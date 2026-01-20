"""
Script para importar datos históricos de producción desde Excel.
Ejecutar desde el directorio backend con el entorno virtual activado:
    python import_excel.py
"""
import os
import sys
from datetime import datetime

# Agregar el directorio actual al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Importar pandas
try:
    import pandas as pd
except ImportError:
    print("❌ Error: pandas no está instalado. Ejecuta:")
    print("   pip install pandas openpyxl")
    sys.exit(1)

from app import app, db
from models import Producto, ProduccionHistorica


def parse_cantidad(valor):
    """Convierte valores del Excel (ej: '1.179,30' o 1179.3) a float"""
    if pd.isna(valor) or valor == '-' or valor == '':
        return 0.0
    if isinstance(valor, (int, float)):
        return float(valor)
    # Formato argentino: 1.179,30 -> 1179.30
    str_val = str(valor).strip()
    str_val = str_val.replace('.', '')  # Quitar separador de miles
    str_val = str_val.replace(',', '.')  # Cambiar decimal
    try:
        return float(str_val)
    except ValueError:
        return 0.0


def parse_fecha(valor):
    """Convierte fecha del Excel a date object"""
    if pd.isna(valor):
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, str):
        # Intentar varios formatos
        for fmt in ['%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y']:
            try:
                return datetime.strptime(valor, fmt).date()
            except ValueError:
                continue
    return None


def normalize_product_code(codigo):
    """
    Normaliza el código de producto para evitar duplicados.
    
    Estrategia: Los códigos numéricos se normalizan a 5 dígitos con padding de ceros.
    Ejemplo: '5936' -> '05936', '05936' -> '05936'
    """
    if not codigo:
        return codigo
    
    codigo_str = str(codigo).strip()
    
    # Si es puramente numérico, normalizar a 5 dígitos
    if codigo_str.isdigit():
        return codigo_str.zfill(5)
    
    return codigo_str


def find_existing_product(codigo, productos_db, productos_by_name):
    """
    Busca un producto existente por código normalizado o nombre similar.
    
    Args:
        codigo: Código del producto
        productos_db: Dict de productos indexados por código normalizado
        productos_by_name: Dict de productos indexados por nombre normalizado
    
    Returns:
        Producto existente o None
    """
    # 1. Buscar por código normalizado
    norm_code = normalize_product_code(codigo)
    if norm_code in productos_db:
        return productos_db[norm_code]
    
    # 2. Buscar por código original (sin normalizar)
    if codigo in productos_db:
        return productos_db[codigo]
    
    return None


