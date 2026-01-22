"""
Script para backup y restauración de la base de datos.
Uso:
    python db_utils.py backup              # Crear backup
    python db_utils.py restore <archivo>   # Restaurar desde archivo
    python db_utils.py list                # Listar backups disponibles
    python db_utils.py status              # Ver estado de la BD actual
    python db_utils.py migrate <origen>    # Migrar datos desde otra BD
"""
import sys
import os
import shutil
import sqlite3
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Rutas
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__).replace('/scripts', '').replace('\\scripts', ''))
if BACKEND_DIR.endswith('scripts'):
    BACKEND_DIR = os.path.dirname(BACKEND_DIR)
DB_PATH = os.path.join(BACKEND_DIR, 'costos_embutidos.db')
BACKUP_DIR = os.path.join(BACKEND_DIR, 'backups')


def ensure_backup_dir():
    os.makedirs(BACKUP_DIR, exist_ok=True)


def create_backup(suffix='manual'):
    """Crea un backup de la base de datos"""
    ensure_backup_dir()
    
    if not os.path.exists(DB_PATH):
        print(f"❌ No existe la base de datos en: {DB_PATH}")
        return None
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = f'costos_embutidos_{timestamp}_{suffix}.db'
    backup_path = os.path.join(BACKUP_DIR, backup_name)
    
    shutil.copy2(DB_PATH, backup_path)
    print(f"✅ Backup creado: {backup_path}")
    print(f"   Tamaño: {os.path.getsize(backup_path):,} bytes")
    
    return backup_path


def restore_backup(backup_file):
    """Restaura la base de datos desde un archivo de backup"""
    # Si es solo el nombre del archivo, buscar en el directorio de backups
    if not os.path.isabs(backup_file):
        backup_path = os.path.join(BACKUP_DIR, backup_file)
    else:
        backup_path = backup_file
    
    if not os.path.exists(backup_path):
        print(f"❌ No existe el archivo de backup: {backup_path}")
        return False
    
    # Crear backup de la BD actual antes de restaurar
    if os.path.exists(DB_PATH):
        create_backup('pre_restore')
    
    shutil.copy2(backup_path, DB_PATH)
    print(f"✅ Base de datos restaurada desde: {backup_path}")
    
    # Mostrar estado
    show_status()
    return True


def list_backups():
    """Lista todos los backups disponibles"""
    ensure_backup_dir()
    
    backups = sorted([f for f in os.listdir(BACKUP_DIR) if f.endswith('.db')], reverse=True)
    
    if not backups:
        print("📭 No hay backups disponibles")
        return
    
    print(f"📁 Backups disponibles ({len(backups)}):")
    for b in backups:
        path = os.path.join(BACKUP_DIR, b)
        size = os.path.getsize(path)
        mtime = datetime.fromtimestamp(os.path.getmtime(path)).strftime('%Y-%m-%d %H:%M:%S')
        print(f"   {b:50s} {size:>10,} bytes  {mtime}")


def show_status():
    """Muestra el estado actual de la base de datos"""
    if not os.path.exists(DB_PATH):
        print(f"❌ No existe la base de datos en: {DB_PATH}")
        return
    
    print(f"📊 Estado de la base de datos")
    print(f"   Ruta: {DB_PATH}")
    print(f"   Tamaño: {os.path.getsize(DB_PATH):,} bytes")
    print()
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    tables = ['productos', 'materias_primas', 'costos_indirectos', 'formula_detalles', 
              'produccion_programada', 'produccion_historica', 'inflacion_mensual']
    
    print("   Contenido:")
    for table in tables:
        try:
            count = c.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
            status = "✅" if count > 0 else "⚠️ "
            print(f"   {status} {table:25s}: {count:>6d} registros")
        except Exception as e:
            print(f"   ❌ {table:25s}: ERROR - {e}")
    
    conn.close()


def migrate_data(source_db):
    """Migra datos desde otra base de datos"""
    if not os.path.exists(source_db):
        print(f"❌ No existe la base de datos origen: {source_db}")
        return False
    
    # Crear backup antes de migrar
    if os.path.exists(DB_PATH):
        create_backup('pre_migrate')
    
    print(f"📤 Migrando datos desde: {source_db}")
    
    source_conn = sqlite3.connect(source_db)
    dest_conn = sqlite3.connect(DB_PATH)
    
    # Tablas a migrar (en orden de dependencias)
    tables_to_migrate = [
        ('categorias', 'id, nombre, tipo'),
        ('materias_primas', 'id, codigo, nombre, categoria_id, unidad, costo_unitario, fecha_actualizacion, activo'),
        ('productos', 'id, codigo, nombre, peso_batch_kg, porcentaje_merma, min_mo_kg, activo, fecha_creacion'),
        ('formula_detalles', 'id, producto_id, materia_prima_id, cantidad'),
        ('costos_indirectos', 'id, mes_base, cuenta, descripcion, monto, tipo_distribucion'),
        ('inflacion_mensual', 'id, mes, porcentaje, fecha_creacion'),
        ('produccion_programada', 'id, producto_id, cantidad_batches, fecha_programacion'),
        ('produccion_historica', 'id, producto_id, fecha_produccion, año, mes, cantidad_kg'),
    ]
    
    migrated = 0
    for table, columns in tables_to_migrate:
        try:
            # Obtener datos de origen
            rows = source_conn.execute(f'SELECT {columns} FROM {table}').fetchall()
            if not rows:
                print(f"   ⚪ {table}: 0 registros (vacío)")
                continue
            
            # Insertar en destino (ignorando duplicados)
            placeholders = ','.join(['?' for _ in columns.split(',')])
            dest_conn.executemany(
                f'INSERT OR IGNORE INTO {table} ({columns}) VALUES ({placeholders})',
                rows
            )
            dest_conn.commit()
            
            # Contar cuántos se insertaron
            new_count = dest_conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
            print(f"   ✅ {table}: {len(rows)} -> {new_count} registros")
            migrated += len(rows)
            
        except Exception as e:
            print(f"   ❌ {table}: ERROR - {e}")
    
    source_conn.close()
    dest_conn.close()
    
    print(f"\n✅ Migración completada. {migrated} registros procesados.")
    show_status()
    return True


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    command = sys.argv[1].lower()
    
    if command == 'backup':
        create_backup()
    elif command == 'restore':
        if len(sys.argv) < 3:
            print("❌ Especifique el archivo de backup")
            list_backups()
            return
        restore_backup(sys.argv[2])
    elif command == 'list':
        list_backups()
    elif command == 'status':
        show_status()
    elif command == 'migrate':
        if len(sys.argv) < 3:
            print("❌ Especifique la base de datos origen")
            return
        migrate_data(sys.argv[2])
    else:
        print(f"❌ Comando desconocido: {command}")
        print(__doc__)


if __name__ == '__main__':
    main()
