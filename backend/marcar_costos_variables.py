"""
Script para marcar costos indirectos como variables.

Según el análisis, los siguientes tipos de costos deberían ser variables
(escalan con el volumen de producción):
- Agua
- Análisis de Laboratorio
- Combustibles
- Energía Eléctrica
- Gas Natural
- Material de Limpieza
- Productos Desinfectantes
- Productos Químicos
- Horas Extra
"""

import os
import sys

# Agregar el directorio backend al path
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app import app, db, CostoIndirecto

# Patrones de cuentas que deberían ser variables
CUENTAS_VARIABLES = [
    'agua',
    'análisis de laboratorio',
    'analisis de laboratorio',
    'combustibles',
    'energía eléctrica',
    'energia electrica',
    'gas natural',
    'material de limpieza',
    'productos desinfectantes',
    'productos químicos',
    'productos quimicos',
    'horas extra',
    'material electrico',  # Similar a limpieza/mantenimiento
]

def marcar_costos_variables():
    """Marca como variables los costos que coinciden con los patrones."""
    with app.app_context():
        costos = CostoIndirecto.query.all()
        actualizados = []
        
        for costo in costos:
            cuenta_lower = costo.cuenta.lower()
            for patron in CUENTAS_VARIABLES:
                if patron in cuenta_lower:
                    if not costo.es_variable:
                        costo.es_variable = True
                        actualizados.append(costo.cuenta)
                    break
        
        if actualizados:
            db.session.commit()
            print(f"[OK] {len(actualizados)} costos marcados como variables:")
            for cuenta in actualizados:
                print(f"   - {cuenta}")
        else:
            print("[INFO] No se encontraron costos para actualizar.")
        
        # Mostrar resumen
        total_fijos = CostoIndirecto.query.filter_by(es_variable=False).count()
        total_variables = CostoIndirecto.query.filter_by(es_variable=True).count()
        print(f"\n[RESUMEN] {total_fijos} costos fijos, {total_variables} costos variables")

if __name__ == '__main__':
    marcar_costos_variables()
