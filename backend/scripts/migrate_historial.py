#!/usr/bin/env python3
"""
Migración: Crear tabla historial_precios
Fecha: 2025-12-17
Descripción: Agrega tabla para rastrear cambios de precios en materias primas
"""

from flask import Flask
from models import db, HistorialPrecios
import os

# Configurar app
app = Flask(__name__)
basedir = os.path.abspath(os.path.dirname(__file__))
default_db_uri = f'sqlite:///{os.path.join(basedir, "costos_embutidos.db")}'
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('COSTOS_EMBUTIDOS_DATABASE_URI', default_db_uri)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

def migrate():
    """Ejecuta la migración"""
    with app.app_context():
        # Crear tabla historial_precios si no existe
        db.create_all()
        print("✅ Migración completada: tabla 'historial_precios' creada")

if __name__ == '__main__':
    migrate()
