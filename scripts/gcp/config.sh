#!/usr/bin/env bash
# Configuración compartida por deploy.sh y destroy.sh.
# Cualquier valor puede sobrescribirse con una variable de entorno, p. ej.:
#   REGION=southamerica-east1 ./scripts/gcp/deploy.sh

# ===== Recursos (deben coincidir con .github/workflows/cd.yml) =====
PROJECT_ID="${PROJECT_ID:-costos-embutidos}"
REGION="${REGION:-us-central1}"
REPO_NAME="${REPO_NAME:-costos-repo}"
BUCKET_NAME="${BUCKET_NAME:-${PROJECT_ID}-data}"
SECRET_NAME="${SECRET_NAME:-jwt-secret}"
BACKEND_SERVICE="${BACKEND_SERVICE:-costos-backend}"
FRONTEND_SERVICE="${FRONTEND_SERVICE:-costos-frontend}"

# ===== GitHub (el CD se desactiva al destruir y se reactiva al desplegar) =====
GITHUB_REPO="${GITHUB_REPO:-gnavarrolema/costos-embutidos}"
CD_WORKFLOW="${CD_WORKFLOW:-cd.yml}"

# ===== Varios =====
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_ROOT="${BACKUP_ROOT:-${REPO_ROOT}/backups/gcp}"
# Versiones de imagen que la política de limpieza de Artifact Registry conserva.
KEEP_IMAGE_VERSIONS="${KEEP_IMAGE_VERSIONS:-3}"

AR_HOST="${REGION}-docker.pkg.dev"
IMAGE_BASE="${AR_HOST}/${PROJECT_ID}/${REPO_NAME}"

# Todas las llamadas a gcloud usan este proyecto sin modificar tu `gcloud config`.
export CLOUDSDK_CORE_PROJECT="${PROJECT_ID}"

# ===== Helpers =====
log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m ✔\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m !\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m ✖\033[0m %s\n' "$*" >&2; exit 1; }

confirm() {
  # confirm "mensaje" -> 0 si el usuario responde s/y. Respeta ASSUME_YES=1.
  [[ "${ASSUME_YES:-0}" == "1" ]] && return 0
  local reply
  read -r -p "$1 [s/N] " reply
  [[ "${reply}" =~ ^[sSyY]$ ]]
}

preflight() {
  command -v gcloud >/dev/null 2>&1 || die "gcloud no está instalado (https://cloud.google.com/sdk/docs/install)."
  local account
  account="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | head -n1)"
  [[ -n "${account}" ]] || die "No hay sesión activa en gcloud. Ejecuta: gcloud auth login"
  PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)' 2>/dev/null)" \
    || die "No se puede acceder al proyecto ${PROJECT_ID} con la cuenta ${account}."
  RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
  BACKEND_URL="https://${BACKEND_SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app"
  FRONTEND_URL="https://${FRONTEND_SERVICE}-${PROJECT_NUMBER}.${REGION}.run.app"
  log "Proyecto: ${PROJECT_ID} (${PROJECT_NUMBER}) | Región: ${REGION} | Cuenta: ${account}"
}

run_service_exists() { gcloud run services describe "$1" --region="${REGION}" >/dev/null 2>&1; }
repo_exists()        { gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" >/dev/null 2>&1; }
bucket_exists()      { gcloud storage buckets describe "gs://$1" >/dev/null 2>&1; }
secret_exists()      { gcloud secrets describe "${SECRET_NAME}" >/dev/null 2>&1; }

# Cuenta objetos reales (ignora marcadores de carpeta "algo/").
bucket_object_count() {
  { gcloud storage ls -r "gs://${BUCKET_NAME}/**" 2>/dev/null || true; } | grep -v '/$' | grep -c . || true
}

gh_workflow() {
  # gh_workflow enable|disable  (best-effort: no falla si gh no está disponible)
  [[ "${SKIP_GH:-0}" == "1" ]] && return 0
  if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
    if gh workflow "$1" "${CD_WORKFLOW}" -R "${GITHUB_REPO}" >/dev/null 2>&1; then
      ok "Workflow ${CD_WORKFLOW} en GitHub: $1d"
    else
      warn "No se pudo ejecutar 'gh workflow $1 ${CD_WORKFLOW}'. Hazlo manualmente en GitHub > Actions."
    fi
  else
    warn "gh CLI no disponible/autenticado: $1 manualmente el workflow '${CD_WORKFLOW}' en GitHub > Actions."
  fi
}

find_python() {
  local py
  for py in python3 python; do
    if command -v "${py}" >/dev/null 2>&1 && "${py}" -c 'import sqlite3' >/dev/null 2>&1; then
      echo "${py}"; return 0
    fi
  done
  return 1
}
