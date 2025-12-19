from flask import Flask, jsonify, request, send_file, abort
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from models import db, init_db, Categoria, MateriaPrima, HistorialPrecios, Producto, FormulaDetalle, ProduccionProgramada, ProduccionHistorica, CostoIndirecto, InflacionMensual, Usuario
from datetime import datetime, date
from sqlalchemy import extract, func
import os
import io
import logging
import time
import uuid

# Cargar variables de entorno desde archivo .env
from dotenv import load_dotenv
load_dotenv()  # Carga variables del archivo .env si existe


from flask import g
from sqlalchemy import text

from logging_config import configure_logging
from auth import init_auth_routes, token_required, admin_required

app = Flask(__name__)

# Logging (consola + archivo rotativo)
configure_logging(app)
logger = logging.getLogger(__name__)

APP_VERSION = os.environ.get('COSTOS_APP_VERSION', '1.5.0')


def _mask_db_uri(uri: str) -> str:
    """Enmascara credenciales en un URI de DB si existieran."""
    if not uri:
        return ''
    try:
        # ejemplo: postgresql://user:pass@host/db
        if '://' not in uri:
            return uri
        scheme, rest = uri.split('://', 1)
        if '@' not in rest:
            return uri
        creds, tail = rest.split('@', 1)
        if ':' in creds:
            user = creds.split(':', 1)[0]
            creds_masked = f"{user}:***"
        else:
            creds_masked = '***'
        return f"{scheme}://{creds_masked}@{tail}"
    except Exception:
        return uri


def _get_or_404(model, ident):
    instance = db.session.get(model, ident)
    if instance is None:
        abort(404)
    return instance


logger.info(
    "backend.start version=%s db=%s skip_init_db=%s",
    APP_VERSION,
    _mask_db_uri(app.config.get('SQLALCHEMY_DATABASE_URI', '')),
    os.environ.get('COSTOS_EMBUTIDOS_SKIP_INIT_DB'),
)


@app.before_request
def _log_request_start():
    g._req_start_ts = time.perf_counter()


@app.after_request
def _log_request_end(response):
    try:
        start = getattr(g, '_req_start_ts', None)
        if start is None:
            return response
        duration_ms = (time.perf_counter() - start) * 1000

        qs = request.query_string.decode('utf-8', errors='ignore') if request.query_string else ''
        path = request.path
        if qs:
            path = f"{path}?{qs}"

        msg = "HTTP %s %s -> %s (%.1fms)"
        args = (request.method, path, response.status_code, duration_ms)

        if response.status_code >= 500:
            logger.error(msg, *args)
        elif response.status_code >= 400:
            logger.warning(msg, *args)
        else:
            logger.info(msg, *args)
    except Exception:
        # Evitar que un problema de logging rompa la respuesta
        pass
    return response


@app.teardown_request
def _log_unhandled_exception(exc):
    if exc is not None:
        logger.exception("Unhandled exception during request")

# ===== HELPERS DE VALIDACIÓN =====
def get_json_data():
    """Obtiene los datos JSON del request con validación"""
    # Usar silent=True evita BadRequest cuando el Content-Type es JSON
    # pero el body viene vacío (patrón usado por algunas llamadas del frontend).
    return request.get_json(silent=True)


def validate_positive_number(value, field_name, allow_zero=False):
    """Valida que un número sea positivo"""
    if value is None:
        return None, None
    try:
        num = float(value)
        if allow_zero and num < 0:
            return None, f'{field_name} no puede ser negativo'
        if not allow_zero and num <= 0:
            return None, f'{field_name} debe ser mayor a cero'
        return num, None
    except (ValueError, TypeError):
        return None, f'{field_name} debe ser un número válido'


def validate_month_format(mes_str, field_name='mes'):
    """Valida que el formato del mes sea YYYY-MM y retorna (año, mes) o error"""
    if not mes_str:
        return None, None, f'{field_name} es requerido'
    try:
        if len(mes_str) != 7 or mes_str[4] != '-':
            raise ValueError('Formato inválido')
        año, mes = map(int, mes_str.split('-'))
        if año < 2000 or año > 2100:
            raise ValueError('Año fuera de rango')
        if mes < 1 or mes > 12:
            raise ValueError('Mes debe estar entre 1 y 12')
        return año, mes, None
    except (ValueError, TypeError):
        return None, None, f'{field_name} debe tener formato YYYY-MM (ej: 2025-01)'
# Configurar CORS según entorno
FLASK_ENV = os.environ.get('FLASK_ENV', 'production')

if FLASK_ENV == 'development':
    # Development: Permitir todos los orígenes
    CORS(app)
    logger.info("CORS configurado para desarrollo (todos los orígenes permitidos)")
else:
    # Production: Restrictivo - Solo dominios específicos
    allowed_origins = os.environ.get('ALLOWED_ORIGINS', '').split(',')
    allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip()]
    
    if not allowed_origins:
        logger.warning(
            "⚠️  ALLOWED_ORIGINS no configurado. "
            "En producción, defina los dominios permitidos para CORS."
        )
        # Fallback seguro: solo localhost
        allowed_origins = ['http://localhost:5173']
    
    CORS(app, resources={
        r"/api/*": {
            "origins": allowed_origins,
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"],
            "expose_headers": ["Content-Type"],
            "supports_credentials": True
        }
    })
    logger.info(f"CORS configurado para producción: {allowed_origins}")

# Rate Limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# Configuración
basedir = os.path.abspath(os.path.dirname(__file__))
default_db_uri = f'sqlite:///{os.path.join(basedir, "costos_embutidos.db")}'
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('COSTOS_EMBUTIDOS_DATABASE_URI', default_db_uri)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

# Inicializar DB
if os.environ.get('COSTOS_EMBUTIDOS_SKIP_INIT_DB') != '1':
    init_db(app)

# Inicializar rutas de autenticación
init_auth_routes(app)


# ===== CATEGORÍAS =====
@app.route('/api/categorias', methods=['GET'])
def get_categorias():
    categorias = Categoria.query.all()
    return jsonify([c.to_dict() for c in categorias])


@app.route('/api/categorias', methods=['POST'])
def create_categoria():
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    if not data.get('nombre'):
        return jsonify({'error': 'El nombre es requerido'}), 400
    
    categoria = Categoria(
        nombre=data['nombre'],
        tipo=data.get('tipo', 'INDIRECTA')
    )
    db.session.add(categoria)
    db.session.commit()
    return jsonify(categoria.to_dict()), 201


# ===== MATERIAS PRIMAS =====
@app.route('/api/materias-primas', methods=['GET'])
def get_materias_primas():
    materias = MateriaPrima.query.filter_by(activo=True).all()
    return jsonify([m.to_dict() for m in materias])


@app.route('/api/materias-primas/<int:id>', methods=['GET'])
def get_materia_prima(id):
    materia = _get_or_404(MateriaPrima, id)
    return jsonify(materia.to_dict())


@app.route('/api/materias-primas', methods=['POST'])
def create_materia_prima():
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    # Validar campos requeridos
    if not data.get('nombre'):
        return jsonify({'error': 'El nombre es requerido'}), 400
    if not data.get('categoria'):
        return jsonify({'error': 'La categoría es requerida'}), 400
    if not data.get('unidad'):
        return jsonify({'error': 'La unidad es requerida'}), 400
    
    # Validar costo unitario
    costo, error = validate_positive_number(data.get('costo_unitario', 0), 'costo_unitario', allow_zero=True)
    if error:
        return jsonify({'error': error}), 400
    
    # Buscar categoría por nombre
    categoria = Categoria.query.filter_by(nombre=data['categoria']).first()
    if not categoria:
        return jsonify({'error': f"Categoría '{data['categoria']}' no encontrada"}), 400
    
    materia = MateriaPrima(
        codigo=data.get('codigo', ''),
        nombre=data['nombre'],
        categoria_id=categoria.id,
        unidad=data['unidad'],
        costo_unitario=costo,
        fecha_actualizacion=datetime.utcnow()
    )
    db.session.add(materia)
    db.session.commit()
    
    logger.info(
        "materia_prima.created id=%s codigo=%s nombre=%s categoria=%s costo_unitario=%.2f",
        materia.id,
        materia.codigo,
        materia.nombre,
        categoria.nombre,
        float(materia.costo_unitario)
    )
    
    return jsonify(materia.to_dict()), 201


@app.route('/api/materias-primas/<int:id>', methods=['PUT'])
def update_materia_prima(id):
    materia = _get_or_404(MateriaPrima, id)
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    if 'categoria' in data:
        categoria = Categoria.query.filter_by(nombre=data['categoria']).first()
        if categoria:
            materia.categoria_id = categoria.id
    
    # Validar costo unitario si se proporciona y registrar en historial si cambia
    if 'costo_unitario' in data:
        precio_anterior = materia.costo_unitario
        costo, error = validate_positive_number(data['costo_unitario'], 'costo_unitario', allow_zero=True)
        if error:
            return jsonify({'error': error}), 400
        
        # Solo registrar en historial si el precio realmente cambió
        if precio_anterior != costo:
            historial_entry = HistorialPrecios(
                materia_prima_id=materia.id,
                precio_anterior=precio_anterior,
                precio_nuevo=costo,
                tipo_cambio='EDICION_INDIVIDUAL'
            )
            db.session.add(historial_entry)
            
            logger.info(
                "materia_prima.precio_updated id=%s nombre=%s precio_anterior=%.2f precio_nuevo=%.2f",
                materia.id,
                materia.nombre,
                float(precio_anterior),
                float(costo)
            )
        
        materia.costo_unitario = costo
    
    materia.codigo = data.get('codigo', materia.codigo)
    materia.nombre = data.get('nombre', materia.nombre)
    materia.unidad = data.get('unidad', materia.unidad)
    materia.fecha_actualizacion = datetime.utcnow()
    
    db.session.commit()
    
    logger.info(
        "materia_prima.updated id=%s codigo=%s nombre=%s",
        materia.id,
        materia.codigo,
        materia.nombre
    )
    
    return jsonify(materia.to_dict())


@app.route('/api/materias-primas/<int:id>', methods=['DELETE'])
def delete_materia_prima(id):
    materia = _get_or_404(MateriaPrima, id)
    materia.activo = False  # Soft delete
    db.session.commit()
    
    logger.info(
        "materia_prima.deleted id=%s codigo=%s nombre=%s",
        materia.id,
        materia.codigo,
        materia.nombre
    )
    
    return jsonify({'message': 'Materia prima eliminada'})


@app.route('/api/materias-primas/historial', methods=['GET'])
def get_historial_precios():
    """
    Obtiene el historial de cambios de precios.
    
    Query params:
    - materia_prima_id: (opcional) filtrar por materia prima específica
    - limit: (opcional) cantidad de registros, default 100
    """
    materia_id = request.args.get('materia_prima_id', type=int)
    limit = request.args.get('limit', 100, type=int)
    
    query = HistorialPrecios.query
    
    if materia_id:
        query = query.filter_by(materia_prima_id=materia_id)
    
    historial = query.order_by(HistorialPrecios.fecha_cambio.desc()).limit(limit).all()
    
    logger.info(
        "historial_precios.get materia_prima_id=%s limit=%d resultados=%d",
        materia_id,
        limit,
        len(historial)
    )
    
    return jsonify([h.to_dict() for h in historial])


