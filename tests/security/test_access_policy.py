"""La politica de acceso de la herramienta interna (app/access_policy.py) y su guarda.

Antes 91 rutas respondian a cualquiera en internet. La tabla declara quien puede llamar a cada una; aca se
prueba que la tabla es coherente con la app real y que la guarda la aplica: sin sesion es 401, un rol que
no esta es 403, `admin` entra siempre, y el secreto de los sistemas externos solo abre las rutas de
ingesta. La guarda se ejecuta directamente sobre contextos de peticion (sin pasar por las vistas); su
registro en la app y el efecto extremo a extremo se prueban en test_access_policy_integration.
"""
import logging
import re

import pytest
from flask import g, has_app_context

from app.access_policy import POLITICA, es_llamada_de_confianza, es_llamada_de_ingesta, guardia

TOKEN = 'secreto-de-ingesta-de-prueba-con-mas-de-veinte-caracteres'
ROLES = ['admin', 'operator', 'closer', 'setter', 'triage', 'director_comercial', 'director_marketing', 'hiring']

# Las UNICAS rutas que aceptan el secreto de los sistemas externos (n8n, Apps Script): se fija la lista
# para que ampliar lo que puede hacer una llamada de maquina sea una decision consciente.
RUTAS_DE_INGESTA = {
    ('POST', '/api/public/financial-agendas'),
    ('POST', '/api/public/financial-agendas-form'),
    ('POST', '/api/public/financial-agendas/verificar-hora'),
    ('POST', '/api/public/financial-sales'),
    ('GET', '/api/public/clients/search'),
    ('POST', '/api/public/clients/follow-up'),
    ('GET', '/api/public/new-clients'),
}


def concreta(regla):
    """/api/x/<int:id>/<string:k> -> /api/x/1/x"""
    return re.sub(r'<string:\w+>', 'x', re.sub(r'<int:\w+>', '1', regla))


def consultar(app, metodo, ruta, cabeceras=None):
    """Lo que devuelve la guarda para esa peticion: None (pasa) o (respuesta, codigo)."""
    if has_app_context():
        g.__dict__.clear()  # Flask-Login deja al usuario en g: sin esto el de la primera peticion se queda
    with app.test_request_context(ruta, method=metodo, headers=cabeceras or {}):
        return guardia()


def codigo(resultado):
    return None if resultado is None else resultado[1]


@pytest.fixture()
def ingesta(monkeypatch):
    monkeypatch.setenv('INGEST_API_TOKEN', TOKEN)


# --- La tabla es coherente con la app -----------------------------------------------------------

def _reglas_de_la_app(app):
    return {(m, r.rule) for r in app.url_map.iter_rules() for m in (r.methods or set()) - {'HEAD', 'OPTIONS'}}


def test_cada_entrada_de_la_tabla_es_una_ruta_real(app):
    sobrantes = set(POLITICA) - _reglas_de_la_app(app)

    assert sobrantes == set(), f'Entradas de POLITICA que no son rutas de la app (¿un typo?): {sorted(sobrantes)}'


def test_toda_politica_incluye_a_admin_y_solo_roles_reales():
    for clave, politica in POLITICA.items():
        assert 'admin' in politica.roles, clave
        assert politica.roles <= set(ROLES), (clave, politica.roles - set(ROLES))


def test_las_rutas_de_ingesta_son_exactamente_las_esperadas():
    assert {clave for clave, politica in POLITICA.items() if politica.ingesta} == RUTAS_DE_INGESTA


def test_lo_publico_por_diseno_no_esta_en_la_tabla():
    from tests.security.anonymous_surface import PUBLICAS_POR_DISENO

    # Una ruta o es publica (formularios, reservas, telemetria, callbacks) o tiene politica: nunca las dos.
    assert PUBLICAS_POR_DISENO.isdisjoint(POLITICA)


def test_las_tres_rutas_que_parecian_expuestas_son_publicas_por_diseno():
    from tests.security.anonymous_surface import PUBLICAS_POR_DISENO

    # El funnel y la comprobacion de cliente de la pagina de reservas y el contador de la landing (solo
    # totales): protegerlas rompe el embudo de reservas y la prueba social de la landing.
    assert {('GET', '/api/public/funnel/<string:utm_source>'), ('POST', '/api/public/clients/check'),
            ('GET', '/api/public/workshop-lead/stats')} <= PUBLICAS_POR_DISENO


