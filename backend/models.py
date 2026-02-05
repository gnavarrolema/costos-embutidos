from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class Usuario(db.Model):
    """Modelo de usuario para autenticación"""
    __tablename__ = 'usuarios'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    nombre = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100))
    rol = db.Column(db.String(20), nullable=False, default='usuario')  # admin, usuario, lectura
    activo = db.Column(db.Boolean, default=True)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    ultimo_login = db.Column(db.DateTime)
    
    def set_password(self, password):
        """Hashea y guarda la contraseña"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Verifica la contraseña"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'nombre': self.nombre,
            'email': self.email,
            'rol': self.rol,
            'activo': self.activo,
            'fecha_creacion': self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            'ultimo_login': self.ultimo_login.isoformat() if self.ultimo_login else None
        }

class Categoria(db.Model):
    __tablename__ = 'categorias'
    
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), unique=True, nullable=False)
    tipo = db.Column(db.String(20), nullable=False)  # DIRECTA, INDIRECTA, ENVASE
    
    materias_primas = db.relationship('MateriaPrima', backref='categoria', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'tipo': self.tipo
        }


class MateriaPrima(db.Model):
    __tablename__ = 'materias_primas'
    
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(20))
    nombre = db.Column(db.String(100), unique=True, nullable=False)
    categoria_id = db.Column(db.Integer, db.ForeignKey('categorias.id'), nullable=False)
    unidad = db.Column(db.String(10), nullable=False)  # Kg, UND, Lt
    costo_unitario = db.Column(db.Float, nullable=False, default=0)
    fecha_actualizacion = db.Column(db.DateTime, default=datetime.utcnow)
    activo = db.Column(db.Boolean, default=True)
    
    formula_detalles = db.relationship('FormulaDetalle', backref='materia_prima', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'codigo': self.codigo,
            'nombre': self.nombre,
            'categoria_id': self.categoria_id,
            'categoria': self.categoria.nombre if self.categoria else None,
            'unidad': self.unidad,
            'costo_unitario': self.costo_unitario,
            'fecha_actualizacion': self.fecha_actualizacion.isoformat() if self.fecha_actualizacion else None,
            'activo': self.activo
        }


class HistorialPrecios(db.Model):
    """Registra todos los cambios de precios en materias primas"""
    __tablename__ = 'historial_precios'
    
    id = db.Column(db.Integer, primary_key=True)
    materia_prima_id = db.Column(db.Integer, db.ForeignKey('materias_primas.id'), nullable=False)
    precio_anterior = db.Column(db.Float, nullable=False)
    precio_nuevo = db.Column(db.Float, nullable=False)
    fecha_cambio = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    tipo_cambio = db.Column(db.String(20), nullable=False)  # 'AJUSTE_MASIVO', 'EDICION_INDIVIDUAL', 'REVERSION'
    porcentaje_aplicado = db.Column(db.Float, nullable=True)  # Solo para ajustes masivos
    categoria_afectada = db.Column(db.String(50), nullable=True)  # Solo para ajustes masivos por categoría
    ajuste_batch_id = db.Column(db.String(50), nullable=True)  # Agrupa cambios del mismo ajuste masivo
    usuario = db.Column(db.String(100), nullable=True)  # Futuro: tracking de quién hizo el cambio
    
    materia_prima = db.relationship('MateriaPrima', backref='historial_precios')
    
    def to_dict(self):
        return {
            'id': self.id,
            'materia_prima_id': self.materia_prima_id,
            'materia_prima_nombre': self.materia_prima.nombre if self.materia_prima else None,
            'precio_anterior': self.precio_anterior,
            'precio_nuevo': self.precio_nuevo,
            'diferencia': round(self.precio_nuevo - self.precio_anterior, 2),
            'fecha_cambio': self.fecha_cambio.isoformat() if self.fecha_cambio else None,
            'tipo_cambio': self.tipo_cambio,
            'porcentaje_aplicado': self.porcentaje_aplicado,
            'categoria_afectada': self.categoria_afectada,
            'ajuste_batch_id': self.ajuste_batch_id,
            'usuario': self.usuario
        }



class Producto(db.Model):
    __tablename__ = 'productos'
    
    id = db.Column(db.Integer, primary_key=True)
    codigo = db.Column(db.String(20), unique=True, nullable=False)
    nombre = db.Column(db.String(100), nullable=False)
    peso_batch_kg = db.Column(db.Float, nullable=False)
    porcentaje_merma = db.Column(db.Float, nullable=False, default=0)
    min_mo_kg = db.Column(db.Float, nullable=False, default=0)  # Minutos mano de obra por kg
    activo = db.Column(db.Boolean, default=True)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    
    formula_detalles = db.relationship('FormulaDetalle', backref='producto', lazy=True, cascade='all, delete-orphan')
    produccion_programada = db.relationship('ProduccionProgramada', backref='producto', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'codigo': self.codigo,
            'nombre': self.nombre,
            'peso_batch_kg': self.peso_batch_kg,
            'porcentaje_merma': self.porcentaje_merma,
            'min_mo_kg': self.min_mo_kg,
            'activo': self.activo,
            'fecha_creacion': self.fecha_creacion.isoformat() if self.fecha_creacion else None
        }
    
    def get_costeo(self):
        """Calcula el costeo completo del producto"""
        ingredientes = []
        totales_categoria = {}
        total_materia_prima = 0
        
        for detalle in self.formula_detalles:
            mp = detalle.materia_prima
            costo_total = detalle.cantidad * mp.costo_unitario
            
            ingredientes.append({
                'id': detalle.id,
                'materia_prima_id': mp.id,
                'nombre': mp.nombre,
                'categoria': mp.categoria.nombre,
                'unidad': mp.unidad,
                'costo_unitario': mp.costo_unitario,
                'cantidad': detalle.cantidad,
                'costo_total': costo_total
            })
            
            cat = mp.categoria.nombre
            if cat not in totales_categoria:
                totales_categoria[cat] = {'cantidad': 0, 'costo': 0}
            totales_categoria[cat]['cantidad'] += detalle.cantidad
            totales_categoria[cat]['costo'] += costo_total
            
            if cat != 'ENVASES':
                total_materia_prima += costo_total
        
        total_envases = totales_categoria.get('ENVASES', {}).get('costo', 0)
        
        # Calcular costo de merma (porcentaje de pérdida sobre materia prima)
        costo_merma = total_materia_prima * (self.porcentaje_merma / 100) if self.porcentaje_merma > 0 else 0
        materia_prima_neta = total_materia_prima + costo_merma
        total_neto = materia_prima_neta + total_envases
        
        # Calcular peso neto considerando el rendimiento (Escenario B)
        # peso_batch_kg = peso bruto de ingredientes
        # rendimiento = porcentaje de producto final obtenido
        rendimiento = 100 - self.porcentaje_merma  # Ej: 100 - 3.6 = 96.4%
        peso_neto_batch_kg = self.peso_batch_kg * (rendimiento / 100)
        
        # Prevenir división por cero y advertir sobre productos sin fórmula
        costo_por_kg = 0
        advertencias = []
        
        if peso_neto_batch_kg and peso_neto_batch_kg > 0:
            costo_por_kg = total_neto / peso_neto_batch_kg
        else:
            if self.peso_batch_kg and self.peso_batch_kg > 0:
                advertencias.append(f'El rendimiento es 0% o negativo (merma = {self.porcentaje_merma}%)')
            else:
                advertencias.append('El peso del batch es 0 o no está definido')
        
        if total_materia_prima == 0 and len(ingredientes) == 0:
            advertencias.append('Este producto no tiene fórmula definida')
        
        return {
            'producto': self.to_dict(),
            'ingredientes': ingredientes,
            'totales_categoria': totales_categoria,
            'resumen': {
                'total_materia_prima': total_materia_prima,
                'costo_merma': costo_merma,
                'materia_prima_neta': materia_prima_neta,
                'total_envases': total_envases,
                'total_neto': total_neto,
                'peso_batch_kg': self.peso_batch_kg,  # Peso bruto (ingredientes)
                'porcentaje_merma': self.porcentaje_merma,
                'rendimiento': rendimiento,
                'peso_neto_batch_kg': peso_neto_batch_kg,  # Peso neto (producto final)
                'costo_por_kg': costo_por_kg
            },
            'advertencias': advertencias if advertencias else None
        }


class FormulaDetalle(db.Model):
    __tablename__ = 'formula_detalles'
    
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    materia_prima_id = db.Column(db.Integer, db.ForeignKey('materias_primas.id'), nullable=False)
    cantidad = db.Column(db.Float, nullable=False)
    
    def to_dict(self):
        return {
            'id': self.id,
            'producto_id': self.producto_id,
            'materia_prima_id': self.materia_prima_id,
            'cantidad': self.cantidad
        }


class ProduccionProgramada(db.Model):
    __tablename__ = 'produccion_programada'
    
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    cantidad_batches = db.Column(db.Float, nullable=False)
    fecha_programacion = db.Column(db.Date, nullable=False)
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    # Campos para ML
    es_sugerencia_ml = db.Column(db.Boolean, default=False)
    confianza_ml = db.Column(db.Float, nullable=True)  # 0-1
    
    def to_dict(self):
        # Calcular kg_producidos si hay producto relacionado
        kg_producidos = 0
        producto_data = None
        if self.producto:
            kg_producidos = self.cantidad_batches * self.producto.peso_batch_kg
            producto_data = self.producto.to_dict()
        
        return {
            'id': self.id,
            'producto_id': self.producto_id,
            'producto_nombre': self.producto.nombre if self.producto else None,
            'producto': producto_data,
            'cantidad_batches': self.cantidad_batches,
            'kg_producidos': kg_producidos,
            'fecha_programacion': self.fecha_programacion.isoformat() if self.fecha_programacion else None,
            'fecha_creacion': self.fecha_creacion.isoformat() if self.fecha_creacion else None,
            'es_sugerencia_ml': self.es_sugerencia_ml,
            'confianza_ml': self.confianza_ml
        }


class ProduccionHistorica(db.Model):
    """Almacena datos históricos de producción importados desde Excel"""
    __tablename__ = 'produccion_historica'
    
    id = db.Column(db.Integer, primary_key=True)
    producto_id = db.Column(db.Integer, db.ForeignKey('productos.id'), nullable=False)
    fecha = db.Column(db.Date, nullable=False)
    cantidad_kg = db.Column(db.Float, nullable=False)  # Producto terminado en Kg
    año = db.Column(db.Integer, nullable=False)
    mes = db.Column(db.Integer, nullable=False)
    
    producto = db.relationship('Producto', backref='produccion_historica')
    
    # Índice único para evitar duplicados
    __table_args__ = (
        db.UniqueConstraint('producto_id', 'fecha', name='unique_producto_fecha'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'producto_id': self.producto_id,
            'producto_nombre': self.producto.nombre if self.producto else None,
            'fecha': self.fecha.isoformat() if self.fecha else None,
            'cantidad_kg': self.cantidad_kg,
            'año': self.año,
            'mes': self.mes
        }


class CostoIndirecto(db.Model):
    """Almacena los costos indirectos por cuenta y mes base"""
    __tablename__ = 'costos_indirectos'
    
    id = db.Column(db.Integer, primary_key=True)
    cuenta = db.Column(db.String(100), nullable=False)
    descripcion = db.Column(db.String(200))
    monto = db.Column(db.Float, nullable=False)
    tipo_distribucion = db.Column(db.String(10), nullable=False)  # SP (mano obra), GIF (por kg), DEP
    mes_base = db.Column(db.String(7), nullable=False)  # YYYY-MM
    es_variable = db.Column(db.Boolean, default=False)  # True = escala con volumen de producción
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    
    __table_args__ = (
        db.UniqueConstraint('cuenta', 'mes_base', name='unique_cuenta_mes'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'cuenta': self.cuenta,
            'descripcion': self.descripcion,
            'monto': self.monto,
            'tipo_distribucion': self.tipo_distribucion,
            'mes_base': self.mes_base,
            'es_variable': self.es_variable,
            'fecha_creacion': self.fecha_creacion.isoformat() if self.fecha_creacion else None
        }


class InflacionMensual(db.Model):
    """Almacena los índices de inflación mensuales"""
    __tablename__ = 'inflacion_mensual'
    
    id = db.Column(db.Integer, primary_key=True)
    mes = db.Column(db.String(7), unique=True, nullable=False)  # YYYY-MM
    porcentaje = db.Column(db.Float, nullable=False)  # Ej: 2.5 para 2.5%
    fecha_creacion = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'mes': self.mes,
            'porcentaje': self.porcentaje,
            'fecha_creacion': self.fecha_creacion.isoformat() if self.fecha_creacion else None
        }


def init_db(app):
    """Inicializa la base de datos con datos semilla"""
    with app.app_context():
        # Flask-SQLAlchemy 3.x: create_all() es idempotente por defecto
        db.create_all()
        
        # ===== MIGRACIONES MANUALES =====
        # Agregar columna es_variable a costo_indirecto si no existe
        try:
            from sqlalchemy import text, inspect
            inspector = inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('costo_indirecto')]
            
            if 'es_variable' not in columns:
                with db.engine.connect() as conn:
                    conn.execute(text('ALTER TABLE costo_indirecto ADD COLUMN es_variable BOOLEAN DEFAULT 0'))
                    conn.commit()
                print("✅ Migración: columna es_variable agregada a costo_indirecto")
        except Exception as e:
            # Ignorar si la tabla no existe aún o hay otro error
            print(f"⚠️ Migración es_variable: {e}")
        
        # Crear usuario administrador por defecto si no existe ninguno
        if Usuario.query.count() == 0:
            admin = Usuario(
                username='admin',
                nombre='Administrador',
                rol='admin'
            )
            admin.set_password('admin123')  # Cambiar en producción
            db.session.add(admin)
            db.session.commit()
            print("✅ Usuario administrador creado (admin/admin123)")
        
        # Crear categorías si no existen
        if Categoria.query.count() == 0:
            categorias = [
                Categoria(nombre='CERDO', tipo='DIRECTA'),
                Categoria(nombre='POLLO', tipo='DIRECTA'),
                Categoria(nombre='GALLINA', tipo='DIRECTA'),
                Categoria(nombre='INSUMOS', tipo='INDIRECTA'),
                Categoria(nombre='ENVASES', tipo='ENVASE'),
            ]
            db.session.add_all(categorias)
            db.session.commit()
            print("✅ Categorías iniciales creadas")

