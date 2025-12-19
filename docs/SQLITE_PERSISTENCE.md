# 💾 Persistencia de SQLite en Google Cloud Run

Esta guía explica cómo funciona la persistencia de datos SQLite en Cloud Run usando Cloud Storage.

---

## 🎯 El Problema

**Cloud Run es stateless** - cada vez que se despliega una nueva versión o se reinicia un contenedor:
- ❌ El sistema de archivos se resetea
- ❌ Los datos en SQLite se pierden
- ❌ Los modelos ML entrenados desaparecen

## ✅ La Solución: Cloud Storage como Volumen

Usamos **Cloud Storage FUSE** para montar un bucket de GCS como sistema de archivos persistente.

### Arquitectura

```
┌─────────────────────────────────────────┐
│   Cloud Run Container                   │
│                                          │
│  /app/data  ←─────────┐                │
│    ├── instance/       │                │
│    │   └── costos_embutidos.db         │
│    ├── logs/           │  Montado       │
│    │   └── app.log     │  como          │
│    └── models/         │  volumen       │
│        └── *.pkl       │                │
└────────────────────────┼─────────────────┘
                         │
                         ↓
            ┌─────────────────────────┐
            │  Cloud Storage Bucket   │
            │  gs://PROJECT-data/     │
            │                          │
            │  ✅ Persistente          │
            │  ✅ Compartido           │
            │  ✅ Respaldado           │
            └─────────────────────────┘
```

---

## 📦 Configuración Paso a Paso

### 1. Crear el Bucket

```bash
# Crear bucket en la misma región que Cloud Run
gsutil mb -p TU-PROJECT-ID -l us-central1 gs://TU-PROJECT-ID-data

# Crear estructura de carpetas
gsutil -m cp /dev/null gs://TU-PROJECT-ID-data/instance/.keep
gsutil -m cp /dev/null gs://TU-PROJECT-ID-data/logs/.keep
gsutil -m cp /dev/null gs://TU-PROJECT-ID-data/models/.keep
```

### 2. Configurar Permisos

```bash
# Dar acceso al Compute Engine service account (usado por Cloud Run)
gsutil iam ch serviceAccount:$(gcloud projects describe TU-PROJECT-ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com:roles/storage.objectAdmin gs://TU-PROJECT-ID-data
```

### 3. Desplegar con Volumen

```bash
gcloud run deploy costos-backend \
    --image=ARTIFACT-REGISTRY-URL/backend:latest \
    --execution-environment=gen2 \
    --add-volume=name=data,type=cloud-storage,bucket=TU-PROJECT-ID-data \
    --add-volume-mount=volume=data,mount-path=/app/data \
    --set-env-vars="SQLALCHEMY_DATABASE_URI=sqlite:////app/data/instance/costos_embutidos.db" \
    # ... otros parámetros
```

**Parámetros críticos**:
- `--execution-environment=gen2`: Requerido para volúmenes
- `--add-volume`: Define el bucket como volumen
- `--add-volume-mount`: Monta en `/app/data`
- `SQLALCHEMY_DATABASE_URI`: Apunta a la ruta persistente

---

## 🔍 Verificar que Funciona

### Ver archivos en el bucket

```bash
# Listar contenido del bucket
gsutil ls -r gs://TU-PROJECT-ID-data/

# Ver si existe la base de datos
gsutil ls gs://TU-PROJECT-ID-data/instance/costos_embutidos.db
```

### Descargar backup de la DB

```bash
# Descargar la base de datos a tu máquina local
gsutil cp gs://TU-PROJECT-ID-data/instance/costos_embutidos.db ./backup/
```

### Verificar logs persistentes

```bash
# Ver logs guardados en el bucket
gsutil cat gs://TU-PROJECT-ID-data/logs/app.log | tail -50
```

---

## 📊 Rendimiento

### Latencia

| Operación | SQLite Local | SQLite + Cloud Storage |
|-----------|--------------|------------------------|
| **Lectura pequeña** | < 1 ms | 5-10 ms |
| **Escritura pequeña** | < 1 ms | 10-20 ms |
| **Query complejo** | 10-50 ms | 15-60 ms |
| **Cold start** | 1-2 seg | 3-5 seg |

### Para 200 req/mes

Con tu volumen de tráfico (200 req/mes = ~7 req/día):
- ✅ La latencia adicional es **despreciable**
- ✅ Los cold starts son aceptables (solo después de inactividad)
- ✅ No hay diferencia perceptible para el usuario

---

## 💰 Costos

### Cloud Storage

| Ítem | Cantidad | Costo Mensual |
|------|----------|---------------|
| **Almacenamiento** | 100 MB | $0.02 |
| **Operaciones Clase A** (escrituras) | 200 | $0.00 |
| **Operaciones Clase B** (lecturas) | 200 | $0.00 |
| **Egress** (transferencia) | < 1 GB | $0.00 |
| **TOTAL** | - | **~$0.02** |

### Comparación con Cloud SQL

| Opción | Costo Mensual | Cuándo Usar |
|--------|---------------|-------------|
| **SQLite + Cloud Storage** | $0.02 | < 1,000 req/mes |
| **Cloud SQL db-f1-micro** | $7-9 | > 10,000 req/mes |
| **Cloud SQL db-g1-small** | $25-30 | > 100,000 req/mes |

