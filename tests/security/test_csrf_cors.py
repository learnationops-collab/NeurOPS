"""CSRF y CORS.

CSRF: protege TODO lo que se llama con la cookie de sesion desde el navegador. En los tests esta
apagado por defecto (fixture `csrf_enabled` lo enciende). Los blueprints consumidos por maquinas
(webhooks, n8n, la Academia...) estan exentos a proposito; la lista es un trinquete: una exencion
nueva rompe el test y hay que decidirla a conciencia.

CORS: solo los origenes propios pueden leer respuestas de /api/* con credenciales.
"""
import pytest

# Blueprints exentos de CSRF. Los publicos (public_api, manychat, webhooks, sheets, metrics,
# backup, google_calendar_bp) no tienen sesion detras; los external usan token Bearer propio.
EXENTOS = {
    'public_api', 'external_academy_api', 'external_dev_platform_api', 'google_calendar_bp',
    'webhooks', 'backup', 'manychat', 'sheets', 'metrics',
}
ORIGENES_PERMITIDOS = [
    'http://localhost:5173', 'http://localhost:3000', 'https://work.thelearnation.com',
    'https://neurops-production.up.railway.app', 'https://institute.thelearnation.com',
]


# --- CSRF -------------------------------------------------------------------------------------

def test_los_blueprints_exentos_de_csrf_son_los_esperados(app):
    exentos = {getattr(b, 'name', b) for b in app.extensions['csrf']._exempt_blueprints}

    assert exentos == EXENTOS


def test_un_post_sin_token_csrf_es_rechazado(client, csrf_enabled):
    respuesta = client.post('/api/auth/login', json={'username': 'a', 'password': 'b'})

    assert respuesta.status_code == 400
    assert 'CSRF' in respuesta.get_data(as_text=True)


def test_un_token_csrf_incorrecto_es_rechazado(client, csrf_enabled):
    respuesta = client.post('/api/auth/login', json={'username': 'a', 'password': 'b'},
                            headers={'X-CSRFToken': 'token-inventado'})

    assert respuesta.status_code == 400


def test_con_el_token_csrf_de_su_sesion_la_peticion_llega_a_la_vista(client, make_user, csrf_enabled):
    make_user(username='ana')
    token = client.get('/api/auth/csrf-token').get_json()['csrf_token']

    respuesta = client.post('/api/auth/login', json={'username': 'ana', 'password': 'secret123'},
                            headers={'X-CSRFToken': token})

    assert respuesta.status_code == 200


def test_el_token_csrf_de_otra_sesion_no_vale(app, client, csrf_enabled):
    token_ajeno = app.test_client().get('/api/auth/csrf-token').get_json()['csrf_token']
    client.get('/api/auth/csrf-token')  # esta sesion tiene su propio secreto

    respuesta = client.post('/api/auth/login', json={'username': 'a', 'password': 'b'},
                            headers={'X-CSRFToken': token_ajeno})

    assert respuesta.status_code == 400


def test_las_lecturas_no_piden_token_csrf(client, csrf_enabled):
    assert client.get('/api/health').status_code == 200
    assert client.get('/api/auth/me').status_code == 401  # llega a la vista (401 de auth), no 400 de CSRF


def test_un_bearer_tampoco_evita_el_csrf_en_rutas_no_exentas(client, make_user, auth_headers, csrf_enabled):
    admin = make_user(role='admin')
    cabeceras = auth_headers(admin)

    sin_token = client.post('/api/auth/impersonate', headers=cabeceras, json={'user_id': admin.id})
    token = client.get('/api/auth/csrf-token').get_json()['csrf_token']
    con_token = client.post('/api/auth/impersonate', headers={**cabeceras, 'X-CSRFToken': token},
                            json={'user_id': admin.id})

    assert sin_token.status_code == 400
    assert con_token.status_code == 200


@pytest.mark.parametrize('ruta', ['/api/public/lead-roadmap/update-client', '/api/webhooks/manychat',
                                  '/api/manychat-webhook', '/api/v1/metrics/track-visit'])
def test_las_rutas_exentas_no_piden_csrf(client, csrf_enabled, ruta):
    respuesta = client.post(ruta, json={})

    assert 'CSRF' not in respuesta.get_data(as_text=True)


# --- CORS -------------------------------------------------------------------------------------

@pytest.mark.parametrize('origen', ORIGENES_PERMITIDOS)
def test_un_origen_propio_recibe_las_cabeceras_cors_con_credenciales(client, origen):
    respuesta = client.get('/api/health', headers={'Origin': origen})

    assert respuesta.headers['Access-Control-Allow-Origin'] == origen
    assert respuesta.headers['Access-Control-Allow-Credentials'] == 'true'


@pytest.mark.parametrize('origen', [
    'https://evil.example',
    'null',
    'https://work.thelearnation.com.evil.example',  # empieza igual que uno propio
    'https://evil.example/https://work.thelearnation.com',
    'http://work.thelearnation.com',  # mismo host, esquema distinto
    'https://thelearnation.com',
])
def test_un_origen_ajeno_no_recibe_cabeceras_cors(client, origen):
    respuesta = client.get('/api/health', headers={'Origin': origen})

    assert 'Access-Control-Allow-Origin' not in respuesta.headers


def test_el_preflight_de_un_origen_propio_autoriza_metodo_y_cabeceras(client):
    respuesta = client.options('/api/auth/login', headers={
        'Origin': 'https://work.thelearnation.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,authorization,x-csrftoken',
    })

    assert respuesta.status_code == 200
    assert 'POST' in respuesta.headers['Access-Control-Allow-Methods']
    assert 'x-csrftoken' in respuesta.headers['Access-Control-Allow-Headers'].lower()


def test_el_preflight_de_un_origen_ajeno_no_autoriza_nada(client):
    respuesta = client.options('/api/auth/login', headers={
        'Origin': 'https://evil.example', 'Access-Control-Request-Method': 'POST',
    })

    assert 'Access-Control-Allow-Origin' not in respuesta.headers


def test_fuera_de_api_no_hay_cors_ni_para_un_origen_propio(client):
    respuesta = client.get('/', headers={'Origin': 'https://work.thelearnation.com'})

    assert 'Access-Control-Allow-Origin' not in respuesta.headers
