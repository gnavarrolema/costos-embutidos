#!/bin/bash

# Script para verificar que todas las dependencias están instaladas
# Uso: bash verify_dependencies.sh

set -e

PROJECT_ROOT="/mnt/d/gnavarro/Escritorio/Desarrollos/costos-embutidos"
cd "$PROJECT_ROOT"

echo "==========================================="
echo "🔍 Verificación de Dependencias Instaladas"
echo "==========================================="
echo ""

# Activar entorno virtual
if [ ! -d ".venv" ]; then
    echo "❌ ERROR: No se encontró el entorno virtual .venv"
    echo "   Ejecute: bash setup_env.sh"
    exit 1
fi

source .venv/bin/activate

echo "✅ Entorno virtual activado: .venv"
echo ""

# Función para verificar un paquete
check_package() {
    local package=$1
    local version=$2
    
    if pip show "$package" &> /dev/null; then
        installed_version=$(pip show "$package" | grep Version | awk '{print $2}')
        echo "  ✅ $package ($installed_version)"
        return 0
    else
        echo "  ❌ $package - NO INSTALADO"
        return 1
    fi
}

echo "📦 Verificando dependencias principales (requirements.txt):"
echo "-----------------------------------------------------------"
check_package "flask"
check_package "flask-cors"
check_package "flask-sqlalchemy"
check_package "python-dotenv"
check_package "openpyxl"
check_package "xlsxwriter"

echo ""
echo "🤖 Verificando dependencias de ML (requirements-ml.txt):"
echo "-----------------------------------------------------------"
check_package "xgboost"
check_package "pandas"
check_package "numpy"

echo ""
echo "🧪 Verificando dependencias de desarrollo (requirements-dev.txt):"
echo "-----------------------------------------------------------"
check_package "pytest"

echo ""
echo "==========================================="
echo "📊 Resumen de paquetes instalados"
echo "==========================================="
total_packages=$(pip list | wc -l)
echo "Total de paquetes instalados: $((total_packages - 2))"
echo ""

echo "Paquetes principales:"
pip list | grep -E "Flask|pandas|numpy|xgboost|pytest|openpyxl" || echo "  (ejecute 'pip list' para ver todos)"

echo ""
echo "==========================================="
echo "✅ Verificación completada"
echo "==========================================="
echo ""
echo "Para ver todos los paquetes instalados:"
echo "  source .venv/bin/activate"
echo "  pip list"
echo ""
