"""
Script para cargar datos semilla en la base de datos.
Ejecutar desde el directorio backend con el entorno virtual activado:
    python seed_data.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import Categoria, MateriaPrima, Producto, FormulaDetalle

def seed_database():
    with app.app_context():
        print("🌱 Iniciando carga de datos semilla...")
        
        # Verificar que existan categorías
        if Categoria.query.count() == 0:
            print("❌ No hay categorías. Ejecuta app.py primero para crear las categorías.")
            return
        
        # Obtener categorías
        categorias = {c.nombre: c for c in Categoria.query.all()}
        print(f"✅ Categorías encontradas: {list(categorias.keys())}")
        
        # ===== MATERIAS PRIMAS =====
        if MateriaPrima.query.count() == 0:
            print("📦 Creando materias primas...")
            
            materias_primas = [
                # CARNES - CERDO
                {'codigo': '91101', 'nombre': 'Recorte de Cerdo', 'categoria': 'CERDO', 'unidad': 'Kg', 'costo_unitario': 56250},
                {'codigo': '91131', 'nombre': 'Recorte de Grasa', 'categoria': 'CERDO', 'unidad': 'Kg', 'costo_unitario': 0},
                {'codigo': '91102', 'nombre': 'Tocino', 'categoria': 'CERDO', 'unidad': 'Kg', 'costo_unitario': 15000},
                
                # CARNES - POLLO
                {'codigo': '05815', 'nombre': 'Bife de Pata Muslo', 'categoria': 'POLLO', 'unidad': 'Kg', 'costo_unitario': 0},
                
                # INSUMOS
                {'codigo': '', 'nombre': 'Agua', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 0},
                {'codigo': '91112', 'nombre': 'Humo Líquido', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 5},
                {'codigo': '91113', 'nombre': 'Colorante Carmín Fino', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 53000},
                {'codigo': '', 'nombre': 'Sal', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 1700},
                {'codigo': '91138', 'nombre': 'Ají Molido', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 950},
                {'codigo': '91141', 'nombre': 'Eritorbato de Sodio', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 190},
                {'codigo': '91159', 'nombre': 'Azúcar', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 950},
                {'codigo': '91176', 'nombre': 'Farmesal', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 240},
                {'codigo': '91179', 'nombre': 'Pimienta Negra Molida', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 4650},
                {'codigo': '91180', 'nombre': 'Ajo en Polvo', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 1730},
                {'codigo': '91181', 'nombre': 'Comino', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 1530},
                {'codigo': '91187', 'nombre': 'Texturizado de Soja Fina', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 5000},
                {'codigo': '91189', 'nombre': 'Flendiplus', 'categoria': 'INSUMOS', 'unidad': 'Kg', 'costo_unitario': 500},
                
                # ENVASES
                {'codigo': '91117', 'nombre': 'Film para Atador', 'categoria': 'ENVASES', 'unidad': 'Kg', 'costo_unitario': 9000},
                {'codigo': '91095', 'nombre': 'Tripa de Cerdo - Q', 'categoria': 'ENVASES', 'unidad': 'UND', 'costo_unitario': 1125},
                {'codigo': '44952', 'nombre': 'Etiqueta P/Gancho', 'categoria': 'ENVASES', 'unidad': 'UND', 'costo_unitario': 20000},
            ]
            
            for mp_data in materias_primas:
                cat = categorias.get(mp_data['categoria'])
                if cat:
                    mp = MateriaPrima(
                        codigo=mp_data['codigo'],
                        nombre=mp_data['nombre'],
                        categoria_id=cat.id,
                        unidad=mp_data['unidad'],
                        costo_unitario=mp_data['costo_unitario']
                    )
                    db.session.add(mp)
            
            db.session.commit()
            print(f"✅ {len(materias_primas)} materias primas creadas")
        else:
            print(f"ℹ️  Ya existen {MateriaPrima.query.count()} materias primas")
        
        # ===== PRODUCTOS =====
        if Producto.query.count() == 0:
            print("🌭 Creando productos...")
            
            productos = [
                {'codigo': '05936', 'nombre': 'Butifarra 1Kg', 'peso_batch_kg': 100.783, 'porcentaje_merma': 0.9},
                {'codigo': '05942', 'nombre': 'Chorizo Tipo Bombón en Gancho', 'peso_batch_kg': 100.783, 'porcentaje_merma': 0.9},
                {'codigo': '05931', 'nombre': 'Chorizo Parrillero en Gancho', 'peso_batch_kg': 85.5, 'porcentaje_merma': 1.0},
            ]
            
            for p_data in productos:
                producto = Producto(
                    codigo=p_data['codigo'],
                    nombre=p_data['nombre'],
                    peso_batch_kg=p_data['peso_batch_kg'],
                    porcentaje_merma=p_data['porcentaje_merma']
                )
                db.session.add(producto)
            
            db.session.commit()
            print(f"✅ {len(productos)} productos creados")
        else:
            print(f"ℹ️  Ya existen {Producto.query.count()} productos")
        
        # ===== FÓRMULAS =====
        butifarra = Producto.query.filter_by(codigo='05936').first()
        if butifarra and FormulaDetalle.query.filter_by(producto_id=butifarra.id).count() == 0:
            print("📋 Creando fórmula para Butifarra 1Kg...")
            
            # Mapa de nombres a materias primas
            mps = {mp.nombre: mp for mp in MateriaPrima.query.all()}
            
            formula_butifarra = [
                ('Recorte de Cerdo', 2.29),
                ('Tocino', 0.48),
                ('Sal', 0.51),
                ('Colorante Carmín Fino', 0.058),
                ('Farmesal', 0.24),
                ('Pimienta Negra Molida', 0.47),
                ('Ajo en Polvo', 0.17),
                ('Comino', 0.15),
                ('Texturizado de Soja Fina', 1.27),
                ('Flendiplus', 0.50),
                ('Film para Atador', 0.009),
                ('Tripa de Cerdo - Q', 15.89),
                ('Etiqueta P/Gancho', 4.3),
            ]
            
            for nombre, cantidad in formula_butifarra:
                mp = mps.get(nombre)
                if mp:
                    detalle = FormulaDetalle(
                        producto_id=butifarra.id,
                        materia_prima_id=mp.id,
                        cantidad=cantidad
                    )
                    db.session.add(detalle)
            
            db.session.commit()
            print(f"✅ Fórmula de Butifarra creada con {len(formula_butifarra)} ingredientes")
        
        print("\n🎉 ¡Datos semilla cargados exitosamente!")
        
        # Mostrar resumen
        print("\n📊 Resumen de la base de datos:")
        print(f"   - Categorías: {Categoria.query.count()}")
        print(f"   - Materias Primas: {MateriaPrima.query.count()}")
        print(f"   - Productos: {Producto.query.count()}")
        print(f"   - Detalles de Fórmulas: {FormulaDetalle.query.count()}")


if __name__ == '__main__':
    seed_database()
