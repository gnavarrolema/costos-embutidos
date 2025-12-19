#!/bin/bash

# Script para configurar el entorno virtual del proyecto
# Uso: bash setup_env.sh

set -e  # Detener en caso de error

PROJECT_ROOT="/mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos"
cd "$PROJECT_ROOT"

echo "=========================================="
echo "Configurando entorno virtual del proyecto"
echo "=========================================="

# Paso 1: Limpiar entorno virtual duplicado en backend
if [ -d "backend/venv" ]; then
    echo "🗑️  Eliminando entorno virtual duplicado en backend/venv..."
    rm -rf backend/venv
    echo "✅ Entorno virtual de backend eliminado"
else
    echo "✅ No hay entorno virtual duplicado en backend/"
fi

# Paso 2: Verificar/crear entorno virtual en raíz
if [ ! -d ".venv" ]; then
    echo "📦 Creando entorno virtual en .venv..."
    python3 -m venv .venv
    echo "✅ Entorno virtual creado"
else
    echo "✅ Entorno virtual .venv ya existe"
fi

# Paso 3: Activar entorno virtual
echo "🔧 Activando entorno virtual..."
source .venv/bin/activate

# Paso 4: Actualizar pip
echo "⬆️  Actualizando pip..."
pip install --upgrade pip

# Paso 5: Instalar dependencias principales
echo "📥 Instalando dependencias principales (requirements.txt)..."
pip install -r backend/requirements.txt

# Paso 6: Instalar dependencias de Machine Learning
echo "📥 Instalando dependencias de ML (requirements-ml.txt)..."
pip install -r backend/requirements-ml.txt

# Paso 7: Instalar dependencias de desarrollo
echo "📥 Instalando dependencias de desarrollo (requirements-dev.txt)..."
pip install -r backend/requirements-dev.txt

# Paso 8: Verificar instalación
echo ""
echo "=========================================="
echo "✅ Configuración completada exitosamente"
echo "=========================================="
echo ""
echo "Paquetes instalados:"
pip list | head -20
echo "..."
echo ""
echo "Para activar el entorno virtual en el futuro:"
echo "  source .venv/bin/activate"
echo ""
echo "Para ejecutar el backend:"
echo "  python backend/app.py"
echo ""
