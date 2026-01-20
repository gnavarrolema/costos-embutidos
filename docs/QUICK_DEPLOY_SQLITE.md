# 🚀 Guía Rápida: Despliegue con SQLite + Cloud Storage

**Para aplicaciones de bajo tráfico (< 1,000 req/mes) - Costo: ~$0.07/mes**

---

## ✅ Lo que ya completaste:

- [x] Paso 1: Cuenta de Google Cloud creada
- [x] Paso 2: Proyecto configurado (`costos-embutidos`)
- [x] Paso 3: gcloud CLI instalado y autenticado
- [x] `gcloud config set project costos-embutidos`
- [x] `gcloud config set run/region us-central1`
- [x] Paso 4: **SALTADO** (no necesitas Cloud SQL)

---

## 📋 Próximos Pasos

### Paso 5: Preparar Imágenes Docker (15 min)

#### 5.1 Crear Artifact Registry

```bash
# Crear repositorio para imágenes Docker
gcloud artifacts repositories create costos-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Repositorio de imágenes de Costos Embutidos"

# Configurar Docker para usar Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev
```

#### 5.2 Construir y Subir Backend

```bash
# Ir al directorio del proyecto
cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos

# Configurar Docker para Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev

# Construir imagen del backend
docker build -t us-central1-docker.pkg.dev/costos-embutidos/costos-repo/backend:latest -f backend/Dockerfile backend/

# Subir a Artifact Registry
docker push us-central1-docker.pkg.dev/costos-embutidos/costos-repo/backend:latest
```

**Tiempo estimado**: ~5-10 minutos (dependiendo de tu conexión)

#### 5.3 Construir y Subir Frontend

```bash
# Construir imagen del frontend (sin VITE_API_URL por ahora)
docker build -t us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend:latest -f Dockerfile.frontend .

# Subir a Artifact Registry
docker push us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend:latest
```

#### 5.4 Verificar

```bash
# Ver imágenes subidas
gcloud artifacts docker images list us-central1-docker.pkg.dev/costos-embutidos/costos-repo
```

**Salida esperada**:
```
IMAGE                                                           DIGEST        CREATE_TIME          UPDATE_TIME
us-central1-docker.pkg.dev/costos-embutidos/costos-repo/backend   sha256:xxx    2024-xx-xx xx:xx:xx  2024-xx-xx xx:xx:xx
us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend  sha256:xxx    2024-xx-xx xx:xx:xx  2024-xx-xx xx:xx:xx
```

---

### Paso 6: Desplegar Backend con SQLite Persistente (10 min)

#### 6.1 Crear Bucket de Cloud Storage

```bash
# Crear bucket para persistencia de datos
gsutil mb -p costos-embutidos -l us-central1 gs://costos-embutidos-data

# Crear estructura de carpetas
gsutil -m cp /dev/null gs://costos-embutidos-data/instance/.keep
gsutil -m cp /dev/null gs://costos-embutidos-data/logs/.keep
gsutil -m cp /dev/null gs://costos-embutidos-data/models/.keep

# Configurar permisos
gsutil iam ch serviceAccount:$(gcloud projects describe costos-embutidos --format='value(projectNumber)')-compute@developer.gserviceaccount.com:roles/storage.objectAdmin gs://costos-embutidos-data
```

#### 6.2 Crear Secret para JWT

```bash
# Crear secret con tu clave JWT (CAMBIA ESTE VALOR)
echo -n "tu-clave-jwt-super-secreta-cambia-esto-ahora" | \
    gcloud secrets create jwt-secret --data-file=-

# Dar permisos a Cloud Run
gcloud secrets add-iam-policy-binding jwt-secret \
    --member="serviceAccount:$(gcloud projects describe costos-embutidos --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

> ⚠️ **IMPORTANTE**: Cambia `tu-clave-jwt-super-secreta-cambia-esto-ahora` por una clave aleatoria única. Puedes generarla con:
> ```bash
> python3 -c "import secrets; print(secrets.token_urlsafe(32))"
> ```

#### 6.3 Desplegar el Backend

```bash
gcloud run deploy costos-backend \
    --image=us-central1-docker.pkg.dev/costos-embutidos/costos-repo/backend:latest \
    --platform=managed \
    --region=us-central1 \
    --allow-unauthenticated \
    --port=5000 \
    --memory=512Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=3 \
    --execution-environment=gen2 \
    --add-volume=name=data,type=cloud-storage,bucket=costos-embutidos-data \
    --add-volume-mount=volume=data,mount-path=/app/data \
    --set-env-vars="FLASK_ENV=production,COSTOS_LOG_LEVEL=INFO,SQLALCHEMY_DATABASE_URI=sqlite:////app/data/instance/costos_embutidos.db" \
    --set-secrets="JWT_SECRET_KEY=jwt-secret:latest"