@app.route('/api/materias-primas/deshacer-ajuste', methods=['POST'])
def deshacer_ultimo_ajuste():
    """
    Deshace el último ajuste masivo de precios.
    Revierte todos los cambios del batch más reciente.
    """
    # Obtener el último ajuste masivo
    ultimo_ajuste = HistorialPrecios.query.filter_by(
        tipo_cambio='AJUSTE_MASIVO'
    ).order_by(HistorialPrecios.fecha_cambio.desc()).first()
    
    if not ultimo_ajuste:
        return jsonify({'error': 'No hay ajustes masivos para deshacer'}), 404
    
    batch_id = ultimo_ajuste.ajuste_batch_id
    
    # Obtener todos los cambios de ese batch
    cambios = HistorialPrecios.query.filter_by(ajuste_batch_id=batch_id).all()
    
    if not cambios:
        return jsonify({'error': 'No se encontraron cambios para deshacer'}), 404
    
    # Revertir cada cambio
    revertidos = []
    for cambio in cambios:
        materia = MateriaPrima.query.get(cambio.materia_prima_id)
        if materia:
            # Registrar la reversión en el historial
            reversion_entry = HistorialPrecios(
                materia_prima_id=materia.id,
                precio_anterior=materia.costo_unitario,
                precio_nuevo=cambio.precio_anterior,
                tipo_cambio='REVERSION',
                ajuste_batch_id=batch_id
            )
            db.session.add(reversion_entry)
            
            # Revertir precio
            materia.costo_unitario = cambio.precio_anterior
            materia.fecha_actualizacion = datetime.utcnow()
            
            revertidos.append({
                'id': materia.id,
                'nombre': materia.nombre,
                'categoria': materia.categoria.nombre if materia.categoria else None,
                'precio_revertido_a': cambio.precio_anterior,
                'precio_anterior': cambio.precio_nuevo
            })
    
    db.session.commit()
    
    logger.info(
        "materias_primas.reversion_ajuste batch_id=%s items=%d porcentaje_original=%.2f",
        batch_id,
        len(revertidos),
        float(ultimo_ajuste.porcentaje_aplicado) if ultimo_ajuste.porcentaje_aplicado else 0
    )
    
    return jsonify({
        'success': True,
        'items_revertidos': len(revertidos),
        'detalle': revertidos,
        'fecha_ajuste_original': ultimo_ajuste.fecha_cambio.isoformat(),
        'porcentaje_original': ultimo_ajuste.porcentaje_aplicado,
        'categoria_original': ultimo_ajuste.categoria_afectada
    })



@app.route('/api/materias-primas/ajustar-precios', methods=['POST'])
def ajustar_precios_materias_primas():
    """
    Ajusta los precios de todas las materias primas por un porcentaje de inflación.
    
    Body JSON:
    - porcentaje: Porcentaje de ajuste (ej: 5 para 5%)
    - categoria: (opcional) Categoría específica a ajustar, si no se especifica ajusta todas
    """
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    if 'porcentaje' not in data:
        return jsonify({'error': 'El porcentaje es requerido'}), 400
    
    try:
        porcentaje = float(data['porcentaje'])
    except (ValueError, TypeError):
        return jsonify({'error': 'El porcentaje debe ser un número válido'}), 400
    
    factor = 1 + (porcentaje / 100)
    categoria_filtro = data.get('categoria')
    
    # Obtener materias primas a ajustar
    query = MateriaPrima.query.filter_by(activo=True)
    
    if categoria_filtro:
        categoria = Categoria.query.filter_by(nombre=categoria_filtro).first()
        if categoria:
            query = query.filter_by(categoria_id=categoria.id)
        else:
            return jsonify({'error': f"Categoría '{categoria_filtro}' no encontrada"}), 400
    
    materias = query.all()
    
    if not materias:
        return jsonify({'error': 'No hay materias primas para ajustar'}), 400
    
    # Generar ID único para este batch de ajuste
    batch_id = str(uuid.uuid4())
    
    # Aplicar ajuste y registrar historial
    ajustados = []
    for materia in materias:
        precio_anterior = materia.costo_unitario
        precio_nuevo = round(precio_anterior * factor, 2)
        
        # Actualizar precio
        materia.costo_unitario = precio_nuevo
        materia.fecha_actualizacion = datetime.utcnow()
        
        # Registrar en historial
        historial_entry = HistorialPrecios(
            materia_prima_id=materia.id,
            precio_anterior=precio_anterior,
            precio_nuevo=precio_nuevo,
            tipo_cambio='AJUSTE_MASIVO',
            porcentaje_aplicado=porcentaje,
            categoria_afectada=categoria_filtro,
            ajuste_batch_id=batch_id
        )
        db.session.add(historial_entry)
        
        ajustados.append({
            'id': materia.id,
            'nombre': materia.nombre,
            'categoria': materia.categoria.nombre,
            'precio_anterior': precio_anterior,
            'precio_nuevo': precio_nuevo,
            'diferencia': round(precio_nuevo - precio_anterior, 2)
        })
    
    db.session.commit()
    
    logger.info(
        "materias_primas.ajuste_precios porcentaje=%.2f categoria=%s items=%s batch_id=%s",
        float(porcentaje),
        categoria_filtro or 'TODAS',
        len(ajustados),
        batch_id
    )
    
    return jsonify({
        'success': True,
        'porcentaje_aplicado': porcentaje,
        'categoria': categoria_filtro or 'TODAS',
        'items_ajustados': len(ajustados),
        'detalle': ajustados,
        'batch_id': batch_id
    })


# ===== PRODUCTOS =====
@app.route('/api/productos', methods=['GET'])
def get_productos():
    productos = Producto.query.filter_by(activo=True).all()
    return jsonify([p.to_dict() for p in productos])


@app.route('/api/productos/<int:id>', methods=['GET'])
def get_producto(id):
    producto = _get_or_404(Producto, id)
    return jsonify(producto.to_dict())


@app.route('/api/productos', methods=['POST'])
def create_producto():
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    # Validar campos requeridos
    if not data.get('codigo'):
        return jsonify({'error': 'El código es requerido'}), 400
    if not data.get('nombre'):
        return jsonify({'error': 'El nombre es requerido'}), 400
    
    # Validar peso_batch_kg (debe ser mayor a cero)
    peso, error = validate_positive_number(data.get('peso_batch_kg'), 'peso_batch_kg')
    if error:
        return jsonify({'error': error}), 400
    
    # Validar porcentaje_merma (puede ser cero, máximo 100)
    merma, error = validate_positive_number(data.get('porcentaje_merma', 0), 'porcentaje_merma', allow_zero=True)
    if error:
        return jsonify({'error': error}), 400
    if merma is not None and merma > 100:
        return jsonify({'error': 'porcentaje_merma no puede ser mayor a 100'}), 400
    
    # Validar min_mo_kg (puede ser cero)
    min_mo, error = validate_positive_number(data.get('min_mo_kg', 0), 'min_mo_kg', allow_zero=True)
    if error:
        return jsonify({'error': error}), 400
    
    # Verificar si existe un producto con el mismo código
    existing = Producto.query.filter_by(codigo=data['codigo']).first()
    
    if existing:
        if existing.activo:
            # Producto activo con mismo código - error de duplicado
            return jsonify({'error': f'Ya existe un producto activo con el código {data["codigo"]}'}), 400
        else:
            # Producto inactivo - reactivar y actualizar datos
            existing.nombre = data['nombre']
            existing.peso_batch_kg = peso
            existing.porcentaje_merma = merma
            existing.min_mo_kg = min_mo
            existing.activo = True
            db.session.commit()
            
            logger.info(
                "producto.reactivated id=%s codigo=%s nombre=%s peso_batch_kg=%.2f",
                existing.id,
                existing.codigo,
                existing.nombre,
                float(existing.peso_batch_kg)
            )
            
            return jsonify(existing.to_dict()), 201
    
    # Crear nuevo producto
    producto = Producto(
        codigo=data['codigo'],
        nombre=data['nombre'],
        peso_batch_kg=peso,
        porcentaje_merma=merma,
        min_mo_kg=min_mo
    )
    db.session.add(producto)
    db.session.commit()
    
    logger.info(
        "producto.created id=%s codigo=%s nombre=%s peso_batch_kg=%.2f",
        producto.id,
        producto.codigo,
        producto.nombre,
        float(producto.peso_batch_kg)
    )
    
    return jsonify(producto.to_dict()), 201


@app.route('/api/productos/<int:id>', methods=['PUT'])
def update_producto(id):
    producto = _get_or_404(Producto, id)
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    # Validar peso_batch_kg si se proporciona
    if 'peso_batch_kg' in data:
        peso, error = validate_positive_number(data['peso_batch_kg'], 'peso_batch_kg')
        if error:
            return jsonify({'error': error}), 400
        producto.peso_batch_kg = peso
    
    # Validar porcentaje_merma si se proporciona (máximo 100)
    if 'porcentaje_merma' in data:
        merma, error = validate_positive_number(data['porcentaje_merma'], 'porcentaje_merma', allow_zero=True)
        if error:
            return jsonify({'error': error}), 400
        if merma is not None and merma > 100:
            return jsonify({'error': 'porcentaje_merma no puede ser mayor a 100'}), 400
        producto.porcentaje_merma = merma
    
    # Validar min_mo_kg si se proporciona
    if 'min_mo_kg' in data:
        min_mo, error = validate_positive_number(data['min_mo_kg'], 'min_mo_kg', allow_zero=True)
        if error:
            return jsonify({'error': error}), 400
        producto.min_mo_kg = min_mo
    
    producto.codigo = data.get('codigo', producto.codigo)
    producto.nombre = data.get('nombre', producto.nombre)
    
    db.session.commit()
    
    logger.info(
        "producto.updated id=%s codigo=%s nombre=%s",
        producto.id,
        producto.codigo,
        producto.nombre
    )
    
    return jsonify(producto.to_dict())


@app.route('/api/productos/<int:id>', methods=['DELETE'])
def delete_producto(id):
    producto = _get_or_404(Producto, id)
    producto.activo = False  # Soft delete
    db.session.commit()
    
    logger.info(
        "producto.deleted id=%s codigo=%s nombre=%s",
        producto.id,
        producto.codigo,
        producto.nombre
    )
    
    return jsonify({'message': 'Producto eliminado'})


# ===== FÓRMULAS =====
@app.route('/api/formulas/<int:producto_id>', methods=['GET'])
def get_formula(producto_id):
    producto = _get_or_404(Producto, producto_id)
    detalles = FormulaDetalle.query.filter_by(producto_id=producto_id).all()
    return jsonify({
        'producto': producto.to_dict(),
        'ingredientes': [d.to_dict() for d in detalles]
    })


@app.route('/api/formulas/<int:producto_id>', methods=['POST'])
def save_formula(producto_id):
    """Guarda/reemplaza toda la fórmula de un producto"""
    producto = _get_or_404(Producto, producto_id)
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    ingredientes = data.get('ingredientes', [])
    
    # Validar cantidades
    for ing in ingredientes:
        cantidad, error = validate_positive_number(ing.get('cantidad'), 'cantidad')
        if error:
            return jsonify({'error': error}), 400
        ing['cantidad'] = cantidad
    
    # Eliminar ingredientes existentes
    FormulaDetalle.query.filter_by(producto_id=producto_id).delete()
    
    # Agregar nuevos ingredientes
    for ing in ingredientes:
        detalle = FormulaDetalle(
            producto_id=producto_id,
            materia_prima_id=ing['materia_prima_id'],
            cantidad=ing['cantidad']
        )
        db.session.add(detalle)
    
    db.session.commit()
    
    logger.info(
        "formula.saved producto_id=%s producto_codigo=%s ingredientes=%s",
        producto_id,
        producto.codigo,
        len(ingredientes)
    )
    
    return jsonify({'message': 'Fórmula guardada', 'count': len(ingredientes)})


@app.route('/api/formulas/<int:producto_id>/ingrediente', methods=['POST'])
def add_ingrediente(producto_id):
    """Agregar un ingrediente a la fórmula"""
    _get_or_404(Producto, producto_id)
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    # Validar cantidad (debe ser mayor a cero)
    cantidad, error = validate_positive_number(data.get('cantidad'), 'cantidad', allow_zero=False)
    if error:
        return jsonify({'error': error}), 400
    
    if not data.get('materia_prima_id'):
        return jsonify({'error': 'materia_prima_id es requerido'}), 400
    
    detalle = FormulaDetalle(
        producto_id=producto_id,
        materia_prima_id=data['materia_prima_id'],
        cantidad=cantidad
    )
    db.session.add(detalle)
    db.session.commit()
    return jsonify(detalle.to_dict()), 201


