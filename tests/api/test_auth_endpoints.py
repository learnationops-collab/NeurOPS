"""/api/auth/*: login, logout, me, csrf-token y debug.

Login devuelve un JWT (metodo principal de la SPA) y ademas abre una sesion de cookie. Un error de
credenciales debe ser IDENTICO para un usuario inexistente y para una clave incorrecta, para no
revelar que usuarios existen.
"""
import jwt
import pytest

from app.models import User
from tests.conftest import ENTORNO_DE_TEST

LOGIN = '/api/auth/login'
CLAVE = 'secret123'


def entrar(client, username, password=CLAVE, **extra):
    return client.post(LOGIN, json={'username': username, 'password': password, **extra})


def quien_soy(client, token=None):
    cabeceras = {'Authorization': f'Bearer {token}'} if token else {}
    return client.get('/api/auth/me', headers=cabeceras)


# --- Login ------------------------------------------------------------------------------------

def test_login_correcto_devuelve_token_y_usuario(client, make_user):
    usuario = make_user(role='closer', username='ana', email='ana@x.com', can_view_finance=True)

    respuesta = entrar(client, 'ana')

    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    assert cuerpo['message'] == 'Login successful'
    assert cuerpo['user'] == {'id': usuario.id, 'username': 'ana', 'role': 'closer',
                              'email': 'ana@x.com', 'can_view_finance': True}
    assert jwt.decode(cuerpo['token'], ENTORNO_DE_TEST['SECRET_KEY'], algorithms=['HS256'])['id'] == usuario.id


def test_se_puede_entrar_con_el_email(client, make_user):
    make_user(username='ana', email='ana@x.com')

    assert entrar(client, 'ana@x.com').status_code == 200


def test_login_nunca_devuelve_el_hash_de_la_clave(client, make_user):
    usuario = make_user(username='ana')

    texto = entrar(client, 'ana').get_data(as_text=True)

    assert usuario.password_hash not in texto
    assert 'password' not in texto.lower()


@pytest.mark.parametrize('cuerpo', [{}, {'username': 'ana'}, {'password': CLAVE}, {'username': '', 'password': ''}])
def test_faltan_credenciales_es_400(client, make_user, cuerpo):
    make_user(username='ana')

    respuesta = client.post(LOGIN, json=cuerpo)

    assert respuesta.status_code == 400
    assert respuesta.get_json() == {'message': 'Username and password required'}


def test_un_json_roto_es_400_y_no_un_500(client):
    respuesta = client.post(LOGIN, data='{no es json', content_type='application/json')

    assert respuesta.status_code == 400


def test_clave_incorrecta_y_usuario_inexistente_son_indistinguibles(client, make_user):
    make_user(username='ana')

    clave_mala = entrar(client, 'ana', 'incorrecta')
    sin_usuario = entrar(client, 'nadie', 'incorrecta')

    assert clave_mala.status_code == sin_usuario.status_code == 401
    assert clave_mala.get_json() == sin_usuario.get_json() == {'message': 'Invalid credentials'}


@pytest.mark.parametrize('cuerpo', [
    {'username': 123, 'password': CLAVE},
    {'username': 'ana', 'password': 123},
    {'username': ['ana'], 'password': CLAVE},
    {'username': 'ana', 'password': ['secret123']},
    {'username': {'$ne': ''}, 'password': CLAVE},
    {'username': 'ana', 'password': {'$ne': ''}},
    {'username': True, 'password': True},
    [1, 2],  # un JSON valido pero que ni siquiera es un objeto
    'ana',
    5,
])
def test_credenciales_o_cuerpo_que_no_son_texto_dan_400_y_no_un_500(client, make_user, cuerpo):
    make_user(username='ana')

    respuesta = client.post(LOGIN, json=cuerpo)

    assert respuesta.status_code == 400
    assert respuesta.get_json() == {'message': 'Username and password required'}


