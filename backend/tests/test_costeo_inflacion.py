from datetime import date

from app import db, MateriaPrima, Producto, FormulaDetalle, CostoIndirecto, InflacionMensual, ProduccionProgramada, Categoria


def test_costeo_aplica_inflacion_mp_e_indirectos(client):
    """Replica el escenario de backend/test_inflation_fix.py pero como test pytest."""

    # Categories
    cat_mp = Categoria(nombre='CARNE', tipo='DIRECTA')
    db.session.add(cat_mp)
    db.session.commit()

    # Materia Prima: Carne @ $1,000/kg
    mp = MateriaPrima(nombre='Carne Test Fix', categoria_id=cat_mp.id, unidad='Kg', costo_unitario=1000.0)
    db.session.add(mp)
    db.session.commit()

    # Product: 10kg Batch
    prod = Producto(codigo='TEST-FIX', nombre='Salchicha Test Fix', peso_batch_kg=10.0, min_mo_kg=1.0)
    db.session.add(prod)
    db.session.commit()

    # Formula: 10kg de Carne
    db.session.add(FormulaDetalle(producto_id=prod.id, materia_prima_id=mp.id, cantidad=10.0))
    db.session.commit()

    # Indirect Cost: Jan 2025, $2,000 GIF
    db.session.add(CostoIndirecto(cuenta='GIF Test Fix', monto=2000.0, tipo_distribucion='GIF', mes_base='2025-01'))
    db.session.commit()

    # Inflation: Feb 2025, 10%
    db.session.add(InflacionMensual(mes='2025-02', porcentaje=10.0))
    db.session.commit()

    # Schedule Production: Feb 2025, 1 Batch
    db.session.add(ProduccionProgramada(producto_id=prod.id, cantidad_batches=1.0, fecha_programacion=date(2025, 2, 1)))
    db.session.commit()

    resp = client.get(f'/api/costeo/{prod.id}/completo?mes_base=2025-01&mes_produccion=2025-02')
    assert resp.status_code == 200, resp.get_data(as_text=True)

    data = resp.get_json()
    resumen = data['resumen']
    costos_ind = data['costos_indirectos']

    assert abs(costos_ind['inflacion_acumulada_pct'] - 10.0) < 0.1

    # MP
    assert abs(resumen['costo_variable_base_por_kg'] - 1000.0) < 0.1
    assert abs(resumen['costo_variable_por_kg'] - 1100.0) < 0.1

    # Indirectos: 2000 inflado = 2200 / 10kg = 220/kg
    assert abs(resumen['costo_indirecto_por_kg'] - 220.0) < 0.1

    # Total
    assert abs(resumen['costo_total_por_kg'] - 1320.0) < 0.1
