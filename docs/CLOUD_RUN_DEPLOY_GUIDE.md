# 🚀 Guía de Despliegue en Google Cloud Run

Esta guía **super detallada** te enseñará paso a paso cómo desplegar la aplicación **Costos Embutidos** en Google Cloud Run, desde cero y sin conocimientos previos de Google Cloud.

---

## 📋 Índice

1. [¿Qué es Google Cloud Run?](#-qué-es-google-cloud-run)
2. [Requisitos Previos](#-requisitos-previos)
3. [Crear Cuenta de Google Cloud](#-paso-1-crear-cuenta-de-google-cloud)
4. [Configurar el Proyecto](#-paso-2-configurar-el-proyecto-en-google-cloud)
5. [Instalar Google Cloud CLI](#-paso-3-instalar-google-cloud-cli-gcloud)
6. [Configurar Base de Datos](#-paso-4-configurar-base-de-datos-cloud-sql)
7. [Preparar las Imágenes Docker](#-paso-5-preparar-las-imágenes-docker)
8. [Desplegar el Backend](#-paso-6-desplegar-el-backend-en-cloud-run)
9. [Desplegar el Frontend](#-paso-7-desplegar-el-frontend-en-cloud-run)
10. [Configurar CI/CD con GitHub Actions](#-paso-8-configurar-cicd-con-github-actions)
11. [Monitoreo y Logs](#-paso-9-monitoreo-y-logs)
12. [Costos y Límites](#-costos-y-límites-del-tier-gratuito)
13. [Troubleshooting](#-troubleshooting)

---

## 📖 ¿Qué es Google Cloud Run?

**Google Cloud Run** es un servicio serverless que ejecuta contenedores Docker de forma automática. Sus ventajas:

✅ **Serverless**: No administras servidores  
✅ **Escala automáticamente**: De 0 a miles de instancias  
✅ **Pago por uso**: Solo pagas cuando se ejecuta tu código  
✅ **Tier gratuito generoso**: ~2 millones de requests/mes gratis  
✅ **Integración con Google Cloud**: Fácil conexión con Cloud SQL, Storage, etc.

---

## 📋 Requisitos Previos

Antes de comenzar, necesitas:

- ✅ **Cuenta de Google** (Gmail)
- ✅ **Tarjeta de crédito/débito** (Google requiere verificación, pero NO se cobra en el tier gratuito)
- ✅ **Git instalado** en tu sistema
- ✅ **Docker Desktop** instalado y funcionando
- ✅ **WSL Ubuntu 22.04** (para comandos de terminal)
- ✅ Tu código subido a **GitHub**

---

## 🌐 Paso 1: Crear Cuenta de Google Cloud

### 1.1 Registrarse en Google Cloud

1. Abre tu navegador y ve a: **[https://cloud.google.com](https://cloud.google.com)**

2. Haz clic en el botón **"Comenzar gratis"** o **"Get started for free"**

3. Inicia sesión con tu cuenta de Google (Gmail)

4. Completa el formulario de registro:
   - **País**: Selecciona tu país
   - **Tipo de cuenta**: Personal o Empresa (para uso personal, elige Personal)
   - **Acepta los términos de servicio**

5. **Verificación de tarjeta**: 
   - Ingresa los datos de una tarjeta de crédito/débito válida
   - Google hace un cargo temporal de $1 USD (se revierte inmediatamente)
   - ⚠️ **NO se cobra nada** mientras estés en el tier gratuito

### 1.2 Activar el Crédito Gratuito

Google Cloud ofrece:
- **$300 USD de crédito** para usar en 90 días (nuevos usuarios)
- **Tier gratuito permanente** con límites mensuales

> 💡 **Importante**: Los $300 son más que suficientes para meses de desarrollo y pruebas.

---

## ⚙️ Paso 2: Configurar el Proyecto en Google Cloud

### 2.1 Crear un Proyecto Nuevo

1. Ve a la **[Consola de Google Cloud](https://console.cloud.google.com)**

2. En la barra superior, haz clic en el selector de proyectos (puede decir "My First Project" o similar)

3. Haz clic en **"NUEVO PROYECTO"** (NEW PROJECT)

4. Completa los campos:
   ```
   Nombre del proyecto: costos-embutidos
   ID del proyecto: costos-embutidos-xxxxx (auto-generado, puedes editarlo)
   Organización: Sin organización (para uso personal)
   Ubicación: Sin organización
   ```

5. Haz clic en **"CREAR"**

6. Espera unos segundos hasta que aparezca la notificación de que el proyecto fue creado

7. **Selecciona el proyecto**: Haz clic en el selector de proyectos y elige `costos-embutidos`

### 2.2 Habilitar las APIs Necesarias

Para usar Cloud Run, necesitas habilitar varias APIs. Sigue estos pasos:

1. En la consola de Google Cloud, usa la barra de búsqueda superior

2. Busca y habilita cada una de estas APIs:

   **API 1: Cloud Run Admin API**
   - Busca: "Cloud Run Admin API"
   - Haz clic en el resultado
   - Haz clic en **"HABILITAR"** (ENABLE)

   **API 2: Container Registry API**
   - Busca: "Container Registry API"
   - Haz clic en **"HABILITAR"**

   **API 3: Cloud Build API**
   - Busca: "Cloud Build API"
   - Haz clic en **"HABILITAR"**

   **API 4: Artifact Registry API**
   - Busca: "Artifact Registry API"
   - Haz clic en **"HABILITAR"**

   **API 5: Secret Manager API** (para variables de entorno seguras)
   - Busca: "Secret Manager API"
   - Haz clic en **"HABILITAR"**

> 💡 **Atajo**: Puedes habilitar múltiples APIs desde el **API Library** (Biblioteca de APIs)

### 2.3 Verificar APIs Habilitadas

1. Ve a **APIs y servicios** → **APIs habilitadas**
2. Confirma que todas las APIs listadas arriba estén habilitadas

---

## 🖥️ Paso 3: Instalar Google Cloud CLI (gcloud)

### 3.1 Instalar en WSL Ubuntu 22.04

Abre tu terminal WSL Ubuntu y ejecuta estos comandos:

```bash
# 1. Agregar la clave GPG de Google Cloud
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg

# 2. Agregar el repositorio de Google Cloud SDK
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list

# 3. Actualizar e instalar
sudo apt-get update
sudo apt-get install -y google-cloud-cli

# 4. Verificar la instalación
gcloud --version
```

**Salida esperada:**
```
Google Cloud SDK 4xx.x.x
bq 2.x.x
core 2024.xx.xx
gcloud-crc32c 1.x.x
gsutil 5.x
```

### 3.2 Autenticarse en Google Cloud

```bash
# Iniciar sesión (se abrirá el navegador)
gcloud auth login
```

1. Se abrirá tu navegador automáticamente
2. Selecciona tu cuenta de Google
3. Autoriza el acceso a Google Cloud SDK
4. Copia el código de autorización si lo solicita
5. Verás el mensaje: **"You are now logged in"**

### 3.3 Configurar el Proyecto por Defecto

```bash
# Configurar el proyecto (reemplaza con tu ID de proyecto)
gcloud config set project costos-embutidos

# Verificar configuración
gcloud config list
```

**Salida esperada:**
```
[core]
account = tu-email@gmail.com
project = costos-embutidos
```

### 3.4 Configurar la Región por Defecto

```bash
# Establecer la región para Cloud Run (us-central1 tiene buen tier gratuito)
gcloud config set run/region us-central1
```

> 💡 **Regiones recomendadas**:
> - `us-central1` - Iowa, USA (mejor tier gratuito)
> - `southamerica-east1` - São Paulo, Brasil (menor latencia para LATAM)

> ℹ️ **Nota**: El comando `gcloud config set compute/region` solo es necesario si vas a usar Cloud SQL. Si usas SQLite + Cloud Storage (recomendado para tu caso), **no lo necesitas**.

---

## 🗄️ Paso 4: Configurar Base de Datos

> 💡 **Para tu caso (200 req/mes)**: **Puedes SALTARTE este paso completamente**. Vas a usar SQLite + Cloud Storage (configurado en el Paso 6), que es gratis y más que suficiente.

---

### ⚠️ Cloud SQL PostgreSQL (Solo para Alto Tráfico)

**Solo necesitas esto si tienes > 10,000 req/mes** o múltiples instancias concurrentes.

<details>
<summary><b>Click aquí para ver instrucciones de Cloud SQL (OPCIONAL)</b></summary>

#### 4.1 Crear Instancia de Cloud SQL

```bash
# Habilitar la API de Cloud SQL
gcloud services enable sqladmin.googleapis.com

# Crear la instancia PostgreSQL (puede tomar 5-10 minutos)
gcloud sql instances create costos-db \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1 \
    --storage-size=10GB \
    --storage-auto-increase \
    --availability-type=zonal
```

> ⚠️ **Costo**: `db-f1-micro` cuesta ~$7-10/mes (no incluido en tier gratuito)

#### 4.2 Configurar Usuario y Base de Datos

```bash
# Establecer contraseña del usuario postgres
gcloud sql users set-password postgres \
    --instance=costos-db \
    --password=TuPasswordSeguro123!

# Crear la base de datos
gcloud sql databases create costos_embutidos --instance=costos-db
```

#### 4.3 Obtener la Conexión

```bash
# Ver información de conexión
gcloud sql instances describe costos-db --format="value(connectionName)"
```

**Guarda este valor** para usar en el Paso 6, Opción C.

</details>

---

**Continúa con el Paso 5** →

---

## 🐳 Paso 5: Preparar las Imágenes Docker

### 5.1 Configurar Artifact Registry

Artifact Registry es donde almacenaremos nuestras imágenes Docker.

```bash
# Crear repositorio de contenedores
gcloud artifacts repositories create costos-repo \
    --repository-format=docker \
    --location=us-central1 \
    --description="Repositorio de imágenes de Costos Embutidos"

# Configurar Docker para usar Artifact Registry
gcloud auth configure-docker us-central1-docker.pkg.dev
```

### 5.2 Construir y Subir Imagen del Backend

Navega al directorio del proyecto y ejecuta:

```bash
# Ir al directorio del proyecto
cd /mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos

# Construir la imagen del backend
docker build -t us-central1-docker.pkg.dev/costos-embutidos/costos-repo/backend:latest -f backend/Dockerfile backend/

# Subir la imagen a Artifact Registry
docker push us-central1-docker.pkg.dev/costos-embutidos/costos-repo/backend:latest
```

### 5.3 Construir y Subir Imagen del Frontend

```bash
# Construir la imagen del frontend
docker build -t us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend:latest -f Dockerfile.frontend .

# Subir la imagen a Artifact Registry
docker push us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend:latest
```

### 5.4 Verificar las Imágenes

```bash
# Listar imágenes en el repositorio
gcloud artifacts docker images list us-central1-docker.pkg.dev/costos-embutidos/costos-repo
```

---

## 🚀 Paso 6: Desplegar el Backend en Cloud Run

### 6.1 Crear Bucket para Persistencia de SQLite

**¿Por qué?** Cloud Run es stateless, el sistema de archivos se resetea en cada deploy. Para persistir la base de datos SQLite, usamos Cloud Storage:

```bash
# Crear bucket para datos persistentes
gsutil mb -p costos-embutidos -l us-central1 gs://costos-embutidos-data

# Crear estructura de carpetas
gsutil -m cp /dev/null gs://costos-embutidos-data/instance/.keep
gsutil -m cp /dev/null gs://costos-embutidos-data/logs/.keep
gsutil -m cp /dev/null gs://costos-embutidos-data/models/.keep

# Configurar permisos (el servicio Cloud Run necesita acceso)
# El servicio por defecto usa la Compute Engine default service account
gsutil iam ch serviceAccount:$(gcloud projects describe costos-embutidos --format='value(projectNumber)')-compute@developer.gserviceaccount.com:roles/storage.objectAdmin gs://costos-embutidos-data
```

**Costo estimado**: ~$0.02/mes para almacenar 100 MB de datos

### 6.2 Crear Secrets para Variables de Entorno

Primero, guardamos las variables sensibles como secrets:

```bash
# Crear secret para JWT
echo -n "tu-clave-jwt-super-secreta-cambia-esto" | \
    gcloud secrets create jwt-secret --data-file=-

# Dar permisos a Cloud Run para leer el secret
gcloud secrets add-iam-policy-binding jwt-secret \
    --member="serviceAccount:$(gcloud projects describe costos-embutidos --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"
```

### 6.3 Desplegar el Backend con Persistencia

#### Opción A: Con SQLite + Cloud Storage (Recomendado - Casi Gratis)

**Ventajas**: Costo casi nulo (~$0.02/mes), simple, suficiente para 200 req/mes

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

**📝 Explicación de los parámetros nuevos**:
- `--execution-environment=gen2`: Requerido para volúmenes (segunda generación de Cloud Run)
- `--add-volume`: Monta el bucket `costos-embutidos-data` como volumen
- `--add-volume-mount`: Monta el volumen en `/app/data` dentro del contenedor
- `SQLALCHEMY_DATABASE_URI`: Apunta SQLite a la ruta persistente `/app/data/instance/costos_embutidos.db`

**⚠️ Notas importantes**:
- Los datos ahora persisten entre deploys y reinicios
- La primera solicitud después de inactividad puede tardar ~3-5 segundos (cold start + montaje)
- Los logs también se guardarán en `/app/data/logs/` (persistentes)
- Los modelos ML se guardan en `/app/data/models/` (persistentes)

#### Opción B: SQLite Sin Persistencia (Solo para Testing)

**Solo si los datos NO son críticos**:

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
    --set-env-vars="FLASK_ENV=production,COSTOS_LOG_LEVEL=INFO" \
    --set-secrets="JWT_SECRET_KEY=jwt-secret:latest"
```

⚠️ **Datos se perderán en cada nuevo deploy**

#### Opción C: Con Cloud SQL PostgreSQL (Solo para Alto Tráfico)

**Solo considerar si tienes > 10,000 req/mes** - Costo: ~$7-9/mes

```bash
# Primero, crear el secret de la base de datos
echo -n "postgresql://postgres:TuPasswordSeguro123!@/costos_embutidos?host=/cloudsql/costos-embutidos:us-central1:costos-db" | \
    gcloud secrets create database-url --data-file=-

# Dar permisos
gcloud secrets add-iam-policy-binding database-url \
    --member="serviceAccount:$(gcloud projects describe costos-embutidos --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
    --role="roles/secretmanager.secretAccessor"

# Desplegar con Cloud SQL
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
    --add-cloudsql-instances=costos-embutidos:us-central1:costos-db \
    --set-env-vars="FLASK_ENV=production,COSTOS_LOG_LEVEL=INFO" \
    --set-secrets="JWT_SECRET_KEY=jwt-secret:latest,DATABASE_URL=database-url:latest"
```

### 6.3 Obtener la URL del Backend

Después del despliegue, verás un mensaje como:

```
Service [costos-backend] revision [costos-backend-00001-xxx] has been deployed
Service URL: https://costos-backend-xxxxxxxxxx-uc.a.run.app
```

**Guarda esta URL**, la necesitarás para el frontend.

### 6.4 Verificar el Backend

```bash
# Probar el endpoint de salud
curl https://costos-backend-xxxxxxxxxx-uc.a.run.app/api/health
```

**Respuesta esperada:**
```json
{"status":"healthy","message":"API funcionando correctamente"}
```

---

## 🌐 Paso 7: Desplegar el Frontend en Cloud Run

### 7.1 Actualizar la Configuración del Frontend

Antes de desplegar, necesitas configurar la URL del backend. Crea un archivo de variables de entorno para el build:

```bash
# En el directorio del proyecto
echo "VITE_API_URL=https://costos-backend-xxxxxxxxxx-uc.a.run.app" > .env.production
```

### 7.2 Reconstruir el Frontend con la URL Correcta

```bash
# Reconstruir con la variable de entorno
docker build \
    --build-arg VITE_API_URL=https://costos-backend-xxxxxxxxxx-uc.a.run.app \
    -t us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend:latest \
    -f Dockerfile.frontend .

# Subir la nueva imagen
docker push us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend:latest
```

### 7.3 Desplegar el Frontend

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

### 7.4 Configurar CORS en el Backend

Actualiza el backend para permitir requests desde el frontend:

```bash
# Actualizar el servicio backend con la URL del frontend
gcloud run services update costos-backend \
    --region=us-central1 \
    --update-env-vars="ALLOWED_ORIGINS=https://costos-frontend-xxxxxxxxxx-uc.a.run.app"
```

### 7.5 Verificar el Despliegue Completo

1. Abre tu navegador
2. Ve a la URL del frontend: `https://costos-frontend-xxxxxxxxxx-uc.a.run.app`
3. Deberías ver la interfaz de Costos Embutidos
4. Verifica que puedas navegar y que no haya errores en la consola (F12)

---

## 🔄 Paso 8: Configurar CI/CD con GitHub Actions

### 8.1 Crear Cuenta de Servicio para GitHub Actions

```bash
# Crear cuenta de servicio
gcloud iam service-accounts create github-actions \
    --display-name="GitHub Actions Deploy"

# Obtener el email de la cuenta de servicio
SA_EMAIL=$(gcloud iam service-accounts list --filter="displayName:GitHub Actions Deploy" --format="value(email)")

# Asignar roles necesarios
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

### 8.2 Configurar Workload Identity Federation (recomendado)

```bash
# Variables (ajusta owner/repo)
PROJECT_ID=costos-embutidos
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
POOL_ID=github-pool
PROVIDER_ID=github-provider
GITHUB_REPO=gnavarrolema/costos-embutidos

# Crear pool
gcloud iam workload-identity-pools create $POOL_ID \
    --project=$PROJECT_ID \
    --location=global \
    --display-name="GitHub Actions Pool"

# Crear provider OIDC de GitHub
gcloud iam workload-identity-pools providers create-oidc $PROVIDER_ID \
    --project=$PROJECT_ID \
    --location=global \
    --workload-identity-pool=$POOL_ID \
    --display-name="GitHub Provider" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="attribute.repository=='$GITHUB_REPO'"

# Permitir que GitHub impersonifique la service account
gcloud iam service-accounts add-iam-policy-binding $SA_EMAIL \
    --project=$PROJECT_ID \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL_ID/attribute.repository/$GITHUB_REPO"

# Obtener resource name del provider (para secret de GitHub)
gcloud iam workload-identity-pools providers describe $PROVIDER_ID \
    --project=$PROJECT_ID \
    --location=global \
    --workload-identity-pool=$POOL_ID \
    --format="value(name)"
```

### 8.3 Configurar Secrets en GitHub

1. Ve a tu repositorio en GitHub: `https://github.com/gnavarrolema/costos-embutidos`

2. Ve a **Settings** → **Secrets and variables** → **Actions**

3. Crea los siguientes secrets:

   | Nombre del Secret | Valor |
   |-------------------|-------|
   | `GCP_REGION` | `us-central1` |

4. Verifica en `.github/workflows/cd.yml` que estos valores coincidan con tu proyecto:

    - `GCP_PROJECT_ID`
    - `GCP_WORKLOAD_IDENTITY_PROVIDER`
    - `GCP_SERVICE_ACCOUNT_EMAIL`
    - `GCP_PROJECT_NUMBER`

    Si tus IDs o proyecto cambian, actualiza esos `env` del workflow.

5. (Opcional) Crea variables (no secrets):

   | Nombre de Variable | Valor |
   |--------------------|-------|
   | `PRODUCTION_URL` | `https://costos-frontend-xxx-uc.a.run.app` |

### 8.4 El Workflow de GitHub Actions

El archivo `.github/workflows/cd.yml` ya está configurado para desplegar automáticamente a Cloud Run cuando hagas push a la rama `main`.

> ✅ **Nota de seguridad**: este flujo evita claves JSON estáticas (`GCP_SA_KEY`) y usa credenciales efímeras vía OIDC.

---

## 📊 Paso 9: Monitoreo y Logs

### 9.1 Ver Logs en Cloud Console

1. Ve a **[Cloud Console](https://console.cloud.google.com)**
2. Navega a **Cloud Run**
3. Selecciona tu servicio (backend o frontend)
4. Haz clic en la pestaña **"LOGS"**

### 9.2 Ver Logs desde Terminal

```bash
# Logs del backend en tiempo real
gcloud run services logs tail costos-backend --region=us-central1

# Logs del frontend
gcloud run services logs tail costos-frontend --region=us-central1

# Últimos 100 logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=costos-backend" --limit=100
```

### 9.3 Métricas y Monitoreo

1. En Cloud Console, ve a **Cloud Run** → tu servicio
2. La pestaña **"METRICS"** muestra:
   - Requests por segundo
   - Latencia
   - Uso de CPU/Memoria
   - Errores

### 9.4 Configurar Alertas (Opcional)

```bash
# Crear una alerta si hay errores 5xx
gcloud alpha monitoring policies create \
    --notification-channels="projects/costos-embutidos/notificationChannels/xxx" \
    --display-name="Errores 500 en Backend" \
    --condition-display-name="Error rate > 1%" \
    --condition-filter='resource.type="cloud_run_revision" AND resource.labels.service_name="costos-backend"' \
    --condition-threshold-value=0.01 \
    --condition-threshold-comparison=COMPARISON_GT
```

---

## 💰 Costos y Límites del Tier Gratuito

### Cloud Run - Tier Gratuito (Permanente)

| Recurso | Límite Mensual Gratuito |
|---------|-------------------------|
| Requests | 2 millones |
| CPU-tiempo | 360,000 vCPU-segundos |
| Memoria-tiempo | 180,000 GB-segundos |
| Networking (egress) | 1 GB a Norteamérica |

### Artifact Registry - Tier Gratuito

| Recurso | Límite Gratuito |
|---------|-----------------|
| Almacenamiento | 0.5 GB |

### Cloud SQL - Costos Estimados

| Instancia | Costo Aproximado |
|-----------|------------------|
| db-f1-micro | ~$7-10 USD/mes |
| db-g1-small | ~$25-30 USD/mes |

> 💡 **Tip**: Para desarrollo, puedes usar SQLite y evitar el costo de Cloud SQL. Solo usa Cloud SQL para producción real.

### Crédito de Nuevos Usuarios

- **$300 USD** de crédito válido por 90 días
- Suficiente para meses de desarrollo y pruebas

### Calculadora de Costos

Usa la [Calculadora de Google Cloud](https://cloud.google.com/products/calculator) para estimar costos específicos.

---

## 🔧 Troubleshooting

### Error: "Permission denied" al desplegar

**Causa**: La cuenta de servicio no tiene permisos suficientes.

**Solución**:
```bash
# Verificar permisos de la cuenta actual
gcloud auth list

# Re-autenticarse
gcloud auth login

# Verificar permisos del proyecto
gcloud projects get-iam-policy costos-embutidos
```

### Error: "Container failed to start"

**Causa**: El contenedor no puede iniciar correctamente.

**Solución**:
1. Verifica los logs:
   ```bash
   gcloud run services logs read costos-backend --region=us-central1 --limit=50
   ```

2. Prueba el contenedor localmente:
   ```bash
   docker run -p 5000:5000 us-central1-docker.pkg.dev/costos-embutidos/costos-repo/backend:latest
   ```

3. Verifica que el puerto expuesto sea correcto (5000 para backend, 80 para frontend)

### Error: "Cloud SQL connection failed"

**Causa**: El servicio no puede conectarse a Cloud SQL.

**Solución**:
1. Verifica que la instancia Cloud SQL existe:
   ```bash
   gcloud sql instances list
   ```

2. Verifica el nombre de conexión:
   ```bash
   gcloud sql instances describe costos-db --format="value(connectionName)"
   ```

3. Asegúrate de que el flag `--add-cloudsql-instances` tenga el nombre correcto

### Error: "CORS policy blocked"

**Causa**: El frontend no está en la lista de orígenes permitidos.

**Solución**:
```bash
# Actualizar ALLOWED_ORIGINS
gcloud run services update costos-backend \
    --region=us-central1 \
    --update-env-vars="ALLOWED_ORIGINS=https://costos-frontend-xxx-uc.a.run.app"
```

### Error: "Image not found"

**Causa**: La imagen no existe en Artifact Registry.

**Solución**:
```bash
# Listar imágenes disponibles
gcloud artifacts docker images list us-central1-docker.pkg.dev/costos-embutidos/costos-repo

# Re-construir y subir
docker build -t us-central1-docker.pkg.dev/costos-embutidos/costos-repo/backend:latest -f backend/Dockerfile backend/
docker push us-central1-docker.pkg.dev/costos-embutidos/costos-repo/backend:latest
```

### La app se demora en responder (Cold Start)

**Causa**: Cloud Run escala a 0 instancias cuando no hay tráfico.

**Solución**:
```bash
# Mantener al menos 1 instancia siempre activa (tiene costo)
gcloud run services update costos-backend \
    --region=us-central1 \
    --min-instances=1
```

> ⚠️ Nota: Mantener instancias mínimas genera costo continuo.

### Error en GitHub Actions: "Authentication failed"

**Causa**: El secret `GCP_SA_KEY` no es válido.

**Solución**:
1. Regenera la clave JSON:
   ```bash
   gcloud iam service-accounts keys create new-gcp-key.json \
       --iam-account=github-actions@costos-embutidos.iam.gserviceaccount.com
   ```

2. Actualiza el secret en GitHub con el nuevo contenido

---

## 🗑️ Limpiar Recursos (Opcional)

> ✅ **Recomendado**: usa `./scripts/gcp/destroy.sh` (respalda y verifica los datos antes de borrar) y `./scripts/gcp/deploy.sh` para reanudar. Ver [GCP_PAUSE_RESUME.md](GCP_PAUSE_RESUME.md).

Si quieres eliminar todo manualmente para evitar cargos:

```bash
# Eliminar servicios de Cloud Run
gcloud run services delete costos-backend --region=us-central1 --quiet
gcloud run services delete costos-frontend --region=us-central1 --quiet

# Eliminar bucket de datos
gsutil -m rm -r gs://costos-embutidos-data

# Eliminar instancia de Cloud SQL (si la creaste)
gcloud sql instances delete costos-db --quiet

# Eliminar imágenes de Artifact Registry
gcloud artifacts docker images delete us-central1-docker.pkg.dev/costos-embutidos/costos-repo/backend --delete-tags --quiet
gcloud artifacts docker images delete us-central1-docker.pkg.dev/costos-embutidos/costos-repo/frontend --delete-tags --quiet

# Eliminar repositorio de Artifact Registry
gcloud artifacts repositories delete costos-repo --location=us-central1 --quiet

# Eliminar secrets
gcloud secrets delete jwt-secret --quiet
gcloud secrets delete database-url --quiet

# (Opcional) Eliminar el proyecto completo
gcloud projects delete costos-embutidos
```

---

## 📝 Resumen de URLs Importantes

Después del despliegue, tendrás URLs similares a:

| Servicio | URL |
|----------|-----|
| **Frontend** | `https://costos-frontend-xxxxxxxxxx-uc.a.run.app` |
| **Backend** | `https://costos-backend-xxxxxxxxxx-uc.a.run.app` |
| **Cloud Console** | `https://console.cloud.google.com/run?project=costos-embutidos` |
| **Logs** | `https://console.cloud.google.com/logs?project=costos-embutidos` |

---

## 📚 Recursos Adicionales

- [Documentación oficial de Cloud Run](https://cloud.google.com/run/docs)
- [Guía de precios de Cloud Run](https://cloud.google.com/run/pricing)
- [Cloud Run con GitHub Actions](https://cloud.google.com/blog/products/devops-sre/deploy-to-cloud-run-with-github-actions)
- [Conectar Cloud Run con Cloud SQL](https://cloud.google.com/sql/docs/postgres/connect-run)

---

## 🎉 ¡Listo!

Tu aplicación **Costos Embutidos** ahora está desplegada en Google Cloud Run. Cada push a la rama `main` desplegará automáticamente los cambios gracias a GitHub Actions.

**Próximos pasos recomendados:**
1. Configura un dominio personalizado (opcional)
2. Activa Cloud Armor para protección DDoS (opcional)
3. Configura alertas de monitoreo
4. Revisa periódicamente los costos en la consola de facturación

---

**© 2024 Sistema de Costeo de Embutidos** | Guía de Despliegue Cloud Run v1.0
