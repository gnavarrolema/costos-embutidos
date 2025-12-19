# Guía de Contribución - Sistema de Costeo de Embutidos

## 🔄 CI/CD Pipeline

Este proyecto utiliza **GitHub Actions** para integración y despliegue continuo.

### Pipelines Configurados

#### 1. CI Pipeline (`.github/workflows/ci.yml`)

Se ejecuta automáticamente en cada **push** y **pull request** a las ramas `main`, `master` y `develop`.

**Jobs:**
| Job | Descripción |
|-----|-------------|
| `backend-tests` | Ejecuta pytest, flake8 y genera reporte de cobertura |
| `frontend-build` | Compila el frontend con Vite |
| `security-scan` | Escanea vulnerabilidades en dependencias Python |

#### 2. CD Pipeline (`.github/workflows/cd.yml`)

Se ejecuta cuando se hace **merge a main** o se crea un **tag de versión**.

**Jobs:**
| Job | Descripción | Trigger |
|-----|-------------|---------|
| `build` | Empaqueta frontend + backend | Siempre |
| `deploy-staging` | Deploy a staging | Push a main/master |
| `deploy-production` | Deploy a producción | Tags `v*` o manual |
| `create-release` | Crea release en GitHub | Tags `v*` |

---

## 🧪 Ejecutar Tests Localmente

### Backend (Python)

```bash
# Activar entorno virtual
source .venv/bin/activate

# Instalar dependencias de desarrollo
pip install -r backend/requirements-dev.txt

# Ejecutar tests
cd backend
pytest tests/ -v

# Con cobertura
pytest tests/ -v --cov=. --cov-report=html

# Linting
flake8 . --max-line-length=120
```

### Frontend (Node.js)

```bash
# Verificar que compila correctamente
npm run build
```

---

## 📋 Flujo de Trabajo Recomendado

### Para Features Nuevas

1. Crear rama desde `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/mi-nueva-feature
   ```

2. Desarrollar y hacer commits

3. Crear Pull Request a `develop`
   - El CI se ejecutará automáticamente
   - Todos los checks deben pasar

4. Merge a `develop` después de aprobación

### Para Releases

1. Merge `develop` → `main`:
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```
   - Esto triggerea deploy automático a staging

2. Crear tag de versión:
   ```bash
   git tag -a v1.5.1 -m "Release v1.5.1 - Descripción"
   git push origin v1.5.1
   ```
   - Esto triggerea deploy a producción y crea release en GitHub

---

## 🔧 Configuración de Ambientes (GitHub)

Para habilitar deployments, configura en tu repositorio:

### Settings → Environments

1. **staging**
   - Variables: `STAGING_URL`
   - Secrets: `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY`

2. **production**
   - Protection rules: Require reviewers
   - Variables: `PRODUCTION_URL`
   - Secrets: Credenciales de producción

---

## 📊 Badges

Agrega estos badges a tu README.md:

```markdown
![CI](https://github.com/TU_USUARIO/costos-embutidos/actions/workflows/ci.yml/badge.svg)
![CD](https://github.com/TU_USUARIO/costos-embutidos/actions/workflows/cd.yml/badge.svg)
```

---

## 🐛 Solución de Problemas CI/CD

### Tests fallan en CI pero pasan localmente

- Verificar que todas las dependencias estén en `requirements*.txt`
- Revisar variables de entorno necesarias
- Asegurarse de que no hay dependencias de archivos locales

### Build del frontend falla

- Verificar versión de Node.js (requiere 18+)
- Ejecutar `npm ci` localmente para verificar dependencias
- Revisar errores de TypeScript/ESLint si están configurados

### Deployment falla

- Verificar que los secrets estén configurados correctamente
- Revisar permisos en el servidor de destino
- Consultar logs detallados en la pestaña Actions de GitHub
