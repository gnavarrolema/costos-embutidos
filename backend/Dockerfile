# Dockerfile para el Backend de Costos Embutidos
FROM python:3.11-slim

# Evitar que Python genere archivos .pyc y permitir logs en tiempo real
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Instalar dependencias del sistema necesarias para algunas librerías de ML
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
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

# Crear directorio para base de datos y logs si no existen
RUN mkdir -p instance logs

# Usuario no-root para seguridad
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser

# Exponer el puerto que usará Gunicorn
EXPOSE 5000

# Healthcheck para Docker y orquestadores
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Comando para iniciar la aplicación con Gunicorn
# -w 2: 2 workers (ajustar según recursos disponibles)
# --threads 2: para mejor concurrencia con pocos workers
# --timeout 120: para operaciones ML que pueden tardar
CMD ["gunicorn", "--workers", "2", "--threads", "2", "--timeout", "120", "--bind", "0.0.0.0:5000", "app:app"]