def import_production_data(excel_path):
    """
    Importa datos de producción desde el archivo Excel.
    
    Formato esperado del Excel:
    - Columna A: Código (del producto)
    - Columna B: Fecha
    - Columna C: Producto (nombre)
    - Columna D: Unidad de Medida
    - Columna E: Producto Terminado (cantidad en Kg)
    
    MEJORA: Normaliza códigos de producto para evitar duplicados
    (ej: '5936' y '05936' se tratan como el mismo producto)
    """
    print(f"📂 Leyendo archivo: {excel_path}")
    
    if not os.path.exists(excel_path):
        print(f"❌ Archivo no encontrado: {excel_path}")
        return {'success': False, 'error': 'Archivo no encontrado'}
    
    # Leer Excel
    try:
        df = pd.read_excel(excel_path, engine='openpyxl')
    except Exception as e:
        print(f"❌ Error leyendo Excel: {e}")
        return {'success': False, 'error': str(e)}
    
    print(f"📊 {len(df)} filas encontradas")
    print(f"📋 Columnas: {list(df.columns)}")
    
    # Normalizar nombres de columnas
    df.columns = [str(c).strip().lower() for c in df.columns]
    
    # Mapear columnas (flexible)
    col_map = {}
    for col in df.columns:
        if 'codigo' in col or 'código' in col:
            col_map['codigo'] = col
        elif 'fecha' in col:
            col_map['fecha'] = col
        elif 'producto' in col and 'terminado' not in col:
            col_map['producto'] = col
        elif 'terminado' in col or 'cantidad' in col:
            col_map['cantidad'] = col
    
    print(f"🔗 Mapeo de columnas: {col_map}")
    
    if 'codigo' not in col_map or 'fecha' not in col_map or 'cantidad' not in col_map:
        print("❌ No se encontraron las columnas necesarias (codigo, fecha, cantidad)")
        return {'success': False, 'error': 'Columnas no encontradas en Excel'}
    
    with app.app_context():
        # Construir mapeo de productos ACTIVOS con código normalizado
        # Solo consideramos productos activos para evitar reactivar duplicados
        all_products = Producto.query.filter_by(activo=True).all()
        productos_db = {}
        productos_by_name = {}
        
        for p in all_products:
            # Indexar por código normalizado
            norm_code = normalize_product_code(p.codigo)
            productos_db[norm_code] = p
            # También indexar por código original por si acaso
            productos_db[p.codigo] = p
            # Indexar por nombre normalizado (minúscula, sin espacios extra)
            norm_name = p.nombre.strip().lower()
            productos_by_name[norm_name] = p
        
        print(f"📦 Productos activos en DB: {len(all_products)}")
        
        productos_creados = 0
        registros_importados = 0
        registros_actualizados = 0
        errores = []
        
        for idx, row in df.iterrows():
            try:
                codigo_raw = str(row[col_map['codigo']]).strip()
                codigo = normalize_product_code(codigo_raw)
                fecha = parse_fecha(row[col_map['fecha']])
                cantidad = parse_cantidad(row[col_map['cantidad']])
                nombre = row[col_map['producto']] if 'producto' in col_map else f"Producto {codigo}"
                
                if not codigo or not fecha or cantidad <= 0:
                    continue
                
                # Buscar producto existente
                producto = find_existing_product(codigo, productos_db, productos_by_name)
                
                if producto is None:
                    # Verificar también por nombre antes de crear
                    norm_name = str(nombre).strip().lower()
                    if norm_name in productos_by_name:
                        producto = productos_by_name[norm_name]
                        print(f"♻️  Producto '{nombre}' encontrado por nombre (código en Excel: {codigo_raw})")
                    else:
                        # Crear producto nuevo CON CÓDIGO NORMALIZADO
                        nuevo_producto = Producto(
                            codigo=codigo,  # Ya normalizado
                            nombre=str(nombre).strip(),
                            peso_batch_kg=100.0,  # Default, ajustar después
                            porcentaje_merma=1.0,
                            activo=True
                        )
                        db.session.add(nuevo_producto)
                        db.session.flush()  # Para obtener el ID
                        productos_db[codigo] = nuevo_producto
                        productos_by_name[str(nombre).strip().lower()] = nuevo_producto
                        productos_creados += 1
                        print(f"✨ Producto creado: {codigo} - {nombre}")
                        producto = nuevo_producto
                
                # Buscar si ya existe el registro histórico
                existente = ProduccionHistorica.query.filter_by(
                    producto_id=producto.id,
                    fecha=fecha
                ).first()
                
                if existente:
                    # Actualizar si el valor es diferente
                    if existente.cantidad_kg != cantidad:
                        existente.cantidad_kg = cantidad
                        registros_actualizados += 1
                else:
                    # Crear nuevo registro
                    hist = ProduccionHistorica(
                        producto_id=producto.id,
                        fecha=fecha,
                        cantidad_kg=cantidad,
                        año=fecha.year,
                        mes=fecha.month
                    )
                    db.session.add(hist)
                    registros_importados += 1
                
            except Exception as e:
                errores.append(f"Fila {idx + 2}: {str(e)}")
        
        db.session.commit()
        
        print(f"\n✅ Importación completada:")
        print(f"   - Productos creados: {productos_creados}")
        print(f"   - Registros importados: {registros_importados}")
        print(f"   - Registros actualizados: {registros_actualizados}")
        if errores:
            print(f"   - Errores: {len(errores)}")
            for err in errores[:5]:
                print(f"     • {err}")
        
        return {
            'success': True,
            'productos_creados': productos_creados,
            'registros_importados': registros_importados,
            'registros_actualizados': registros_actualizados,
            'errores': errores
        }


def train_model():
    """Entrena el modelo XGBoost con los datos históricos importados"""
    from predictor import predictor
    
    with app.app_context():
        # Obtener todos los datos históricos
        historicos = ProduccionHistorica.query.all()
        
        if not historicos:
            print("❌ No hay datos históricos. Importe datos primero.")
            return
        
        data = [
            {
                'producto_id': h.producto_id,
                'año': h.año,
                'mes': h.mes,
                'cantidad_kg': h.cantidad_kg
            }
            for h in historicos
        ]
        
        print(f"📊 Entrenando modelo con {len(data)} registros...")
        result = predictor.train(data)
        
        if result.get('success'):
            print(f"✅ Modelo entrenado exitosamente:")
            print(f"   - Productos con modelo propio: {result.get('productos_entrenados', 0)}")
            print(f"   - Productos sin datos suficientes: {result.get('productos_sin_datos', 0)}")
            print(f"   - Modelo global: {'Sí' if result.get('modelo_global') else 'No'}")
        else:
            print(f"❌ Error: {result.get('error')}")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Importar datos históricos de producción')
    parser.add_argument('--excel', type=str, 
                        default='../data/Histórico_Producción.xlsx',
                        help='Ruta al archivo Excel')
    parser.add_argument('--train', action='store_true',
                        help='Entrenar modelo después de importar')
    
    args = parser.parse_args()
    
    # Importar datos
    result = import_production_data(args.excel)
    
    # Entrenar modelo si se solicita
    if args.train and result.get('success'):
        print("\n📈 Entrenando modelo ML...")
        train_model()
