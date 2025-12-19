"""Script temporal para re-entrenar el modelo ML"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from models import ProduccionHistorica
from predictor import get_predictor

with app.app_context():
    historicos = ProduccionHistorica.query.all()
    data = [
        {'producto_id': h.producto_id, 'año': h.año, 'mes': h.mes, 'cantidad_kg': h.cantidad_kg}
        for h in historicos
    ]
    print(f'📊 Datos a entrenar: {len(data)} registros')
    productos_unicos = len(set(h['producto_id'] for h in data))
    print(f'📦 Productos únicos con historial: {productos_unicos}')
    
    predictor = get_predictor()
    result = predictor.train(data)
    
    if result.get('success'):
        print(f'✅ Modelo entrenado:')
        print(f'   Productos entrenados: {result.get("productos_entrenados", 0)}')
        print(f'   Modelo global: {"Sí" if result.get("modelo_global") else "No"}')
    else:
        print(f'❌ Error: {result.get("error")}')