# --- Sin credenciales: nadie pasa ---------------------------------------------------------------

def test_un_anonimo_recibe_401_en_cada_ruta_de_la_tabla(app, db):
    fallan = [(m, r) for m, r in sorted(POLITICA) if codigo(consultar(app, m, concreta(r))) != 401]

    assert fallan == [], f'Rutas que un anonimo puede llamar: {fallan}'


def test_admin_pasa_en_cada_ruta_de_la_tabla(app, db, make_user, auth_headers):
    cabeceras = auth_headers(make_user(role='admin'))

    fallan = [(m, r) for m, r in sorted(POLITICA) if consultar(app, m, concreta(r), cabeceras) is not None]

    assert fallan == [], f'Rutas que dejan a admin afuera: {fallan}'


def test_una_respuesta_401_es_json_y_no_revela_la_tabla(app, db):
    resultado = consultar(app, 'GET', '/api/public/financial-sales')

    assert resultado[0].get_json() == {'message': 'Unauthorized'}


# --- Roles: quien puede y quien no --------------------------------------------------------------

# (metodo, ruta) -> (roles que pasan). Verdad escrita a mano, independiente de la tabla.
MATRIZ = {
    ('GET', '/api/public/financial-sales/payroll'): {'admin'},
    ('POST', '/api/public/financial-sales/1/toggle-payroll-exclusion'): {'admin'},
    ('GET', '/api/public/reports/sales-attribution'): {'admin'},
    ('POST', '/api/public/financial-agendas/repair-db'): {'admin'},
    ('DELETE', '/api/public/financial-sales/1'): {'admin', 'director_comercial', 'operator'},
    ('GET', '/api/public/financial-sales'): {'admin', 'director_comercial', 'operator'},
    ('PUT', '/api/public/ads/1'): {'admin', 'director_marketing'},
    ('POST', '/api/manychat-webhook/cleanup-duplicates'): {'admin', 'director_marketing'},
    ('POST', '/api/manychat-webhook/migrate'): {'admin', 'director_marketing'},
    ('POST', '/api/public/closer-report'): {'admin', 'closer'},
    ('POST', '/api/public/setter-report'): {'admin', 'setter'},
    ('POST', '/api/public/triage-report'): {'admin', 'triage'},
    ('DELETE', '/api/conversational/records/clear'): {'admin', 'director_comercial'},
    ('POST', '/api/conversational/messages'): {'admin', 'director_comercial', 'setter'},
    ('GET', '/api/triage/tracker'): {'admin', 'director_comercial'},
    ('GET', '/api/workshop/stats/summary'): {'admin', 'operator', 'director_marketing'},
    ('POST', '/api/public/lead-roadmap/update-client'):
        {'admin', 'closer', 'director_comercial', 'operator', 'setter', 'triage'},
}


@pytest.mark.parametrize('rol', ROLES)
def test_cada_rol_pasa_o_recibe_403_segun_la_matriz(app, db, make_user, auth_headers, rol):
    cabeceras = auth_headers(make_user(role=rol))

    distintas = [(m, r, 'pasa' if consultar(app, m, r, cabeceras) is None else '403')
                 for (m, r), roles in sorted(MATRIZ.items())
                 if (codigo(consultar(app, m, r, cabeceras)) is None) != (rol in roles)]

    assert distintas == [], f'El rol {rol} no coincide con la matriz en: {distintas}'


def test_una_respuesta_403_es_json(app, db, make_user, auth_headers):
    resultado = consultar(app, 'GET', '/api/public/financial-sales/payroll', auth_headers(make_user(role='closer')))

    assert resultado[0].get_json() == {'message': 'Forbidden'}


def test_un_usuario_desactivado_recibe_401_y_no_403(app, db, make_user, auth_headers):
    inactivo = make_user(role='admin', is_active=False)

    assert codigo(consultar(app, 'GET', '/api/public/financial-sales', auth_headers(inactivo))) == 401


