#!/usr/bin/env bash
# Desaprovisiona Costos Embutidos en GCP para llevar el costo a ~$0.
#
# Orden (pensado para no perder datos):
#   1. Desactiva el workflow de CD en GitHub (un push no debe recrear nada a medias).
#   2. Elimina los servicios de Cloud Run (se detienen las escrituras a SQLite).
#   3. Respalda el bucket de datos en backups/gcp/<fecha>/ y VERIFICA el respaldo.
#   4. Solo si el respaldo es válido: elimina bucket, imágenes, secret y buckets de Cloud Build.
#
# Se conservan (costo $0): APIs habilitadas, service account github-actions y Workload Identity.
#
# Uso: ./scripts/gcp/destroy.sh [opciones]
#   -y, --yes        No pedir confirmación
#   --keep-data      No borrar el bucket de datos (sigue respaldándose). <5 GB en us-central1 = free tier
#   --keep-images    No borrar el repositorio de Artifact Registry
#   --no-gh          No tocar el workflow de GitHub
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/config.sh"

KEEP_DATA=0
KEEP_IMAGES=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -y|--yes)      ASSUME_YES=1 ;;
    --keep-data)   KEEP_DATA=1 ;;
    --keep-images) KEEP_IMAGES=1 ;;
    --no-gh)       SKIP_GH=1 ;;
    -h|--help)     sed -n '2,20p' "$0"; exit 0 ;;
    *) die "Opción desconocida: $1" ;;
  esac
  shift
done

preflight

cat <<EOF

Se ELIMINARÁN estos recursos del proyecto ${PROJECT_ID}:
  - Cloud Run:          ${BACKEND_SERVICE}, ${FRONTEND_SERVICE}
  - Bucket de datos:    gs://${BUCKET_NAME} $([[ ${KEEP_DATA} == 1 ]] && echo '(SE CONSERVA)' || echo '(tras respaldo verificado)')
  - Artifact Registry:  ${REPO_NAME} $([[ ${KEEP_IMAGES} == 1 ]] && echo '(SE CONSERVA)')
  - Secret Manager:     ${SECRET_NAME} (se regenera al desplegar; los usuarios deberán volver a iniciar sesión)
  - Cloud Build:        gs://${PROJECT_ID}_cloudbuild (si existe)
Respaldo local en:      ${BACKUP_ROOT}/

EOF
if [[ "${ASSUME_YES:-0}" != "1" ]]; then
  read -r -p "Escribe el ID del proyecto (${PROJECT_ID}) para continuar: " answer
  [[ "${answer}" == "${PROJECT_ID}" ]] || die "Cancelado."
fi

# ---------- 1. GitHub CD ----------
log "Desactivando CD en GitHub"
gh_workflow disable

# ---------- 2. Cloud Run ----------
for svc in "${FRONTEND_SERVICE}" "${BACKEND_SERVICE}"; do
  if run_service_exists "${svc}"; then
    log "Eliminando servicio Cloud Run ${svc}"
    gcloud run services delete "${svc}" --region="${REGION}" --quiet
    ok "${svc} eliminado"
  else
    ok "${svc} no existe (nada que hacer)"
  fi
done

