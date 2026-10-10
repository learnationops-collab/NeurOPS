"""/api/auth/impersonate y /api/auth/revert: simular a otro usuario y volver.

Admin y operator simulan a cualquiera; la direccion comercial, solo a closers y setters activos. Quien ya esta
simulando puede cambiar de usuario sin volver, con lo que puede su usuario ORIGINAL (no el simulado). El estado viaja en los claims del JWT (`is_impersonating`, `original_user_id`,
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


# Varios roles en una cuenta (08/10/2026): Mario es operador con dirección, closer y admin como roles
# adicionales. Pasado a otro de sus roles no podía simular a Marlon (director con closer extra):
# contaba solo el rol activo.

@pytest.fixture()
def mario(make_user):
    return make_user(role='operator', username='mario',
                     roles_extra='closer,admin,hiring,director_comercial,director_marketing')


@pytest.fixture()
def marlon(make_user):
    return make_user(role='director_comercial', username='marlon', roles_extra='closer')


@pytest.mark.parametrize('activo', [None, 'closer', 'admin', 'hiring', 'director_comercial', 'director_marketing'])
def test_un_operador_simula_desde_cualquiera_de_sus_roles(client, auth_headers, mario, marlon, activo):
    headers = auth_headers(mario, **({'active_role': activo} if activo else {}))

    respuesta = suplantar(client, headers, marlon.id, isolated=True)

    assert respuesta.status_code == 200
    reclamos = claims(respuesta.get_json()['token'])
    assert (reclamos['id'], reclamos['original_user_id']) == (marlon.id, mario.id)
    assert client.get('/api/auth/impersonate/closers', headers=headers).status_code == 200


def test_un_rol_adicional_que_no_simula_no_da_permiso(client, make_user, auth_headers, equipo):
    # Lo que cuenta son los roles que la cuenta TIENE: un closer que además es setter sigue sin simular.
    closer_setter = make_user(role='closer', username='cs', roles_extra='setter')

    assert suplantar(client, auth_headers(closer_setter), equipo['admin'].id).status_code == 403
    assert suplantar(client, auth_headers(closer_setter, active_role='setter'), equipo['admin'].id).status_code == 403


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
        'is_impersonating': True, 'original_user_role': 'admin', 'can_view_finance': False, 'mascota': None,
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


# --- La direccion comercial simula closers (30/09/2026) y setters (10/10/2026) ----------------
#
# Para ver el mazo como lo ve cada closer y el espacio como lo ve cada setter. Solo closers y setters
# activos: ni otra direccion, ni un admin. Y lo que puede se decide por el usuario REAL, tambien al
# cambiar de usuario sin volver: un closer o un setter simulado no puede ser la puerta a una cuenta
# con mas permisos.

LISTA = '/api/auth/impersonate/closers'
LISTA_SETTERS = '/api/auth/impersonate/setters'


@pytest.fixture()
def direccion(make_user, equipo):
    return make_user(role='director_comercial', username='dire')


@pytest.fixture()
def setter(make_user):
    return make_user(role='setter', username='sol')


def test_la_direccion_simula_a_un_closer_activo(client, auth_headers, equipo, direccion):
    respuesta = suplantar(client, auth_headers(direccion), equipo['closer_a'].id, isolated=True)

    assert respuesta.status_code == 200
    reclamos = claims(respuesta.get_json()['token'])
    assert (reclamos['id'], reclamos['is_impersonating']) == (equipo['closer_a'].id, True)
    assert (reclamos['original_user_id'], reclamos['original_user_role']) == (direccion.id, 'director_comercial')


def test_la_direccion_simula_a_un_setter_activo(client, auth_headers, direccion, setter):
    respuesta = suplantar(client, auth_headers(direccion), setter.id, isolated=True)

    assert respuesta.status_code == 200
    assert respuesta.get_json()['user']['role'] == 'setter'
    reclamos = claims(respuesta.get_json()['token'])
    assert (reclamos['id'], reclamos['is_impersonating']) == (setter.id, True)
    assert (reclamos['original_user_id'], reclamos['original_user_role']) == (direccion.id, 'director_comercial')


def test_la_direccion_no_simula_a_un_setter_desactivado(client, db, auth_headers, direccion, setter):
    setter.is_active = False
    db.session.commit()

    respuesta = suplantar(client, auth_headers(direccion), setter.id)

    assert respuesta.status_code == 400
    assert respuesta.get_json() == {'message': 'User is inactive'}


@pytest.mark.parametrize('rol', ['admin', 'operator', 'triage', 'hiring', 'director_comercial',
                                 'director_marketing'])
def test_la_direccion_no_simula_a_quien_no_es_closer_ni_setter(client, make_user, auth_headers, direccion, rol):
    otro = make_user(role=rol)

    respuesta = suplantar(client, auth_headers(direccion), otro.id)

    assert respuesta.status_code == 403
    assert respuesta.get_json() == {'message': 'Forbidden'}
    assert 'token' not in respuesta.get_json()


def test_la_direccion_no_simula_a_un_closer_desactivado(client, db, auth_headers, equipo, direccion):
    equipo['closer_a'].is_active = False
    db.session.commit()

    respuesta = suplantar(client, auth_headers(direccion), equipo['closer_a'].id)

    assert respuesta.status_code == 400
    assert respuesta.get_json() == {'message': 'User is inactive'}


def test_simulando_a_un_closer_la_direccion_cambia_a_otro_closer(client, auth_headers, equipo, direccion):
    token_a = suplantar(client, auth_headers(direccion), equipo['closer_a'].id, isolated=True).get_json()['token']

    respuesta = suplantar(client, bearer(token_a), equipo['closer_b'].id, isolated=True)

    assert respuesta.status_code == 200
    reclamos = claims(respuesta.get_json()['token'])
    assert (reclamos['id'], reclamos['original_user_id'], reclamos['original_user_role']) == \
        (equipo['closer_b'].id, direccion.id, 'director_comercial')


def test_simulando_a_un_closer_la_direccion_pasa_a_un_setter_y_vuelve(client, auth_headers, equipo, direccion, setter):
    token_a = suplantar(client, auth_headers(direccion), equipo['closer_a'].id, isolated=True).get_json()['token']

    respuesta = suplantar(client, bearer(token_a), setter.id, isolated=True)

    assert respuesta.status_code == 200
    token_s = respuesta.get_json()['token']
    assert (claims(token_s)['id'], claims(token_s)['original_user_id']) == (setter.id, direccion.id)
    assert client.post(REVERTIR, headers=bearer(token_s)).get_json()['user']['id'] == direccion.id


@pytest.mark.parametrize('destino', ['admin', 'operator'])
def test_un_setter_simulado_por_la_direccion_no_salta_a_un_admin(client, auth_headers, equipo, direccion, setter,
                                                                destino):
    token_s = suplantar(client, auth_headers(direccion), setter.id, isolated=True).get_json()['token']

    respuesta = suplantar(client, bearer(token_s), equipo[destino].id, isolated=True)

    assert respuesta.status_code == 403
    assert 'token' not in respuesta.get_json()


@pytest.mark.parametrize('destino', ['admin', 'operator'])
def test_un_closer_simulado_por_la_direccion_no_salta_a_un_admin(client, auth_headers, equipo, direccion, destino):
    # El agujero que habria si "quien ya simula cambia a cualquiera" siguiera valiendo.
    token_a = suplantar(client, auth_headers(direccion), equipo['closer_a'].id, isolated=True).get_json()['token']

    respuesta = suplantar(client, bearer(token_a), equipo[destino].id, isolated=True)

    assert respuesta.status_code == 403
    assert 'token' not in respuesta.get_json()


def test_tampoco_salta_en_el_modo_clasico_de_cookie(client, equipo, direccion):
    assert client.post('/api/auth/login', json={'username': 'dire', 'password': 'secret123'}).status_code == 200
    assert client.post(IMPERSONAR, json={'user_id': equipo['closer_a'].id}).status_code == 200

    respuesta = client.post(IMPERSONAR, json={'user_id': equipo['admin'].id})

    assert respuesta.status_code == 403
    usuario = client.get('/api/auth/me').get_json()['user']  # sigue siendo el closer simulado
    assert (usuario['id'], usuario['original_user_role']) == (equipo['closer_a'].id, 'director_comercial')


def test_si_a_la_direccion_le_cambian_el_rol_mientras_simula_ya_no_cambia_de_usuario(
        client, db, auth_headers, equipo, direccion):
    token_a = suplantar(client, auth_headers(direccion), equipo['closer_a'].id, isolated=True).get_json()['token']
    direccion.role = 'setter'
    db.session.commit()

    assert suplantar(client, bearer(token_a), equipo['closer_b'].id, isolated=True).status_code == 403
    assert client.get(LISTA, headers=bearer(token_a)).status_code == 403


def test_un_token_de_suplantacion_sin_original_no_cambia_de_usuario(client, equipo):
    token = equipo['closer_a'].get_auth_token(is_impersonating=True)  # sin original_user_id

    assert suplantar(client, bearer(token), equipo['closer_b'].id, isolated=True).status_code == 403


def test_la_direccion_vuelve_a_su_sesion(client, auth_headers, equipo, direccion):
    token_a = suplantar(client, auth_headers(direccion), equipo['closer_a'].id, isolated=True).get_json()['token']

    respuesta = client.post(REVERTIR, headers=bearer(token_a))

    assert respuesta.status_code == 200
    assert respuesta.get_json()['user']['id'] == direccion.id
    assert 'is_impersonating' not in claims(respuesta.get_json()['token'])


# --- La lista de closers para simular ---------------------------------------------------------

def test_la_lista_trae_solo_los_closers_activos_por_nombre(client, db, make_user, auth_headers, equipo, direccion):
    make_user(role='closer', username='ana')
    make_user(role='closer', username='zoe', is_active=False)
    make_user(role='setter', username='beto')

    respuesta = client.get(LISTA, headers=auth_headers(direccion))

    assert respuesta.status_code == 200
    assert [c['username'] for c in respuesta.get_json()['closers']] == ['ana', 'carlos', 'cata']
    assert set(respuesta.get_json()['closers'][0]) == {'id', 'username'}  # nada mas que eso


@pytest.mark.parametrize('quien', ['admin', 'operator'])
def test_admin_y_operator_tambien_ven_la_lista(client, auth_headers, equipo, quien):
    assert client.get(LISTA, headers=auth_headers(equipo[quien])).status_code == 200


@pytest.mark.parametrize('rol', ['closer', 'setter', 'triage', 'hiring', 'director_marketing'])
def test_quien_no_simula_closers_no_ve_la_lista(client, make_user, auth_headers, equipo, rol):
    respuesta = client.get(LISTA, headers=auth_headers(make_user(role=rol)))

    assert respuesta.status_code == 403


def test_sin_sesion_no_hay_lista(client):
    assert client.get(LISTA).status_code == 401


def test_simulando_a_un_closer_la_direccion_sigue_viendo_la_lista(client, auth_headers, equipo, direccion):
    token_a = suplantar(client, auth_headers(direccion), equipo['closer_a'].id, isolated=True).get_json()['token']

    assert client.get(LISTA, headers=bearer(token_a)).status_code == 200


# --- La lista de setters para simular (10/10/2026) --------------------------------------------

def test_la_lista_de_setters_trae_solo_los_activos_por_nombre(client, make_user, auth_headers, equipo, direccion,
                                                              setter):
    make_user(role='setter', username='ana')
    make_user(role='setter', username='zoe', is_active=False)

    respuesta = client.get(LISTA_SETTERS, headers=auth_headers(direccion))

    assert respuesta.status_code == 200
    assert [s['username'] for s in respuesta.get_json()['setters']] == ['ana', 'sol']  # sin los closers
    assert set(respuesta.get_json()['setters'][0]) == {'id', 'username'}


@pytest.mark.parametrize('quien', ['admin', 'operator'])
def test_admin_y_operator_tambien_ven_la_lista_de_setters(client, auth_headers, equipo, quien):
    assert client.get(LISTA_SETTERS, headers=auth_headers(equipo[quien])).status_code == 200


@pytest.mark.parametrize('rol', ['closer', 'setter', 'triage', 'hiring', 'director_marketing'])
def test_quien_no_simula_setters_no_ve_su_lista(client, make_user, auth_headers, equipo, rol):
    assert client.get(LISTA_SETTERS, headers=auth_headers(make_user(role=rol))).status_code == 403


def test_sin_sesion_no_hay_lista_de_setters(client):
    assert client.get(LISTA_SETTERS).status_code == 401


def test_simulando_a_un_setter_la_direccion_sigue_viendo_las_dos_listas(client, auth_headers, direccion, setter):
    token_s = suplantar(client, auth_headers(direccion), setter.id, isolated=True).get_json()['token']

    assert client.get(LISTA_SETTERS, headers=bearer(token_s)).status_code == 200
    assert client.get(LISTA, headers=bearer(token_s)).status_code == 200


# --- Simular a alguien con varios roles (07/10/2026) --------------------------------------------
#
# Una persona con varios roles se simula con UNO: el que se elige. Antes entraba siempre con el
# principal: al simular a Mario desde la pestaña «Hiring» de Equipo caía en su sesión de operador.

@pytest.fixture()
def multirol(make_user):
    return make_user(role='operator', username='mario', roles_extra='closer,hiring')


def test_sin_elegir_rol_se_simula_con_el_principal(client, auth_headers, equipo, multirol):
    respuesta = suplantar(client, auth_headers(equipo['admin']), multirol.id, isolated=True)

    assert respuesta.get_json()['user']['role'] == 'operator'
    assert 'active_role' not in claims(respuesta.get_json()['token'])


def test_se_simula_con_el_rol_elegido(client, auth_headers, equipo, multirol):
    respuesta = suplantar(client, auth_headers(equipo['admin']), multirol.id, isolated=True, role='hiring')

    cuerpo = respuesta.get_json()
    assert respuesta.status_code == 200
    assert cuerpo['user']['role'] == 'hiring'
    assert claims(cuerpo['token'])['active_role'] == 'hiring'
    yo = client.get('/api/auth/me', headers=bearer(cuerpo['token'])).get_json()['user']
    assert (yo['id'], yo['role'], yo['is_impersonating']) == (multirol.id, 'hiring', True)


def test_elegir_el_rol_principal_no_agrega_claim(client, auth_headers, equipo, multirol):
    respuesta = suplantar(client, auth_headers(equipo['admin']), multirol.id, isolated=True, role='operator')

    assert 'active_role' not in claims(respuesta.get_json()['token'])


@pytest.mark.parametrize('rol', ['admin', 'setter', '', 7])
def test_un_rol_que_la_persona_no_tiene_es_400(client, auth_headers, equipo, multirol, rol):
    respuesta = suplantar(client, auth_headers(equipo['admin']), multirol.id, isolated=True, role=rol)

    assert respuesta.status_code == 400
    assert 'token' not in respuesta.get_json()


def test_el_modo_clasico_deja_el_rol_elegido_en_la_cookie(client, equipo, multirol):
    client.post('/api/auth/login', json={'username': 'root', 'password': 'secret123'})

    assert client.post(IMPERSONAR, json={'user_id': multirol.id, 'role': 'hiring'}).status_code == 200

    usuario = client.get('/api/auth/me').get_json()['user']
    assert (usuario['id'], usuario['role'], usuario['is_impersonating']) == (multirol.id, 'hiring', True)


def test_al_revertir_no_queda_el_rol_simulado(client, equipo, multirol):
    client.post('/api/auth/login', json={'username': 'root', 'password': 'secret123'})
    client.post(IMPERSONAR, json={'user_id': multirol.id, 'role': 'hiring'})

    client.post(REVERTIR)

    usuario = client.get('/api/auth/me').get_json()['user']
    assert (usuario['id'], usuario['role'], usuario['is_impersonating']) == (equipo['admin'].id, 'admin', False)


def test_la_direccion_simula_a_quien_es_closer_pero_no_principal(client, auth_headers, direccion, multirol):
    sin_elegir = suplantar(client, auth_headers(direccion), multirol.id, isolated=True)
    como_closer = suplantar(client, auth_headers(direccion), multirol.id, isolated=True, role='closer')
    como_hiring = suplantar(client, auth_headers(direccion), multirol.id, isolated=True, role='hiring')

    assert sin_elegir.status_code == 403  # su principal es operador
    assert como_closer.status_code == 200
    assert como_hiring.status_code == 403
