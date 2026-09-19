"""/api/auth/impersonate y /api/auth/revert: simular a otro usuario y volver.

Solo admin y operator pueden empezar una simulacion (o quien ya esta simulando, para cambiar de
usuario sin volver). El estado viaja en los claims del JWT (`is_impersonating`, `original_user_id`,
`original_user_role`), asi cada pestana lleva su propia identidad; el modo clasico ademas cambia la
cookie de sesion, que es de TODO el navegador. Invariante de auditoria: el "original" es siempre el
operador real, aunque se cambie de usuario simulado varias veces.
"""
import jwt
import pytest

from app.models import User
from tests.conftest import ENTORNO_DE_TEST

IMPERSONAR = '/api/auth/impersonate'
REVERTIR = '/api/auth/revert'


def claims(token):
    return jwt.decode(token, ENTORNO_DE_TEST['SECRET_KEY'], algorithms=['HS256'])


def bearer(token):
    return {'Authorization': f'Bearer {token}'}


def suplantar(client, headers, user_id, **extra):
    return client.post(IMPERSONAR, headers=headers, json={'user_id': user_id, **extra})


@pytest.fixture()
def equipo(make_user):
    return {
        'admin': make_user(role='admin', username='root'),
        'operator': make_user(role='operator', username='ops'),
        'closer_a': make_user(role='closer', username='cata'),
        'closer_b': make_user(role='closer', username='carlos'),
    }


# --- Quien puede suplantar --------------------------------------------------------------------

def test_sin_sesion_no_se_puede_suplantar(client, equipo):
    respuesta = client.post(IMPERSONAR, json={'user_id': equipo['closer_a'].id})

    assert respuesta.status_code == 401
    assert respuesta.get_json() == {'message': 'Unauthorized'}


@pytest.mark.parametrize('rol', ['closer', 'setter', 'triage', 'hiring', 'director_comercial', 'director_marketing'])
def test_un_rol_sin_privilegio_recibe_403(client, make_user, auth_headers, equipo, rol):
    usuario = make_user(role=rol)

    respuesta = suplantar(client, auth_headers(usuario), equipo['admin'].id)  # incluso hacia un admin

    assert respuesta.status_code == 403
    assert respuesta.get_json() == {'message': 'Forbidden'}


@pytest.mark.parametrize('quien', ['admin', 'operator'])
def test_admin_y_operator_pueden_suplantar(client, auth_headers, equipo, quien):
    respuesta = suplantar(client, auth_headers(equipo[quien]), equipo['closer_a'].id)

    assert respuesta.status_code == 200


def test_un_token_falsificado_no_puede_suplantar(client, equipo):
    falso = jwt.encode({'id': equipo['admin'].id, 'exp': 9_999_999_999}, 'otra-clave-de-32-bytes-o-mas-para-hs256',
                       algorithm='HS256')

    assert suplantar(client, bearer(falso), equipo['closer_a'].id).status_code == 401


def test_falta_el_usuario_a_suplantar(client, auth_headers, equipo):
    admin = auth_headers(equipo['admin'])

    assert client.post(IMPERSONAR, headers=admin, json={}).status_code == 400
    assert suplantar(client, admin, 99_999).status_code == 404


@pytest.mark.parametrize('extra', [{}, {'isolated': True}])
def test_no_se_puede_suplantar_a_un_usuario_desactivado(client, db, auth_headers, equipo, extra):
    # Un JWT de suplantacion a nombre de una cuenta desactivada tampoco autenticaria despues, pero
    # emitirlo (y abrir la cookie del modo clasico) no tiene sentido.
    inactivo = equipo['closer_a']
    inactivo.is_active = False
    db.session.commit()

    respuesta = suplantar(client, auth_headers(equipo['admin']), inactivo.id, **extra)

    assert respuesta.status_code == 400
    assert respuesta.get_json() == {'message': 'User is inactive'}
    assert 'token' not in respuesta.get_json()


# --- Modo aislado (una pestana) ---------------------------------------------------------------

def test_el_modo_aislado_emite_un_token_con_el_estado_de_suplantacion(client, auth_headers, equipo):
    respuesta = suplantar(client, auth_headers(equipo['admin']), equipo['closer_a'].id, isolated=True)

    cuerpo = respuesta.get_json()
    assert respuesta.status_code == 200
    assert cuerpo['user'] == {
        'id': equipo['closer_a'].id, 'username': 'cata', 'role': 'closer', 'email': equipo['closer_a'].email,
        'is_impersonating': True, 'original_user_role': 'admin', 'can_view_finance': False,
    }
    assert claims(cuerpo['token']) | {'exp': 0} == {
        'id': equipo['closer_a'].id, 'exp': 0, 'is_impersonating': True,
        'original_user_id': equipo['admin'].id, 'original_user_role': 'admin',
    }