def test_un_token_de_usuario_falsificado_recibe_401(app, db):
    import jwt

    falso = jwt.encode({'id': 1, 'exp': 9_999_999_999}, 'otra-clave-de-32-bytes-o-mas-para-hs256', algorithm='HS256')

    assert codigo(consultar(app, 'GET', '/api/public/financial-sales', {'Authorization': f'Bearer {falso}'})) == 401


# --- Metodos y rutas que la guarda no toca ------------------------------------------------------

def test_head_de_una_ruta_get_tambien_se_protege(app, db):
    # Flask ejecuta la vista del GET para un HEAD: sin esto se saltaria la guarda.
    assert codigo(consultar(app, 'HEAD', '/api/public/financial-sales')) == 401


def test_options_no_se_bloquea_para_no_romper_los_preflight_de_cors(app, db):
    assert consultar(app, 'OPTIONS', '/api/public/financial-sales') is None


@pytest.mark.parametrize('metodo,ruta', [
    ('POST', '/api/public/book'),
    ('POST', '/api/public/submit-lead'),
    ('GET', '/api/public/slots'),
    ('GET', '/api/public/funnel/mi-evento'),
    ('POST', '/api/public/clients/check'),
    ('GET', '/api/public/workshop-lead/stats'),
    ('POST', '/api/auth/login'),
    ('GET', '/api/health'),
    ('POST', '/api/webhooks/manychat'),
])
def test_las_rutas_publicas_por_diseno_no_las_toca_la_guarda(app, db, metodo, ruta):
    assert consultar(app, metodo, ruta) is None


def test_una_ruta_que_no_existe_no_es_de_la_guarda(app, db):
    assert consultar(app, 'GET', '/api/public/no-existe') is None


def test_un_metodo_que_la_ruta_no_admite_no_es_de_la_guarda(app, db):
    assert consultar(app, 'PATCH', '/api/public/financial-sales') is None  # es un 405, no un 401


# --- El secreto de los sistemas externos (n8n, Apps Script) --------------------------------------

@pytest.mark.parametrize('cabeceras', [{'X-Api-Token': TOKEN}, {'Authorization': f'Bearer {TOKEN}'}])
def test_el_secreto_abre_las_rutas_de_ingesta(app, db, ingesta, cabeceras):
    fallan = [(m, r) for m, r in sorted(RUTAS_DE_INGESTA) if consultar(app, m, concreta(r), cabeceras) is not None]

    assert fallan == [], f'Rutas de ingesta que el secreto no abre: {fallan}'


def test_el_secreto_no_abre_ninguna_otra_ruta(app, db, ingesta):
    abiertas = []
    for metodo, regla in sorted(set(POLITICA) - RUTAS_DE_INGESTA):
        for cabeceras in ({'X-Api-Token': TOKEN}, {'Authorization': f'Bearer {TOKEN}'}):
            if codigo(consultar(app, metodo, concreta(regla), cabeceras)) != 401:
                abiertas.append((metodo, regla))

    assert abiertas == [], f'Rutas que el secreto de ingesta abre y no deberia: {abiertas}'


@pytest.mark.parametrize('cabeceras', [
    {}, {'X-Api-Token': ''}, {'X-Api-Token': 'mal'}, {'X-Api-Token': TOKEN[:-1]}, {'X-Api-Token': TOKEN + 'x'},
    {'X-Api-Token': TOKEN.upper()}, {'X-Api-Token': 'tokén-con-acento'}, {'Authorization': 'Bearer mal'},
    {'Authorization': f'Basic {TOKEN}'}, {'Authorization': TOKEN},
])
def test_un_secreto_incorrecto_o_ausente_es_401(app, db, ingesta, cabeceras):
    assert codigo(consultar(app, 'POST', '/api/public/financial-sales', cabeceras)) == 401


@pytest.mark.parametrize('configurado', [None, '', 'corto'])
def test_sin_secreto_configurado_o_muy_corto_nadie_califica_ni_con_su_propio_valor(app, db, monkeypatch, configurado):
    if configurado is not None:
        monkeypatch.setenv('INGEST_API_TOKEN', configurado)

    cabeceras = {'X-Api-Token': configurado or 'algo'}
    assert codigo(consultar(app, 'POST', '/api/public/financial-sales', cabeceras)) == 401
    with app.test_request_context('/api/public/financial-sales', method='POST', headers=cabeceras):
        assert es_llamada_de_ingesta() is False