@app.route('/api/formulas/ingrediente/<int:id>', methods=['PUT'])
def update_ingrediente(id):
    detalle = _get_or_404(FormulaDetalle, id)
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    if 'cantidad' in data:
        cantidad, error = validate_positive_number(data['cantidad'], 'cantidad', allow_zero=False)
        if error:
            return jsonify({'error': error}), 400
        detalle.cantidad = cantidad
    
    if 'materia_prima_id' in data:
        detalle.materia_prima_id = data['materia_prima_id']
    
    db.session.commit()
    return jsonify(detalle.to_dict())


@app.route('/api/formulas/ingrediente/<int:id>', methods=['DELETE'])
def delete_ingrediente(id):
    detalle = _get_or_404(FormulaDetalle, id)
    db.session.delete(detalle)
    db.session.commit()
    return jsonify({'message': 'Ingrediente eliminado'})


# ===== COSTEO =====
@app.route('/api/costeo/<int:producto_id>', methods=['GET'])
def get_costeo(producto_id):
    """Obtiene el costeo completo de un producto"""
    producto = _get_or_404(Producto, producto_id)
    return jsonify(producto.get_costeo())


@app.route('/api/costeo/<int:producto_id>/completo', methods=['GET'])
def get_costeo_completo(producto_id):
    """
    Obtiene el costeo completo de un producto incluyendo costos indirectos.
    
    Query params:
    - mes_base: Mes base de los costos indirectos (YYYY-MM)
    - mes_produccion: Mes de producción para cálculo (YYYY-MM), default mes actual
    """
    producto = _get_or_404(Producto, producto_id)
    mes_base = request.args.get('mes_base')
    mes_produccion = request.args.get('mes_produccion')

    logger.debug(
        "costeo_completo.start producto_id=%s codigo=%s mes_base=%s mes_produccion=%s",
        producto_id,
        getattr(producto, 'codigo', None),
        mes_base,
        mes_produccion,
    )
    
    # Validar formato de mes_base si se proporciona
    if mes_base:
        año_b, mes_b, error = validate_month_format(mes_base, 'mes_base')
        if error:
            return jsonify({'error': error}), 400
    
    # Validar formato de mes_produccion si se proporciona
    if mes_produccion:
        año_p, mes_p, error = validate_month_format(mes_produccion, 'mes_produccion')
        if error:
            return jsonify({'error': error}), 400
    
    # Obtener costeo variable base
    costeo_variable = producto.get_costeo()
    
    if not mes_base:
        # Si no hay mes_base, devolver solo costeo variable
        costeo_variable['costos_indirectos'] = None
        costeo_variable['resumen']['costo_indirecto_por_kg'] = 0
        costeo_variable['resumen']['costo_total_por_kg'] = costeo_variable['resumen']['costo_por_kg']
        return jsonify(costeo_variable)
    
    if not mes_produccion:
        mes_produccion = f"{date.today().year}-{date.today().month:02d}"
    
    try:
        # Obtener costos indirectos del mes base
        costos = CostoIndirecto.query.filter_by(mes_base=mes_base).all()
        
        if not costos:
            costeo_variable['costos_indirectos'] = {'error': f'No hay costos para mes base {mes_base}'}
            costeo_variable['resumen']['costo_indirecto_por_kg'] = 0
            costeo_variable['resumen']['costo_total_por_kg'] = costeo_variable['resumen']['costo_por_kg']
            return jsonify(costeo_variable)
        
        # Calcular totales de costos por tipo
        total_sp = sum(c.monto for c in costos if c.tipo_distribucion == 'SP')
        total_gif = sum(c.monto for c in costos if c.tipo_distribucion == 'GIF')
        total_dep = sum(c.monto for c in costos if c.tipo_distribucion == 'DEP')
        
        # Calcular inflación acumulada
        año_base, mes_base_num = map(int, mes_base.split('-'))
        año_prod, mes_prod = map(int, mes_produccion.split('-'))
        meses_diferencia = (año_prod - año_base) * 12 + (mes_prod - mes_base_num)
        
        inflacion_acumulada = 1.0
        if meses_diferencia > 0:
            inflaciones = InflacionMensual.query.filter(
                InflacionMensual.mes > mes_base,
                InflacionMensual.mes <= mes_produccion
            ).all()
            for inf in inflaciones:
                inflacion_acumulada *= (1 + inf.porcentaje / 100)
        
        # Ajustar costos por inflación
        total_sp_ajustado = total_sp * inflacion_acumulada
        total_gif_ajustado = total_gif * inflacion_acumulada
        total_dep_ajustado = total_dep * inflacion_acumulada
        
        # Para calcular la distribución, necesitamos el total de producción del mes
        # Usamos la producción programada del mes como referencia
        fecha_inicio = date(año_prod, mes_prod, 1)
        if mes_prod == 12:
            fecha_fin = date(año_prod + 1, 1, 1)
        else:
            fecha_fin = date(año_prod, mes_prod + 1, 1)
        
        producciones = ProduccionProgramada.query.filter(
            ProduccionProgramada.fecha_programacion >= fecha_inicio,
            ProduccionProgramada.fecha_programacion < fecha_fin
        ).all()
        
        # Calcular totales de producción
        total_kg_mes = 0
        total_minutos_mes = 0
        kg_este_producto = 0
        minutos_este_producto = 0
        
        for prod in producciones:
            prod_obj = prod.producto
            kg_producido = prod.cantidad_batches * prod_obj.peso_batch_kg
            minutos = kg_producido * prod_obj.min_mo_kg
            
            total_kg_mes += kg_producido
            total_minutos_mes += minutos
            
            if prod_obj.id == producto_id:
                kg_este_producto += kg_producido
                minutos_este_producto += minutos
        
        # Si no hay producción programada, usar valores por defecto basados en 1 batch
        if total_kg_mes == 0:
            # Calcular como si fuera 100% de la producción
            kg_este_producto = producto.peso_batch_kg
            minutos_este_producto = producto.peso_batch_kg * producto.min_mo_kg
            total_kg_mes = kg_este_producto
            total_minutos_mes = minutos_este_producto
        
        # Calcular costo indirecto por kg para este producto
        # Nota: SP se distribuye por minutos (MO). Si no hay minutos (total_minutos_mes==0),
        # hacemos fallback a distribución por kg para evitar sobreasignación (cada producto
        # no debe llevarse el 100% de SP al consultar individualmente).
        if kg_este_producto > 0:
            pct_kg = (kg_este_producto / total_kg_mes) if total_kg_mes > 0 else 0
            if total_minutos_mes > 0:
                pct_sp = minutos_este_producto / total_minutos_mes
            else:
                pct_sp = pct_kg
            
            costo_sp_producto = total_sp_ajustado * pct_sp
            costo_gif_producto = total_gif_ajustado * pct_kg
            costo_dep_producto = total_dep_ajustado * pct_kg
            
            costo_indirecto_total = costo_sp_producto + costo_gif_producto + costo_dep_producto
            costo_indirecto_por_kg = costo_indirecto_total / kg_este_producto
        else:
            costo_sp_producto = 0
            costo_gif_producto = 0
            costo_dep_producto = 0
            costo_indirecto_total = 0
            costo_indirecto_por_kg = 0
        
        # Agregar info de costos indirectos al resultado
        costeo_variable['costos_indirectos'] = {
            'mes_base': mes_base,
            'mes_produccion': mes_produccion,
            'inflacion_acumulada_pct': round((inflacion_acumulada - 1) * 100, 2),
            'costo_sp': round(costo_sp_producto, 2),
            'costo_gif': round(costo_gif_producto, 2),
            'costo_dep': round(costo_dep_producto, 2),
            'costo_indirecto_total': round(costo_indirecto_total, 2),
            'costo_indirecto_por_kg': round(costo_indirecto_por_kg, 2),
            'kg_produccion': round(kg_este_producto, 2),
            'minutos_mo': round(minutos_este_producto, 2),
            'pct_participacion_kg': round((kg_este_producto / total_kg_mes * 100) if total_kg_mes > 0 else 100, 2),
            'pct_participacion_mo': round(((minutos_este_producto / total_minutos_mes) if total_minutos_mes > 0 else ((kg_este_producto / total_kg_mes) if total_kg_mes > 0 else 0)) * 100, 2)
        }
        
        # Actualizar resumen con costo total
        # CRITICAL FIX: Aplicar inflación a costos variables (MP)
        costo_variable_base_por_kg = costeo_variable['resumen']['costo_por_kg']
        costo_variable_por_kg = costo_variable_base_por_kg * inflacion_acumulada
        costeo_variable['resumen']['costo_variable_base_por_kg'] = round(costo_variable_base_por_kg, 2)
        costeo_variable['resumen']['costo_variable_por_kg'] = round(costo_variable_por_kg, 2)
        costeo_variable['resumen']['costo_indirecto_por_kg'] = round(costo_indirecto_por_kg, 2)
        costeo_variable['resumen']['costo_total_por_kg'] = round(costo_variable_por_kg + costo_indirecto_por_kg, 2)

        sp_fallback_to_kg = bool(total_minutos_mes == 0 and total_kg_mes > 0 and total_sp_ajustado > 0)
        if sp_fallback_to_kg:
            logger.info(
                "costeo_completo.sp_fallback_to_kg producto_id=%s mes_produccion=%s kg_total_mes=%.4f",
                producto_id,
                mes_produccion,
                float(total_kg_mes),
            )

        logger.info(
            "costeo_completo.done producto_id=%s mes_base=%s mes_produccion=%s inflacion_pct=%.2f "
            "sp_base=%.2f gif_base=%.2f dep_base=%.2f sp_aj=%.2f gif_aj=%.2f dep_aj=%.2f "
            "kg_mes=%.4f min_mes=%.4f kg_prod=%.4f min_prod=%.4f pct_kg=%.6f pct_sp=%.6f "
            "ind_por_kg=%.4f total_por_kg=%.4f",
            producto_id,
            mes_base,
            mes_produccion,
            float((inflacion_acumulada - 1) * 100),
            float(total_sp),
            float(total_gif),
            float(total_dep),
            float(total_sp_ajustado),
            float(total_gif_ajustado),
            float(total_dep_ajustado),
            float(total_kg_mes),
            float(total_minutos_mes),
            float(kg_este_producto),
            float(minutos_este_producto),
            float(pct_kg),
            float(pct_sp),
            float(costo_indirecto_por_kg),
            float(costeo_variable['resumen']['costo_total_por_kg']),
        )
        
        return jsonify(costeo_variable)
        
    except Exception as e:
        logger.exception(
            "costeo_completo.error producto_id=%s mes_base=%s mes_produccion=%s",
            producto_id,
            mes_base,
            mes_produccion,
        )
        costeo_variable['costos_indirectos'] = {'error': str(e)}
        costeo_variable['resumen']['costo_indirecto_por_kg'] = 0
        costeo_variable['resumen']['costo_total_por_kg'] = costeo_variable['resumen']['costo_por_kg']
        return jsonify(costeo_variable)


@app.route('/api/costeo/resumen', methods=['GET'])
def get_costeo_resumen():
    """Obtiene resumen de costos de todos los productos"""
    productos = Producto.query.filter_by(activo=True).all()
    resumen = []
    for p in productos:
        costeo = p.get_costeo()
        resumen.append({
            'producto': p.to_dict(),
            'costo_total': costeo['resumen']['total_neto'],
            'costo_por_kg': costeo['resumen']['costo_por_kg']
        })
    return jsonify(resumen)


