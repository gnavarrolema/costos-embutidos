"""
Script para crear usuarios iniciales en el sistema de Costos Embutidos
Ejecutar: python create_users.py
"""
import os
import sys

# Agregar el directorio backend al path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from models import db, Usuario

def create_app():
    app = Flask(__name__)
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get(
        'COSTOS_EMBUTIDOS_DATABASE_URI',
        f'sqlite:///{os.path.join(basedir, "costos_embutidos.db")}'
    )
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    db.init_app(app)
    return app


def create_default_users():
    """Crea los usuarios por defecto si no existen"""
    app = create_app()
    
    with app.app_context():
        # Crear tablas si no existen
        db.create_all()
        
        # Lista de usuarios por defecto
        default_users = [
            {
                'username': 'admin',
                'password': 'admin123',
                'nombre': 'Administrador del Sistema',
                'email': 'admin@embutidos.local',
                'rol': 'admin'
            },
            {
                'username': 'costos',
                'password': 'costos2024',
                'nombre': 'Usuario de Costos',
                'email': 'costos@embutidos.local',
                'rol': 'usuario'
            },
            {
                'username': 'consulta',
                'password': 'consulta123',
                'nombre': 'Usuario de Consulta',
                'email': 'consulta@embutidos.local',
                'rol': 'lectura'
            }
        ]
        
        created = 0
        for user_data in default_users:
            # Verificar si el usuario ya existe
            existing = Usuario.query.filter_by(username=user_data['username']).first()
            if existing:
                print(f"⏭️  Usuario '{user_data['username']}' ya existe")
                continue
            
            # Crear nuevo usuario
            user = Usuario(
                username=user_data['username'],
                nombre=user_data['nombre'],
                email=user_data['email'],
                rol=user_data['rol']
            )
            user.set_password(user_data['password'])
            db.session.add(user)
            created += 1
            print(f"✅ Usuario '{user_data['username']}' creado (contraseña: {user_data['password']})")
        
        if created > 0:
            db.session.commit()
            print(f"\n🎉 {created} usuario(s) creado(s) exitosamente")
        else:
            print("\nℹ️  No se crearon nuevos usuarios")
        
        # Mostrar todos los usuarios
        print("\n📋 Usuarios en el sistema:")
        print("-" * 60)
        for user in Usuario.query.all():
            status = "✓ Activo" if user.activo else "✗ Inactivo"
            print(f"  {user.username:15} | {user.nombre:25} | {user.rol:10} | {status}")


def reset_admin_password():
    """Resetea la contraseña del administrador"""
    app = create_app()
    
    with app.app_context():
        admin = Usuario.query.filter_by(username='admin').first()
        if admin:
            admin.set_password('admin123')
            db.session.commit()
            print("✅ Contraseña de admin reseteada a 'admin123'")
        else:
            print("❌ Usuario admin no encontrado")


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--reset-admin':
        reset_admin_password()
    else:
        print("=" * 60)
        print("  CREACIÓN DE USUARIOS - COSTOS EMBUTIDOS")
        print("=" * 60)
        create_default_users()
        print("\n⚠️  IMPORTANTE: Cambie las contraseñas por defecto en producción")
        print("   Puede hacerlo desde el panel de administración del sistema")