**Para tu caso (200 req/mes)**: SQLite + Cloud Storage es **400x más barato** 🎉

---

## 🔒 Backups

### Backup Manual

```bash
# Backup completo del bucket
gsutil -m cp -r gs://TU-PROJECT-ID-data/ ./backups/$(date +%Y%m%d)/

# Backup solo de la DB
gsutil cp gs://TU-PROJECT-ID-data/instance/costos_embutidos.db ./backups/db-$(date +%Y%m%d-%H%M%S).db
```

### Backup Automático con Cron (en tu PC local)

```bash
# Crear script de backup
cat > ~/backup-costos.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="$HOME/backups/costos-embutidos"
DATE=$(date +%Y%m%d)
mkdir -p "$BACKUP_DIR"
gsutil cp gs://TU-PROJECT-ID-data/instance/costos_embutidos.db "$BACKUP_DIR/db-$DATE.db"
# Mantener solo últimos 30 días
find "$BACKUP_DIR" -name "db-*.db" -mtime +30 -delete
EOF

chmod +x ~/backup-costos.sh

# Agregar a crontab (diario a las 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * $HOME/backup-costos.sh") | crontab -
```

### Restaurar desde Backup

```bash
# Subir backup al bucket
gsutil cp ./backups/db-20240115.db gs://TU-PROJECT-ID-data/instance/costos_embutidos.db

# Reiniciar el servicio para que tome el nuevo archivo
gcloud run services update costos-backend --region=us-central1
```

---

## ⚡ Optimizaciones

### Para Apps de Producción con Más Tráfico

Si en el futuro tu app crece, considera:

1. **Cloud SQL** (> 10,000 req/mes)
   - Mejor rendimiento en queries complejos
   - Conexiones concurrentes sin problemas
   - Backups automáticos enterprise-grade

2. **Cloud Memorystore (Redis)** (caché)
   - Caché de queries frecuentes
   - Sesiones de usuario
   - Reduce latencia a < 1ms

3. **Min-instances > 0**
   - Elimina cold starts
   - Costo: ~$3-5/mes adicionales
   - Solo si cold starts son un problema

---

## 🐛 Troubleshooting

### "Permission denied" al escribir en la DB

```bash
# Verificar permisos del bucket
gsutil iam get gs://TU-PROJECT-ID-data

# Asegurarte que el service account tiene storage.objectAdmin
gsutil iam ch serviceAccount:PROJECT-NUMBER-compute@developer.gserviceaccount.com:roles/storage.objectAdmin gs://TU-PROJECT-ID-data
```

### "No such file or directory: /app/data/instance/costos_embutidos.db"

```bash
# Verificar que el volumen está montado
gcloud run services describe costos-backend --region=us-central1 --format="value(spec.template.spec.volumes)"

# Verificar variable de entorno
gcloud run services describe costos-backend --region=us-central1 --format="value(spec.template.spec.containers[0].env)"
```

### La DB no persiste después de un deploy

```bash
# Verificar que usas gen2
gcloud run services describe costos-backend --region=us-central1 --format="value(spec.template.metadata.annotations[run.googleapis.com/execution-environment])"
# Debe mostrar: gen2

# Verificar configuración de volumen
gcloud run services describe costos-backend --region=us-central1 --format=yaml | grep -A 10 volumes
```

### Performance lento

```bash
# Verificar región del bucket y Cloud Run (deben ser la misma)
gcloud run services describe costos-backend --region=us-central1 --format="value(spec.template.spec.containers[0].env[REGION])"
gsutil ls -L -b gs://TU-PROJECT-ID-data | grep Location

# Verificar cold start
gcloud run services describe costos-backend --region=us-central1 --format="value(spec.template.spec.containers[0].resources.limits.memory)"
```

---

## 📝 Checklist de Configuración

Antes de desplegar, verifica:

- [ ] Bucket creado en la misma región que Cloud Run
- [ ] Service account tiene permisos `storage.objectAdmin`
- [ ] Cloud Run usa `--execution-environment=gen2`
- [ ] Volumen configurado con `--add-volume`
- [ ] Volumen montado con `--add-volume-mount`
- [ ] `SQLALCHEMY_DATABASE_URI` apunta a `/app/data/instance/`
- [ ] Estructura de carpetas creada en el bucket
- [ ] Probado localmente que la ruta funciona

---

## 🎓 Conceptos Clave

### Cloud Storage FUSE

- Monta buckets de GCS como sistema de archivos
- Transparente para la aplicación (usa paths normales)
- Lectura/escritura como archivos normales
- Sincronización automática con el bucket

### Execution Environment Gen2

- Segunda generación de Cloud Run
- Soporta volúmenes (gen1 no los soporta)
- Mejor rendimiento de red
- Mayor límite de memoria (hasta 32 GB)

### Service Account

- Identidad que usa Cloud Run para acceder a recursos de GCP
- Por defecto: `PROJECT-NUMBER-compute@developer.gserviceaccount.com`
- Necesita permisos explícitos para acceder al bucket

---

**© 2024 Sistema de Costeo de Embutidos** | Guía de Persistencia SQLite v1.0
