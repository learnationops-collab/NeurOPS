"""Ruta comodin que sirve la SPA de React (frontend/dist): fallback a index.html y archivos estaticos.

Cada test apunta la carpeta estatica a un directorio temporal, asi el resultado no depende de que
exista (o no) un `frontend/dist` compilado en la maquina que corre los tests: en la de un
desarrollador suele existir y en CI no. La ruta hace `os.path.exists(join(static_folder, path))` con
el path que manda el visitante, asi que la proteccion contra path traversal se prueba aca.
"""
import pytest

INDICE = '<html>SPA-INDEX</html>'
SECRETO = 'CONTENIDO-SECRETO-FUERA-DE-DIST'


@pytest.fixture()
def estaticos(app, tmp_path, monkeypatch):
    carpeta = tmp_path / 'dist'
    (carpeta / 'assets').mkdir(parents=True)
    (carpeta / 'index.html').write_text(INDICE)
    (carpeta / 'assets' / 'app.js').write_text('console.log("hola")')
    (tmp_path / 'secreto.txt').write_text(SECRETO)  # al lado de dist, NO dentro
    monkeypatch.setattr(app, 'static_folder', str(carpeta))
    return carpeta


def test_la_raiz_y_las_rutas_del_frontend_sirven_la_spa(client, estaticos):
    for ruta in ('/', '/admin/ventas', '/closer/deck'):
        respuesta = client.get(ruta)

        assert respuesta.status_code == 200
        assert INDICE in respuesta.get_data(as_text=True)


def test_un_archivo_estatico_existente_se_sirve(client, estaticos):
    respuesta = client.get('/assets/app.js')

    assert respuesta.status_code == 200
    assert 'console.log' in respuesta.get_data(as_text=True)


@pytest.mark.parametrize('ruta', [
    '/../secreto.txt',
    '/%2e%2e/secreto.txt',
    '/..%2fsecreto.txt',
    '/assets/../../secreto.txt',
    '/assets/%2e%2e/%2e%2e/secreto.txt',
    '/..\\secreto.txt',
    '/....//secreto.txt',
])
def test_no_se_pueden_leer_archivos_fuera_de_la_carpeta_estatica(client, estaticos, ruta):
    respuesta = client.get(ruta)

    assert SECRETO not in respuesta.get_data(as_text=True)


# La ruta comodin servia index.html (200) para CUALQUIER GET, tambien /api/...: una URL de API mal
# escrita devolvia HTML con 200 y axios lo tomaba por una respuesta valida en vez de fallar, lo que
# escondia el error.
@pytest.mark.parametrize('ruta', ['/api', '/api/', '/api/ruta-que-no-existe', '/api/a/b/c', '/api/auth'])
def test_una_ruta_de_la_api_inexistente_es_404_json_y_no_la_spa(client, estaticos, ruta):
    respuesta = client.get(ruta)

    assert respuesta.status_code == 404
    assert respuesta.get_json() == {'message': 'Not found'}
    assert INDICE not in respuesta.get_data(as_text=True)


@pytest.mark.parametrize('ruta', ['/apiario', '/api-docs', '/apis/x', '/admin/api/x'])
def test_solo_el_prefijo_api_barra_es_de_la_api(client, estaticos, ruta):
    # '/apiario' o '/admin/api/x' son rutas de la SPA: no se confunden con el prefijo /api/.
    respuesta = client.get(ruta)

    assert respuesta.status_code == 200
    assert INDICE in respuesta.get_data(as_text=True)


def test_una_ruta_real_de_la_api_sigue_funcionando(client, estaticos):
    respuesta = client.get('/api/auth/csrf-token')

    assert respuesta.status_code == 200
    assert 'csrf_token' in respuesta.get_json()


def test_un_archivo_estatico_llamado_api_no_se_sirve_bajo_el_prefijo(client, estaticos):
    # Nada en /api/ sale de la carpeta estatica, exista o no un archivo con ese nombre.
    (estaticos / 'api').mkdir()
    (estaticos / 'api' / 'dato.json').write_text('{"filtrado": true}')

    respuesta = client.get('/api/dato.json')

    assert respuesta.status_code == 404
    assert 'filtrado' not in respuesta.get_data(as_text=True)
