"""Una persona con varios roles: cuentas enlazadas por `persona_id` y cambio de rol sin suplantar.

Cada rol conserva su cuenta (y su historial). Los operadores vinculan; cualquier cuenta de la persona
pasa a otra con `/auth/switch-role`, que no es una suplantación (sin claims, sin «Volver»).
"""
import jwt
import pytest

from app import db
from app.models import User
from tests.conftest import ENTORNO_DE_TEST

CAMBIAR = '/api/auth/switch-role'
PERSONAS = '/api/auth/personas'
VINCULAR = '/api/auth/personas/vincular'
DESVINCULAR = '/api/auth/personas/desvincular'


def claims(token):
    return jwt.decode(token, ENTORNO_DE_TEST['SECRET_KEY'], algorithms=['HS256'])


def bearer(token):
    return {'Authorization': f'Bearer {token}'}


@pytest.fixture()
def marlon(make_user):
    """Una persona: administrador comercial y closer, con cuentas distintas."""
    director = make_user(role='director_comercial', username='marlon_garcia')
    closer = make_user(role='closer', username='marlon_closer')
    director.persona_id = closer.persona_id = 1
    db.session.commit()
    return director, closer


# --- Cambio de rol ------------------------------------------------------------------------------

def test_cambia_a_la_otra_cuenta_de_la_misma_persona(client, auth_headers, marlon):
    director, closer = marlon

    r = client.post(CAMBIAR, headers=auth_headers(director), json={'user_id': closer.id})

    assert r.status_code == 200
    cuerpo = r.get_json()
    assert cuerpo['user']['id'] == closer.id and cuerpo['user']['role'] == 'closer'
    # No es una suplantación: el token no lleva ningún claim de ese tipo.
    assert 'is_impersonating' not in claims(cuerpo['token'])
    assert claims(cuerpo['token'])['id'] == closer.id


def test_con_el_token_nuevo_se_es_el_closer_y_se_puede_volver(client, marlon):
    director, closer = marlon
    token = client.post(CAMBIAR, headers=bearer(director.get_auth_token()),
                        json={'user_id': closer.id}).get_json()['token']

    yo = client.get('/api/auth/me', headers=bearer(token)).get_json()['user']
    assert yo['role'] == 'closer' and yo['is_impersonating'] is False
    assert {c['role'] for c in yo['cuentas_vinculadas']} == {'closer', 'director_comercial'}

    vuelta = client.post(CAMBIAR, headers=bearer(token), json={'user_id': director.id})
    assert vuelta.status_code == 200 and vuelta.get_json()['user']['role'] == 'director_comercial'


def test_no_se_puede_pasar_a_una_cuenta_de_otra_persona(client, auth_headers, marlon, make_user):
    director, _ = marlon
    ajeno = make_user(role='closer', username='ajeno')

    r = client.post(CAMBIAR, headers=auth_headers(director), json={'user_id': ajeno.id})

    assert r.status_code == 403


def test_una_cuenta_suelta_no_cambia_a_nadie(client, auth_headers, make_user):
    solo = make_user(role='closer', username='solo')
    otro = make_user(role='closer', username='otro')

    assert client.post(CAMBIAR, headers=auth_headers(solo), json={'user_id': otro.id}).status_code == 403


def test_no_se_pasa_a_una_cuenta_desactivada(client, auth_headers, marlon):
    director, closer = marlon
    closer.is_active = False
    db.session.commit()

    assert client.post(CAMBIAR, headers=auth_headers(director), json={'user_id': closer.id}).status_code == 403


def test_quien_simula_a_otro_tiene_que_volver_antes_de_cambiar(client, auth_headers, marlon):
    director, closer = marlon
    headers = auth_headers(director, is_impersonating=True, original_user_id=director.id,
                           original_user_role='director_comercial')

    assert client.post(CAMBIAR, headers=headers, json={'user_id': closer.id}).status_code == 400


@pytest.mark.parametrize('cuerpo', [{}, {'user_id': 'x'}, {'user_id': True}, {'user_id': None}])
def test_pide_un_id_valido(client, auth_headers, marlon, cuerpo):
    director, _ = marlon

    assert client.post(CAMBIAR, headers=auth_headers(director), json=cuerpo).status_code == 400


