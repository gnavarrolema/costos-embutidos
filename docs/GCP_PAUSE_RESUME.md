# ⏸️ Pausar y reanudar la app en GCP (costo $0)

Dos scripts, basados en `gcloud`, controlan todo el ciclo de vida de la infraestructura:

| Script | Qué hace |
|---|---|
| `scripts/gcp/destroy.sh` | Respalda los datos, **verifica** el respaldo y elimina todo lo que genera costo |
| `scripts/gcp/deploy.sh`  | Recrea la infraestructura, **restaura** el último respaldo y despliega la app |

La configuración compartida (proyecto, región, nombres) está en `scripts/gcp/config.sh` y coincide con `.github/workflows/cd.yml`.

---

## 1. Qué recursos existen y cuánto cuestan

| Recurso | Nombre | Costo con la app sin uso | `destroy.sh` |
|---|---|---|---|
| Cloud Run (backend, frontend) | `costos-backend`, `costos-frontend` | ~$0 (`min-instances=0`) | Elimina |
| Artifact Registry | `costos-repo` | **$0.10/GB/mes por encima de 0.5 GB.** Cada push a `main` sube una imagen de backend con dependencias de ML (~1 GB) → **suele ser el costo principal** | Elimina |
| Cloud Storage (SQLite, modelos) | `gs://costos-embutidos-data` | Gratis hasta 5 GB en `us-central1` | Respalda → verifica → elimina |
| Secret Manager | `jwt-secret` | Gratis (≤ 6 versiones) | Elimina (se regenera) |
| Buckets de Cloud Build | `gs://costos-embutidos_cloudbuild` | Centavos | Elimina |
| APIs, SA `github-actions`, Workload Identity | — | $0 | **Conserva** (el CI los necesita) |

> 💡 Antes de destruir, revisa **Facturación → Informes**, agrupado por *SKU*, para confirmar de dónde viene el costo. Si es solo Artifact Registry, puede bastar con ejecutar `deploy.sh` una vez: aplica una política de limpieza que conserva solo las últimas 3 versiones de cada imagen.

---

## 2. Requisitos (una sola vez)

Ejecuta los scripts desde **WSL Ubuntu** (o Git Bash / Linux / macOS con bash 4+):

```bash
gcloud --version          # Google Cloud SDK
gcloud auth login         # sesión con una cuenta Owner/Editor del proyecto
gh auth login             # opcional: para activar/desactivar el CD automáticamente
docker info               # opcional: si no hay Docker, deploy.sh usa Cloud Build
```

`.gitattributes` fuerza finales de línea LF en los `.sh`, así que funcionan en WSL aunque clones en Windows con `core.autocrlf=true`.

---

## 3. Pausar (llevar el costo a $0)

```bash
./scripts/gcp/destroy.sh
```

El script pide que escribas el ID del proyecto y luego:

1. **Desactiva el workflow de CD** en GitHub: un push a `main` durante la pausa no intentará desplegar sobre una infraestructura inexistente.
2. **Elimina los servicios de Cloud Run**, lo que detiene cualquier escritura a SQLite antes de respaldar (el respaldo queda consistente).
3. **Respalda** `gs://costos-embutidos-data` en `backups/gcp/<fecha>/data/` y genera:
   - `manifest-remote.txt`: listado de objetos con tamaños, tal como estaban en GCS
   - `SHA256SUMS`: checksums de cada archivo
   - `backups/gcp/costos-embutidos-data-<fecha>.tar.gz`: archivo portable
4. **Verifica** que se descargaron todos los objetos y ejecuta `PRAGMA integrity_check` en cada base SQLite.
   **Si algo falla, se detiene y el bucket NO se borra.**
5. Elimina bucket (sin *soft delete*, para que no se facture durante 7 días), Artifact Registry, el secret y los buckets de Cloud Build.
6. Muestra el inventario restante, que debería estar vacío.

Opciones:

```bash
./scripts/gcp/destroy.sh --keep-data     # respalda pero conserva el bucket (gratis si < 5 GB)
./scripts/gcp/destroy.sh --keep-images   # conserva las imágenes (re-despliegue más rápido, cuesta almacenamiento)
./scripts/gcp/destroy.sh --no-gh         # no tocar GitHub Actions
./scripts/gcp/destroy.sh -y              # sin confirmación (automatización)
```

