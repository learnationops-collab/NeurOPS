"""User: contrasenas, JWT y carga del usuario desde la peticion (request_loader).

El JWT firmado con SECRET_KEY es el metodo de autenticacion principal de la SPA: cada pestana lleva
el suyo. Un token vencido, adulterado, firmado con otra clave o con otro algoritmo (incluido 'none')
NUNCA debe autenticar.
"""
import time

import jwt
import pytest
from flask import g, request, session

from app.models import User
from app.models.user import get_impersonation_state, load_user_from_request
from tests.conftest import ENTORNO_DE_TEST

SECRETO = ENTORNO_DE_TEST['SECRET_KEY']
OTRA_CLAVE = 'otra-clave-de-32-bytes-o-mas-para-hs256'


@pytest.fixture()
def con_app(app):
    with app.app_context():
        yield


def _firmar(payload, clave=SECRETO, algoritmo='HS256'):
    return jwt.encode(payload, clave, algorithm=algoritmo)


def _vigente():
    return {'id': 1, 'exp': time.time() + 600}


def _con_payload_adulterado():
    cabecera, cuerpo, firma = _firmar(_vigente()).split('.')
    return f'{cabecera}.{cuerpo[:-2]}xx.{firma}'


# --- Contrasenas ------------------------------------------------------------------------------

def test_la_contrasena_no_se_guarda_en_claro():
    usuario = User(username='ana')
    usuario.set_password('clave-muy-secreta')

    assert usuario.password_hash
    assert 'clave-muy-secreta' not in usuario.password_hash
    assert usuario.check_password('clave-muy-secreta') is True
    assert usuario.check_password('otra') is False
    assert usuario.check_password('') is False


def test_dos_usuarios_con_la_misma_clave_tienen_hashes_distintos():
    a, b = User(username='a'), User(username='b')
    a.set_password('igual')
    b.set_password('igual')

    assert a.password_hash != b.password_hash  # cada hash lleva su propia sal


def test_la_clave_distingue_mayusculas():
    usuario = User(username='ana')
    usuario.set_password('Clave')

    assert usuario.check_password('clave') is False


# --- get_auth_token / decode_auth_token -------------------------------------------------------

def test_el_token_lleva_el_id_y_vence_en_24_horas(con_app, make_user):
    usuario = make_user()

    payload = jwt.decode(usuario.get_auth_token(), SECRETO, algorithms=['HS256'])

    assert payload['id'] == usuario.id
    assert 86_390 < payload['exp'] - time.time() < 86_410


def test_el_token_usa_hs256(con_app, make_user):
    assert jwt.get_unverified_header(make_user().get_auth_token())['alg'] == 'HS256'


def test_el_token_acepta_una_duracion_y_claims_extra(con_app, make_user):
    usuario = make_user()

    payload = jwt.decode(
        usuario.get_auth_token(expires_in=60, is_impersonating=True, original_user_id=7),
        SECRETO, algorithms=['HS256'],
    )

    assert 50 < payload['exp'] - time.time() < 70
    assert payload['is_impersonating'] is True
    assert payload['original_user_id'] == 7


def test_un_token_valido_se_decodifica(con_app, make_user):
    usuario = make_user()

    assert User.decode_auth_token(usuario.get_auth_token())['id'] == usuario.id
    assert User.verify_auth_token(usuario.get_auth_token()) == usuario.id


@pytest.mark.parametrize('nombre,fabricar', [
    ('vencido', lambda: _firmar({'id': 1, 'exp': time.time() - 10})),
    ('firmado con otra clave', lambda: _firmar(_vigente(), clave=OTRA_CLAVE)),
    ('con otro algoritmo (HS512)', lambda: _firmar(_vigente(), algoritmo='HS512')),
    ('sin firma (alg none)', lambda: jwt.encode(_vigente(), None, algorithm='none')),
    ('firma adulterada', lambda: _firmar(_vigente())[:-4] + 'AAAA'),
    ('payload adulterado', _con_payload_adulterado),
    ('basura', lambda: 'esto-no-es-un-jwt'),
    ('vacio', lambda: ''),
])
def test_un_token_invalido_nunca_se_decodifica(con_app, nombre, fabricar):
    token = fabricar()

    assert User.decode_auth_token(token) is None
    assert User.verify_auth_token(token) is None


