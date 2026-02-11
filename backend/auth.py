"""
Módulo de autenticación para Costos Embutidos
Sistema simple de autenticación basado en JWT para uso interno
"""
from functools import wraps
from flask import request, jsonify, g
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from models import db, Usuario
import jwt
import os
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# Clave secreta para JWT - REQUERIDA en producción
SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
if not SECRET_KEY:
    # Solo para desarrollo local
    if os.environ.get('FLASK_ENV') == 'development':
        logger.warning('⚠️  Usando SECRET_KEY por defecto. NO USAR EN PRODUCCIÓN!')
        SECRET_KEY = 'dev-secret-key-CHANGE-IN-PRODUCTION'
    else:
        raise ValueError(
            '🔴 CRÍTICO: JWT_SECRET_KEY no está configurada. '
            'Defina esta variable de entorno antes de ejecutar en producción.'
        )

JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', '24'))


def generate_token(user):
    """Genera un token JWT para el usuario"""
    payload = {
        'user_id': user.id,
        'username': user.username,
        'nombre': user.nombre,
        'rol': user.rol,
        'exp': datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')


def decode_token(token):
    """Decodifica y valida un token JWT"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def token_required(f):
    """Decorador para proteger rutas que requieren autenticación"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Buscar token en el header Authorization
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            try:
                token = auth_header.split(' ')[1]  # Bearer <token>
            except IndexError:
                return jsonify({'error': 'Token mal formado'}), 401
        
        if not token:
            return jsonify({'error': 'Token no proporcionado'}), 401
        
        payload = decode_token(token)
        if not payload:
            return jsonify({'error': 'Token inválido o expirado'}), 401
        
        # Verificar que el usuario aún existe y está activo
        user = db.session.get(Usuario, payload['user_id'])
        if not user or not user.activo:
            return jsonify({'error': 'Usuario no encontrado o inactivo'}), 401
        
        # Guardar usuario en el contexto de la petición
        g.current_user = user
        
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    """Decorador para rutas que requieren rol de administrador"""
    @wraps(f)
    @token_required
    def decorated(*args, **kwargs):
        if g.current_user.rol != 'admin':
            return jsonify({'error': 'Se requiere rol de administrador'}), 403
        return f(*args, **kwargs)
    return decorated


def init_auth_routes(app):
    """Registra las rutas de autenticación en la aplicación Flask"""
    
    # Inicializar Flask-Limiter solo para rutas de auth
    def _auth_rate_limit_key():
        """Excluir OPTIONS (CORS preflight) del rate limiting"""
        if request.method == 'OPTIONS':
            return None
        return get_remote_address()

    limiter = Limiter(
        app=app,
        key_func=_auth_rate_limit_key,
        default_limits=[],  # Sin límite por defecto, solo en rutas específicas
        storage_uri="memory://",
        strategy="fixed-window"
    )

    @app.route('/api/auth/login', methods=['POST'])
    @limiter.limit("5 per minute; 15 per hour") # Límite específico para el login
    def login():
        """Endpoint de login"""
        try:
            data = request.get_json()
            
            if not data:
                return jsonify({'error': 'Datos no proporcionados'}), 400
            
            username = data.get('username', '').strip()
            password = data.get('password', '')
            
            if not username or not password:
                return jsonify({'error': 'Usuario y contraseña son requeridos'}), 400
            
            # Buscar usuario
            user = Usuario.query.filter_by(username=username).first()
            
            if not user or not user.check_password(password):
                logger.warning(f"Intento de login fallido para usuario: {username}")
                return jsonify({'error': 'Credenciales inválidas'}), 401
            
            if not user.activo:
                return jsonify({'error': 'Usuario desactivado'}), 401
            
            # Actualizar último login
            user.ultimo_login = datetime.utcnow()
            db.session.commit()
            
            # Generar token
            token = generate_token(user)
            
            logger.info(f"Login exitoso: {username}")
            
            return jsonify({
                'token': token,
                'user': user.to_dict()
            })
            
        except Exception as e:
            logger.error(f"Error en login: {str(e)}")
            return jsonify({'error': 'Error interno del servidor'}), 500
    
    @app.route('/api/auth/verify', methods=['GET'])
    @token_required
    def verify_token():
        """Verifica si el token actual es válido"""
        return jsonify({
            'valid': True,
            'user': g.current_user.to_dict()
        })
    
    @app.route('/api/auth/logout', methods=['POST'])
    @token_required
    def logout():
        """Endpoint de logout (solo para registro)"""
        logger.info(f"Logout: {g.current_user.username}")
        return jsonify({'message': 'Sesión cerrada correctamente'})
    
    @app.route('/api/auth/change-password', methods=['POST'])
    @token_required
    def change_password():
        """Permite al usuario cambiar su contraseña"""
        try:
            data = request.get_json()
            
            current_password = data.get('current_password', '')
            new_password = data.get('new_password', '')
            
            if not current_password or not new_password:
                return jsonify({'error': 'Contraseña actual y nueva son requeridas'}), 400
            
            if len(new_password) < 8:
                return jsonify({'error': 'La nueva contraseña debe tener al menos 8 caracteres'}), 400
            
            user = g.current_user
            
            if not user.check_password(current_password):
                return jsonify({'error': 'Contraseña actual incorrecta'}), 401
            
            user.set_password(new_password)
            db.session.commit()
            
            logger.info(f"Contraseña cambiada: {user.username}")
            
            return jsonify({'message': 'Contraseña actualizada correctamente'})
            
        except Exception as e:
            logger.error(f"Error al cambiar contraseña: {str(e)}")
            return jsonify({'error': 'Error interno del servidor'}), 500
    
    # ===== Rutas de administración de usuarios =====
    
    @app.route('/api/usuarios', methods=['GET'])
    @admin_required
    def get_usuarios():
        """Lista todos los usuarios (solo admin)"""
        usuarios = Usuario.query.all()
        return jsonify([u.to_dict() for u in usuarios])
    
    @app.route('/api/usuarios', methods=['POST'])
    @admin_required
    def create_usuario():
        """Crea un nuevo usuario (solo admin)"""
        try:
            data = request.get_json()
            
            username = data.get('username', '').strip()
            password = data.get('password', '')
            nombre = data.get('nombre', '').strip()
            email = data.get('email', '').strip()
            rol = data.get('rol', 'usuario')
            
            if not username or not password or not nombre:
                return jsonify({'error': 'Username, password y nombre son requeridos'}), 400
            
            if Usuario.query.filter_by(username=username).first():
                return jsonify({'error': 'El nombre de usuario ya existe'}), 400
            
            if rol not in ['admin', 'usuario', 'lectura']:
                return jsonify({'error': 'Rol inválido'}), 400
            
            user = Usuario(
                username=username,
                nombre=nombre,
                email=email if email else None,
                rol=rol
            )
            user.set_password(password)
            
            db.session.add(user)
            db.session.commit()
            
            logger.info(f"Usuario creado: {username} por {g.current_user.username}")
            
            return jsonify(user.to_dict()), 201
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error al crear usuario: {str(e)}")
            return jsonify({'error': 'Error al crear usuario'}), 500
    
    @app.route('/api/usuarios/<int:user_id>', methods=['PUT'])
    @admin_required
    def update_usuario(user_id):
        """Actualiza un usuario (solo admin)"""
        try:
            user = db.session.get(Usuario, user_id)
            if not user:
                return jsonify({'error': 'Usuario no encontrado'}), 404
            
            data = request.get_json()
            
            if 'nombre' in data:
                user.nombre = data['nombre'].strip()
            if 'email' in data:
                user.email = data['email'].strip() if data['email'] else None
            if 'rol' in data and data['rol'] in ['admin', 'usuario', 'lectura']:
                user.rol = data['rol']
            if 'activo' in data:
                user.activo = bool(data['activo'])
            if 'password' in data and data['password']:
                user.set_password(data['password'])
            
            db.session.commit()
            
            logger.info(f"Usuario actualizado: {user.username} por {g.current_user.username}")
            
            return jsonify(user.to_dict())
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error al actualizar usuario: {str(e)}")
            return jsonify({'error': 'Error al actualizar usuario'}), 500
    
    @app.route('/api/usuarios/<int:user_id>', methods=['DELETE'])
    @admin_required
    def delete_usuario(user_id):
        """Elimina un usuario (solo admin)"""
        try:
            user = db.session.get(Usuario, user_id)
            if not user:
                return jsonify({'error': 'Usuario no encontrado'}), 404
            
            # No permitir eliminar al propio usuario
            if user.id == g.current_user.id:
                return jsonify({'error': 'No puedes eliminar tu propio usuario'}), 400
            
            username = user.username
            db.session.delete(user)
            db.session.commit()
            
            logger.info(f"Usuario eliminado: {username} por {g.current_user.username}")
            
            return jsonify({'message': 'Usuario eliminado correctamente'})
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error al eliminar usuario: {str(e)}")
            return jsonify({'error': 'Error al eliminar usuario'}), 500
