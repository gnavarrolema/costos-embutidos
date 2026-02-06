"""Tests para la funcionalidad de costos indirectos fijos vs variables."""

from app import db, CostoIndirecto


def test_costo_indirecto_es_variable_default_false(client):
    """Verifica que es_variable sea False por defecto."""
    # Crear costo sin especificar es_variable
    resp = client.post('/api/costos-indirectos', json={
        'cuenta': 'Seguros',
        'monto': 1000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-01'
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['es_variable'] == False


def test_costo_indirecto_crear_con_es_variable_true(client):
    """Verifica que se puede crear un costo marcado como variable."""
    resp = client.post('/api/costos-indirectos', json={
        'cuenta': 'Energía Eléctrica',
        'monto': 5000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-01',
        'es_variable': True
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert data['es_variable'] == True


def test_costo_indirecto_actualizar_es_variable(client):
    """Verifica que se puede actualizar el campo es_variable."""
    # Crear costo como fijo
    resp = client.post('/api/costos-indirectos', json={
        'cuenta': 'Gas Natural',
        'monto': 3000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-01',
        'es_variable': False
    })
    assert resp.status_code == 201
    costo_id = resp.get_json()['id']
    
    # Actualizar a variable
    resp = client.put(f'/api/costos-indirectos/{costo_id}', json={
        'es_variable': True
    })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data['es_variable'] == True


def test_resumen_incluye_fijos_y_variables(client):
    """Verifica que el resumen incluya desglose de fijos y variables."""
    # Crear costos fijos
    client.post('/api/costos-indirectos', json={
        'cuenta': 'Alquiler',
        'monto': 10000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-02',
        'es_variable': False
    })
    client.post('/api/costos-indirectos', json={
        'cuenta': 'Seguros',
        'monto': 5000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-02',
        'es_variable': False
    })
    
    # Crear costos variables
    client.post('/api/costos-indirectos', json={
        'cuenta': 'Energía',
        'monto': 8000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-02',
        'es_variable': True
    })
    client.post('/api/costos-indirectos', json={
        'cuenta': 'Gas',
        'monto': 2000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-02',
        'es_variable': True
    })
    
    # Obtener resumen
    resp = client.get('/api/costos-indirectos/resumen?mes_base=2025-02')
    assert resp.status_code == 200
    data = resp.get_json()
    
    assert data['total_fijos'] == 15000.0  # 10000 + 5000
    assert data['total_variables'] == 10000.0  # 8000 + 2000
    assert data['total'] == 25000.0


def test_distribucion_escala_costos_variables(client):
    """
    Verifica que los costos variables escalan proporcionalmente con el volumen.
    
    Setup:
    - Mes base (2025-03): 1000 kg producidos, costo variable $10,000
    - Mes proyección (2025-04): 1500 kg producidos (factor 1.5)
    
    Esperado:
    - Factor = 1.5
    - Costo variable escalado = $15,000
    - Costo fijo sin cambio = $5,000
    """
    from app import db, Producto, ProduccionProgramada, Categoria
    from datetime import date
    
    # Setup: Crear categoría y producto
    categoria = Categoria(nombre='TEST_CAT', tipo='DIRECTA')
    db.session.add(categoria)
    db.session.commit()
    
    producto = Producto(
        codigo='TEST001',
        nombre='Producto Test',
        peso_batch_kg=100.0,
        porcentaje_merma=0,
        min_mo_kg=0.5,
        activo=True
    )
    db.session.add(producto)
    db.session.commit()
    
    # Producción mes base: 10 batches = 1000 kg
    prod_base = ProduccionProgramada(
        producto_id=producto.id,
        cantidad_batches=10.0,
        fecha_programacion=date(2025, 3, 15)
    )
    db.session.add(prod_base)
    
    # Producción mes proyección: 15 batches = 1500 kg (factor 1.5)
    prod_proyectado = ProduccionProgramada(
        producto_id=producto.id,
        cantidad_batches=15.0,
        fecha_programacion=date(2025, 4, 15)
    )
    db.session.add(prod_proyectado)
    db.session.commit()
    
    # Crear costo FIJO (no debe escalar)
    client.post('/api/costos-indirectos', json={
        'cuenta': 'Alquiler Test',
        'monto': 5000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-03',
        'es_variable': False
    })
    
    # Crear costo VARIABLE (debe escalar)
    client.post('/api/costos-indirectos', json={
        'cuenta': 'Energía Test',
        'monto': 10000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-03',
        'es_variable': True
    })
    
    # Llamar endpoint de distribución
    resp = client.get('/api/distribucion-costos?mes_base=2025-03&mes_produccion=2025-04')
    assert resp.status_code == 200
    data = resp.get_json()
    
    # Verificar factor de escalamiento
    assert 'escalamiento' in data
    assert data['escalamiento']['factor'] == 1.5  # 1500/1000
    assert data['escalamiento']['volumen_base_kg'] == 1000.0
    assert data['escalamiento']['volumen_proyectado_kg'] == 1500.0
    
    # Verificar que los fijos no escalaron
    assert data['escalamiento']['total_fijos'] == 5000.0
    
    # Verificar que los variables escalaron
    assert data['escalamiento']['total_variables_base'] == 10000.0
    assert data['escalamiento']['total_variables_escalados'] == 15000.0  # 10000 * 1.5
    
    # Verificar total indirectos = fijos + variables escalados = 5000 + 15000 = 20000
    assert data['totales']['total_indirectos'] == 20000.0


def test_costeo_completo_aplica_escalamiento(client):
    """
    Verifica que /api/costeo/{id}/completo aplique escalamiento a costos variables.
    
    Este test comprueba la corrección del bug donde el endpoint de costeo completo
    ignoraba el campo es_variable y no aplicaba escalamiento por volumen.
    """
    from app import db, Producto, ProduccionProgramada, Categoria
    from datetime import date
    
    # Setup: Crear categoría y producto
    categoria = Categoria(nombre='TEST_CAT_COSTEO', tipo='DIRECTA')
    db.session.add(categoria)
    db.session.commit()
    
    producto = Producto(
        codigo='COSTEO001',
        nombre='Producto Costeo Test',
        peso_batch_kg=100.0,
        porcentaje_merma=0,
        min_mo_kg=0.5,
        activo=True
    )
    db.session.add(producto)
    db.session.commit()
    
    # Producción mes base (2025-05): 10 batches = 1000 kg
    prod_base = ProduccionProgramada(
        producto_id=producto.id,
        cantidad_batches=10.0,
        fecha_programacion=date(2025, 5, 15)
    )
    db.session.add(prod_base)
    
    # Producción mes proyección (2025-06): 20 batches = 2000 kg (factor 2.0)
    prod_proyectado = ProduccionProgramada(
        producto_id=producto.id,
        cantidad_batches=20.0,
        fecha_programacion=date(2025, 6, 15)
    )
    db.session.add(prod_proyectado)
    db.session.commit()
    
    # Crear costo FIJO
    client.post('/api/costos-indirectos', json={
        'cuenta': 'Alquiler Costeo Test',
        'monto': 5000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-05',
        'es_variable': False
    })
    
    # Crear costo VARIABLE
    client.post('/api/costos-indirectos', json={
        'cuenta': 'Energía Costeo Test',
        'monto': 10000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-05',
        'es_variable': True
    })
    
    # Llamar endpoint de costeo completo
    resp = client.get(f'/api/costeo/{producto.id}/completo?mes_base=2025-05&mes_produccion=2025-06')
    assert resp.status_code == 200
    data = resp.get_json()
    
    # Verificar que existe info de escalamiento
    assert 'costos_indirectos' in data
    assert 'escalamiento' in data['costos_indirectos']
    
    # El factor debería ser 2.0 (2000 kg / 1000 kg)
    escalamiento = data['costos_indirectos']['escalamiento']
    assert escalamiento['factor'] == 2.0
    assert escalamiento['volumen_base_kg'] == 1000.0
    assert escalamiento['volumen_proyectado_kg'] == 2000.0
    
    # Total fijos = 5000, Total variables base = 10000, escalados = 20000
    assert escalamiento['total_fijos'] == 5000.0
    assert escalamiento['total_variables_base'] == 10000.0
    assert escalamiento['total_variables_escalados'] == 20000.0


def test_variacion_max_pct_limita_escalamiento(client):
    """
    Verifica que variacion_max_pct limita el porcentaje de aumento.
    
    Un costo con variacion_max_pct=50 no puede aumentar más del 50%,
    incluso si la producción aumenta más.
    """
    from app import db, Producto, ProduccionProgramada, Categoria
    from datetime import date
    
    # Setup
    categoria = Categoria(nombre='TEST_CAT_VARIACION', tipo='DIRECTA')
    db.session.add(categoria)
    db.session.commit()
    
    producto = Producto(
        codigo='VARMAX001',
        nombre='Producto Variacion Max Test',
        peso_batch_kg=100.0,
        porcentaje_merma=0,
        min_mo_kg=0.5,
        activo=True
    )
    db.session.add(producto)
    db.session.commit()
    
    # Producción mes base: 1000 kg
    prod_base = ProduccionProgramada(
        producto_id=producto.id,
        cantidad_batches=10.0,
        fecha_programacion=date(2025, 7, 15)
    )
    db.session.add(prod_base)
    
    # Producción mes proyección: 2000 kg (factor base 2.0 = +100%)
    prod_proyectado = ProduccionProgramada(
        producto_id=producto.id,
        cantidad_batches=20.0,
        fecha_programacion=date(2025, 8, 15)
    )
    db.session.add(prod_proyectado)
    db.session.commit()
    
    # Crear costo variable con variación máxima del 50%
    resp = client.post('/api/costos-indirectos', json={
        'cuenta': 'Energía VariacionMax Test',
        'monto': 10000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-07',
        'es_variable': True,
        'variacion_max_pct': 50  # Máximo +50%
    })
    assert resp.status_code == 201
    
    # Llamar endpoint de distribución
    resp = client.get('/api/distribucion-costos?mes_base=2025-07&mes_produccion=2025-08')
    assert resp.status_code == 200
    data = resp.get_json()
    
    # Con factor base 2.0 (+100%) pero límite de 50%:
    # factor_efectivo = min(2.0, 1.5) = 1.5
    # Costo escalado = 10000 * 1.5 = 15000
    assert data['escalamiento']['total_variables_escalados'] == 15000.0


def test_escalamiento_sin_limite(client):
    """
    Verifica que sin variacion_max_pct el escalamiento es ilimitado (hasta factor_limite_max global).
    """
    from app import db, Producto, ProduccionProgramada, Categoria
    from datetime import date
    
    # Setup
    categoria = Categoria(nombre='TEST_CAT_NOLIMIT', tipo='DIRECTA')
    db.session.add(categoria)
    db.session.commit()
    
    producto = Producto(
        codigo='NOLIMIT001',
        nombre='Producto Sin Limite Test',
        peso_batch_kg=100.0,
        porcentaje_merma=0,
        min_mo_kg=0.5,
        activo=True
    )
    db.session.add(producto)
    db.session.commit()
    
    # Producción mes base: 1000 kg
    prod_base = ProduccionProgramada(
        producto_id=producto.id,
        cantidad_batches=10.0,
        fecha_programacion=date(2025, 9, 15)
    )
    db.session.add(prod_base)
    
    # Producción mes proyección: 2500 kg (factor base 2.5)
    prod_proyectado = ProduccionProgramada(
        producto_id=producto.id,
        cantidad_batches=25.0,
        fecha_programacion=date(2025, 10, 15)
    )
    db.session.add(prod_proyectado)
    db.session.commit()
    
    # Crear costo variable SIN límite de variación
    resp = client.post('/api/costos-indirectos', json={
        'cuenta': 'Gas Sin Limite Test',
        'monto': 10000.0,
        'tipo_distribucion': 'GIF',
        'mes_base': '2025-09',
        'es_variable': True
        # Sin variacion_max_pct
    })
    assert resp.status_code == 201
    
    # Llamar endpoint de distribución
    resp = client.get('/api/distribucion-costos?mes_base=2025-09&mes_produccion=2025-10')
    assert resp.status_code == 200
    data = resp.get_json()
    
    # Factor base 2.5, sin límite individual
    # Costo escalado = 10000 * 2.5 = 25000
    assert data['escalamiento']['total_variables_escalados'] == 25000.0