def test_decodificar_none_no_rompe(con_app):
    assert User.decode_auth_token(None) is None


# --- load_user_from_request -------------------------------------------------------------------

def _usuario_de(app, autorizacion=None, query=''):
    cabeceras = {'Authorization': autorizacion} if autorizacion else {}
    with app.test_request_context(f'/api/x{query}', headers=cabeceras):
        return load_user_from_request(request)


def test_un_bearer_valido_carga_al_usuario(app, db, make_user):
    usuario = make_user(role='closer')

    cargado = _usuario_de(app, f'Bearer {usuario.get_auth_token()}')

    assert cargado.id == usuario.id


def test_sin_token_no_hay_usuario(app, db):
    assert _usuario_de(app) is None


@pytest.mark.parametrize('autorizacion', ['Bearer basura', 'Bearer ', 'Bearer'])
def test_un_bearer_invalido_no_carga_a_nadie(app, db, autorizacion):
    assert _usuario_de(app, autorizacion) is None


def test_un_token_vencido_no_carga_a_nadie(app, db, make_user):
    usuario = make_user()

    assert _usuario_de(app, f'Bearer {usuario.get_auth_token(expires_in=-5)}') is None


def test_el_token_de_un_usuario_borrado_no_carga_a_nadie(app, db, make_user):
    usuario = make_user()
    token = usuario.get_auth_token()
    db.session.delete(usuario)
    db.session.commit()

    assert _usuario_de(app, f'Bearer {token}') is None


def test_los_claims_del_token_quedan_disponibles_para_la_suplantacion(app, db, make_user):
    usuario = make_user()
    token = usuario.get_auth_token(is_impersonating=True, original_user_id=9, original_user_role='admin')

    with app.test_request_context('/api/x', headers={'Authorization': f'Bearer {token}'}):
        load_user_from_request(request)

        assert g.token_claims['original_user_id'] == 9


@pytest.mark.xfail(strict=True, reason=(
    "BUG DE SEGURIDAD: is_active no se comprueba al autenticar por token. Flask-Login solo lo mira "
    "en login_user(), pero la SPA usa Bearer: un usuario desactivado conserva el acceso hasta que "
    "venza su JWT (24 h) y, ademas, /api/auth/login le entrega un token nuevo."))
def test_un_usuario_desactivado_no_se_autentica_con_su_token(app, db, make_user):
    usuario = make_user(is_active=False)

    assert _usuario_de(app, f'Bearer {usuario.get_auth_token()}') is None


# --- get_impersonation_state ------------------------------------------------------------------

def test_sin_nada_no_se_esta_suplantando(app):
    with app.test_request_context('/'):
        assert get_impersonation_state() == (False, None, None)


def test_el_estado_sale_de_los_claims_del_token(app):
    with app.test_request_context('/'):
        g.token_claims = {'is_impersonating': True, 'original_user_id': 5, 'original_user_role': 'operator'}

        assert get_impersonation_state() == (True, 5, 'operator')


def test_un_token_sin_claims_de_suplantacion_no_suplanta(app):
    with app.test_request_context('/'):
        g.token_claims = {'id': 3}

        assert get_impersonation_state() == (False, None, None)


def test_sin_token_el_estado_sale_de_la_sesion_de_cookie(app):
    with app.test_request_context('/'):
        session['is_impersonating'] = True
        session['original_user_id'] = 8
        session['original_user_role'] = 'admin'

        assert get_impersonation_state() == (True, 8, 'admin')


def test_el_token_manda_sobre_la_sesion_compartida_del_navegador(app):
    # Cada pestana simulada lleva su propio JWT y no debe heredar la suplantacion de otra pestana.
    with app.test_request_context('/'):
        session['is_impersonating'] = True
        session['original_user_id'] = 8
        g.token_claims = {'id': 3}

        assert get_impersonation_state() == (False, None, None)
