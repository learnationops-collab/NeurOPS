"""Escalada vertical: un rol de bajo privilegio no debe llegar a las rutas de otro rol.

Cada ruta se pide con el token de cada rol y se exige un 403 EXPLICITO: un 401 significaria que el
token no se acepto (el test pasaria "en vacio") y cualquier otro codigo que la vista llego a
ejecutarse. Solo se piden rutas con roles que deben ser rechazados, asi que ninguna vista con efectos
(borrar usuarios, vaciar tablas...) llega a correr.
"""
import re

import pytest

ROLES_BAJOS = ['closer', 'setter', 'triage', 'hiring', 'director_comercial', 'director_marketing']
TODOS_LOS_ROLES = ['admin', 'operator', 'director_comercial', 'director_marketing', 'closer', 'setter', 'triage',
                   'hiring']
CON_CUERPO = {'POST', 'PUT', 'PATCH', 'DELETE'}


def _rellenar(regla):
    return re.sub(r'<([^>:]+:)?[^>]+>', lambda m: '1' if (m.group(1) or '').startswith('int') else 'x', regla)


def _rutas_bajo(app, prefijo):
    """[(metodo, url, regla)] de todas las rutas cuyo path empieza por `prefijo`."""
    rutas = []
    for regla in app.url_map.iter_rules():
        if regla.rule.startswith(prefijo):
            for metodo in sorted((regla.methods or set()) - {'HEAD', 'OPTIONS'}):
                rutas.append((metodo, _rellenar(regla.rule), regla.rule))
    return rutas


@pytest.fixture()
def cabeceras_por_rol(make_user, auth_headers):
    return {rol: auth_headers(make_user(role=rol)) for rol in TODOS_LOS_ROLES}


def _no_rechazadas_con_403(app, prefijo, roles, cabeceras_por_rol):
    cliente = app.test_client()
    fallos = []
    for metodo, url, regla in _rutas_bajo(app, prefijo):
        for rol in roles:
            respuesta = cliente.open(url, method=metodo, headers=cabeceras_por_rol[rol],
                                     json={} if metodo in CON_CUERPO else None)
            if respuesta.status_code != 403:
                fallos.append(f'{rol:18s} {metodo:6s} {regla} -> {respuesta.status_code}')
    return fallos


# --- /api/admin/* -----------------------------------------------------------------------------

def test_hay_rutas_de_admin_que_proteger(app):
    assert len(_rutas_bajo(app, '/api/admin/')) >= 80


def test_ningun_rol_de_bajo_privilegio_llega_a_las_rutas_de_admin(app, db, cabeceras_por_rol):
    fallos = _no_rechazadas_con_403(app, '/api/admin/', ROLES_BAJOS, cabeceras_por_rol)

    assert fallos == [], 'Rutas de admin que NO responden 403 a un rol de bajo privilegio:\n' + '\n'.join(fallos)


def test_admin_y_operator_si_llegan_a_las_rutas_de_lectura_de_admin(app, db, cabeceras_por_rol):
    # Control del test anterior: los tokens funcionan y los 403 no son un rechazo generalizado.
    cliente = app.test_client()
    lecturas = [(url, regla) for metodo, url, regla in _rutas_bajo(app, '/api/admin/') if metodo == 'GET']

    for rol in ('admin', 'operator'):
        llegan = [regla for url, regla in lecturas
                  if cliente.get(url, headers=cabeceras_por_rol[rol]).status_code not in (401, 403)]
        assert len(llegan) >= 30, f'{rol} solo llega a {len(llegan)} de {len(lecturas)} lecturas de admin'


# --- /api/setter/* ----------------------------------------------------------------------------

def test_solo_un_setter_usa_las_rutas_de_setter(app, db, cabeceras_por_rol):
    ajenos = [rol for rol in TODOS_LOS_ROLES if rol != 'setter']

    fallos = _no_rechazadas_con_403(app, '/api/setter/', ajenos, cabeceras_por_rol)

    assert fallos == [], 'Rutas de setter que NO responden 403 a otro rol:\n' + '\n'.join(fallos)


def test_un_setter_si_llega_a_sus_rutas(app, db, cabeceras_por_rol):
    lecturas = [url for metodo, url, _ in _rutas_bajo(app, '/api/setter/') if metodo == 'GET']
    cliente = app.test_client()

    llegan = [url for url in lecturas if cliente.get(url, headers=cabeceras_por_rol['setter']).status_code != 403]

    assert len(llegan) >= 5