def test_sin_sesion_no_cambia(client, marlon):
    assert client.post(CAMBIAR, json={'user_id': marlon[1].id}).status_code == 401


def test_login_y_me_traen_las_cuentas_vinculadas(client, marlon):
    director, closer = marlon

    login = client.post('/api/auth/login', json={'username': 'marlon_garcia', 'password': 'secret123'})
    cuentas = login.get_json()['user']['cuentas_vinculadas']

    assert [(c['id'], c['activa']) for c in cuentas] == [(director.id, True), (closer.id, False)]


def test_una_cuenta_suelta_no_trae_cuentas_vinculadas(client, auth_headers, make_user):
    solo = make_user(role='closer')

    me = client.get('/api/auth/me', headers=auth_headers(solo)).get_json()['user']

    assert me['cuentas_vinculadas'] == []


# --- Gestión (operadores) ---------------------------------------------------------------------

@pytest.mark.parametrize('rol', ['closer', 'setter', 'director_comercial', 'triage'])
def test_solo_operador_o_admin_gestionan_vinculos(client, auth_headers, make_user, rol):
    otro = make_user(role=rol)

    assert client.get(PERSONAS, headers=auth_headers(otro)).status_code == 403
    assert client.post(VINCULAR, headers=auth_headers(otro), json={'user_ids': [1, 2]}).status_code == 403


@pytest.mark.parametrize('rol', ['operator', 'admin'])
def test_operador_y_admin_vinculan_y_desvinculan(client, auth_headers, make_user, rol):
    gestor = make_user(role=rol)
    a, b = make_user(role='director_comercial'), make_user(role='closer')

    r = client.post(VINCULAR, headers=auth_headers(gestor), json={'user_ids': [a.id, b.id]})

    assert r.status_code == 200
    assert a.persona_id == b.persona_id is not None
    assert len(client.get(PERSONAS, headers=auth_headers(gestor)).get_json()['personas']) == 1

    r = client.post(DESVINCULAR, headers=auth_headers(gestor), json={'user_id': a.id})

    # Con una sola cuenta la persona se deshace: nadie queda "vinculado consigo mismo".
    assert r.status_code == 200
    assert a.persona_id is None and b.persona_id is None


def test_vincular_una_cuenta_a_una_persona_existente_la_suma(client, auth_headers, make_user, marlon):
    director, closer = marlon
    setter = make_user(role='setter')
    gestor = make_user(role='operator')

    client.post(VINCULAR, headers=auth_headers(gestor), json={'user_ids': [director.id, setter.id]})

    assert setter.persona_id == director.persona_id == closer.persona_id == 1


def test_vincular_valida_el_pedido(client, auth_headers, make_user):
    gestor = make_user(role='operator')
    una = make_user(role='closer')

    assert client.post(VINCULAR, headers=auth_headers(gestor), json={'user_ids': [una.id]}).status_code == 400
    assert client.post(VINCULAR, headers=auth_headers(gestor), json={'user_ids': [una.id, 9999]}).status_code == 400
    assert client.post(VINCULAR, headers=auth_headers(gestor), json={'user_ids': 'x'}).status_code == 400
    assert client.post(DESVINCULAR, headers=auth_headers(gestor), json={'user_id': una.id}).status_code == 400


def test_la_columna_persona_id_existe_y_empieza_vacia(make_user):
    assert User.__table__.c.persona_id.nullable
    assert make_user(role='closer').persona_id is None


# --- Varios roles en UNA cuenta ---------------------------------------------------------------

@pytest.fixture()
def marlon_unico(make_user):
    """La misma persona con una sola cuenta: dirección comercial y, además, closer."""
    return make_user(role='director_comercial', username='marlon', roles_extra='closer')


def test_roles_lista_el_principal_y_los_adicionales(marlon_unico):
    assert marlon_unico.roles == ['director_comercial', 'closer']
    assert marlon_unico.tiene_rol('closer') and not marlon_unico.tiene_rol('setter')