---

## 4. Reanudar

```bash
./scripts/gcp/deploy.sh
```

1. Habilita APIs y crea (si faltan) Artifact Registry con política de limpieza, el bucket (privado, con *public access prevention*) y el secret JWT, con los permisos IAM para la SA de Cloud Run.
2. **Si el bucket está vacío, restaura automáticamente el último respaldo** (`backups/gcp/LATEST`) después de validar sus checksums.
3. Construye las imágenes con el commit actual como tag (Docker local, o Cloud Build si Docker no está disponible).
4. Despliega backend y frontend con la misma configuración que `cd.yml`. Las URLs son deterministas, así que CORS y `VITE_API_URL` quedan bien configurados desde el primer intento.
5. Comprueba `/api/health` y `/health`, y **reactiva el CD** en GitHub.

Opciones:

```bash
./scripts/gcp/deploy.sh --restore latest                       # forzar restauración (pide confirmación si hay datos)
./scripts/gcp/deploy.sh --restore backups/gcp/20260923-114939  # restaurar un respaldo concreto
./scripts/gcp/deploy.sh --fresh                                # arrancar con base de datos vacía
./scripts/gcp/deploy.sh --build-mode cloudbuild                # build remoto (sin Docker local)
./scripts/gcp/deploy.sh --skip-build                           # re-desplegar imágenes :latest existentes
```

> ⚠️ Como el secret JWT se regenera, las sesiones anteriores se invalidan y los usuarios deben volver a iniciar sesión. Los datos no se ven afectados.

---

## 5. Buenas prácticas de respaldo

- **Regla 3-2-1**: `backups/` está en `.gitignore` (contiene datos de producción) y vive solo en tu disco. Copia el `.tar.gz` a otro lugar (Google Drive, disco externo). Ejemplo desde WSL:
  ```bash
  cp backups/gcp/costos-embutidos-data-*.tar.gz /mnt/g/Mi\ unidad/Respaldos/
  ```
- **Prueba la restauración**, no solo el respaldo. `deploy.sh` valida los checksums al restaurar, y puedes abrir la base respaldada localmente:
  ```bash
  python -c "import sqlite3; print(sqlite3.connect('backups/gcp/<fecha>/data/instance/costos_embutidos.db').execute('PRAGMA integrity_check').fetchone())"
  ```
- **Verifica un archivo copiado fuera** con `tar -xzf archivo.tar.gz && cd data && sha256sum -c ../SHA256SUMS`.
- **Conserva varios respaldos** (cada pausa crea uno nuevo; ninguno se borra automáticamente).
- **No edites el bucket** mientras la app está corriendo: SQLite sobre Cloud Storage FUSE no tolera escritores concurrentes. Por eso el script elimina Cloud Run antes de respaldar.
- **Presupuesto con alerta** como red de seguridad: *Facturación → Presupuestos y alertas → Crear presupuesto* (p. ej. $1 con alertas al 50/90/100 %).

---

## 6. ¿Por qué `gcloud` y no Terraform?

El CD (`cd.yml`) ya despliega con `gcloud run deploy` en cada push. Con Terraform administrando los mismos servicios, cada push generaría *drift* respecto del estado de Terraform, y además habría que alojar el *state* (normalmente en un bucket GCS, que es justo lo que se elimina). Para 6 recursos sin dependencias complejas, scripts idempotentes con `gcloud` son más simples y coherentes con `scripts/setup_gcp_*.sh`.

---

## 7. Apagado total (irreversible)

Si nunca vas a volver a usar el proyecto, después de `destroy.sh` puedes eliminarlo por completo. Queda 30 días en estado *pending deletion* y luego se borra definitivamente:

```bash
gcloud projects delete costos-embutidos
```

Para volver después tendrías que crear un proyecto nuevo, ejecutar `scripts/setup_gcp_oidc.sh` y actualizar los IDs en `cd.yml` y `config.sh`.