# ---------- 3. Respaldo verificado ----------
if bucket_exists "${BUCKET_NAME}"; then
  STAMP="$(date +%Y%m%d-%H%M%S)"
  BACKUP_DIR="${BACKUP_ROOT}/${STAMP}"
  mkdir -p "${BACKUP_DIR}/data"
  log "Respaldando gs://${BUCKET_NAME} -> ${BACKUP_DIR}/data"

  gcloud storage ls -l -r "gs://${BUCKET_NAME}/**" > "${BACKUP_DIR}/manifest-remote.txt" 2>/dev/null || true
  REMOTE_COUNT="$(bucket_object_count)"
  gcloud storage rsync -r "gs://${BUCKET_NAME}" "${BACKUP_DIR}/data"
  LOCAL_COUNT="$(find "${BACKUP_DIR}/data" -type f | wc -l | tr -d ' ')"

  [[ "${LOCAL_COUNT}" -ge "${REMOTE_COUNT}" ]] \
    || die "Respaldo incompleto: ${LOCAL_COUNT}/${REMOTE_COUNT} archivos. NO se borró el bucket."
  ok "Archivos respaldados: ${LOCAL_COUNT}/${REMOTE_COUNT}"

  # Verificar integridad de cada base SQLite respaldada.
  mapfile -t DBS < <(find "${BACKUP_DIR}/data" -type f \( -name '*.db' -o -name '*.sqlite3' \))
  if [[ ${#DBS[@]} -gt 0 ]]; then
    if PY="$(find_python)"; then
      for db in "${DBS[@]}"; do
        result="$("${PY}" - "${db}" <<'PY' || true
import sqlite3, sys
try:
    print(sqlite3.connect(sys.argv[1]).execute("PRAGMA integrity_check").fetchone()[0])
except Exception as exc:
    print(f"error: {exc}")
PY
)"
        [[ "${result}" == "ok" ]] || die "integrity_check falló en ${db}: ${result}. NO se borró el bucket."
        ok "SQLite OK: ${db#"${BACKUP_DIR}/"}"
      done
    else
      warn "Python no disponible: se omite PRAGMA integrity_check."
      confirm "¿Continuar sin verificar la integridad de SQLite?" || die "Cancelado. El bucket sigue intacto."
    fi
  elif [[ "${KEEP_DATA}" == "0" ]]; then
    warn "El respaldo no contiene ninguna base SQLite (*.db)."
    confirm "¿Borrar el bucket de todos modos?" || die "Cancelado. El bucket sigue intacto."
  fi

  # Archivo portable + checksums para copiar fuera de esta máquina.
  (cd "${BACKUP_DIR}/data" && find . -type f -print0 | xargs -0 -r sha256sum) > "${BACKUP_DIR}/SHA256SUMS"
  tar -czf "${BACKUP_ROOT}/costos-embutidos-data-${STAMP}.tar.gz" -C "${BACKUP_DIR}" data SHA256SUMS
  echo "${STAMP}" > "${BACKUP_ROOT}/LATEST"
  ok "Respaldo listo: ${BACKUP_ROOT}/costos-embutidos-data-${STAMP}.tar.gz"

  if [[ "${KEEP_DATA}" == "0" ]]; then
    log "Eliminando bucket gs://${BUCKET_NAME}"
    # Sin soft delete: los objetos borrados no se siguen facturando durante 7 días.
    gcloud storage buckets update "gs://${BUCKET_NAME}" --clear-soft-delete >/dev/null 2>&1 || true
    gcloud storage rm -r "gs://${BUCKET_NAME}" --quiet
    ok "Bucket eliminado"
  fi
else
  ok "El bucket gs://${BUCKET_NAME} no existe (nada que respaldar)"
fi

# ---------- 4. Resto de recursos ----------
if [[ "${KEEP_IMAGES}" == "0" ]] && repo_exists; then
  log "Eliminando repositorio de Artifact Registry ${REPO_NAME} (todas las imágenes)"
  gcloud artifacts repositories delete "${REPO_NAME}" --location="${REGION}" --quiet
  ok "Repositorio eliminado"
fi

if secret_exists; then
  log "Eliminando secret ${SECRET_NAME}"
  gcloud secrets delete "${SECRET_NAME}" --quiet
  ok "Secret eliminado"
fi

for b in "${PROJECT_ID}_cloudbuild" "${PROJECT_ID}_${REGION}_cloudbuild"; do
  if bucket_exists "${b}"; then
    log "Eliminando bucket de Cloud Build gs://${b}"
    gcloud storage rm -r "gs://${b}" --quiet
  fi
done

# ---------- 5. Inventario final ----------
log "Inventario restante (debería estar vacío salvo lo que decidiste conservar):"
echo "  Cloud Run:";         gcloud run services list --region="${REGION}" --format='value(metadata.name)' | sed 's/^/    - /'
echo "  Artifact Registry:"; gcloud artifacts repositories list --location="${REGION}" --format='value(name)' 2>/dev/null | sed 's/^/    - /'
echo "  Buckets:";           gcloud storage buckets list --format='value(name)' | sed 's/^/    - /'
echo "  Secrets:";           gcloud secrets list --format='value(name)' | sed 's/^/    - /'

cat <<EOF

✅ Aplicación desaprovisionada.
   Respaldo:  ${BACKUP_ROOT}/  (cópialo también fuera de esta máquina)
   Reanudar:  ./scripts/gcp/deploy.sh   (restaura automáticamente el último respaldo)
EOF
