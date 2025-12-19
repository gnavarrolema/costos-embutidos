#!/usr/bin/env python3
"""Script para recrear la base de datos con el nuevo esquema"""
import os

# Eliminar la base de datos existente
db_path = os.path.join(os.path.dirname(__file__), 'costos_embutidos.db')
if os.path.exists(db_path):
    os.remove(db_path)
    print(f"✅ Base de datos eliminada: {db_path}")

# Importar y recrear
from app import app, db

with app.app_context():
    db.create_all()
    print("✅ Base de datos recreada con el nuevo esquema")
    print("✅ Categorías iniciales creadas automáticamente")