def test_el_modo_aislado_no_toca_la_cookie_compartida_del_navegador(client, auth_headers, equipo):
    respuesta = suplantar(client, auth_headers(equipo['admin']), equipo['closer_a'].id, isolated=True)

    assert 'Set-Cookie' not in respuesta.headers
    assert client.get('/api/auth/me').status_code == 401  # sin token no hay nadie en el navegador


def test_con_el_token_aislado_me_muestra_al_usuario_simulado(client, auth_headers, equipo):
    token = suplantar(client, auth_headers(equipo['admin']), equipo['closer_a'].id, isolated=True).get_json()['token']

    usuario = client.get('/api/auth/me', headers=bearer(token)).get_json()['user']

    assert (usuario['id'], usuario['is_impersonating'], usuario['original_user_role']) == \
        (equipo['closer_a'].id, True, 'admin')


def test_al_cambiar_de_usuario_simulado_el_original_sigue_siendo_el_operador_real(client, auth_headers, equipo):
    # Pista de auditoria: nunca queda como "original" el closer intermedio.
    token_a = suplantar(client, auth_headers(equipo['operator']), equipo['closer_a'].id,
                        isolated=True).get_json()['token']

    respuesta = suplantar(client, bearer(token_a), equipo['closer_b'].id, isolated=True)

    assert respuesta.status_code == 200  # quien ya esta simulando puede cambiar de usuario
    reclamos = claims(respuesta.get_json()['token'])
    assert reclamos['id'] == equipo['closer_b'].id
    assert reclamos['original_user_id'] == equipo['operator'].id
    assert reclamos['original_user_role'] == 'operator'


# --- Modo clasico (cookie) --------------------------------------------------------------------

def test_el_modo_clasico_cambia_la_cookie_de_sesion_al_usuario_simulado(client, equipo):
    client.post('/api/auth/login', json={'username': 'root', 'password': 'secret123'})

    respuesta = client.post(IMPERSONAR, json={'user_id': equipo['closer_a'].id})

    assert respuesta.status_code == 200
    usuario = client.get('/api/auth/me').get_json()['user']  # solo cookie
    assert (usuario['id'], usuario['is_impersonating'], usuario['original_user_role']) == \
        (equipo['closer_a'].id, True, 'admin')


# --- Revert -----------------------------------------------------------------------------------

def test_revertir_sin_estar_suplantando_es_400(client, auth_headers, equipo):
    respuesta = client.post(REVERTIR, headers=auth_headers(equipo['closer_a']))

    assert respuesta.status_code == 400
    assert respuesta.get_json() == {'message': 'Not impersonating'}


def test_revertir_sin_sesion_es_401(client):
    assert client.post(REVERTIR).status_code == 401


def test_revertir_en_modo_aislado_devuelve_un_token_limpio_del_original(client, auth_headers, equipo):
    token = suplantar(client, auth_headers(equipo['admin']), equipo['closer_a'].id, isolated=True).get_json()['token']

    respuesta = client.post(REVERTIR, headers=bearer(token))

    cuerpo = respuesta.get_json()
    assert respuesta.status_code == 200
    assert cuerpo['user']['id'] == equipo['admin'].id
    assert 'is_impersonating' not in claims(cuerpo['token'])  # sin claims de suplantacion
    yo = client.get('/api/auth/me', headers=bearer(cuerpo['token'])).get_json()['user']
    assert (yo['id'], yo['is_impersonating']) == (equipo['admin'].id, False)


def test_revertir_en_modo_clasico_restaura_la_cookie_del_original(client, equipo):
    client.post('/api/auth/login', json={'username': 'root', 'password': 'secret123'})
    client.post(IMPERSONAR, json={'user_id': equipo['closer_a'].id})

    respuesta = client.post(REVERTIR)

    assert respuesta.status_code == 200
    usuario = client.get('/api/auth/me').get_json()['user']
    assert (usuario['id'], usuario['is_impersonating']) == (equipo['admin'].id, False)


def test_si_el_original_fue_borrado_revertir_cierra_la_sesion(client, db, auth_headers, equipo):
    token = suplantar(client, auth_headers(equipo['admin']), equipo['closer_a'].id, isolated=True).get_json()['token']
    db.session.delete(User.query.get(equipo['admin'].id))
    db.session.commit()

    respuesta = client.post(REVERTIR, headers=bearer(token))

    assert respuesta.status_code == 200
    assert respuesta.get_json() == {'message': 'Original user not found, logged out'}


def test_un_token_de_suplantacion_sin_original_cierra_la_sesion(client, equipo):
    token = equipo['closer_a'].get_auth_token(is_impersonating=True)  # sin original_user_id

    respuesta = client.post(REVERTIR, headers=bearer(token))

    assert respuesta.status_code == 200
    assert respuesta.get_json() == {'message': 'Session lost, logged out'}
