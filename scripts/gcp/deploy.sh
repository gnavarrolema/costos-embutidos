#!/usr/bin/env bash
# Aprovisiona y despliega Costos Embutidos en GCP desde cero (idempotente).
#
#   1. Habilita APIs; crea Artifact Registry (+ política de limpieza), bucket de datos y secret JWT.
#   2. Si el bucket está vacío, restaura el último respaldo de backups/gcp/.
#   3. Construye y sube las imágenes (Docker local o Cloud Build).
#   4. Despliega backend y frontend en Cloud Run (misma configuración que cd.yml).
#   5. Verifica /api/health y reactiva el workflow de CD en GitHub.
#
# Uso: ./scripts/gcp/deploy.sh [opciones]
#   -y, --yes                    No pedir confirmación
#   --restore <dir|latest>       Restaurar un respaldo concreto (aunque el bucket tenga datos)
#   --fresh                      No restaurar nada (base de datos nueva)
#   --build-mode docker|cloudbuild   Por defecto: docker si el daemon responde, si no cloudbuild
#   --skip-build                 Desplegar las imágenes :latest ya existentes
#   --no-gh                      No tocar el workflow de GitHub
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

RESTORE=""
FRESH=0
BUILD_MODE="${BUILD_MODE:-auto}"
SKIP_BUILD=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)     ASSUME_YES=1 ;;
    --restore)    RESTORE="${2:?--restore requiere un directorio o 'latest'}"; shift ;;
    --fresh)      FRESH=1 ;;
    --build-mode) BUILD_MODE="${2:?--build-mode requiere docker|cloudbuild}"; shift ;;
    --skip-build) SKIP_BUILD=1 ;;
    --no-gh)      SKIP_GH=1 ;;
    -h|--help)    sed -n '2,19p' "$0"; exit 0 ;;
    *) die "Opción desconocida: $1" ;;
  esac
  shift
done
[[ -n "${RESTORE}" && "${FRESH}" == "1" ]] && die "--restore y --fresh son excluyentes."

preflight

if [[ "${BUILD_MODE}" == "auto" ]]; then
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then BUILD_MODE=docker; else BUILD_MODE=cloudbuild; fi
fi
[[ "${SKIP_BUILD}" == "1" || "${BUILD_MODE}" =~ ^(docker|cloudbuild)$ ]] || die "--build-mode inválido: ${BUILD_MODE}"

TAG="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo manual)"
if [[ -n "$(git -C "${REPO_ROOT}" status --porcelain 2>/dev/null)" ]]; then
  TAG="${TAG}-dirty-$(date +%Y%m%d%H%M%S)"
  warn "Hay cambios sin commitear: se desplegará el working tree con tag ${TAG}"
fi

# ---------- 1. Infraestructura base ----------
log "Habilitando APIs"
APIS=(run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
      storage.googleapis.com iamcredentials.googleapis.com)
[[ "${BUILD_MODE}" == "cloudbuild" ]] && APIS+=(cloudbuild.googleapis.com)
gcloud services enable "${APIS[@]}"
ok "APIs habilitadas"

if ! repo_exists; then
  log "Creando repositorio Artifact Registry ${REPO_NAME}"
  gcloud artifacts repositories create "${REPO_NAME}" --repository-format=docker \
    --location="${REGION}" --description="Docker images for Costos Embutidos"