@pytest.mark.parametrize('usuario', ["' OR '1'='1", "ana'--", 'ana"; DROP TABLE users;--', '%', '*'])
def test_un_usuario_con_sintaxis_de_inyeccion_no_entra_ni_rompe(client, make_user, usuario):
    make_user(username='ana')

    respuesta = entrar(client, usuario, "' OR '1'='1")

    assert respuesta.status_code == 401
    assert User.query.count() == 1


def test_el_usuario_distingue_mayusculas(client, make_user):
    make_user(username='ana')

    assert entrar(client, 'ANA').status_code == 401


@pytest.mark.parametrize('hash_guardado', [None, ''])
def test_un_usuario_sin_clave_guardada_no_entra_ni_rompe(client, make_user, db, hash_guardado):
    # Antes check_password_hash(None, ...) lanzaba: el login contestaba 500, y quien escribiera el
    # nombre de una cuenta importada sin clave lo veia (y sabia que existe y no tiene clave).
    usuario = make_user(username='ana')
    usuario.password_hash = hash_guardado
    db.session.commit()

    respuesta = entrar(client, 'ana')

    assert respuesta.status_code == 401
    assert respuesta.get_json() == {'message': 'Invalid credentials'}  # igual que una clave mala


def test_login_abre_tambien_la_sesion_de_cookie(client, make_user):
    make_user(username='ana')

    entrar(client, 'ana')

    assert quien_soy(client).get_json()['user']['username'] == 'ana'  # sin token, solo la cookie


def test_login_sincroniza_la_zona_horaria_del_navegador(client, make_user, db):
    usuario = make_user(username='ana')

    entrar(client, 'ana', timezone='America/Caracas')

    db.session.refresh(usuario)
    assert usuario.timezone == 'America/Caracas'


@pytest.mark.parametrize('zona', ['Marte/Olympus', '', None, 'no-es-una-zona'])
def test_una_zona_invalida_se_ignora_y_el_login_sigue_funcionando(client, make_user, db, zona):
    usuario = make_user(username='ana')
    original = usuario.timezone

    respuesta = entrar(client, 'ana', timezone=zona)

    assert respuesta.status_code == 200
    db.session.refresh(usuario)
    assert usuario.timezone == original


# --- Usuarios desactivados --------------------------------------------------------------------
# login_user() devuelve False para un desactivado, pero el endpoint ignoraba ese resultado y le
# entregaba igual un JWT de 24 h. Con ese token toda ruta protegida le daba 401 (Flask-Login da por
# no autenticada a una cuenta con is_active falsy), asi que el efecto era un login "exitoso" que
# rebotaba sin explicacion.

def test_un_usuario_desactivado_no_puede_entrar(client, make_user):
    make_user(username='ana', is_active=False)

    respuesta = entrar(client, 'ana')

    assert respuesta.status_code == 403
    assert 'desactivada' in respuesta.get_json()['message']
    assert 'token' not in respuesta.get_json()
    assert quien_soy(client).status_code == 401  # y tampoco le abrio la sesion de cookie


def test_un_desactivado_tampoco_entra_con_su_email(client, make_user):
    make_user(username='ana', email='ana@x.com', is_active=False)

    assert entrar(client, 'ana@x.com').status_code == 403


def test_con_la_clave_mala_un_desactivado_recibe_lo_mismo_que_cualquiera(client, make_user):
    # El aviso de cuenta desactivada se da DESPUES de acertar la clave: sin ella no se revela que la
    # cuenta existe ni en que estado esta.
    make_user(username='ana', is_active=False)

    respuesta = entrar(client, 'ana', 'incorrecta')

    assert respuesta.status_code == 401
    assert respuesta.get_json() == {'message': 'Invalid credentials'}


def test_desactivar_a_alguien_corta_el_token_que_ya_tenia(client, make_user, db):
    ana = make_user(username='ana')
    token = entrar(client, 'ana').get_json()['token']
    assert quien_soy(client, token).status_code == 200

    ana.is_active = False
    db.session.commit()

    assert quien_soy(client, token).status_code == 401


