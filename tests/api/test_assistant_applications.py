"""Panel de Hiring: listado, conteos por modalidad y borrado de postulaciones de Asistente.

Antes, con la pestaña Híbridos elegida, «Sin analizar» e «Incompletas» seguían mostrando el total
global, y el KPI «Postulaciones» sumaba también a quienes abandonaron el formulario a mitad de camino.
El borrado es real (sin papelera): el panel lo difiere durante su ventana de «Deshacer».
"""
import pytest

from app.models import AssistantApplication

LISTA = '/api/assistant-applications'


@pytest.fixture()
def postulaciones(db):
    """3 híbridos (2 completas sin analizar + 1 incompleta) y 4 online (1 sin analizar, 1 incompleta,
    1 seleccionada, 1 con video verificado)."""
    filas = [
        dict(nombre='Hib 1', pais='Argentina', provincia='Salta', completo=True),
        dict(nombre='Hib 2', pais='Brasil', provincia='Paraná', completo=True),
        dict(nombre='Hib 3', pais='Argentina', provincia='Salta', completo=False),
        dict(nombre='On 1', pais='Venezuela', provincia='Caracas', completo=True),
        dict(nombre='On 2', pais='Argentina', provincia='Córdoba', completo=False),
        dict(nombre='On 3', pais='Argentina', provincia='Córdoba', completo=True, estado='seleccionada'),
        dict(nombre='On 4', pais='Argentina', provincia='Córdoba', completo=True,
             video='https://v.test/x', video_verificado='Sí, lo verifiqué'),
    ]
    creadas = [AssistantApplication(**f) for f in filas]
    db.session.add_all(creadas)
    db.session.commit()
    return creadas


def pedir(client, auth_headers, usuario, **params):
    return client.get(LISTA, headers=auth_headers(usuario), query_string=params)


@pytest.fixture()
def admin(make_user):
    return make_user(role='admin')


# --- Conteos ----------------------------------------------------------------------------------

def test_sin_modalidad_los_conteos_son_los_del_pool_entero(client, auth_headers, admin, postulaciones):
    cuerpo = pedir(client, auth_headers, admin).get_json()

    assert cuerpo['conteos']['sin_analizar'] == 4  # Hib 1, Hib 2, On 1, On 4
    assert cuerpo['conteos']['incompletas'] == 2
    assert cuerpo['conteos'] == {**cuerpo['conteos_globales'], 'hibrido': 2, 'online': 2}


def test_con_hibridos_las_subpestanas_cuentan_solo_hibridos(client, auth_headers, admin, postulaciones):
    cuerpo = pedir(client, auth_headers, admin, filtro='sin_analizar', modalidad='hibrido').get_json()

    assert cuerpo['conteos']['sin_analizar'] == 2
    assert cuerpo['conteos']['incompletas'] == 1
    assert cuerpo['conteos']['seleccionadas'] == 0
    assert cuerpo['conteos']['con_video'] == 0
    assert sorted(p['nombre'] for p in cuerpo['postulaciones']) == ['Hib 1', 'Hib 2']


def test_con_online_las_subpestanas_cuentan_solo_online(client, auth_headers, admin, postulaciones):
    cuerpo = pedir(client, auth_headers, admin, filtro='incompletas', modalidad='online').get_json()

    assert cuerpo['conteos']['sin_analizar'] == 2
    assert cuerpo['conteos']['incompletas'] == 1
    assert cuerpo['conteos']['seleccionadas'] == 1
    assert cuerpo['conteos']['con_video'] == 1
    assert [p['nombre'] for p in cuerpo['postulaciones']] == ['On 2']


def test_una_modalidad_sin_postulaciones_cuenta_cero(client, db, auth_headers, admin):
    db.session.add(AssistantApplication(nombre='Solo online', pais='Venezuela', completo=True))
    db.session.commit()

    cuerpo = pedir(client, auth_headers, admin, modalidad='hibrido').get_json()

    assert cuerpo['conteos']['sin_analizar'] == 0
    assert cuerpo['conteos']['incompletas'] == 0
    assert cuerpo['total'] == 0
    assert cuerpo['postulaciones'] == []
    # El dock no se entera de la modalidad: sigue viendo el pool entero.
    assert cuerpo['conteos_globales']['sin_analizar'] == 1


def test_los_contadores_de_modalidad_ignoran_la_modalidad_pedida(client, auth_headers, admin, postulaciones):
    sin_modalidad = pedir(client, auth_headers, admin, filtro='sin_analizar').get_json()['conteos']
    con_modalidad = pedir(client, auth_headers, admin, filtro='sin_analizar', modalidad='online').get_json()['conteos']

    assert (con_modalidad['hibrido'], con_modalidad['online']) == (sin_modalidad['hibrido'], sin_modalidad['online'])
    assert (con_modalidad['hibrido'], con_modalidad['online']) == (2, 2)


# --- KPI «Postulaciones» ----------------------------------------------------------------------

def test_el_total_cuenta_solo_las_postulaciones_completas(client, auth_headers, admin, postulaciones):
    cuerpo = pedir(client, auth_headers, admin).get_json()

    assert cuerpo['total'] == 5  # 7 en total menos las 2 incompletas
    assert cuerpo['total'] == cuerpo['conteos']['completas']


def test_el_total_sigue_la_modalidad(client, auth_headers, admin, postulaciones):
    assert pedir(client, auth_headers, admin, modalidad='hibrido').get_json()['total'] == 2
    assert pedir(client, auth_headers, admin, modalidad='online').get_json()['total'] == 3