fi
# Cada push a main sube ~1 GB de imágenes; sin limpieza el almacenamiento crece sin límite.
POLICY_FILE="$(mktemp)"
cat > "${POLICY_FILE}" <<EOF
[
  {"name": "keep-recent", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": ${KEEP_IMAGE_VERSIONS}}},
  {"name": "delete-old",  "action": {"type": "Delete"}, "condition": {"tagState": "ANY", "olderThan": "1d"}}
]
EOF
gcloud artifacts repositories set-cleanup-policies "${REPO_NAME}" --location="${REGION}" \
  --policy="${POLICY_FILE}" --no-dry-run >/dev/null
rm -f "${POLICY_FILE}"
ok "Artifact Registry listo (conserva las últimas ${KEEP_IMAGE_VERSIONS} versiones)"

BUCKET_IS_NEW=0
if ! bucket_exists "${BUCKET_NAME}"; then
  log "Creando bucket gs://${BUCKET_NAME}"
  gcloud storage buckets create "gs://${BUCKET_NAME}" --location="${REGION}" \
    --uniform-bucket-level-access --public-access-prevention
  BUCKET_IS_NEW=1
fi
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/storage.objectAdmin" >/dev/null
ok "Bucket de datos listo"

if ! secret_exists; then
  log "Creando secret ${SECRET_NAME} (JWT nuevo)"
  gcloud secrets create "${SECRET_NAME}" --replication-policy=automatic
  openssl rand -hex 32 | tr -d '\n' | gcloud secrets versions add "${SECRET_NAME}" --data-file=- >/dev/null
fi
gcloud secrets add-iam-policy-binding "${SECRET_NAME}" \
  --member="serviceAccount:${RUNTIME_SA}" --role="roles/secretmanager.secretAccessor" >/dev/null
ok "Secret listo"

# ---------- 2. Restaurar datos ----------
resolve_backup() {
  if [[ "$1" == "latest" ]]; then
    [[ -f "${BACKUP_ROOT}/LATEST" ]] || return 1
    echo "${BACKUP_ROOT}/$(cat "${BACKUP_ROOT}/LATEST")"
  else
    echo "$1"
  fi
}

TARGET_BACKUP=""
if [[ -n "${RESTORE}" ]]; then
  TARGET_BACKUP="$(resolve_backup "${RESTORE}")" || die "No se encontró respaldo '${RESTORE}'."
  if [[ "$(bucket_object_count)" -gt 0 ]]; then
    confirm "gs://${BUCKET_NAME} ya contiene datos y serán SOBRESCRITOS con ${TARGET_BACKUP}. ¿Continuar?" \
      || die "Cancelado."
  fi
elif [[ "${FRESH}" == "0" && ( "${BUCKET_IS_NEW}" == "1" || "$(bucket_object_count)" == "0" ) ]]; then
  if TARGET_BACKUP="$(resolve_backup latest)"; then
    log "Bucket vacío: se restaurará el último respaldo (${TARGET_BACKUP}). Usa --fresh para evitarlo."
  else
    warn "Bucket vacío y sin respaldos en ${BACKUP_ROOT}: la app arrancará con una base de datos nueva."
    TARGET_BACKUP=""
  fi
fi

if [[ -n "${TARGET_BACKUP}" ]]; then
  [[ -d "${TARGET_BACKUP}/data" ]] || die "El respaldo ${TARGET_BACKUP} no tiene carpeta data/."
  if [[ -f "${TARGET_BACKUP}/SHA256SUMS" ]]; then
    (cd "${TARGET_BACKUP}/data" && sha256sum --quiet -c ../SHA256SUMS) || die "Checksums del respaldo no coinciden."
    ok "Checksums del respaldo verificados"
  fi
  gcloud storage rsync -r "${TARGET_BACKUP}/data" "gs://${BUCKET_NAME}"
  ok "Datos restaurados en gs://${BUCKET_NAME}"
fi

# ---------- 3. Imágenes ----------
BACKEND_IMAGE="${IMAGE_BASE}/backend:${TAG}"
FRONTEND_IMAGE="${IMAGE_BASE}/frontend:${TAG}"
if [[ "${SKIP_BUILD}" == "1" ]]; then
  BACKEND_IMAGE="${IMAGE_BASE}/backend:latest"
  FRONTEND_IMAGE="${IMAGE_BASE}/frontend:latest"
  log "Omitiendo build: se usarán las imágenes :latest"
elif [[ "${BUILD_MODE}" == "docker" ]]; then
  log "Construyendo imágenes con Docker local (tag ${TAG})"
  gcloud auth configure-docker "${AR_HOST}" --quiet >/dev/null
  docker build --platform linux/amd64 -t "${BACKEND_IMAGE}" -t "${IMAGE_BASE}/backend:latest" \
    -f "${REPO_ROOT}/backend/Dockerfile" "${REPO_ROOT}/backend"
  docker build --platform linux/amd64 --build-arg "VITE_API_URL=${BACKEND_URL}" \
    -t "${FRONTEND_IMAGE}" -t "${IMAGE_BASE}/frontend:latest" \
    -f "${REPO_ROOT}/Dockerfile.frontend" "${REPO_ROOT}"
  for img in "${BACKEND_IMAGE}" "${IMAGE_BASE}/backend:latest" "${FRONTEND_IMAGE}" "${IMAGE_BASE}/frontend:latest"; do
    docker push "${img}"
  done
else
  log "Construyendo imágenes con Cloud Build (tag ${TAG})"
  # En proyectos nuevos Cloud Build ejecuta con la SA de Compute: necesita este rol.
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/cloudbuild.builds.builder" --condition=None --quiet >/dev/null
  gcloud builds submit "${REPO_ROOT}" --config="${REPO_ROOT}/scripts/gcp/cloudbuild.yaml" \
    --substitutions="_IMAGE_BASE=${IMAGE_BASE},_TAG=${TAG},_API_URL=${BACKEND_URL}"
fi
ok "Imágenes disponibles en ${IMAGE_BASE}"

# ---------- 4. Cloud Run ----------
log "Desplegando ${BACKEND_SERVICE}"
gcloud run deploy "${BACKEND_SERVICE}" \
  --image="${BACKEND_IMAGE}" \
  --region="${REGION}" \
  --allow-unauthenticated \
  --port=5000 \
  --memory=512Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --execution-environment=gen2 \
  --add-volume="name=data,type=cloud-storage,bucket=${BUCKET_NAME}" \
  --add-volume-mount="volume=data,mount-path=/app/data" \
  --set-env-vars="FLASK_ENV=production,COSTOS_LOG_LEVEL=INFO,SQLALCHEMY_DATABASE_URI=sqlite:////app/data/instance/costos_embutidos.db,ALLOWED_ORIGINS=${FRONTEND_URL}" \
  --set-secrets="JWT_SECRET_KEY=${SECRET_NAME}:latest" \
  --quiet

log "Desplegando ${FRONTEND_SERVICE}"
gcloud run deploy "${FRONTEND_SERVICE}" \
  --image="${FRONTEND_IMAGE}" \
  --region="${REGION}" \
  --allow-unauthenticated \
  --port=80 \
  --memory=256Mi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --quiet

# ---------- 5. Verificación ----------
log "Verificando salud de los servicios (el primer arranque puede tardar)"
curl -fsS --retry 6 --retry-delay 10 --retry-all-errors --max-time 60 "${BACKEND_URL}/api/health" >/dev/null \
  && ok "Backend OK: ${BACKEND_URL}/api/health" \
  || warn "El backend no respondió. Revisa: gcloud run services logs read ${BACKEND_SERVICE} --region=${REGION}"
curl -fsS --retry 3 --retry-delay 5 --retry-all-errors --max-time 30 "${FRONTEND_URL}/health" >/dev/null \
  && ok "Frontend OK: ${FRONTEND_URL}" \
  || warn "El frontend no respondió en ${FRONTEND_URL}/health"

log "Reactivando CD en GitHub"
gh_workflow enable

cat <<EOF

✅ Despliegue completo (tag ${TAG})
   Frontend: ${FRONTEND_URL}
   Backend:  ${BACKEND_URL}
   Pausar:   ./scripts/gcp/destroy.sh
EOF
