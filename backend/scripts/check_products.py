"""Script para analizar productos en la base de datos"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, db
from models import Producto, ProduccionHistorica

with app.app_context():
    print("=" * 70)
    print("ANÁLISIS DE PRODUCTOS")
    print("=" * 70)
    
    # Productos activos
    activos = Producto.query.filter_by(activo=True).all()
    print(f"\n📦 Productos ACTIVOS: {len(activos)}")
    for p in activos:
        print(f"   ID={p.id:3d} | {p.codigo:8s} | {p.nombre}")
    
    # Productos inactivos
    inactivos = Producto.query.filter_by(activo=False).all()
    print(f"\n❌ Productos INACTIVOS: {len(inactivos)}")
    for p in inactivos:
        print(f"   ID={p.id:3d} | {p.codigo:8s} | {p.nombre}")
    
    # Productos con historial
    print("\n" + "=" * 70)
    print("PRODUCTOS CON DATOS HISTÓRICOS")
    print("=" * 70)
    
    # Agrupar histórico por producto
    from sqlalchemy import func
    historico_por_producto = db.session.query(
        ProduccionHistorica.producto_id,
        func.count(ProduccionHistorica.id).label('registros'),
        func.sum(ProduccionHistorica.cantidad_kg).label('total_kg')
    ).group_by(ProduccionHistorica.producto_id).all()
    
    print(f"\n📊 Productos con historial: {len(historico_por_producto)}")
    
    for h in historico_por_producto:
        prod = Producto.query.get(h.producto_id)
        estado = "✅" if prod and prod.activo else "❌"
        nombre = prod.nombre if prod else "PRODUCTO NO ENCONTRADO"
        codigo = prod.codigo if prod else "???"
        print(f"   {estado} ID={h.producto_id:3d} | {codigo:8s} | {nombre[:35]:35s} | {h.registros} registros | {h.total_kg:,.0f} kg")
    
    # Identificar duplicados por código
    print("\n" + "=" * 70)
    print("POSIBLES DUPLICADOS (mismo código)")
    print("=" * 70)
    
    all_products = Producto.query.all()
    codigo_map = {}
    for p in all_products:
        if p.codigo not in codigo_map:
            codigo_map[p.codigo] = []
        codigo_map[p.codigo].append(p)
    
    duplicados = {k: v for k, v in codigo_map.items() if len(v) > 1}
    
    if duplicados:
        for codigo, prods in duplicados.items():
            print(f"\n   Código {codigo}:")
            for p in prods:
                estado = "ACTIVO" if p.activo else "INACTIVO"
                # Contar historial
                hist_count = ProduccionHistorica.query.filter_by(producto_id=p.id).count()
                print(f"      ID={p.id:3d} | {p.nombre[:40]:40s} | {estado:8s} | {hist_count} registros históricos")
    else:
        print("   No se encontraron productos duplicados por código")