def test_el_secreto_no_se_toma_de_la_url(app, db, ingesta):
    assert codigo(consultar(app, 'POST', f'/api/public/financial-sales?token={TOKEN}')) == 401


def test_compara_el_secreto_en_tiempo_constante_sobre_bytes(app, db, ingesta, monkeypatch):
    from app import decorators

    llamadas, real = [], decorators.hmac.compare_digest

    def espia(a, b):
        llamadas.append((a, b))
        return real(a, b)

    monkeypatch.setattr(decorators.hmac, 'compare_digest', espia)

    consultar(app, 'POST', '/api/public/financial-sales', {'X-Api-Token': 'mal'})

    assert llamadas == [(b'mal', TOKEN.encode())]  # nunca con `==`, que filtra el largo del prefijo coincidente


def test_un_jwt_de_usuario_en_una_ruta_de_ingesta_se_juzga_por_su_rol(app, db, ingesta, make_user, auth_headers):
    # Un Bearer puede ser el JWT de un usuario: no coincide con el secreto y se trata como credencial de usuario.
    assert consultar(app, 'POST', '/api/public/financial-sales', auth_headers(make_user(role='operator'))) is None
    assert codigo(consultar(app, 'POST', '/api/public/financial-sales', auth_headers(make_user(role='closer')))) == 403


def test_el_secreto_no_da_acceso_de_usuario(app, db, ingesta):
    # Solo abre las rutas de ingesta: no autentica a nadie (no hay usuario detras).
    with app.test_request_context('/api/public/financial-sales', method='POST', headers={'X-Api-Token': TOKEN}):
        assert es_llamada_de_ingesta() is True
        assert es_llamada_de_confianza() is True

        from flask_login import current_user
        assert current_user.is_authenticated is False


def test_es_llamada_de_confianza_distingue_anonimo_usuario_y_maquina(app, db, ingesta, make_user, auth_headers):
    def confianza(cabeceras):
        if has_app_context():
            g.__dict__.clear()
        with app.test_request_context('/api/public/clients/check', method='POST', headers=cabeceras):
            return es_llamada_de_confianza()

    assert confianza({}) is False
    assert confianza({'X-Api-Token': 'mal'}) is False
    assert confianza(auth_headers(make_user(role='closer'))) is True
    assert confianza({'X-Api-Token': TOKEN}) is True


# --- Modo de migracion --------------------------------------------------------------------------

@pytest.fixture()
def migracion(monkeypatch):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', 'log_only')


def _avisos(caplog):
    return [r.getMessage() for r in caplog.records if 'MIGRACION DE SECRETOS' in r.getMessage()]


def test_en_migracion_un_anonimo_pasa_y_queda_registrado(app, db, migracion, caplog):
    with caplog.at_level(logging.WARNING):
        resultado = consultar(app, 'DELETE', '/api/public/financial-sales/1')

    assert resultado is None
    avisos = _avisos(caplog)
    assert len(avisos) == 1
    assert 'DELETE /api/public/financial-sales/1' in avisos[0] and 'sin sesion ni secreto de ingesta' in avisos[0]


def test_en_migracion_un_rol_no_permitido_pasa_y_queda_registrado(app, db, migracion, make_user, auth_headers, caplog):
    with caplog.at_level(logging.WARNING):
        resultado = consultar(app, 'GET', '/api/public/financial-sales/payroll', auth_headers(make_user(role='closer')))

    assert resultado is None
    assert 'el rol closer no esta permitido' in _avisos(caplog)[0]


def test_en_migracion_lo_permitido_no_genera_avisos(app, db, migracion, make_user, auth_headers, caplog):
    with caplog.at_level(logging.WARNING):
        consultar(app, 'GET', '/api/public/financial-sales', auth_headers(make_user(role='operator')))

    assert _avisos(caplog) == []


def test_sin_migracion_no_pasa_nadie_sin_credencial(app, db):
    assert codigo(consultar(app, 'DELETE', '/api/public/financial-sales/1')) == 401