```

**Tiempo estimado**: ~2-3 minutos

**Salida esperada**:
```
Deploying container to Cloud Run service [costos-backend] in project [costos-embutidos] region [us-central1]
✓ Deploying... Done.
  ✓ Creating Revision...
  ✓ Routing traffic...
Done.
Service [costos-backend] revision [costos-backend-00001-xxx] has been deployed and is serving 100 percent of traffic.
Service URL: https://costos-backend-xxxxxxxxxx-uc.a.run.app
```

#### 6.4 GUARDAR LA URL DEL BACKEND

```bash
# Copiar la URL del backend (la necesitas para el siguiente paso)
export BACKEND_URL=$(gcloud run services describe costos-backend --region=us-central1 --format="value(status.url)")
echo "Backend URL: $BACKEND_URL"
```

**Guardar esta URL** - por ejemplo: `https://costos-backend-abc123-uc.a.run.app`

#### 6.5 Verificar que Funciona

```bash
# Probar endpoint de salud
curl $BACKEND_URL/api/health
```

**Respuesta esperada**:
```json
{"status":"healthy","message":"API funcionando correctamente"}
```

✅ Si ves esto, el backend está funcionando correctamente.

---

### Paso 7: Desplegar Frontend (10 min)

#### 7.1 Reconstruir Frontend con URL del Backend

```bash
# REEMPLAZAR con tu URL real del backend
BACKEND_URL="https://costos-backend-xxxxxxxxxx-uc.a.run.app"

# Reconstruir frontend con la variable de entorno
docker build \
    --build-arg VITE_API_URL=$BACKEND_URL \
    -t us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend:latest \
    -f Dockerfile.frontend .

# Subir nueva imagen
docker push us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend:latest
```

#### 7.2 Desplegar Frontend

```bash
gcloud run deploy costos-frontend \
    --image=us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend:latest \
    --platform=managed \
    --region=us-central1 \
    --allow-unauthenticated \
    --port=80 \
    --memory=256Mi \
    --cpu=1 \
    --min-instances=0 \
    --max-instances=3
```

**Salida esperada**:
```
Service URL: https://costos-frontend-xxxxxxxxxx-uc.a.run.app
```

#### 7.3 GUARDAR LA URL DEL FRONTEND

```bash
export FRONTEND_URL=$(gcloud run services describe costos-frontend --region=us-central1 --format="value(status.url)")
echo "Frontend URL: $FRONTEND_URL"
```

#### 7.4 Configurar CORS en el Backend

```bash
# Actualizar backend para permitir requests desde el frontend
gcloud run services update costos-backend \
    --region=us-central1 \
    --update-env-vars="ALLOWED_ORIGINS=$FRONTEND_URL"
```

#### 7.5 ¡Probar la App!

1. Abre tu navegador
2. Ve a la URL del frontend: `https://costos-frontend-xxxxxxxxxx-uc.a.run.app`
3. Deberías ver la aplicación Costos Embutidos funcionando
4. Abre la consola del navegador (F12) para verificar que no hay errores

---

### Paso 8: Configurar CI/CD (15 min)

#### 8.1 Crear Service Account para GitHub Actions

```bash
# Crear cuenta de servicio
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deploy"

# Obtener el email
SA_EMAIL=$(gcloud iam service-accounts list --filter="displayName:GitHub Actions Deploy" --format="value(email)")

# Asignar roles
gcloud projects add-iam-policy-binding costos-embutidos \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding costos-embutidos \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/storage.admin"

gcloud projects add-iam-policy-binding costos-embutidos \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/artifactregistry.writer"

gcloud projects add-iam-policy-binding costos-embutidos \
    --member="serviceAccount:$SA_EMAIL" \
    --role="roles/iam.serviceAccountUser"
```

