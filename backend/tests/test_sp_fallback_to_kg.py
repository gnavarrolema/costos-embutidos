from datetime import date

from app import db, MateriaPrima, Producto, FormulaDetalle, CostoIndirecto, ProduccionProgramada, Categoria


def test_sp_fallback_a_kg_si_total_minutos_es_cero(client):
    """Si total_minutos_mes==0, SP debe distribuirse por kg (fallback) como GIF/DEP."""

    cat = Categoria(nombre='CARNE', tipo='DIRECTA')
    db.session.add(cat)
    db.session.commit()

    mp = MateriaPrima(nombre='Carne Base', categoria_id=cat.id, unidad='Kg', costo_unitario=100.0)
    db.session.add(mp)
    db.session.commit()

    # 2 productos con min_mo_kg = 0
    p1 = Producto(codigo='SP0-A', nombre='Prod A', peso_batch_kg=10.0, min_mo_kg=0.0)
    p2 = Producto(codigo='SP0-B', nombre='Prod B', peso_batch_kg=20.0, min_mo_kg=0.0)
    db.session.add_all([p1, p2])
    db.session.commit()

    db.session.add_all([
        FormulaDetalle(producto_id=p1.id, materia_prima_id=mp.id, cantidad=10.0),
        FormulaDetalle(producto_id=p2.id, materia_prima_id=mp.id, cantidad=20.0),
    ])
    db.session.commit()

    mes_base = '2025-01'
    mes_prod = '2025-02'

    db.session.add_all([
        CostoIndirecto(cuenta='Sueldos', monto=1000.0, tipo_distribucion='SP', mes_base=mes_base),
        CostoIndirecto(cuenta='GIF', monto=2000.0, tipo_distribucion='GIF', mes_base=mes_base),
        CostoIndirecto(cuenta='Dep', monto=500.0, tipo_distribucion='DEP', mes_base=mes_base),
    ])
    db.session.commit()

    db.session.add_all([
        ProduccionProgramada(producto_id=p1.id, cantidad_batches=1.0, fecha_programacion=date(2025, 2, 1)),  # 10 kg
        ProduccionProgramada(producto_id=p2.id, cantidad_batches=1.0, fecha_programacion=date(2025, 2, 1)),  # 20 kg
    ])
    db.session.commit()

    kg_total = 30.0
    total_ind = 3500.0
    expected_ind_por_kg = total_ind / kg_total

    r1 = client.get(f'/api/costeo/{p1.id}/completo?mes_base={mes_base}&mes_produccion={mes_prod}')
    assert r1.status_code == 200, r1.get_data(as_text=True)
    d1 = r1.get_json()

    r2 = client.get(f'/api/costeo/{p2.id}/completo?mes_base={mes_base}&mes_produccion={mes_prod}')
    assert r2.status_code == 200, r2.get_data(as_text=True)
    d2 = r2.get_json()

    ind1 = d1['resumen']['costo_indirecto_por_kg']
    ind2 = d2['resumen']['costo_indirecto_por_kg']

    assert abs(ind1 - expected_ind_por_kg) < 0.2
    assert abs(ind2 - expected_ind_por_kg) < 0.2

    # pct_participacion_mo debe caer a kg en fallback
    assert abs(d1['costos_indirectos']['pct_participacion_mo'] - (10.0 / kg_total) * 100) < 0.2
    assert abs(d2['costos_indirectos']['pct_participacion_mo'] - (20.0 / kg_total) * 100) < 0.2
