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


# --- Eliminar ---------------------------------------------------------------------------------

@pytest.mark.parametrize('rol', ['admin', 'hiring'])
def test_borra_de_verdad_la_postulacion(client, auth_headers, make_user, postulaciones, rol):
    objetivo = postulaciones[0]
    quedan = AssistantApplication.query.count() - 1

    respuesta = client.delete(f'{LISTA}/{objetivo.id}', headers=auth_headers(make_user(role=rol)))

    assert respuesta.status_code == 200
    assert respuesta.get_json() == {'status': 'success', 'id': objetivo.id}
    assert AssistantApplication.query.get(objetivo.id) is None
    assert AssistantApplication.query.count() == quedan


def test_borrar_una_que_no_existe_da_404(client, auth_headers, admin, postulaciones):
    respuesta = client.delete(f'{LISTA}/99999', headers=auth_headers(admin))

    assert respuesta.status_code == 404
    assert AssistantApplication.query.count() == len(postulaciones)


def test_borrar_una_ya_borrada_da_404(client, auth_headers, admin, postulaciones):
    ruta = f'{LISTA}/{postulaciones[0].id}'
    assert client.delete(ruta, headers=auth_headers(admin)).status_code == 200

    assert client.delete(ruta, headers=auth_headers(admin)).status_code == 404


def test_sin_sesion_no_borra(client, postulaciones):
    respuesta = client.delete(f'{LISTA}/{postulaciones[0].id}')

    assert respuesta.status_code == 401
    assert AssistantApplication.query.count() == len(postulaciones)


@pytest.mark.parametrize('rol', ['operator', 'closer', 'setter', 'triage', 'director_comercial', 'director_marketing'])
def test_los_roles_sin_acceso_a_hiring_no_borran(client, auth_headers, make_user, postulaciones, rol):
    respuesta = client.delete(f'{LISTA}/{postulaciones[0].id}', headers=auth_headers(make_user(role=rol)))

    assert respuesta.status_code == 403
    assert AssistantApplication.query.count() == len(postulaciones)


# --- Formulario editable: form_id y respuestas extra --------------------------------------------

def test_el_detalle_rotula_las_respuestas_extra(client, db, auth_headers, admin):
    from app.models import HiringForm

    form = HiringForm(nombre='F', activo=True, preguntas=[
        {'id': 'linkedin', 'bloque': 'Video y CV', 'tipo': 'link', 't': 'Tu LinkedIn', 'on': True, 'base': False},
    ])
    db.session.add(form)
    db.session.flush()
    fila = AssistantApplication(nombre='Ana', form_id=form.id,
                                respuestas_extra={'huerfana': 'x', 'linkedin': 'https://linkedin.com/in/ana'})
    db.session.add(fila)
    db.session.commit()

    cuerpo = client.get(f'{LISTA}/{fila.id}', headers=auth_headers(admin)).get_json()

    assert cuerpo['form_id'] == form.id
    assert cuerpo['respuestas_extra'] == {'huerfana': 'x', 'linkedin': 'https://linkedin.com/in/ana'}
    assert cuerpo['preguntas_extra'] == [
        {'id': 'linkedin', 't': 'Tu LinkedIn', 'bloque': 'Video y CV'},
        {'id': 'huerfana', 't': 'huerfana', 'bloque': None},
    ]


def test_el_listado_trae_form_id_pero_no_las_respuestas_extra(client, auth_headers, admin, postulaciones):
    fila = pedir(client, auth_headers, admin, filtro='todas').get_json()['postulaciones'][0]

    assert fila['form_id'] is None
    assert 'respuestas_extra' not in fila


def _consultas_del_listado(client, db, auth_headers, admin, cuantas):
    from sqlalchemy import event

    from app.models import HiringForm

    db.session.query(AssistantApplication).delete()
    db.session.query(HiringForm).delete()
    form = HiringForm(nombre='F', activo=True, preguntas=[
        {'id': 'notion', 'tipo': 'radio', 't': 'Notion', 'o': [{'t': 'x'}], 'on': False, 'base': True},
    ])
    db.session.add(form)
    db.session.flush()
    db.session.add_all([AssistantApplication(nombre=f'A{i}', form_id=form.id, completo=True) for i in range(cuantas)])
    db.session.commit()
    db.session.expire_all()

    consultas = []
    contar = lambda *args, **kwargs: consultas.append(1)  # noqa: E731
    event.listen(db.engine, 'before_cursor_execute', contar)
    try:
        assert pedir(client, auth_headers, admin, filtro='todas').status_code == 200
    finally:
        event.remove(db.engine, 'before_cursor_execute', contar)
    return len(consultas)


def test_el_listado_lee_cada_formulario_una_sola_vez(client, db, auth_headers, admin):
    # Completitud y score miran el formulario de cada postulación: con 40 filas no
    # pueden hacer más consultas que con 2.
    assert _consultas_del_listado(client, db, auth_headers, admin, 40) == \
        _consultas_del_listado(client, db, auth_headers, admin, 2)


def test_el_listado_trae_la_automatizacion_contada(client, db, auth_headers, admin):
    db.session.add(AssistantApplication(nombre='Ana', completo=True, automatizacion_ejemplo='Un zap de Stripe a Sheets'))
    db.session.commit()

    fila = pedir(client, auth_headers, admin, filtro='todas').get_json()['postulaciones'][0]

    assert fila['automatizacion_ejemplo'] == 'Un zap de Stripe a Sheets'
