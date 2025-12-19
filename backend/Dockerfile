# Dockerfile para el Backend de Costos Embutidos
FROM python:3.11-slim

# Evitar que Python genere archivos .pyc y permitir logs en tiempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependencias del sistema necesarias para algunas librerías de ML y PostgreSQL
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copiar archivos de requerimientos
COPY requirements.txt .
COPY requirements-ml.txt .

# Instalar dependencias (incluyendo Gunicorn para producción)
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r requirements-ml.txt && \
    pip install --no-cache-dir gunicorn

# Copiar el resto del código del backend
COPY . .

# Crear directorios para datos persistentes y logs
# instance/ contendrá la base de datos SQLite
# logs/ contendrá los archivos de log
# models/ contendrá los modelos ML entrenados
RUN mkdir -p /app/instance /app/logs /app/backend/models

# Usuario no-root para seguridad
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app

# Configurar permisos para directorios de datos
RUN chmod -R 755 /app/instance /app/logs /app/backend/models

USER appuser

# Exponer el puerto que usará Gunicorn
EXPOSE 5000

# Healthcheck para Docker y orquestadores
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Comando para iniciar la aplicación con Gunicorn
# -w 1: 1 worker para evitar database locks con Cloud Storage FUSE
# --threads 4: compensar con más threads por worker
# --timeout 120: para operaciones ML que pueden tardar
CMD ["gunicorn", "--workers", "1", "--threads", "4", "--timeout", "120", "--bind", "0.0.0.0:5000", "app:app"]
