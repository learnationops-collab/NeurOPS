"""Postulaciones de Closer de ventas: quién abre el panel y quién figura como revisor.

El 10/10/2026 se retiró la vista «Administración» y el panel pasó a Learnation Talent, así que lo
abren los mismos que Talent: `admin` y `hiring` (antes solo `admin`). Cuenta el rol ACTIVO de la
sesión, como en el resto de la app; y los revisores son quienes pueden votar, con el rol principal o
uno adicional (`roles_extra`).
"""
import re

import pytest

from app.models import JobApplication, JobApplicationVote

PREFIJO = '/api/job-applications'
ROLES_AJENOS = ['operator', 'closer', 'setter', 'triage', 'director_comercial', 'director_marketing']
CON_CUERPO = {'POST', 'PUT', 'PATCH', 'DELETE'}


def _rutas(app):
    """[(metodo, url)] de todas las rutas del panel, con los parámetros rellenados."""
    rutas = []
    for regla in app.url_map.iter_rules():
        if regla.rule.startswith(PREFIJO):
            url = re.sub(r'<int:\w+>', '1', regla.rule)
            for metodo in sorted((regla.methods or set()) - {'HEAD', 'OPTIONS'}):
                rutas.append((metodo, url))
    return rutas


@pytest.fixture()
def postulacion(db):
    fila = JobApplication(nombre='Cande Closer', email='cande@test.local', completo=True)
    db.session.add(fila)
    db.session.commit()
    return fila


def test_el_panel_tiene_las_rutas_que_se_prueban(app):
    assert len(_rutas(app)) == 8


@pytest.mark.parametrize('rol', ['admin', 'hiring'])
def test_admin_y_hiring_abren_el_panel(client, make_user, auth_headers, postulacion, rol):
    cabeceras = auth_headers(make_user(role=rol))

    assert client.get(PREFIJO, headers=cabeceras, query_string={'filtro': 'todas'}).status_code == 200
    assert client.get(f'{PREFIJO}/{postulacion.id}', headers=cabeceras).status_code == 200
    assert client.get(f'{PREFIJO}/stats', headers=cabeceras).status_code == 200
    assert client.get(f'{PREFIJO}/revisores', headers=cabeceras).status_code == 200
    assert client.get(f'{PREFIJO}/clarity-weights', headers=cabeceras).status_code == 200


def test_los_demas_roles_reciben_403_en_todas_las_rutas(app, client, make_user, auth_headers):
    fallos = []
    for rol in ROLES_AJENOS:
        cabeceras = auth_headers(make_user(role=rol))
        for metodo, url in _rutas(app):
            respuesta = client.open(url, method=metodo, headers=cabeceras, json={} if metodo in CON_CUERPO else None)
            if respuesta.status_code != 403:
                fallos.append(f'{rol} {metodo} {url} -> {respuesta.status_code}')

    assert fallos == []


def test_sin_sesion_es_401(app, client):
    for metodo, url in _rutas(app):
        assert client.open(url, method=metodo, json={} if metodo in CON_CUERPO else None).status_code == 401, url


def test_hiring_vota_y_resuelve(client, make_user, auth_headers, postulacion, db):
    hiring = make_user(role='hiring')
    cabeceras = auth_headers(hiring)

    voto = client.post(f'{PREFIJO}/{postulacion.id}/vote', headers=cabeceras, json={'valor': 'pre'})
    assert voto.status_code == 200
    assert voto.get_json()['veredicto'] == 'preseleccionada'
    assert JobApplicationVote.query.filter_by(application_id=postulacion.id).one().reviewer_id == hiring.id

    resolucion = client.post(f'{PREFIJO}/{postulacion.id}/resolver', headers=cabeceras, json={'valor': 'testeo'})
    assert resolucion.status_code == 200
    db.session.refresh(postulacion)
    assert postulacion.resuelto_por_id == hiring.id


def test_con_hiring_de_rol_adicional_entra_solo_trabajando_con_ese_rol(client, make_user, auth_headers):
    # Mario: operador con `hiring` de rol extra. El panel mira el rol ACTIVO, como `hiring_required`.
    mario = make_user(role='operator', roles_extra='hiring')

    assert client.get(PREFIJO, headers=auth_headers(mario)).status_code == 403
    assert client.get(PREFIJO, headers=auth_headers(mario, active_role='hiring')).status_code == 200


# --- Revisores --------------------------------------------------------------------------------

def test_revisores_son_admin_y_hiring_con_el_rol_principal_o_adicional(client, make_user, auth_headers):
    make_user(role='admin', username='ana_admin')
    make_user(role='hiring', username='beto_hiring')
    make_user(role='operator', username='caro_operadora', roles_extra='hiring')
    make_user(role='closer', username='dani_closer', roles_extra='setter')
    make_user(role='director_comercial', username='eli_direccion')
    # Con los dos roles figura una sola vez.
    make_user(role='admin', username='fer_ambos', roles_extra='hiring')
    quien_pide = make_user(role='hiring', username='gus_hiring')

    cuerpo = client.get(f'{PREFIJO}/revisores', headers=auth_headers(quien_pide)).get_json()

    assert [r['nombre'] for r in cuerpo['revisores']] == [
        'ana_admin', 'beto_hiring', 'caro_operadora', 'fer_ambos', 'gus_hiring',
    ]


def test_el_voto_de_un_hiring_cuenta_en_su_tarjeta_de_revisor(client, make_user, auth_headers, postulacion, db):
    hiring = make_user(role='hiring', username='beto_hiring')
    db.session.add(JobApplicationVote(application_id=postulacion.id, reviewer_id=hiring.id, vote='des'))
    db.session.commit()

    cuerpo = client.get(f'{PREFIJO}/revisores', headers=auth_headers(make_user(role='admin'))).get_json()

    beto = next(r for r in cuerpo['revisores'] if r['nombre'] == 'beto_hiring')
    assert beto['hechas'] == 1 and beto['faltan'] == 0 and beto['conteo']['des'] == 1
