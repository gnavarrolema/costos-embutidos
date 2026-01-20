# 🥩 Sistema de Costeo de Embutidos

**Versión 1.5.0** | Sistema integral de gestión de costos para producción de embutidos

## 📋 Descripción

Sistema web completo para la planificación, control y análisis de costos en la industria de embutidos. Permite gestionar materias primas, productos, costos indirectos, inflación mensual, y realizar proyecciones con Machine Learning.

## ✨ Características Principales

### 🏠 Dashboard
- Vista rápida de KPIs principales
- Alertas de precios desactualizados
- Accesos directos a módulos críticos

### 📦 Materias Primas
- Gestión de ingredientes por categoría
- Actualización de precios individual o masiva
- Importación desde Excel
- Exportación a Excel

### 🌭 Productos
- Formulación de productos con recetas
- Cálculo automático de costo por Kg
- Configuración de tiempos de producción

### 📊 Producción Programada
- **Planificación con costos completos**: MP + Indirectos + Inflación
- Selección de mes base para costos
- Cálculo automático de inflación acumulada
- Visualización de composición de costos (MP vs Indirectos)
- KPIs: Batches, Peso Total, Costo Total, Costo Promedio/Kg
- Integración con ML para cargar predicciones

### 💰 Costos Indirectos
- Gestión de Sueldos y Aportes Patronales
- Gastos Indirectos de Fabricación (GIF)
- Depreciación de maquinaria
- Distribución automática por producto

### 📈 Planificación (Hoja de Costos)
- Costo detallado de producción por producto/mes
- Materias primas desglosadas por ingrediente
- Costos indirectos distribuidos
- Inflación aplicada

### 🔮 Proyecciones ML
- Predicciones de precios con Machine Learning
- Horizonte configurable (1-12 meses)
- Visualización gráfica de tendencias

### 🎯 Escenarios (What-If Analysis)
- Análisis de impacto de cambios
- Escenarios: inflación, precios MP, costos indirectos, volumen
- Comparación con escenario base

## 🛠️ Tecnologías

| Componente | Tecnología |
|------------|------------|
| Frontend | React + Vite |
| Backend | Flask + SQLAlchemy |
| Base de Datos | SQLite |
| ML | scikit-learn |

## 🚀 Instalación Rápida

### 1. Clonar repositorio
```bash
git clone [url-repositorio]
cd costos-embutidos
```

### 2. Configurar Variables de Entorno

Copie el archivo de ejemplo y configure sus valores:

```bash
cp .env.example .env
```

Edite `.env` y configure al menos las siguientes variables **importantes para producción**:

```bash
# CRÍTICO: Cambiar en producción
JWT_SECRET_KEY=your-super-secret-jwt-key-CHANGE-THIS

# Entorno: development | production
FLASK_ENV=development

# CORS (solo para producción)
ALLOWED_ORIGINS=https://tu-dominio.com
```

> 💡 **Tip**: Para generar una clave JWT segura:
> ```bash
> python -c "import secrets; print(secrets.token_urlsafe(32))"
> ```

Ver [`.env.example`](.env.example) para todas las variables disponibles.

### 3. Backend (Python 3.10+)
```bash
cd backend
python -m venv venv
# Windows
.\venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
python scripts/seed_data.py  # Datos iniciales
python app.py                # Iniciar servidor (puerto 5000)
```

### ✅ Tests (pytest)

Desde la raíz del proyecto (o desde `backend/`), con el venv activado:

```bash
pip install -r backend/requirements-dev.txt
pytest
```

### 🔮 ML (opcional)

Si vas a usar Proyecciones ML / predictor:

```bash
pip install -r backend/requirements-ml.txt
```

### 3. Frontend
```bash
cd ..  # Volver a raíz
npm install
npm run dev  # Iniciar (puerto 5173)
```

### 4. Acceder
Abrir navegador en: `http://localhost:5173`

## 📖 Documentación

📚 **[Guía de Usuario Completa](USER_GUIDE.md)** - Documentación detallada paso a paso

## 📁 Estructura del Proyecto

```
costos-embutidos/
├── backend/
│   ├── app.py              # API Flask
│   ├── models.py           # Modelos SQLAlchemy
│   ├── predictor.py        # Módulo ML
│   ├── seed_data.py        # Datos iniciales
│   └── requirements.txt    # Dependencias Python
├── src/
│   ├── pages/              # Componentes de páginas
│   │   ├── Dashboard.jsx
│   │   ├── MateriasPrimas.jsx
│   │   ├── Productos.jsx
│   │   ├── ProduccionProgramada.jsx
│   │   ├── CostosIndirectos.jsx
│   │   ├── Formulacion.jsx
│   │   ├── Proyecciones.jsx
│   │   └── Escenarios.jsx
│   ├── services/
│   │   └── api.js          # Cliente API
│   └── App.jsx             # Router principal
├── data/                   # Archivos Excel importados
├── package.json
└── vite.config.js
```

## 🔧 Configuración

El backend se configura en `backend/app.py`:
- Base de datos: `sqlite:///costos_embutidos.db`
- Puerto API: 5000
- CORS habilitado para desarrollo

### Variables de entorno útiles (dev/tests)

- `COSTOS_EMBUTIDOS_DATABASE_URI`: override del URI de SQLAlchemy (ej: `sqlite:///:memory:`)
- `COSTOS_EMBUTIDOS_SKIP_INIT_DB=1`: evita que `app.py` ejecute inicialización/seed automático al importarse (útil para scripts de validación con DB aislada)

### Logging (backend)

- `COSTOS_LOG_LEVEL`: nivel (`DEBUG`, `INFO`, `WARNING`, ...). Default: `INFO`
- `COSTOS_LOG_FILE`: ruta de log (default: `backend/logs/app.log`)
- `COSTOS_LOG_MAX_BYTES`: tamaño máximo por archivo (default: 5242880)
- `COSTOS_LOG_BACKUP_COUNT`: cantidad de rotaciones (default: 5)

El backend también registra cada request con método, ruta, status y duración.

### Healthcheck

- `GET /api/health` → `{ "status": "ok", "version": "..." }`

### 💾 Persistencia de Datos

✅ **Todos los datos se guardan permanentemente** en la base de datos SQLite (`backend/costos_embutidos.db`)

Los datos persisten automáticamente:
- ✅ Entre sesiones (cerrar y abrir la aplicación)
- ✅ Después de reiniciar el servidor
- ✅ Después de reiniciar la computadora

**Datos que se persisten incluyen:**
- Productos y fórmulas/recetas
- Materias primas y precios
- Producción programada e histórica
- Costos indirectos por mes
- Configuración de inflación mensual
- Categorías personalizadas

> 💡 **Nota**: Mientras no elimine manualmente el archivo `backend/costos_embutidos.db`, todos sus datos permanecerán intactos.

## 📞 Soporte

Para dudas o problemas, consultar la [Guía de Usuario](USER_GUIDE.md) o crear un issue en el repositorio.

---

**© 2024 Sistema de Costeo de Embutidos** | Desarrollado con ❤️
# Test deploy Mon Dec 22 09:36:35 -03 2025