def test_las_consultas_por_rol_encuentran_a_quien_lo_tiene_como_adicional(marlon_unico, make_user):
    otro = make_user(role='setter', username='solo_setter')

    closers = {u.id for u in User.query.filter(User.role == 'closer').all()}
    comercial = {u.id for u in User.query.filter(User.role == 'director_comercial').all()}
    en_lista = {u.id for u in User.query.filter(User.role.in_(['closer', 'setter'])).all()}
    sin_closer = {u.id for u in User.query.filter(User.role != 'closer').all()}

    assert closers == {marlon_unico.id}
    assert comercial == {marlon_unico.id}
    assert en_lista == {marlon_unico.id, otro.id}
    assert marlon_unico.id not in sin_closer and otro.id in sin_closer


def test_por_defecto_se_trabaja_con_el_rol_principal(client, auth_headers, marlon_unico):
    me = client.get('/api/auth/me', headers=auth_headers(marlon_unico)).get_json()['user']

    assert me['role'] == 'director_comercial' and me['roles'] == ['director_comercial', 'closer']


def test_cambia_de_rol_dentro_de_la_misma_cuenta(client, auth_headers, marlon_unico):
    r = client.post(CAMBIAR, headers=auth_headers(marlon_unico), json={'role': 'closer'})

    assert r.status_code == 200
    cuerpo = r.get_json()
    assert cuerpo['user']['id'] == marlon_unico.id and cuerpo['user']['role'] == 'closer'
    assert claims(cuerpo['token'])['active_role'] == 'closer'
    assert 'is_impersonating' not in claims(cuerpo['token'])

    # Con ese token se es closer: el guardián de closer deja pasar y /me lo refleja.
    yo = client.get('/api/auth/me', headers=bearer(cuerpo['token'])).get_json()['user']
    assert yo['role'] == 'closer' and yo['roles'] == ['director_comercial', 'closer']


def test_se_puede_volver_al_rol_principal(client, marlon_unico):
    token = client.post(CAMBIAR, headers=bearer(marlon_unico.get_auth_token()),
                        json={'role': 'closer'}).get_json()['token']

    vuelta = client.post(CAMBIAR, headers=bearer(token), json={'role': 'director_comercial'}).get_json()

    assert vuelta['user']['role'] == 'director_comercial'
    assert 'active_role' not in claims(vuelta['token'])


def test_no_se_activa_un_rol_que_la_cuenta_no_tiene(client, auth_headers, marlon_unico):
    assert client.post(CAMBIAR, headers=auth_headers(marlon_unico), json={'role': 'admin'}).status_code == 403
    assert client.post(CAMBIAR, headers=auth_headers(marlon_unico), json={'role': 7}).status_code == 403


def test_un_token_con_un_rol_activo_inventado_se_ignora(client, auth_headers, marlon_unico):
    # Un claim `active_role` que la cuenta no tiene no da ningún permiso: manda el principal.
    headers = auth_headers(marlon_unico, active_role='admin')

    me = client.get('/api/auth/me', headers=headers).get_json()['user']

    assert me['role'] == 'director_comercial'
    assert client.get('/api/admin/users', headers=headers).status_code == 403


def test_el_rol_activo_decide_los_permisos(client, auth_headers, marlon_unico):
    # Como director comercial no entra al mazo del closer; como closer sí.
    como_director = auth_headers(marlon_unico)
    como_closer = auth_headers(marlon_unico, active_role='closer')

    assert client.get('/api/closer/agendas', headers=como_director).status_code in (401, 403)
    assert client.get('/api/closer/agendas', headers=como_closer).status_code not in (401, 403)


def test_simulando_a_otro_no_se_cambia_de_rol(client, auth_headers, marlon_unico, make_user):
    otro = make_user(role='closer', username='otro_closer')
    headers = auth_headers(otro, is_impersonating=True, original_user_id=marlon_unico.id,
                           original_user_role='director_comercial')

    assert client.post(CAMBIAR, headers=headers, json={'role': 'closer'}).status_code == 400
