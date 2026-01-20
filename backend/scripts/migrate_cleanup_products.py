#!/usr/bin/env python3
"""
Migración: Limpiar productos duplicados

Problema detectado:
- Existen productos duplicados con códigos similares (05936 vs 5936)
- El historial está dividido entre ambos
- Esto causa que el modelo ML entrene con datos fragmentados

Solución:
1. Identificar pares de productos duplicados
2. Migrar historial de duplicados -> originales
3. Desactivar productos duplicados
4. Limpiar historial huérfano

Ejecutar desde backend/: python scripts/migrate_cleanup_products.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from models import Producto, ProduccionHistorica, FormulaDetalle, ProduccionProgramada
from datetime import datetime

# Mapeo de productos duplicados -> originales
# Formato: {codigo_duplicado: codigo_original}
# Los códigos duplicados no tienen el 0 inicial
DUPLICATE_MAPPING = {
    '5931': '05931',   # Chorizo Parrillero en Gancho
    '5923': '05923',   # Chorizo Parrillero en Plancha
    '5942': '05942',   # Chorizo Tipo Bombón en Gancho
    '5940': '05940',   # Chorizo Tipo Bombón Plancha
    '5936': '05936',   # Butifarra 1 Kg
    '5904': '05904',   # Paleta
    '5952': '05952',   # Fiambre Sandwichero
    '5903': '05903',   # Jamón Cocido
    '5958': '05958',   # Fiambrelli
}


def get_product_by_code(code):
    """Obtiene un producto por código (exacto)"""
    return Producto.query.filter_by(codigo=code).first()


def migrate_historical_data(from_product_id, to_product_id, dry_run=True):
    """
    Migra datos históricos de un producto a otro.
    Evita duplicados verificando si ya existe un registro para el mismo año/mes.
    """
    # Obtener registros a migrar
    records = ProduccionHistorica.query.filter_by(producto_id=from_product_id).all()
    
    migrated = 0
    skipped = 0
    
    for record in records:
        # Verificar si ya existe un registro para este año/mes en el producto destino
        existing = ProduccionHistorica.query.filter_by(
            producto_id=to_product_id,
            año=record.año,
            mes=record.mes
        ).first()
        
        if existing:
            # Ya existe, no duplicar
            skipped += 1
            continue
        
        if not dry_run:
            # Actualizar el producto_id del registro
            record.producto_id = to_product_id
        
        migrated += 1
    
    return migrated, skipped


def migrate_production_planning(from_product_id, to_product_id, dry_run=True):
    """Migra datos de producción programada"""
    records = ProduccionProgramada.query.filter_by(producto_id=from_product_id).all()
    
    migrated = 0
    for record in records:
        if not dry_run:
            record.producto_id = to_product_id
        migrated += 1
    
    return migrated


def migrate_formulas(from_product_id, to_product_id, dry_run=True):
    """Migra fórmulas de producto"""
    # Verificar si el producto destino ya tiene fórmula
    dest_formulas = FormulaDetalle.query.filter_by(producto_id=to_product_id).count()
    if dest_formulas > 0:
        return 0, "destino ya tiene fórmula"
    
    records = FormulaDetalle.query.filter_by(producto_id=from_product_id).all()
    migrated = 0
    for record in records:
        if not dry_run:
            record.producto_id = to_product_id
        migrated += 1
    
    return migrated, None


def run_migration(dry_run=True):
    """Ejecuta la migración completa"""
    mode = "SIMULACIÓN" if dry_run else "EJECUCIÓN"
    print(f"\n{'='*70}")
    print(f"  LIMPIEZA DE PRODUCTOS DUPLICADOS - {mode}")
    print(f"{'='*70}")
    
    results = []
    
    for dup_code, orig_code in DUPLICATE_MAPPING.items():
        dup_product = get_product_by_code(dup_code)
        orig_product = get_product_by_code(orig_code)
        
        if not dup_product:
            print(f"\n⚠️  Producto duplicado {dup_code} no encontrado, saltando...")
            continue
        
        if not orig_product:
            print(f"\n⚠️  Producto original {orig_code} no encontrado, saltando...")
            continue
        
        print(f"\n📦 Limpiando: {dup_code} ({dup_product.nombre})")
        print(f"   Original: {orig_code} ({orig_product.nombre})")
        print(f"   IDs: duplicado={dup_product.id}, original={orig_product.id}")
        
        # Contar y eliminar historial del producto duplicado
        hist_count = ProduccionHistorica.query.filter_by(producto_id=dup_product.id).count()
        if hist_count > 0:
            if not dry_run:
                ProduccionHistorica.query.filter_by(producto_id=dup_product.id).delete()
            print(f"   🗑️  Eliminando {hist_count} registros históricos duplicados")
        
        # Eliminar producción programada del duplicado
        prog_count = ProduccionProgramada.query.filter_by(producto_id=dup_product.id).count()
        if prog_count > 0:
            if not dry_run:
                ProduccionProgramada.query.filter_by(producto_id=dup_product.id).delete()
            print(f"   🗑️  Eliminando {prog_count} registros de producción programada")
        
        # Eliminar fórmulas del duplicado (el original ya tiene)
        form_count = FormulaDetalle.query.filter_by(producto_id=dup_product.id).count()
        if form_count > 0:
            if not dry_run:
                FormulaDetalle.query.filter_by(producto_id=dup_product.id).delete()
            print(f"   🗑️  Eliminando {form_count} ingredientes de fórmula duplicados")
        
        # Desactivar producto duplicado
        if not dry_run:
            dup_product.activo = False
        print(f"   ❌ {'Desactivando' if not dry_run else '[SIMULACIÓN] Desactivaría'} producto {dup_code}")
        
        results.append({
            'code': dup_code,
            'hist_deleted': hist_count,
            'prog_deleted': prog_count,
            'form_deleted': form_count
        })
    
    if not dry_run:
        db.session.commit()
        print(f"\n✅ Cambios guardados en la base de datos")
    else:
        print(f"\n⚠️  Modo simulación - no se guardaron cambios")
        print(f"   Ejecute con --execute para aplicar los cambios")
    
    # Resumen
    print(f"\n{'='*70}")
    print("RESUMEN")
    print(f"{'='*70}")
    total_hist = sum(r['hist_deleted'] for r in results)
    total_prog = sum(r['prog_deleted'] for r in results)
    total_form = sum(r['form_deleted'] for r in results)
    print(f"   Productos procesados: {len(results)}")
    print(f"   Registros históricos eliminados: {total_hist}")
    print(f"   Registros producción eliminados: {total_prog}")
    print(f"   Ingredientes fórmula eliminados: {total_form}")
    
    return results


def verify_cleanup():
    """Verifica el estado después de la limpieza"""
    print(f"\n{'='*70}")
    print("VERIFICACIÓN POST-LIMPIEZA")
    print(f"{'='*70}")
    
    activos = Producto.query.filter_by(activo=True).count()
    inactivos = Producto.query.filter_by(activo=False).count()
    
    print(f"\n   Productos activos: {activos}")
    print(f"   Productos inactivos: {inactivos}")
    
    # Verificar productos con historial
    from sqlalchemy import func
    hist_count = db.session.query(
        ProduccionHistorica.producto_id
    ).distinct().count()
    
    print(f"   Productos con historial: {hist_count}")
    
    # Listar productos activos
    print("\n   Productos activos:")
    for p in Producto.query.filter_by(activo=True).order_by(Producto.codigo).all():
        hist = ProduccionHistorica.query.filter_by(producto_id=p.id).count()
        print(f"      {p.codigo} | {p.nombre[:35]:35s} | {hist} registros")


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Migrar y limpiar productos duplicados')
    parser.add_argument('--execute', action='store_true',
                        help='Ejecutar la migración (sin esto solo simula)')
    parser.add_argument('--verify', action='store_true',
                        help='Solo verificar estado actual')
    
    args = parser.parse_args()
    
    with app.app_context():
        if args.verify:
            verify_cleanup()
        else:
            dry_run = not args.execute
            run_migration(dry_run=dry_run)
            if not dry_run:
                verify_cleanup()
