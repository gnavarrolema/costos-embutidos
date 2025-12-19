# 🚀 Guía de Despliegue en Railway

Esta guía detalla cómo desplegar la aplicación **Costos Embutidos** en Railway, una plataforma cloud con tier gratuito.

## 📋 Requisitos Previos

- Cuenta de GitHub con el repositorio del proyecto
- Navegador web moderno

> **💡 Nota**: Railway ofrece **$5 USD de crédito mensual gratis** sin necesidad de tarjeta de crédito. Es suficiente para uso personal/demo.

---

## 🎯 Paso 1: Crear Cuenta en Railway

1. Ve a [railway.app](https://railway.app)
2. Haz clic en **"Start a New Project"**
3. Selecciona **"Deploy from GitHub repo"**
4. Autoriza a Railway para acceder a tu cuenta de GitHub
5. Completa el registro (puedes usar tu cuenta de GitHub)

---

## 🗄️ Paso 2: Crear Base de Datos PostgreSQL

Antes de desplegar la app, necesitas una base de datos:

1. En el dashboard de Railway, haz clic en **"New Project"**
2. Selecciona **"Provision PostgreSQL"**
3. Railway creará automáticamente una instancia de PostgreSQL
4. Haz clic en el servicio PostgreSQL creado
5. Ve a la pestaña **"Variables"**
6. Copia el valor de `DATABASE_URL` (lo necesitarás después)

> **Ejemplo de DATABASE_URL**: `postgresql://postgres:password@containers-us-west-xxx.railway.app:5432/railway`

---

## 📦 Paso 3: Desplegar el Backend

### Opción A: Desde GitHub (Recomendado)

1. En Railway, haz clic en **"New"** → **"GitHub Repo"**
2. Selecciona tu repositorio `costos-embutidos`
3. Railway detectará automáticamente el `Dockerfile` en `/backend`
4. En la configuración del servicio:
   - **Root Directory**: `backend`
   - **Build Command**: (dejar en automático, usa Dockerfile)

### Opción B: Manual con Railway CLI

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Vincular proyecto
railway link

# Desplegar
railway up
```

---

## ⚙️ Paso 4: Configurar Variables de Entorno

En Railway, selecciona tu servicio backend y ve a **Variables**:

### Variables Requeridas

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Referencia a PostgreSQL |
| `JWT_SECRET_KEY` | `tu-clave-super-secreta` | Genera con: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `FLASK_ENV` | `production` | Entorno de producción |
| `ALLOWED_ORIGINS` | `https://tu-frontend.up.railway.app` | URL del frontend |

### Variables Opcionales

| Variable | Valor Default | Descripción |
|----------|---------------|-------------|
| `JWT_EXPIRATION_HOURS` | `24` | Duración de tokens |
| `COSTOS_LOG_LEVEL` | `INFO` | Nivel de logs |
| `PORT` | `5000` | Puerto (Railway lo asigna automáticamente) |

> **💡 Tip**: Para referenciar la base de datos, usa `${{Postgres.DATABASE_URL}}` y Railway la inyectará automáticamente.

---

## 🌐 Paso 5: Desplegar el Frontend

Railway soporta sitios estáticos:

1. Haz clic en **"New"** → **"GitHub Repo"**
2. Selecciona el mismo repositorio
3. En la configuración:
   - **Root Directory**: `.` (raíz)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx serve dist -s -l 3000`

O mejor, configura Nginx como en el docker-compose:

1. Crea un nuevo servicio desde el mismo repo
2. Usa el `Dockerfile.frontend` existente

---

## 🔗 Paso 6: Conectar Frontend con Backend

1. En el servicio del frontend, agrega la variable:
   - `VITE_API_URL`: URL pública del backend (ej: `https://tu-backend.up.railway.app`)

2. En el servicio del backend, actualiza `ALLOWED_ORIGINS` con la URL del frontend

---

## 🔄 Paso 7: Configurar Deploy Automático (CI/CD)

### Obtener Token de Railway

1. Ve a tu perfil en Railway → **Account Settings**
2. Sección **Tokens** → **Create Token**
3. Nombra el token (ej: "GitHub Actions")
4. Copia el token generado

### Configurar GitHub Actions

1. En tu repositorio de GitHub, ve a **Settings** → **Secrets and variables** → **Actions**
2. Crea un nuevo secret:
   - **Name**: `RAILWAY_TOKEN`
   - **Value**: (pega el token de Railway)

3. (Opcional) Agrega una variable de entorno:
   - Ve a **Variables** (no Secrets)
   - **Name**: `PRODUCTION_URL`
   - **Value**: `https://tu-app.up.railway.app`

Ahora, cada push a `main` desplegará automáticamente en Railway.

---

## 📊 Paso 8: Monitoreo y Logs

### Ver Logs en Tiempo Real

1. En Railway, selecciona tu servicio
2. Ve a la pestaña **"Logs"**
3. Los logs se actualizan en tiempo real

### Métricas de Uso

1. Ve a tu proyecto en Railway
2. La sección **"Usage"** muestra:
   - CPU utilizado
   - Memoria
   - Crédito restante del mes

---

## 🔧 Troubleshooting

### El build falla

**Síntoma**: Error durante el build  
**Solución**: 
- Verifica que el `Dockerfile` sea correcto
- Revisa los logs de build en Railway
- Asegúrate de que las dependencias estén actualizadas

### La app no conecta a la base de datos

**Síntoma**: Error de conexión a PostgreSQL  
**Solución**:
1. Verifica que `DATABASE_URL` esté configurada
2. Asegúrate de usar la referencia `${{Postgres.DATABASE_URL}}`
3. Verifica que ambos servicios estén en el mismo proyecto

### CORS bloqueando requests

**Síntoma**: Error "CORS policy" en el navegador  
**Solución**:
1. Actualiza `ALLOWED_ORIGINS` con la URL exacta del frontend
2. No incluyas trailing slash (correcto: `https://app.railway.app`, incorrecto: `https://app.railway.app/`)

### La app se duerme o pausa

**Síntoma**: Respuestas lentas o timeout  
**Solución**:
- En el tier gratuito, las apps pueden pausarse por inactividad
- Railway las reactiva automáticamente al recibir tráfico
- Considera agregar un servicio de "ping" para mantenerla activa

---

## 💰 Costos y Límites del Tier Gratuito

| Recurso | Límite Gratuito |
|---------|-----------------|
| Crédito Mensual | $5 USD |
| Proyectos | Ilimitados |
| Servicios por proyecto | Ilimitados |
| Builds | Ilimitados |
| Bandwidth | Sin límite específico |

> **⚠️ Importante**: Si excedes los $5 de crédito, Railway **pausará** tus servicios hasta el próximo mes. Monitorea tu uso regularmente.

---

## 📝 Resumen de URLs Importantes

Después del despliegue, tendrás URLs similares a:

- **Backend**: `https://costos-backend-production.up.railway.app`
- **Frontend**: `https://costos-frontend-production.up.railway.app`
- **PostgreSQL**: Interna, solo accesible desde otros servicios del proyecto

---

## 🎉 ¡Listo!

Tu aplicación Costos Embutidos ahora está desplegada en Railway. Cada push a la rama `main` desplegará automáticamente los cambios.

Para soporte adicional, consulta:
- [Documentación de Railway](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
