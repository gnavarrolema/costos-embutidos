#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="costos-embutidos"
REGION="us-central1"
REPO_NAME="costos-repo"
BUCKET_NAME="${PROJECT_ID}-data"
SECRET_NAME="jwt-secret"

gcloud config set project "${PROJECT_ID}" >/dev/null

# Enable required APIs
for API in run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com iamcredentials.googleapis.com cloudbuild.googleapis.com storage.googleapis.com; do
  gcloud services enable "$API" --project="${PROJECT_ID}" >/dev/null
done

# Artifact Registry repo
if ! gcloud artifacts repositories describe "${REPO_NAME}" --location="${REGION}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Docker images for Costos Embutidos" \
    --project="${PROJECT_ID}" >/dev/null
fi

# Storage bucket for data volume
if ! gcloud storage buckets describe "gs://${BUCKET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET_NAME}" \
    --project="${PROJECT_ID}" \
    --location="${REGION}" \
    --uniform-bucket-level-access >/dev/null
fi

# Secret Manager secret for JWT
if ! gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud secrets create "${SECRET_NAME}" --replication-policy="automatic" --project="${PROJECT_ID}" >/dev/null
  openssl rand -hex 32 | gcloud secrets versions add "${SECRET_NAME}" --data-file=- --project="${PROJECT_ID}" >/dev/null
fi

echo "---RUNTIME-READY---"
echo "PROJECT=${PROJECT_ID}"
echo "REGION=${REGION}"
echo "REPO=${REPO_NAME}"
echo "BUCKET=${BUCKET_NAME}"
echo "SECRET=${SECRET_NAME}"
