def test_productos_paginados_formato(client):
    resp = client.get('/api/productos?page=1&per_page=10')
    assert resp.status_code == 200

    data = resp.get_json()
    assert 'items' in data
    assert 'pagination' in data
    assert data['pagination']['page'] == 1
    assert data['pagination']['per_page'] == 10


def test_productos_sin_paginacion_compatibilidad(client):
    resp = client.get('/api/productos')
    assert resp.status_code == 200
    data = resp.get_json()
    assert isinstance(data, list)