#### 8.2 Generar Clave JSON

```bash
# Generar clave
gcloud iam service-accounts keys create gcp-key.json \
    --iam-account=$SA_EMAIL

# Ver contenido (para copiar a GitHub)
cat gcp-key.json
```

> ⚠️ **IMPORTANTE**: Copia TODO el contenido del archivo JSON (desde `{` hasta `}`)

#### 8.3 Configurar Secrets en GitHub

1. Ve a: `https://github.com/gnavarrolema/costos-embutidos`
2. **Settings** → **Secrets and variables** → **Actions**
3. Clic en **"New repository secret"**
4. Crear estos 3 secrets:

| Nombre | Valor |
|--------|-------|
| `GCP_PROJECT_ID` | `costos-embutidos` |
| `GCP_SA_KEY` | Pegar TODO el contenido de `gcp-key.json` |
| `GCP_REGION` | `us-central1` |

#### 8.4 Probar el CI/CD

```bash
# Hacer un cambio pequeño y push
cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos
echo "# Test deploy $(date)" >> README.md
git add README.md
git commit -m "Test: Trigger CI/CD deployment"
git push
```

Ve a: `https://github.com/gnavarrolema/costos-embutidos/actions`

Deberías ver el workflow ejecutándose. Tarda ~5-10 minutos.

---

## ✅ Checklist Final

Después de completar todos los pasos:

- [ ] Backend desplegado y respondiendo en `/api/health`
- [ ] Frontend desplegado y mostrando la interfaz
- [ ] CORS configurado (frontend puede llamar al backend)
- [ ] Datos persisten en Cloud Storage bucket
- [ ] CI/CD configurado (push a `main` despliega automáticamente)
- [ ] URLs guardadas:
  - Backend: `https://costos-backend-xxx-uc.a.run.app`
  - Frontend: `https://costos-frontend-xxx-uc.a.run.app`

---

## 🐛 Troubleshooting Rápido

### Backend no responde

```bash
# Ver logs
gcloud run services logs read costos-backend --region=us-central1 --limit=50

# Ver estado del servicio
gcloud run services describe costos-backend --region=us-central1
```

### Frontend muestra error CORS

```bash
# Verificar ALLOWED_ORIGINS
gcloud run services describe costos-backend --region=us-central1 --format="value(spec.template.spec.containers[0].env)"

# Actualizar si es necesario
gcloud run services update costos-backend \
    --region=us-central1 \
    --update-env-vars="ALLOWED_ORIGINS=https://costos-frontend-xxx-uc.a.run.app"
```

### Ver archivos en el bucket

```bash
# Listar contenido del bucket
gsutil ls -r gs://costos-embutidos-data/

# Ver si existe la DB
gsutil ls gs://costos-embutidos-data/instance/costos_embutidos.db
```

### Descargar backup de la DB

```bash
# Crear carpeta local
mkdir -p ~/backups

# Descargar DB
gsutil cp gs://costos-embutidos-data/instance/costos_embutidos.db ~/backups/
```

---

## 📊 Costo Total Estimado

| Servicio | Costo Mensual |
|----------|---------------|
| Cloud Run (200 req/mes) | $0.00 (tier gratuito) |
| Cloud Storage (100 MB) | $0.02 |
| Artifact Registry | $0.05 |
| **TOTAL** | **~$0.07/mes** |

---

## 📚 Documentos Relacionados

- **Guía Completa**: [CLOUD_RUN_DEPLOY_GUIDE.md](CLOUD_RUN_DEPLOY_GUIDE.md)
- **Persistencia SQLite**: [SQLITE_PERSISTENCE.md](SQLITE_PERSISTENCE.md)
- **User Guide**: [../USER_GUIDE.md](../USER_GUIDE.md)

---

**© 2024 Sistema de Costeo de Embutidos** | Guía Rápida SQLite v1.0