# ===== PRODUCCIÓN PROGRAMADA =====
@app.route('/api/produccion-programada', methods=['GET'])
def get_produccion():
    """Obtiene producción programada con filtro opcional por mes (formato: YYYY-MM)"""
    fecha = request.args.get('fecha')
    mes = request.args.get('mes')  # Formato: 2024-12
    
    query = ProduccionProgramada.query
    
    if fecha:
        query = query.filter(ProduccionProgramada.fecha_programacion == fecha)
    elif mes:
        # Filtrar por año-mes
        try:
            year, month = mes.split('-')
            query = query.filter(
                extract('year', ProduccionProgramada.fecha_programacion) == int(year),
                extract('month', ProduccionProgramada.fecha_programacion) == int(month)
            )
        except ValueError:
            pass
    
    produccion = query.order_by(ProduccionProgramada.fecha_programacion.desc()).all()
    return jsonify([p.to_dict() for p in produccion])


@app.route('/api/produccion-programada', methods=['POST'])
def create_produccion():
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    # Validar campos requeridos
    if not data.get('producto_id'):
        return jsonify({'error': 'producto_id es requerido'}), 400
    if not data.get('fecha_programacion'):
        return jsonify({'error': 'fecha_programacion es requerida'}), 400
    
    # Validar cantidad_batches
    cantidad, error = validate_positive_number(data.get('cantidad_batches'), 'cantidad_batches')
    if error:
        return jsonify({'error': error}), 400
    
    try:
        fecha = datetime.strptime(data['fecha_programacion'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400
    
    produccion = ProduccionProgramada(
        producto_id=data['producto_id'],
        cantidad_batches=cantidad,
        fecha_programacion=fecha
    )
    db.session.add(produccion)
    db.session.commit()
    
    producto = produccion.producto
    logger.info(
        "produccion_programada.created id=%s producto_id=%s producto_codigo=%s cantidad_batches=%.2f fecha=%s",
        produccion.id,
        producto.id,
        producto.codigo,
        float(cantidad),
        fecha.isoformat()
    )
    
    return jsonify(produccion.to_dict()), 201


@app.route('/api/produccion-programada/<int:id>', methods=['PUT'])
def update_produccion(id):
    produccion = _get_or_404(ProduccionProgramada, id)
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    if 'cantidad_batches' in data:
        cantidad, error = validate_positive_number(data['cantidad_batches'], 'cantidad_batches')
        if error:
            return jsonify({'error': error}), 400
        produccion.cantidad_batches = cantidad
    
    if 'fecha_programacion' in data:
        try:
            produccion.fecha_programacion = datetime.strptime(data['fecha_programacion'], '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'Formato de fecha inválido. Use YYYY-MM-DD'}), 400
    
    db.session.commit()
    
    producto = produccion.producto
    logger.info(
        "produccion_programada.updated id=%s producto_codigo=%s cantidad_batches=%.2f fecha=%s",
        produccion.id,
        producto.codigo,
        float(produccion.cantidad_batches),
        produccion.fecha_programacion.isoformat()
    )
    
    return jsonify(produccion.to_dict())


@app.route('/api/produccion-programada/<int:id>', methods=['DELETE'])
def delete_produccion(id):
    produccion = _get_or_404(ProduccionProgramada, id)
    producto = produccion.producto
    fecha = produccion.fecha_programacion
    cantidad = produccion.cantidad_batches
    
    db.session.delete(produccion)
    db.session.commit()
    
    logger.info(
        "produccion_programada.deleted id=%s producto_codigo=%s cantidad_batches=%.2f fecha=%s",
        id,
        producto.codigo,
        float(cantidad),
        fecha.isoformat()
    )
    
    return jsonify({'message': 'Producción eliminada'})


# ===== REQUERIMIENTOS =====
@app.route('/api/requerimientos', methods=['GET'])
def get_requerimientos():
    """Calcula los requerimientos totales de materia prima basado en producción programada.
    Soporta filtro por mes (formato: YYYY-MM)"""
    fecha = request.args.get('fecha')
    mes = request.args.get('mes')  # Formato: 2024-12
    
    query = ProduccionProgramada.query
    
    if fecha:
        query = query.filter(ProduccionProgramada.fecha_programacion == fecha)
    elif mes:
        try:
            year, month = mes.split('-')
            query = query.filter(
                extract('year', ProduccionProgramada.fecha_programacion) == int(year),
                extract('month', ProduccionProgramada.fecha_programacion) == int(month)
            )
        except ValueError:
            pass
    
    programacion = query.all()
    
    requerimientos = {}
    totales_categoria = {}
    costo_total = 0
    total_batches = 0
    total_peso = 0
    
    for prog in programacion:
        producto = prog.producto
        costeo = producto.get_costeo()
        total_batches += prog.cantidad_batches
        total_peso += prog.cantidad_batches * producto.peso_batch_kg
        
        for ing in costeo['ingredientes']:
            mp_id = ing['materia_prima_id']
            cantidad_total = ing['cantidad'] * prog.cantidad_batches
            costo_requerido = ing['costo_total'] * prog.cantidad_batches
            
            if mp_id not in requerimientos:
                requerimientos[mp_id] = {
                    'materia_prima_id': mp_id,
                    'nombre': ing['nombre'],
                    'categoria': ing['categoria'],
                    'unidad': ing['unidad'],
                    'cantidad_total': 0,
                    'costo_total': 0
                }
            
            requerimientos[mp_id]['cantidad_total'] += cantidad_total
            requerimientos[mp_id]['costo_total'] += costo_requerido
            
            cat = ing['categoria']
            if cat not in totales_categoria:
                totales_categoria[cat] = 0
            totales_categoria[cat] += costo_requerido
            costo_total += costo_requerido
    
    return jsonify({
        'requerimientos': list(requerimientos.values()),
        'totales_categoria': totales_categoria,
        'costo_total': costo_total,
        'total_batches': total_batches,
        'total_peso': total_peso,
        'mes': mes
    })


# ===== RESUMEN MENSUAL =====
@app.route('/api/resumen-mensual', methods=['GET'])
def get_resumen_mensual():
    """Obtiene resumen de producción y costos para un mes específico"""
    mes = request.args.get('mes')  # Formato: 2024-12
    
    if not mes:
        # Default: mes actual
        today = date.today()
        mes = f"{today.year}-{today.month:02d}"
    
    try:
        year, month = mes.split('-')
        
        # Obtener producción del mes
        produccion = ProduccionProgramada.query.filter(
            extract('year', ProduccionProgramada.fecha_programacion) == int(year),
            extract('month', ProduccionProgramada.fecha_programacion) == int(month)
        ).all()
        
        # Calcular totales
        total_batches = 0
        total_peso = 0
        costo_total = 0
        por_producto = {}
        totales_categoria = {}
        
        for prog in produccion:
            producto = prog.producto
            costeo = producto.get_costeo()
            costo_batch = costeo['resumen']['total_neto']
            
            total_batches += prog.cantidad_batches
            total_peso += prog.cantidad_batches * producto.peso_batch_kg
            costo_total += prog.cantidad_batches * costo_batch
            
            # Agrupar por producto
            if producto.id not in por_producto:
                por_producto[producto.id] = {
                    'producto': producto.to_dict(),
                    'batches': 0,
                    'peso': 0,
                    'costo': 0
                }
            por_producto[producto.id]['batches'] += prog.cantidad_batches
            por_producto[producto.id]['peso'] += prog.cantidad_batches * producto.peso_batch_kg
            por_producto[producto.id]['costo'] += prog.cantidad_batches * costo_batch
            
            # Agrupar por categoría
            for cat, data in costeo['totales_categoria'].items():
                if cat not in totales_categoria:
                    totales_categoria[cat] = 0
                totales_categoria[cat] += data['costo'] * prog.cantidad_batches
        
        return jsonify({
            'mes': mes,
            'total_batches': total_batches,
            'total_peso': total_peso,
            'costo_total': costo_total,
            'por_producto': list(por_producto.values()),
            'totales_categoria': totales_categoria
        })
        
    except ValueError:
        return jsonify({'error': 'Formato de mes inválido. Use YYYY-MM'}), 400


# ===== PRODUCCIÓN HISTÓRICA =====
@app.route('/api/produccion-historica', methods=['GET'])
def get_produccion_historica():
    """Obtiene los datos históricos de producción"""
    producto_id = request.args.get('producto_id', type=int)
    query = ProduccionHistorica.query
    
    if producto_id:
        query = query.filter(ProduccionHistorica.producto_id == producto_id)
    
    historicos = query.order_by(ProduccionHistorica.fecha.desc()).all()
    return jsonify([h.to_dict() for h in historicos])


@app.route('/api/produccion-historica/resumen', methods=['GET'])
def get_historico_resumen():
    """Obtiene un resumen de los datos históricos por producto"""
    resumen = db.session.query(
        ProduccionHistorica.producto_id,
        Producto.codigo,
        Producto.nombre,
        func.count(ProduccionHistorica.id).label('total_registros'),
        func.min(ProduccionHistorica.fecha).label('fecha_inicio'),
        func.max(ProduccionHistorica.fecha).label('fecha_fin'),
        func.sum(ProduccionHistorica.cantidad_kg).label('total_kg')
    ).join(Producto).group_by(ProduccionHistorica.producto_id).all()
    
    return jsonify([{
        'producto_id': r.producto_id,
        'codigo': r.codigo,
        'nombre': r.nombre,
        'total_registros': r.total_registros,
        'fecha_inicio': r.fecha_inicio.isoformat() if r.fecha_inicio else None,
        'fecha_fin': r.fecha_fin.isoformat() if r.fecha_fin else None,
        'total_kg': round(r.total_kg, 2) if r.total_kg else 0
    } for r in resumen])


# ===== PREDICCIONES ML =====
@app.route('/api/ml/status', methods=['GET'])
def get_ml_status():
    """Obtiene el estado del modelo ML"""
    try:
        from predictor import get_predictor
        predictor = get_predictor()
        
        if predictor is None:
            return jsonify({
                'is_trained': False,
                'error': 'Predictor no disponible'
            })
        
        status = predictor.get_training_status()
        
        # Agregar info de datos históricos
        total_historicos = ProduccionHistorica.query.count()
        productos_con_historico = db.session.query(
            ProduccionHistorica.producto_id
        ).distinct().count()
        
        status['datos_historicos'] = {
            'total_registros': total_historicos,
            'productos_con_datos': productos_con_historico
        }
        
        return jsonify(status)
    except ImportError:
        return jsonify({
            'is_trained': False,
            'error': 'Módulo de predicción no disponible'
        })


@app.route('/api/ml/train', methods=['POST'])
def train_ml_model():
    """Entrena el modelo ML con los datos históricos"""
    try:
        from predictor import get_predictor
        predictor = get_predictor()
        
        if predictor is None:
            return jsonify({
                'success': False,
                'error': 'Predictor no disponible. Verifique las dependencias de ML.'
            }), 500
        
        # Obtener todos los datos históricos
        historicos = ProduccionHistorica.query.all()
        
        if not historicos:
            return jsonify({
                'success': False,
                'error': 'No hay datos históricos. Importe datos primero.'
            }), 400

        req = get_json_data() or {}
        cutoff_ym = req.get('cutoff_ym') or req.get('cutoff')
        
        data = [
            {
                'producto_id': h.producto_id,
                'año': h.año,
                'mes': h.mes,
                'cantidad_kg': h.cantidad_kg
            }
            for h in historicos
        ]
        
        logger.info(
            "ml.train.start registros=%s productos=%s cutoff_ym=%s",
            len(data),
            len(set(h.producto_id for h in historicos)),
            cutoff_ym
        )
        
        import time
        start_time = time.time()
        result = predictor.train(data, cutoff_ym=cutoff_ym)
        duration = time.time() - start_time
        
        if result.get('success'):
            logger.info(
                "ml.train.success duration_sec=%.2f productos_entrenados=%s modelo_global=%s",
                duration,
                result.get('productos_entrenados', 0),
                result.get('modelo_global', False)
            )
        else:
            logger.warning(
                "ml.train.failed duration_sec=%.2f error=%s",
                duration,
                result.get('error', 'unknown')
            )
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/ml/predict', methods=['POST'])
def predict_production():
    """Genera predicciones para un mes específico"""
    try:
        from predictor import get_predictor
        predictor = get_predictor()
        
        if predictor is None:
            return jsonify({'error': 'Predictor no disponible'}), 500
        
        data = get_json_data()
        if not data:
            data = {}
        
        año = data.get('año') or date.today().year
        mes = data.get('mes') or date.today().month
        productos_ids = data.get('productos_ids')
        
        if not productos_ids:
            # Predecir para todos los productos activos
            productos = Producto.query.filter_by(activo=True).all()
            productos_ids = [p.id for p in productos]
        
        predicciones = predictor.predict_month(productos_ids, año, mes)
        
        # Enriquecer con info del producto
        for pred in predicciones:
            producto = db.session.get(Producto, pred['producto_id'])
            if producto:
                pred['producto'] = producto.to_dict()
        
        return jsonify({
            'año': año,
            'mes': mes,
            'predicciones': predicciones
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/predict/<int:producto_id>', methods=['GET'])
def predict_producto(producto_id):
    """Predice producción para un producto específico"""
    try:
        from predictor import get_predictor
        predictor = get_predictor()
        
        if predictor is None:
            return jsonify({'error': 'Predictor no disponible'}), 500
        
        año = request.args.get('año', type=int) or date.today().year
        mes = request.args.get('mes', type=int) or date.today().month
        similar_id = request.args.get('similar_id', type=int)
        
        prediccion = predictor.predict(producto_id, año, mes, similar_id)
        
        producto = db.session.get(Producto, producto_id)
        if producto:
            prediccion['producto'] = producto.to_dict()
        
        return jsonify(prediccion)
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ml/import', methods=['POST'])
def import_excel_data():
    """Importa datos desde el archivo Excel configurado"""
    try:
        import pandas as pd
        
        excel_path = os.path.join(basedir, '..', 'data', 'Histórico_Producción.xlsx')
        
        if not os.path.exists(excel_path):
            return jsonify({
                'success': False,
                'error': f'Archivo no encontrado: {excel_path}'
            }), 404
        
        # Leer Excel
        df = pd.read_excel(excel_path, engine='openpyxl')
        df.columns = [str(c).strip().lower() for c in df.columns]
        
        # Mapear columnas
        col_map = {}
        for col in df.columns:
            if 'codigo' in col or 'código' in col:
                col_map['codigo'] = col
            elif 'fecha' in col:
                col_map['fecha'] = col
            elif 'producto' in col and 'terminado' not in col:
                col_map['producto'] = col
            elif 'terminado' in col or 'cantidad' in col:
                col_map['cantidad'] = col
        
        # Validar que se encontraron las columnas necesarias
        required_cols = ['codigo', 'fecha', 'cantidad']
        missing_cols = [c for c in required_cols if c not in col_map]
        if missing_cols:
            return jsonify({
                'success': False,
                'error': f'Columnas requeridas no encontradas: {missing_cols}. Columnas disponibles: {list(df.columns)}'
            }), 400
        
        productos_db = {p.codigo: p for p in Producto.query.all()}
        productos_creados = 0
        registros_importados = 0
        registros_actualizados = 0
        errores = []
        
        def parse_cantidad(valor):
            if pd.isna(valor) or valor == '-' or valor == '':
                return 0.0
            if isinstance(valor, (int, float)):
                return float(valor)
            str_val = str(valor).strip().replace('.', '').replace(',', '.')
            try:
                return float(str_val)
            except:
                return 0.0
        
        for idx, row in df.iterrows():
            try:
                codigo = str(row[col_map['codigo']]).strip()
                fecha_val = row[col_map['fecha']]
                cantidad = parse_cantidad(row[col_map['cantidad']])
                nombre = row.get(col_map.get('producto', ''), f"Producto {codigo}")
                
                if pd.isna(fecha_val) or cantidad <= 0:
                    continue
                
                if isinstance(fecha_val, datetime):
                    fecha = fecha_val.date()
                elif isinstance(fecha_val, date):
                    fecha = fecha_val
                else:
                    continue
                
                # Buscar o crear producto
                if codigo not in productos_db:
                    nuevo_producto = Producto(
                        codigo=codigo,
                        nombre=str(nombre).strip() if not pd.isna(nombre) else f"Producto {codigo}",
                        peso_batch_kg=100.0,
                        porcentaje_merma=1.0,
                        activo=True
                    )
                    db.session.add(nuevo_producto)
                    db.session.flush()
                    productos_db[codigo] = nuevo_producto
                    productos_creados += 1
                
                producto = productos_db[codigo]
                
                # Buscar registro existente
                existente = ProduccionHistorica.query.filter_by(
                    producto_id=producto.id,
                    fecha=fecha
                ).first()
                
                if existente:
                    if existente.cantidad_kg != cantidad:
                        existente.cantidad_kg = cantidad
                        registros_actualizados += 1
                else:
                    hist = ProduccionHistorica(
                        producto_id=producto.id,
                        fecha=fecha,
                        cantidad_kg=cantidad,
                        año=fecha.year,
                        mes=fecha.month
                    )
                    db.session.add(hist)
                    registros_importados += 1
                    
            except KeyError as e:
                errores.append(f'Fila {idx + 2}: Columna faltante - {str(e)}')
            except Exception as e:
                errores.append(f'Fila {idx + 2}: {str(e)}')
        
        db.session.commit()
        
        result = {
            'success': True,
            'productos_creados': productos_creados,
            'registros_importados': registros_importados,
            'registros_actualizados': registros_actualizados
        }
        
        # Incluir errores si los hubo (máximo 10 para no saturar)
        if errores:
            result['advertencias'] = errores[:10]
            if len(errores) > 10:
                result['total_advertencias'] = len(errores)
        
        return jsonify(result)
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'error': str(e)}), 500


# ===== COSTOS INDIRECTOS =====
@app.route('/api/costos-indirectos', methods=['GET'])
def get_costos_indirectos():
    """Obtiene todos los costos indirectos, opcionalmente filtrados por mes base"""
    mes_base = request.args.get('mes_base')
    query = CostoIndirecto.query
    
    if mes_base:
        query = query.filter(CostoIndirecto.mes_base == mes_base)
    
    costos = query.order_by(CostoIndirecto.tipo_distribucion, CostoIndirecto.cuenta).all()
    return jsonify([c.to_dict() for c in costos])


@app.route('/api/costos-indirectos', methods=['POST'])
def create_costo_indirecto():
    """Crea un nuevo costo indirecto"""
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    # Validar campos requeridos
    if not data.get('cuenta'):
        return jsonify({'error': 'La cuenta es requerida'}), 400
    if not data.get('mes_base'):
        return jsonify({'error': 'El mes_base es requerido'}), 400
    if not data.get('tipo_distribucion'):
        return jsonify({'error': 'El tipo_distribucion es requerido'}), 400
    
    # Validar tipo_distribucion
    tipos_validos = ['SP', 'GIF', 'DEP']
    if data['tipo_distribucion'] not in tipos_validos:
        return jsonify({'error': f'tipo_distribucion debe ser uno de: {tipos_validos}'}), 400
    
    # Validar monto
    monto, error = validate_positive_number(data.get('monto'), 'monto', allow_zero=True)
    if error:
        return jsonify({'error': error}), 400
    
    # Verificar si ya existe
    existente = CostoIndirecto.query.filter_by(
        cuenta=data['cuenta'],
        mes_base=data['mes_base']
    ).first()
    
    if existente:
        return jsonify({'error': 'Ya existe un costo con esa cuenta para ese mes'}), 400
    
    costo = CostoIndirecto(
        cuenta=data['cuenta'],
        descripcion=data.get('descripcion', ''),
        monto=monto,
        tipo_distribucion=data['tipo_distribucion'],
        mes_base=data['mes_base']
    )
    db.session.add(costo)
    db.session.commit()
    return jsonify(costo.to_dict()), 201


@app.route('/api/costos-indirectos/<int:id>', methods=['PUT'])
def update_costo_indirecto(id):
    """Actualiza un costo indirecto existente"""
    costo = _get_or_404(CostoIndirecto, id)
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    # Validar tipo_distribucion si se proporciona
    if 'tipo_distribucion' in data:
        tipos_validos = ['SP', 'GIF', 'DEP']
        if data['tipo_distribucion'] not in tipos_validos:
            return jsonify({'error': f'tipo_distribucion debe ser uno de: {tipos_validos}'}), 400
        costo.tipo_distribucion = data['tipo_distribucion']
    
    # Validar monto si se proporciona
    if 'monto' in data:
        monto, error = validate_positive_number(data['monto'], 'monto', allow_zero=True)
        if error:
            return jsonify({'error': error}), 400
        costo.monto = monto
    
    costo.cuenta = data.get('cuenta', costo.cuenta)
    costo.descripcion = data.get('descripcion', costo.descripcion)
    
    db.session.commit()
    return jsonify(costo.to_dict())


@app.route('/api/costos-indirectos/<int:id>', methods=['DELETE'])
def delete_costo_indirecto(id):
    """Elimina un costo indirecto"""
    costo = _get_or_404(CostoIndirecto, id)
    db.session.delete(costo)
    db.session.commit()
    return jsonify({'message': 'Costo eliminado'})


@app.route('/api/costos-indirectos/resumen', methods=['GET'])
def get_resumen_costos_indirectos():
    """Obtiene un resumen de costos indirectos por tipo"""
    mes_base = request.args.get('mes_base')
    
    if not mes_base:
        return jsonify({'error': 'Debe especificar mes_base'}), 400
    
    costos = CostoIndirecto.query.filter_by(mes_base=mes_base).all()
    
    # Agrupar por tipo
    por_tipo = {'SP': 0, 'GIF': 0, 'DEP': 0}
    for c in costos:
        if c.tipo_distribucion in por_tipo:
            por_tipo[c.tipo_distribucion] += c.monto
    
    return jsonify({
        'mes_base': mes_base,
        'total': sum(por_tipo.values()),
        'por_tipo': por_tipo,
        'cantidad_cuentas': len(costos)
    })


# ===== INFLACIÓN =====
@app.route('/api/inflacion', methods=['GET'])
def get_inflaciones():
    """Obtiene todos los índices de inflación"""
    inflaciones = InflacionMensual.query.order_by(InflacionMensual.mes).all()
    return jsonify([i.to_dict() for i in inflaciones])


@app.route('/api/inflacion', methods=['POST'])
def create_inflacion():
    """Crea o actualiza un índice de inflación mensual"""
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    if not data.get('mes'):
        return jsonify({'error': 'El mes es requerido (formato YYYY-MM)'}), 400
    if 'porcentaje' not in data:
        return jsonify({'error': 'El porcentaje es requerido'}), 400
    
    try:
        porcentaje = float(data['porcentaje'])
    except (ValueError, TypeError):
        return jsonify({'error': 'El porcentaje debe ser un número válido'}), 400
    
    existente = InflacionMensual.query.filter_by(mes=data['mes']).first()
    
    if existente:
        existente.porcentaje = porcentaje
        db.session.commit()
        return jsonify(existente.to_dict())
    
    inflacion = InflacionMensual(
        mes=data['mes'],
        porcentaje=porcentaje
    )
    db.session.add(inflacion)
    db.session.commit()
    return jsonify(inflacion.to_dict()), 201


@app.route('/api/inflacion/<int:id>', methods=['DELETE'])
def delete_inflacion(id):
    """Elimina un índice de inflación"""
    inflacion = _get_or_404(InflacionMensual, id)
    db.session.delete(inflacion)
    db.session.commit()
    return jsonify({'message': 'Inflación eliminada'})


# ===== DISTRIBUCIÓN DE COSTOS =====
@app.route('/api/distribucion-costos', methods=['GET'])
def calcular_distribucion_costos():
    """
    Calcula la distribución de costos indirectos para un mes de producción.
    
    Query params:
    - mes_base: Mes de los costos base (YYYY-MM)
    - mes_produccion: Mes de producción a calcular (YYYY-MM)
    """
    mes_base = request.args.get('mes_base')
    mes_produccion = request.args.get('mes_produccion')
    
    if not mes_base or not mes_produccion:
        return jsonify({'error': 'Debe especificar mes_base y mes_produccion'}), 400
    
    # Validar formatos
    año_base, mes_base_num, error = validate_month_format(mes_base, 'mes_base')
    if error:
        return jsonify({'error': error}), 400
    
    año_prod, mes_prod, error = validate_month_format(mes_produccion, 'mes_produccion')
    if error:
        return jsonify({'error': error}), 400
    
    try:
        logger.debug(
            "distribucion_costos.start mes_base=%s mes_produccion=%s",
            mes_base,
            mes_produccion,
        )
        
        # Obtener producción del mes
        fecha_inicio = date(año_prod, mes_prod, 1)
        if mes_prod == 12:
            fecha_fin = date(año_prod + 1, 1, 1)
        else:
            fecha_fin = date(año_prod, mes_prod + 1, 1)
        
        producciones = ProduccionProgramada.query.filter(
            ProduccionProgramada.fecha_programacion >= fecha_inicio,
            ProduccionProgramada.fecha_programacion < fecha_fin
        ).all()
        
        # Obtener costos indirectos del mes base
        costos = CostoIndirecto.query.filter_by(mes_base=mes_base).all()
        
        if not costos:
            return jsonify({'error': f'No hay costos cargados para el mes base {mes_base}'}), 404
        
        # Calcular totales de costos por tipo
        total_sp = sum(c.monto for c in costos if c.tipo_distribucion == 'SP')
        total_gif = sum(c.monto for c in costos if c.tipo_distribucion == 'GIF')
        total_dep = sum(c.monto for c in costos if c.tipo_distribucion == 'DEP')
        
        # Calcular inflación acumulada
        meses_diferencia = (año_prod - año_base) * 12 + (mes_prod - mes_base_num)
        
        inflacion_acumulada = 1.0
        if meses_diferencia > 0:
            # Obtener inflaciones entre mes_base y mes_produccion
            inflaciones = InflacionMensual.query.filter(
                InflacionMensual.mes > mes_base,
                InflacionMensual.mes <= mes_produccion
            ).all()
            
            for inf in inflaciones:
                inflacion_acumulada *= (1 + inf.porcentaje / 100)
        
        # Ajustar costos por inflación
        total_sp_ajustado = total_sp * inflacion_acumulada
        total_gif_ajustado = total_gif * inflacion_acumulada
        total_dep_ajustado = total_dep * inflacion_acumulada
        
        # Calcular totales de producción
        total_kg = 0
        total_minutos = 0
        produccion_por_producto = {}
        
        for prod in producciones:
            producto = prod.producto
            kg_producido = prod.cantidad_batches * producto.peso_batch_kg
            minutos = kg_producido * producto.min_mo_kg
            
            total_kg += kg_producido
            total_minutos += minutos
            
            if producto.id not in produccion_por_producto:
                produccion_por_producto[producto.id] = {
                    'producto': producto.to_dict(),
                    'kg': 0,
                    'minutos': 0,
                    'batches': 0
                }
            produccion_por_producto[producto.id]['kg'] += kg_producido
            produccion_por_producto[producto.id]['minutos'] += minutos
            produccion_por_producto[producto.id]['batches'] += prod.cantidad_batches
        
        # Distribuir costos
        distribucion = []
        for prod_id, datos in produccion_por_producto.items():
            pct_kg = (datos['kg'] / total_kg * 100) if total_kg > 0 else 0

            # SP: proporcional a minutos. Si no hay minutos (total_minutos==0), fallback a kg.
            if total_minutos > 0:
                pct_sp = datos['minutos'] / total_minutos
            else:
                pct_sp = (datos['kg'] / total_kg) if total_kg > 0 else 0
            pct_mo = pct_sp * 100
            
            costo_sp = total_sp_ajustado * pct_sp
            # Costo GIF y DEP proporcional a kg
            costo_gif = (datos['kg'] / total_kg * total_gif_ajustado) if total_kg > 0 else 0
            costo_dep = (datos['kg'] / total_kg * total_dep_ajustado) if total_kg > 0 else 0
            
            costo_total_indirecto = costo_sp + costo_gif + costo_dep
            costo_indirecto_por_kg = costo_total_indirecto / datos['kg'] if datos['kg'] > 0 else 0
            
            distribucion.append({
                'producto': datos['producto'],
                'kg_producidos': round(datos['kg'], 2),
                'minutos_mo': round(datos['minutos'], 2),
                'batches': datos['batches'],
                'pct_kg': round(pct_kg, 2),
                'pct_mo': round(pct_mo, 2),
                'costo_sp': round(costo_sp, 2),
                'costo_gif': round(costo_gif, 2),
                'costo_dep': round(costo_dep, 2),
                'costo_total_indirecto': round(costo_total_indirecto, 2),
                'costo_indirecto_por_kg': round(costo_indirecto_por_kg, 2)
            })

        sp_fallback_to_kg = bool(total_minutos == 0 and total_kg > 0 and total_sp_ajustado > 0)
        if sp_fallback_to_kg:
            logger.info(
                "distribucion_costos.sp_fallback_to_kg mes_produccion=%s kg_total=%.4f",
                mes_produccion,
                float(total_kg),
            )

        logger.info(
            "distribucion_costos.done mes_base=%s mes_produccion=%s inflacion_pct=%.2f "
            "sp_base=%.2f gif_base=%.2f dep_base=%.2f sp_aj=%.2f gif_aj=%.2f dep_aj=%.2f "
            "kg_total=%.4f min_total=%.4f items=%s",
            mes_base,
            mes_produccion,
            float((inflacion_acumulada - 1) * 100),
            float(total_sp),
            float(total_gif),
            float(total_dep),
            float(total_sp_ajustado),
            float(total_gif_ajustado),
            float(total_dep_ajustado),
            float(total_kg),
            float(total_minutos),
            len(distribucion),
        )

        return jsonify({
            'mes_base': mes_base,
            'mes_produccion': mes_produccion,
            'inflacion_acumulada': round((inflacion_acumulada - 1) * 100, 2),
            'totales': {
                'kg': round(total_kg, 2),
                'minutos': round(total_minutos, 2),
                'sp_base': round(total_sp, 2),
                'gif_base': round(total_gif, 2),
                'dep_base': round(total_dep, 2),
                'sp_ajustado': round(total_sp_ajustado, 2),
                'gif_ajustado': round(total_gif_ajustado, 2),
                'dep_ajustado': round(total_dep_ajustado, 2),
                'total_indirectos': round(total_sp_ajustado + total_gif_ajustado + total_dep_ajustado, 2)
            },
            'distribucion': distribucion
        })
        
    except Exception as e:
        logger.exception(
            "distribucion_costos.error mes_base=%s mes_produccion=%s",
            mes_base,
            mes_produccion,
        )
        return jsonify({'error': str(e)}), 500


@app.route('/api/health', methods=['GET'])
def health_check():
    """Healthcheck simple para monitoreo."""
    try:
        with db.session.begin():
            db.session.execute(text('SELECT 1'))
        return jsonify({'status': 'ok', 'version': APP_VERSION}), 200
    except Exception:
        logger.exception('health_check.failed')
        return jsonify({'status': 'error', 'version': APP_VERSION}), 500


# ===== EXPORTACIÓN A EXCEL =====
@app.route('/api/exportar/costeo/<int:producto_id>', methods=['GET'])
def exportar_costeo_producto(producto_id):
    """
    Exporta la hoja de costos de un producto a Excel.
    
    Query params:
    - mes_base: Mes base para costos indirectos (YYYY-MM)
    - mes_produccion: Mes de producción (YYYY-MM)
    """
    try:
        import xlsxwriter
        
        producto = _get_or_404(Producto, producto_id)
        mes_base = request.args.get('mes_base')
        mes_produccion = request.args.get('mes_produccion', f"{date.today().year}-{date.today().month:02d}")
        
        # Obtener costeo completo
        costeo = producto.get_costeo()
        
        # Crear archivo Excel en memoria
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        
        # Formatos
        title_format = workbook.add_format({'bold': True, 'font_size': 14, 'bg_color': '#4472C4', 'font_color': 'white'})
        header_format = workbook.add_format({'bold': True, 'bg_color': '#D9E2F3', 'border': 1})
        currency_format = workbook.add_format({'num_format': '$#,##0.00', 'border': 1})
        number_format = workbook.add_format({'num_format': '#,##0.000', 'border': 1})
        percent_format = workbook.add_format({'num_format': '0.00%', 'border': 1})
        text_format = workbook.add_format({'border': 1})
        subtotal_format = workbook.add_format({'bold': True, 'bg_color': '#E2EFDA', 'num_format': '$#,##0.00', 'border': 1})
        total_format = workbook.add_format({'bold': True, 'bg_color': '#C6E0B4', 'num_format': '$#,##0.00', 'border': 1})
        
        worksheet = workbook.add_worksheet('Hoja de Costos')
        worksheet.set_column('A:A', 30)
        worksheet.set_column('B:B', 15)
        worksheet.set_column('C:C', 15)
        worksheet.set_column('D:D', 15)
        worksheet.set_column('E:E', 15)
        
        row = 0
        
        # Encabezado del producto
        worksheet.merge_range(row, 0, row, 4, f"HOJA DE COSTOS: {producto.codigo} - {producto.nombre}", title_format)
        row += 2
        
        worksheet.write(row, 0, 'Peso del Batch:', header_format)
        worksheet.write(row, 1, f"{producto.peso_batch_kg} Kg", text_format)
        worksheet.write(row, 2, '% Merma:', header_format)
        worksheet.write(row, 3, f"{producto.porcentaje_merma}%", text_format)
        row += 1
        
        worksheet.write(row, 0, 'Min M.O./Kg:', header_format)
        worksheet.write(row, 1, f"{producto.min_mo_kg or 0}", text_format)
        row += 2
        
        # Tabla de ingredientes
        worksheet.write(row, 0, 'DETALLE DE MATERIA PRIMA', header_format)
        worksheet.merge_range(row, 1, row, 4, '', header_format)
        row += 1
        
        worksheet.write(row, 0, 'Ingrediente', header_format)
        worksheet.write(row, 1, 'Categoría', header_format)
        worksheet.write(row, 2, 'Cantidad', header_format)
        worksheet.write(row, 3, 'Costo Unit.', header_format)
        worksheet.write(row, 4, 'Costo Total', header_format)
        row += 1
        
        for ing in costeo['ingredientes']:
            worksheet.write(row, 0, ing['nombre'], text_format)
            worksheet.write(row, 1, ing['categoria'], text_format)
            worksheet.write(row, 2, ing['cantidad'], number_format)
            worksheet.write(row, 3, ing['costo_unitario'], currency_format)
            worksheet.write(row, 4, ing['costo_total'], currency_format)
            row += 1
        
        row += 1
        
        # Resumen de costos variables
        worksheet.write(row, 0, 'RESUMEN COSTOS VARIABLES', header_format)
        worksheet.merge_range(row, 1, row, 4, '', header_format)
        row += 1
        
        worksheet.write(row, 0, 'Total Materia Prima', text_format)
        worksheet.write(row, 4, costeo['resumen']['total_materia_prima'], currency_format)
        row += 1
        
        worksheet.write(row, 0, f"Costo Merma ({producto.porcentaje_merma}%)", text_format)
        worksheet.write(row, 4, costeo['resumen']['costo_merma'], currency_format)
        row += 1
        
        worksheet.write(row, 0, 'Materia Prima Neta', text_format)
        worksheet.write(row, 4, costeo['resumen']['materia_prima_neta'], subtotal_format)
        row += 1
        
        worksheet.write(row, 0, 'Envases', text_format)
        worksheet.write(row, 4, costeo['resumen']['total_envases'], currency_format)
        row += 1
        
        worksheet.write(row, 0, 'TOTAL COSTO VARIABLE (Batch)', text_format)
        worksheet.write(row, 4, costeo['resumen']['total_neto'], total_format)
        row += 1
        
        worksheet.write(row, 0, 'Costo Variable por Kg', text_format)
        worksheet.write(row, 4, costeo['resumen']['costo_por_kg'], total_format)
        row += 2
        
        # Info de exportación
        worksheet.write(row, 0, f"Exportado: {datetime.now().strftime('%Y-%m-%d %H:%M')}", text_format)
        
        workbook.close()
        
        output.seek(0)
        filename = f"hoja_costos_{producto.codigo}_{date.today().strftime('%Y%m%d')}.xlsx"
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except ImportError:
        return jsonify({'error': 'xlsxwriter no está instalado. Ejecute: pip install xlsxwriter'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/exportar/produccion', methods=['GET'])
def exportar_produccion():
    """
    Exporta la producción programada a Excel.
    
    Query params:
    - mes: Mes a exportar (YYYY-MM)
    """
    try:
        import xlsxwriter
        
        mes = request.args.get('mes', f"{date.today().year}-{date.today().month:02d}")
        año, mes_num = map(int, mes.split('-'))
        
        # Obtener producción del mes
        producciones = ProduccionProgramada.query.filter(
            extract('year', ProduccionProgramada.fecha_programacion) == año,
            extract('month', ProduccionProgramada.fecha_programacion) == mes_num
        ).all()
        
        # Crear archivo Excel en memoria
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        
        # Formatos
        title_format = workbook.add_format({'bold': True, 'font_size': 14, 'bg_color': '#4472C4', 'font_color': 'white'})
        header_format = workbook.add_format({'bold': True, 'bg_color': '#D9E2F3', 'border': 1})
        currency_format = workbook.add_format({'num_format': '$#,##0.00', 'border': 1})
        number_format = workbook.add_format({'num_format': '#,##0.00', 'border': 1})
        text_format = workbook.add_format({'border': 1})
        date_format = workbook.add_format({'num_format': 'dd/mm/yyyy', 'border': 1})
        total_format = workbook.add_format({'bold': True, 'bg_color': '#C6E0B4', 'border': 1})
        
        worksheet = workbook.add_worksheet('Producción')
        worksheet.set_column('A:A', 12)
        worksheet.set_column('B:B', 12)
        worksheet.set_column('C:C', 30)
        worksheet.set_column('D:D', 12)
        worksheet.set_column('E:E', 15)
        worksheet.set_column('F:F', 15)
        worksheet.set_column('G:G', 18)
        
        row = 0
        meses_nombre = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        
        worksheet.merge_range(row, 0, row, 6, f"PRODUCCIÓN PROGRAMADA - {meses_nombre[mes_num]} {año}", title_format)
        row += 2
        
        worksheet.write(row, 0, 'Fecha', header_format)
        worksheet.write(row, 1, 'Código', header_format)
        worksheet.write(row, 2, 'Producto', header_format)
        worksheet.write(row, 3, 'Batches', header_format)
        worksheet.write(row, 4, 'Peso/Batch', header_format)
        worksheet.write(row, 5, 'Kg Total', header_format)
        worksheet.write(row, 6, 'Costo Total', header_format)
        row += 1
        
        total_batches = 0
        total_kg = 0
        total_costo = 0
        
        for prod in producciones:
            producto = prod.producto
            costeo = producto.get_costeo()
            costo_batch = costeo['resumen']['total_neto']
            kg_total = prod.cantidad_batches * producto.peso_batch_kg
            costo_total = prod.cantidad_batches * costo_batch
            
            worksheet.write(row, 0, prod.fecha_programacion.strftime('%d/%m/%Y') if prod.fecha_programacion else '', text_format)
            worksheet.write(row, 1, producto.codigo, text_format)
            worksheet.write(row, 2, producto.nombre, text_format)
            worksheet.write(row, 3, prod.cantidad_batches, number_format)
            worksheet.write(row, 4, producto.peso_batch_kg, number_format)
            worksheet.write(row, 5, kg_total, number_format)
            worksheet.write(row, 6, costo_total, currency_format)
            
            total_batches += prod.cantidad_batches
            total_kg += kg_total
            total_costo += costo_total
            row += 1
        
        # Totales
        row += 1
        worksheet.write(row, 2, 'TOTALES', total_format)
        worksheet.write(row, 3, total_batches, total_format)
        worksheet.write(row, 5, total_kg, total_format)
        worksheet.write(row, 6, total_costo, total_format)
        
        row += 2
        worksheet.write(row, 0, f"Exportado: {datetime.now().strftime('%Y-%m-%d %H:%M')}", text_format)
        
        workbook.close()
        
        output.seek(0)
        filename = f"produccion_{mes}.xlsx"
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except ImportError:
        return jsonify({'error': 'xlsxwriter no está instalado. Ejecute: pip install xlsxwriter'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/exportar/requerimientos', methods=['GET'])
def exportar_requerimientos():
    """
    Exporta los requerimientos de materia prima a Excel.
    
    Query params:
    - mes: Mes a exportar (YYYY-MM)
    """
    try:
        import xlsxwriter
        
        mes = request.args.get('mes', f"{date.today().year}-{date.today().month:02d}")
        año, mes_num = map(int, mes.split('-'))
        
        # Obtener producción del mes
        producciones = ProduccionProgramada.query.filter(
            extract('year', ProduccionProgramada.fecha_programacion) == año,
            extract('month', ProduccionProgramada.fecha_programacion) == mes_num
        ).all()
        
        # Calcular requerimientos
        requerimientos = {}
        for prog in producciones:
            producto = prog.producto
            costeo = producto.get_costeo()
            
            for ing in costeo['ingredientes']:
                mp_id = ing['materia_prima_id']
                cantidad_total = ing['cantidad'] * prog.cantidad_batches
                costo_total = ing['costo_total'] * prog.cantidad_batches
                
                if mp_id not in requerimientos:
                    requerimientos[mp_id] = {
                        'nombre': ing['nombre'],
                        'categoria': ing['categoria'],
                        'unidad': ing['unidad'],
                        'cantidad': 0,
                        'costo': 0
                    }
                requerimientos[mp_id]['cantidad'] += cantidad_total
                requerimientos[mp_id]['costo'] += costo_total
        
        # Crear archivo Excel
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output, {'in_memory': True})
        
        # Formatos
        title_format = workbook.add_format({'bold': True, 'font_size': 14, 'bg_color': '#4472C4', 'font_color': 'white'})
        header_format = workbook.add_format({'bold': True, 'bg_color': '#D9E2F3', 'border': 1})
        currency_format = workbook.add_format({'num_format': '$#,##0.00', 'border': 1})
        number_format = workbook.add_format({'num_format': '#,##0.000', 'border': 1})
        text_format = workbook.add_format({'border': 1})
        total_format = workbook.add_format({'bold': True, 'bg_color': '#C6E0B4', 'border': 1})
        cat_format = workbook.add_format({'bold': True, 'bg_color': '#FCE4D6', 'border': 1})
        
        worksheet = workbook.add_worksheet('Requerimientos')
        worksheet.set_column('A:A', 30)
        worksheet.set_column('B:B', 15)
        worksheet.set_column('C:C', 15)
        worksheet.set_column('D:D', 10)
        worksheet.set_column('E:E', 18)
        
        row = 0
        meses_nombre = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                       'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
        
        worksheet.merge_range(row, 0, row, 4, f"REQUERIMIENTOS DE MATERIA PRIMA - {meses_nombre[mes_num]} {año}", title_format)
        row += 2
        
        worksheet.write(row, 0, 'Materia Prima', header_format)
        worksheet.write(row, 1, 'Categoría', header_format)
        worksheet.write(row, 2, 'Cantidad', header_format)
        worksheet.write(row, 3, 'Unidad', header_format)
        worksheet.write(row, 4, 'Costo Total', header_format)
        row += 1
        
        # Agrupar por categoría
        categorias = {}
        for mp_id, data in requerimientos.items():
            cat = data['categoria']
            if cat not in categorias:
                categorias[cat] = []
            categorias[cat].append(data)
        
        total_general = 0
        for cat in ['CERDO', 'POLLO', 'GALLINA', 'INSUMOS', 'ENVASES']:
            if cat not in categorias:
                continue
            
            items = categorias[cat]
            cat_total = sum(item['costo'] for item in items)
            total_general += cat_total
            
            worksheet.write(row, 0, cat, cat_format)
            worksheet.merge_range(row, 1, row, 3, '', cat_format)
            worksheet.write(row, 4, cat_total, cat_format)
            row += 1
            
            for item in sorted(items, key=lambda x: x['nombre']):
                worksheet.write(row, 0, item['nombre'], text_format)
                worksheet.write(row, 1, item['categoria'], text_format)
                worksheet.write(row, 2, item['cantidad'], number_format)
                worksheet.write(row, 3, item['unidad'], text_format)
                worksheet.write(row, 4, item['costo'], currency_format)
                row += 1
            
            row += 1
        
        worksheet.write(row, 0, 'TOTAL GENERAL', total_format)
        worksheet.merge_range(row, 1, row, 3, '', total_format)
        worksheet.write(row, 4, total_general, total_format)
        
        row += 2
        worksheet.write(row, 0, f"Exportado: {datetime.now().strftime('%Y-%m-%d %H:%M')}", text_format)
        
        workbook.close()
        
        output.seek(0)
        filename = f"requerimientos_{mes}.xlsx"
        
        return send_file(
            output,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            as_attachment=True,
            download_name=filename
        )
        
    except ImportError:
        return jsonify({'error': 'xlsxwriter no está instalado. Ejecute: pip install xlsxwriter'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ===== PROYECCIÓN MULTI-PERÍODO =====
@app.route('/api/proyeccion-multiperiodo', methods=['POST'])
def proyeccion_multiperiodo():
    """
    Genera proyección consolidada para múltiples meses.
    
    Body JSON:
    - mes_inicio: Mes inicial (YYYY-MM)
    - mes_fin: Mes final (YYYY-MM)
    - mes_base_costos: Mes base para costos indirectos (YYYY-MM)
    - modo: 'mixto' | 'manual' | 'ml'
    
    Returns: Proyección consolidada con costos por mes y resumen
    """
    data = get_json_data()
    if not data:
        return jsonify({'error': 'Datos JSON requeridos'}), 400
    
    mes_inicio = data.get('mes_inicio')
    mes_fin = data.get('mes_fin')
    mes_base_costos = data.get('mes_base_costos')
    modo = data.get('modo', 'mixto')
    
    if not all([mes_inicio, mes_fin, mes_base_costos]):
        return jsonify({'error': 'mes_inicio, mes_fin y mes_base_costos son requeridos'}), 400
    
    try:
        # Importar predictor para ML
        from predictor import get_predictor
        predictor = get_predictor()
        
        # Parsear fechas
        año_inicio, mes_inicio_num = map(int, mes_inicio.split('-'))
        año_fin, mes_fin_num = map(int, mes_fin.split('-'))
        año_base, mes_base_num = map(int, mes_base_costos.split('-'))
        
        # Generar lista de meses en el rango
        meses_proyeccion = []
        fecha_actual = date(año_inicio, mes_inicio_num, 1)
        fecha_fin_obj = date(año_fin, mes_fin_num, 1)
        
        while fecha_actual <= fecha_fin_obj:
            meses_proyeccion.append(f"{fecha_actual.year}-{fecha_actual.month:02d}")
            # Siguiente mes
            if fecha_actual.month == 12:
                fecha_actual = date(fecha_actual.year + 1, 1, 1)
            else:
                fecha_actual = date(fecha_actual.year, fecha_actual.month + 1, 1)
        
        # Obtener productos
        productos = Producto.query.filter_by(activo=True).all()
        productos_dict = {p.id: p for p in productos}
        
        # Obtener costos indirectos del mes base
        costos_base = CostoIndirecto.query.filter_by(mes_base=mes_base_costos).all()
        if not costos_base:
            return jsonify({'error': f'No hay costos indirectos para el mes base {mes_base_costos}'}), 400
        
        total_sp_base = sum(c.monto for c in costos_base if c.tipo_distribucion == 'SP')
        total_gif_base = sum(c.monto for c in costos_base if c.tipo_distribucion == 'GIF')
        total_dep_base = sum(c.monto for c in costos_base if c.tipo_distribucion == 'DEP')

        logger.info(
            "proyeccion_multiperiodo.start mes_inicio=%s mes_fin=%s mes_base_costos=%s modo=%s meses=%s productos=%s sp_base=%.2f gif_base=%.2f dep_base=%.2f",
            mes_inicio,
            mes_fin,
            mes_base_costos,
            modo,
            len(meses_proyeccion),
            len(productos_dict),
            float(total_sp_base),
            float(total_gif_base),
            float(total_dep_base),
        )
        
        # Procesar cada mes
        resultados_meses = []
        total_kg_periodo = 0
        costo_total_periodo = 0
        meses_manuales = 0
        meses_ml = 0
        
        for mes_proj in meses_proyeccion:
            # Variables de diagnóstico del mes
            total_kg_mes = 0
            total_minutos_mes = 0

            año_proj, mes_proj_num = map(int, mes_proj.split('-'))
            
            # Calcular inflación acumulada
            inflacion_acumulada = 1.0
            if mes_proj > mes_base_costos:
                inflaciones = InflacionMensual.query.filter(
                    InflacionMensual.mes > mes_base_costos,
                    InflacionMensual.mes <= mes_proj
                ).all()
                for inf in inflaciones:
                    inflacion_acumulada *= (1 + inf.porcentaje / 100)
            
            # Ajustar costos indirectos por inflación
            total_sp = total_sp_base * inflacion_acumulada
            total_gif = total_gif_base * inflacion_acumulada
            total_dep = total_dep_base * inflacion_acumulada
            
            # Determinar fuente de datos: manual o ML
            fecha_inicio_mes = date(año_proj, mes_proj_num, 1)
            if mes_proj_num == 12:
                fecha_fin_mes = date(año_proj + 1, 1, 1)
            else:
                fecha_fin_mes = date(año_proj, mes_proj_num + 1, 1)
            
            # Verificar si hay producción manual
            produccion_manual = ProduccionProgramada.query.filter(
                ProduccionProgramada.fecha_programacion >= fecha_inicio_mes,
                ProduccionProgramada.fecha_programacion < fecha_fin_mes
            ).all()
            
            usar_manual = False
            if modo == 'manual':
                usar_manual = len(produccion_manual) > 0
            elif modo == 'ml':
                usar_manual = False
            else:  # mixto
                usar_manual = len(produccion_manual) > 0
            
            productos_mes = []
            fuente = 'manual' if usar_manual else 'ml'
            
            if usar_manual:
                # Usar datos manuales
                meses_manuales += 1
                
                # Calcular totales del mes
                total_kg_mes = 0
                total_minutos_mes = 0
                prod_detalles = {}
                
                for prod_prog in produccion_manual:
                    producto = prod_prog.producto
                    kg_producido = prod_prog.cantidad_batches * producto.peso_batch_kg
                    minutos = kg_producido * producto.min_mo_kg
                    
                    total_kg_mes += kg_producido
                    total_minutos_mes += minutos
                    
                    if producto.id not in prod_detalles:
                        prod_detalles[producto.id] = {
                            'kg': 0,
                            'minutos': 0
                        }
                    prod_detalles[producto.id]['kg'] += kg_producido
                    prod_detalles[producto.id]['minutos'] += minutos
                
                # Calcular costos por producto
                for prod_id, detalles in prod_detalles.items():
                    producto = productos_dict[prod_id]
                    costeo = producto.get_costeo()
                    
                    kg = detalles['kg']
                    minutos_prod = detalles['minutos']
                    
                    # MP con inflación
                    mp_base_kg = costeo['resumen']['costo_por_kg']
                    mp_por_kg = mp_base_kg * inflacion_acumulada
                    
                    # Costos indirectos distribuidos
                    # GIF/DEP: por kg siempre que exista producción.
                    # SP: por minutos si existen; si no, fallback a kg.
                    if kg > 0 and total_kg_mes > 0:
                        pct_kg = kg / total_kg_mes
                        pct_sp = (minutos_prod / total_minutos_mes) if total_minutos_mes > 0 else pct_kg
                        
                        costo_sp = total_sp * pct_sp
                        costo_gif = total_gif * pct_kg
                        costo_dep = total_dep * pct_kg
                        
                        ind_por_kg = (costo_sp + costo_gif + costo_dep) / kg
                    else:
                        ind_por_kg = 0
                    
                    total_por_kg = mp_por_kg + ind_por_kg
                    costo_total = total_por_kg * kg
                    
                    productos_mes.append({
                        'producto_id': prod_id,
                        'nombre': producto.nombre,
                        'codigo': producto.codigo,
                        'kg': round(kg, 2),
                        'mp_por_kg': round(mp_por_kg, 2),
                        'ind_por_kg': round(ind_por_kg, 2),
                        'total_por_kg': round(total_por_kg, 2),
                        'costo_total': round(costo_total, 2),
                        'sin_formula': costeo.get('advertencias') is not None
                    })
                    
                    total_kg_periodo += kg
                    costo_total_periodo += costo_total
            
            else:
                # Usar predicciones ML
                if predictor and predictor.is_trained:
                    meses_ml += 1
                    
                    # Usar predict_month para obtener predicciones de todos los productos
                    productos_ids = list(productos_dict.keys())
                    predicciones = predictor.predict_month(productos_ids, año_proj, mes_proj_num)
                    if predicciones and len(predicciones) > 0:
                        # Calcular totales del mes para distribución
                        total_kg_mes = sum(p['cantidad_kg'] for p in predicciones if p['cantidad_kg'] and p['cantidad_kg'] > 0)
                        total_minutos_mes = 0
                        
                        # Primera pasada: calcular totales
                        for pred in predicciones:
                            if pred['cantidad_kg'] and pred['cantidad_kg'] > 0:
                                prod_id = pred['producto_id']
                                if prod_id in productos_dict:
                                    producto = productos_dict[prod_id]
                                    kg = pred['cantidad_kg']
                                    minutos = kg * producto.min_mo_kg
                                    total_minutos_mes += minutos
                        
                        # Segunda pasada: calcular costos
                        for pred in predicciones:
                            if pred['cantidad_kg'] and pred['cantidad_kg'] > 0:
                                prod_id = pred['producto_id']
                                if prod_id not in productos_dict:
                                    continue
                                
                                producto = productos_dict[prod_id]
                                costeo = producto.get_costeo()
                                kg = pred['cantidad_kg']
                                minutos_prod = kg * producto.min_mo_kg
                                
                                # MP con inflación
                                mp_base_kg = costeo['resumen']['costo_por_kg']
                                mp_por_kg = mp_base_kg * inflacion_acumulada
                                
                                # Costos indirectos distribuidos
                                # GIF/DEP: por kg siempre que exista producción.
                                # SP: por minutos si existen; si no, fallback a kg.
                                if kg > 0 and total_kg_mes > 0:
                                    pct_kg = kg / total_kg_mes
                                    pct_sp = (minutos_prod / total_minutos_mes) if total_minutos_mes > 0 else pct_kg
                                    
                                    costo_sp = total_sp * pct_sp
                                    costo_gif = total_gif * pct_kg
                                    costo_dep = total_dep * pct_kg
                                    
                                    ind_por_kg = (costo_sp + costo_gif + costo_dep) / kg
                                else:
                                    ind_por_kg = 0
                                
                                total_por_kg = mp_por_kg + ind_por_kg
                                costo_total = total_por_kg * kg
                                
                                productos_mes.append({
                                    'producto_id': prod_id,
                                    'nombre': producto.nombre,
                                    'codigo': producto.codigo,
                                    'kg': round(kg, 2),
                                    'mp_por_kg': round(mp_por_kg, 2),
                                    'ind_por_kg': round(ind_por_kg, 2),
                                    'total_por_kg': round(total_por_kg, 2),
                                    'costo_total': round(costo_total, 2),
                                    'confianza': pred.get('confianza', 0),
                                    'metodo': pred.get('metodo', 'desconocido'),
                                    'sin_formula': costeo.get('advertencias') is not None
                                })
                                
                                total_kg_periodo += kg
                                costo_total_periodo += costo_total
                else:
                    fuente = 'sin_datos'
            
            # Calcular totales del mes
            total_kg_mes_calc = sum(p['kg'] for p in productos_mes)
            costo_total_mes = sum(p['costo_total'] for p in productos_mes)
            productos_sin_formula = sum(1 for p in productos_mes if p.get('sin_formula', False))
            
            resultados_meses.append({
                'mes': mes_proj,
                'fuente': fuente,
                'productos': productos_mes,
                'total_kg': round(total_kg_mes_calc, 2),
                'costo_total': round(costo_total_mes, 2),
                'inflacion_acumulada_pct': round((inflacion_acumulada - 1) * 100, 2),
                'productos_sin_formula': productos_sin_formula
            })

            sp_fallback_to_kg = bool(total_minutos_mes == 0 and total_kg_mes_calc > 0 and total_sp > 0)
            if sp_fallback_to_kg:
                logger.info(
                    "proyeccion_multiperiodo.sp_fallback_to_kg mes=%s kg_total=%.4f",
                    mes_proj,
                    float(total_kg_mes_calc),
                )

            logger.debug(
                "proyeccion_multiperiodo.mes mes=%s fuente=%s inflacion_pct=%.2f kg=%.4f minutos=%.4f costo_total=%.2f productos=%s sin_formula=%s",
                mes_proj,
                fuente,
                float((inflacion_acumulada - 1) * 100),
                float(total_kg_mes_calc),
                float(total_minutos_mes),
                float(costo_total_mes),
                len(productos_mes),
                productos_sin_formula,
            )
        
        # Calcular resumen
        num_meses = len(meses_proyeccion)
        costo_promedio_mes = costo_total_periodo / num_meses if num_meses > 0 else 0
        costo_promedio_kg = costo_total_periodo / total_kg_periodo if total_kg_periodo > 0 else 0

        logger.info(
            "proyeccion_multiperiodo.done meses=%s meses_manuales=%s meses_ml=%s total_kg=%.4f costo_total=%.2f costo_prom_kg=%.4f",
            num_meses,
            meses_manuales,
            meses_ml,
            float(total_kg_periodo),
            float(costo_total_periodo),
            float(costo_promedio_kg),
        )
        
        return jsonify({
            'meses': resultados_meses,
            'resumen': {
                'total_kg_periodo': round(total_kg_periodo, 2),
                'costo_total_periodo': round(costo_total_periodo, 2),
                'costo_promedio_kg': round(costo_promedio_kg, 2),
                'costo_promedio_mes': round(costo_promedio_mes, 2),
                'num_meses': num_meses,
                'meses_manuales': meses_manuales,
                'meses_ml': meses_ml,
                'mes_base_costos': mes_base_costos
            }
        })
        
    except Exception as e:
        logger.exception(
            "proyeccion_multiperiodo.error mes_inicio=%s mes_fin=%s mes_base_costos=%s modo=%s",
            mes_inicio,
            mes_fin,
            mes_base_costos,
            modo,
        )
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
