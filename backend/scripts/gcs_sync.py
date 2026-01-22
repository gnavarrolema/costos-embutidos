"""
Script para sincronizar la base de datos con Google Cloud Storage.

Uso:
    python gcs_sync.py download   # Descargar BD de producción a local
    python gcs_sync.py upload     # Subir BD local a producción (¡CUIDADO!)
    python gcs_sync.py status     # Ver estado del bucket

Requiere:
    pip install google-cloud-storage
"""
import sys
import os
from datetime import datetime

# Configuración
PROJECT_ID = 'costos-embutidos'
BUCKET_NAME = f'{PROJECT_ID}-data'  # Convención: PROJECT-data
GCS_DB_PATH = 'instance/costos_embutidos.db'

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_DB_PATH = os.path.join(BACKEND_DIR, 'costos_embutidos.db')
BACKUP_DIR = os.path.join(BACKEND_DIR, 'backups')
KEY_FILE = os.path.join(os.path.dirname(BACKEND_DIR), 'gcp-key.json')


def get_storage_client():
    """Obtiene cliente de GCS autenticado"""
    try:
        from google.cloud import storage
    except ImportError:
        print("❌ Falta instalar google-cloud-storage:")
        print("   pip install google-cloud-storage")
        sys.exit(1)
    
    if os.path.exists(KEY_FILE):
        return storage.Client.from_service_account_json(KEY_FILE)
    else:
        # Intentar autenticación por defecto (gcloud auth)
        print("⚠️  No se encontró gcp-key.json, usando credenciales por defecto")
        return storage.Client(project=PROJECT_ID)


def download_db():
    """Descarga la BD de producción a local"""
    client = get_storage_client()
    
    try:
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(GCS_DB_PATH)
        
        if not blob.exists():
            print(f"❌ No existe la BD en gs://{BUCKET_NAME}/{GCS_DB_PATH}")
            return False
        
        # Crear backup de la BD local actual
        if os.path.exists(LOCAL_DB_PATH):
            os.makedirs(BACKUP_DIR, exist_ok=True)
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_path = os.path.join(BACKUP_DIR, f'costos_embutidos_{timestamp}_pre_gcs_download.db')
            import shutil
            shutil.copy2(LOCAL_DB_PATH, backup_path)
            print(f"📦 Backup local creado: {backup_path}")
        
        # Descargar
        print(f"⬇️  Descargando gs://{BUCKET_NAME}/{GCS_DB_PATH}...")
        blob.download_to_filename(LOCAL_DB_PATH)
        
        size = os.path.getsize(LOCAL_DB_PATH)
        print(f"✅ BD descargada: {LOCAL_DB_PATH} ({size:,} bytes)")
        
        # Mostrar contenido
        show_db_status(LOCAL_DB_PATH)
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def upload_db():
    """Sube la BD local a producción (¡PELIGROSO!)"""
    if not os.path.exists(LOCAL_DB_PATH):
        print(f"❌ No existe la BD local: {LOCAL_DB_PATH}")
        return False
    
    print("⚠️  ¡ADVERTENCIA! Esto sobrescribirá la BD de producción.")
    confirm = input("Escribe 'CONFIRMAR' para continuar: ")
    if confirm != 'CONFIRMAR':
        print("❌ Operación cancelada")
        return False
    
    client = get_storage_client()
    
    try:
        bucket = client.bucket(BUCKET_NAME)
        blob = bucket.blob(GCS_DB_PATH)
        
        # Crear backup en GCS primero
        if blob.exists():
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            backup_blob = bucket.blob(f'backups/costos_embutidos_{timestamp}_pre_upload.db')
            bucket.copy_blob(blob, bucket, backup_blob.name)
            print(f"📦 Backup en GCS: gs://{BUCKET_NAME}/{backup_blob.name}")
        
        # Subir
        print(f"⬆️  Subiendo a gs://{BUCKET_NAME}/{GCS_DB_PATH}...")
        blob.upload_from_filename(LOCAL_DB_PATH)
        
        print(f"✅ BD subida exitosamente")
        return True
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return False


def show_gcs_status():
    """Muestra el estado del bucket de GCS"""
    client = get_storage_client()
    
    try:
        bucket = client.bucket(BUCKET_NAME)
        
        if not bucket.exists():
            print(f"❌ No existe el bucket: gs://{BUCKET_NAME}")
            return
        
        print(f"📁 Bucket: gs://{BUCKET_NAME}")
        print()
        
        blobs = list(bucket.list_blobs())
        if not blobs:
            print("   (vacío)")
            return
        
        print("   Contenido:")
        for blob in blobs:
            size = blob.size or 0
            updated = blob.updated.strftime('%Y-%m-%d %H:%M:%S') if blob.updated else 'N/A'
            print(f"   {blob.name:50s} {size:>10,} bytes  {updated}")
        
        # Verificar si existe la BD
        db_blob = bucket.blob(GCS_DB_PATH)
        if db_blob.exists():
            db_blob.reload()
            print()
            print(f"✅ BD encontrada: gs://{BUCKET_NAME}/{GCS_DB_PATH}")
            print(f"   Tamaño: {db_blob.size:,} bytes")
            print(f"   Actualizado: {db_blob.updated}")
        else:
            print()
            print(f"⚠️  No existe BD en: gs://{BUCKET_NAME}/{GCS_DB_PATH}")
            
    except Exception as e:
        print(f"❌ Error: {e}")


def show_db_status(db_path):
    """Muestra el contenido de una BD"""
    import sqlite3
    
    if not os.path.exists(db_path):
        print(f"❌ No existe: {db_path}")
        return
    
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    print()
    print("📊 Contenido de la BD:")
    
    tables = ['productos', 'materias_primas', 'costos_indirectos', 'formula_detalles', 
              'produccion_programada', 'produccion_historica', 'inflacion_mensual']
    
    for table in tables:
        try:
            count = c.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
            status = "✅" if count > 0 else "⚠️ "
            print(f"   {status} {table:25s}: {count:>6d} registros")
        except Exception as e:
            print(f"   ❌ {table:25s}: ERROR")
    
    conn.close()


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    command = sys.argv[1].lower()
    
    if command == 'download':
        download_db()
    elif command == 'upload':
        upload_db()
    elif command == 'status':
        show_gcs_status()
    else:
        print(f"❌ Comando desconocido: {command}")
        print(__doc__)


if __name__ == '__main__':
    main()
