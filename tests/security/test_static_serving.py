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


@pytest.mark.xfail(strict=True, reason=(
    "BUG menor: la ruta comodin sirve index.html (200) para CUALQUIER GET, tambien /api/...: una URL "
    "de API mal escrita devuelve HTML con 200 y axios lo toma como una respuesta valida en vez de "
    "fallar, lo que esconde el error. Deberia ser un 404 JSON para todo lo que empiece por /api/."))
def test_una_ruta_de_la_api_inexistente_es_404_y_no_la_spa(client, estaticos):
    respuesta = client.get('/api/ruta-que-no-existe')

    assert respuesta.status_code == 404
