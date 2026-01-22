# Scripts de Configuración y Mantenimiento

Esta carpeta contiene scripts auxiliares para configuración inicial y mantenimiento de la base de datos. Estos scripts **no son necesarios** para el funcionamiento normal de la aplicación en producción.

## 📋 Scripts Disponibles

### Configuración Inicial

#### `create_users.py`
Crea usuarios iniciales en el sistema.

```bash
python scripts/create_users.py
```

Usuarios por defecto:
- **admin** (admin123) - Administrador del sistema
- **costos** (costos2024) - Usuario de costos
- **consulta** (consulta123) - Usuario de solo lectura

Opciones:
```bash
python scripts/create_users.py --reset-admin  # Resetear contraseña de admin
```

#### `seed_data.py`
Carga datos semilla (materias primas, productos y fórmulas de ejemplo).

```bash
python scripts/seed_data.py
```

### Mantenimiento de Base de Datos

#### `db_utils.py`
Utilidad para backup, restauración y diagnóstico de la base de datos local.

```bash
python scripts/db_utils.py status    # Ver estado de la BD
python scripts/db_utils.py backup    # Crear backup
python scripts/db_utils.py list      # Listar backups disponibles
python scripts/db_utils.py restore <archivo>  # Restaurar desde backup
```

#### `gcs_sync.py`
Sincroniza la base de datos con Google Cloud Storage (producción).

```bash
python scripts/gcs_sync.py status    # Ver estado del bucket GCS
python scripts/gcs_sync.py download  # Descargar BD de producción
python scripts/gcs_sync.py upload    # Subir BD a producción (requiere confirmación)
```

> ⚠️ Requiere el archivo `gcp-key.json` con credenciales de servicio.

#### `create_tables.py`
Crea las tablas de la base de datos manualmente.

```bash
python scripts/create_tables.py
```

> ℹ️ Normalmente no es necesario, ya que `app.py` crea las tablas automáticamente.

#### `recreate_db.py`
⚠️ **PELIGRO**: Elimina y recrea la base de datos completamente.

```bash
python scripts/recreate_db.py
```

> ⚠️ Esto **borrará todos los datos**. Usar solo en desarrollo.

### Importación de Datos

#### `import_excel.py`
Importa datos históricos de producción desde Excel.

```bash
python scripts/import_excel.py --excel ../data/Histórico_Producción.xlsx
python scripts/import_excel.py --excel ../data/Histórico_Producción.xlsx --train  # Con entrenamiento ML
```

### Migraciones

#### `migrate_historial.py`
Migración ejecutada para crear la tabla `historial_precios`.

```bash
python scripts/migrate_historial.py
```

> ℹ️ Esta migración ya fue ejecutada. Se mantiene solo como referencia.

## ⚠️ Advertencias

1. **Producción**: Estos scripts están diseñados para desarrollo/configuración inicial
2. **Credenciales**: Cambiar contraseñas por defecto antes de desplegar a producción
3. **Backups**: Hacer backup de `costos_embutidos.db` antes de ejecutar scripts destructivos
4. **Rutas**: Ejecutar desde el directorio `backend/` para que las rutas relativas funcionen correctamente
5. **GCS Sync**: Antes de subir a producción, verificar siempre el estado con `gcs_sync.py status`

## 🔗 Ver También

- [README.md](../../README.md) - Documentación principal
- [USER_GUIDE.md](../../USER_GUIDE.md) - Guía de usuario completa
- [CONTRIBUTING.md](../../CONTRIBUTING.md) - Guía de desarrollo y CI/CD