def test_desactivar_a_alguien_corta_su_sesion_de_cookie(client, make_user, db):
    ana = make_user(username='ana')
    entrar(client, 'ana')
    assert quien_soy(client).status_code == 200  # la cookie de ana sirve

    ana.is_active = False
    db.session.commit()

    assert quien_soy(client).status_code == 401


def test_un_usuario_con_is_active_en_null_tampoco_entra(client, make_user, db):
    # Flask-Login lo da por no autenticado (is_authenticated devuelve is_active), asi que ya no podia
    # usar la app: ahora el login lo dice en vez de entregarle un token que rebota.
    ana = make_user(username='ana')
    db.session.execute(db.text('UPDATE users SET is_active = NULL WHERE id = :id'), {'id': ana.id})
    db.session.commit()

    respuesta = entrar(client, 'ana')

    assert respuesta.status_code == 403
    assert 'token' not in respuesta.get_json()


# --- me ---------------------------------------------------------------------------------------

def test_me_sin_sesion_es_401(client):
    respuesta = quien_soy(client)

    assert respuesta.status_code == 401
    assert respuesta.get_json() == {'message': 'Not authenticated'}


def test_me_con_token_devuelve_al_usuario(client, make_user, auth_headers):
    usuario = make_user(role='setter', username='beto', email='beto@x.com')

    respuesta = client.get('/api/auth/me', headers=auth_headers(usuario))

    assert respuesta.status_code == 200
    assert respuesta.get_json()['user'] == {
        'id': usuario.id, 'username': 'beto', 'role': 'setter', 'email': 'beto@x.com',
        'is_impersonating': False, 'original_user_role': None, 'can_view_finance': False,
    }


def test_un_token_basura_es_401(client):
    assert quien_soy(client, 'basura').status_code == 401


def test_el_token_manda_sobre_la_cookie_del_navegador(client, make_user):
    # La cookie es de TODO el navegador: si ganara, una pestana simulada pisaria a las demas.
    ana, beto = make_user(username='ana'), make_user(username='beto')
    entrar(client, 'ana')  # deja la cookie de ana

    con_token_de_beto = quien_soy(client, beto.get_auth_token())

    assert con_token_de_beto.get_json()['user']['id'] == beto.id
    assert quien_soy(client).get_json()['user']['id'] == ana.id  # sin token vuelve a mandar la cookie


# --- logout -----------------------------------------------------------------------------------

def test_logout_cierra_la_sesion_de_cookie(client, make_user):
    make_user(username='ana')
    entrar(client, 'ana')

    respuesta = client.post('/api/auth/logout')

    assert respuesta.status_code == 200
    assert quien_soy(client).status_code == 401


def test_logout_sin_sesion_no_falla(client):
    assert client.post('/api/auth/logout').status_code == 200


# --- csrf-token y debug -----------------------------------------------------------------------

def test_csrf_token_entrega_un_token(client):
    respuesta = client.get('/api/auth/csrf-token')

    assert respuesta.status_code == 200
    assert len(respuesta.get_json()['csrf_token']) > 20


def test_debug_no_devuelve_las_cabeceras_ni_cookies_sensibles(client):
    client.set_cookie('otra', 'VALOR-SECRETO-DE-COOKIE')

    respuesta = client.get('/api/auth/debug', headers={'Authorization': 'Bearer VALOR-SECRETO-DEL-TOKEN'})

    cuerpo = respuesta.get_data(as_text=True)
    assert respuesta.status_code == 200
    assert 'VALOR-SECRETO-DEL-TOKEN' not in cuerpo
    assert 'VALOR-SECRETO-DE-COOKIE' not in cuerpo
    assert 'otra' in respuesta.get_json()['cookies_received']  # solo el NOMBRE de la cookie
