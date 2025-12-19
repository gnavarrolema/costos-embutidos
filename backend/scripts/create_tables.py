"""Script para crear las tablas nuevas"""
import sys
sys.path.insert(0, '.')

from app import app, db
from models import CostoIndirecto, InflacionMensual

with app.app_context():
    db.create_all()
    print("✅ Tablas creadas correctamente")
