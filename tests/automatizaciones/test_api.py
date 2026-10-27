"""API del área Inbox (/api/inbox): la dirección arma y publica flujos; el setter solo mira."""
from datetime import datetime, timedelta

import pytest

from app.automatizaciones import servicio
from app.automatizaciones.modelos import AutFlujo, IgContacto, IgMensaje
from app.automatizaciones.transporte import TransporteSimulado
from app.models.instagram import InstagramWebhookEvento
from tests.automatizaciones import flujos as f

URL = '/api/inbox'


@pytest.fixture()
def gente(make_user):
    return {rol: make_user(role=rol) for rol in ('admin', 'director_comercial', 'setter', 'closer')}


@pytest.fixture()
def como(gente, auth_headers):
    return lambda rol: auth_headers(gente[rol])


def crear(client, cabeceras, nombre='Guía', grafo=None):
    cuerpo = {'nombre': nombre, **({'grafo': grafo} if grafo else {})}
    return client.post(f'{URL}/flujos', json=cuerpo, headers=cabeceras)


# --- Acceso -------------------------------------------------------------------------------------

def test_sin_sesion_es_401(client):
    assert client.get(f'{URL}/estado').status_code == 401


@pytest.mark.parametrize('rol, lee, escribe', [
    ('admin', 200, 201), ('director_comercial', 200, 201), ('setter', 200, 403), ('closer', 403, 403),
])
def test_quien_lee_y_quien_escribe(client, como, rol, lee, escribe):
    assert client.get(f'{URL}/flujos', headers=como(rol)).status_code == lee
    assert crear(client, como(rol)).status_code == escribe


def test_el_estado_dice_si_puede_editar(client, como):
    assert client.get(f'{URL}/estado', headers=como('director_comercial')).get_json()['puede_editar'] is True
    estado = client.get(f'{URL}/estado', headers=como('setter')).get_json()
    assert estado['puede_editar'] is False
    assert estado['modo'] == 'apagado'


def test_el_setter_no_publica_ni_borra(client, como):
    flujo_id = crear(client, como('admin'), grafo=f.guia()).get_json()['id']

    for metodo, ruta in [('put', ''), ('post', '/publicar'), ('post', '/pausar'), ('delete', '')]:
        respuesta = getattr(client, metodo)(f'{URL}/flujos/{flujo_id}{ruta}', json={}, headers=como('setter'))
        assert respuesta.status_code == 403
    assert AutFlujo.query.one().estado == AutFlujo.BORRADOR


# --- Flujos -------------------------------------------------------------------------------------

def test_un_flujo_nuevo_trae_un_grafo_inicial_con_sus_errores(client, como):
    respuesta = crear(client, como('director_comercial'), nombre='  Obtener guía  ')

    datos = respuesta.get_json()
    assert datos['nombre'] == 'Obtener guía'
    assert datos['estado'] == 'borrador' and datos['version'] is None and datos['cambios_sin_publicar']
    assert datos['grafo']['inicio'] == 'n1'
    assert any('palabras clave' in e for e in datos['errores'])


def test_sin_nombre_no_se_crea(client, como):
    assert crear(client, como('admin'), nombre='  ').status_code == 400


def test_guardar_publicar_y_volver_a_editar(client, como):
    h = como('director_comercial')
    flujo_id = crear(client, h).get_json()['id']

    guardado = client.put(f'{URL}/flujos/{flujo_id}', json={'grafo': f.guia(), 'nombre': 'Guía v1'}, headers=h).get_json()
    assert guardado['errores'] == [] and guardado['nombre'] == 'Guía v1'

    publicado = client.post(f'{URL}/flujos/{flujo_id}/publicar', headers=h).get_json()
    assert (publicado['estado'], publicado['version'], publicado['cambios_sin_publicar']) == ('activo', 1, False)
    assert publicado['palabras_clave'] == ['OBTENER GUIA']

    otro = f.guia()
    otro['nodos'][0]['contenido'][0]['texto'] = 'Cambio'
    client.put(f'{URL}/flujos/{flujo_id}', json={'grafo': otro}, headers=h)
    assert client.get(f'{URL}/flujos', headers=h).get_json()['flujos'][0]['cambios_sin_publicar'] is True


def test_publicar_con_errores_es_422_con_la_lista(client, como):
    h = como('admin')
    flujo_id = crear(client, h).get_json()['id']

    respuesta = client.post(f'{URL}/flujos/{flujo_id}/publicar', headers=h)

    assert respuesta.status_code == 422
    assert respuesta.get_json()['errores']
    assert AutFlujo.query.one().version_publicada_id is None


def test_pausar_y_activar(client, como):
    h = como('admin')
    flujo_id = crear(client, h, grafo=f.guia()).get_json()['id']
    assert client.post(f'{URL}/flujos/{flujo_id}/activar', headers=h).status_code == 409

    client.post(f'{URL}/flujos/{flujo_id}/publicar', headers=h)
    assert client.post(f'{URL}/flujos/{flujo_id}/pausar', headers=h).get_json()['estado'] == 'pausado'
    assert client.post(f'{URL}/flujos/{flujo_id}/activar', headers=h).get_json()['estado'] == 'activo'


def test_solo_se_borra_lo_que_nunca_se_publico(client, como):
    h = como('admin')
    borrador = crear(client, h).get_json()['id']
    publicado = crear(client, h, grafo=f.guia()).get_json()['id']
    client.post(f'{URL}/flujos/{publicado}/publicar', headers=h)

    assert client.delete(f'{URL}/flujos/{borrador}', headers=h).status_code == 204
    assert client.delete(f'{URL}/flujos/{publicado}', headers=h).status_code == 409
    assert client.get(f'{URL}/flujos/{borrador}', headers=h).status_code == 404


@pytest.mark.parametrize('grafo', [['no', 'es', 'un', 'objeto'], {'nodos': [{'id': str(i)} for i in range(301)]}])
def test_un_grafo_invalido_o_enorme_se_rechaza(client, como, grafo):
    h = como('admin')
    flujo_id = crear(client, h).get_json()['id']

    assert client.put(f'{URL}/flujos/{flujo_id}', json={'grafo': grafo}, headers=h).status_code == 400


# --- Conversaciones -----------------------------------------------------------------------------

def test_las_conversaciones_muestran_el_historial(client, como, db):
    flujo = AutFlujo(nombre='Guía', grafo=f.guia())
    db.session.add(flujo)
    db.session.commit()
    ahora = datetime(2026, 10, 15, 13, 0)
    servicio.publicar(flujo, momento=ahora - timedelta(minutes=1))
    db.session.add(InstagramWebhookEvento(tipos='messages', payload=f.dm('OBTENER GUIA', 'm1', 1792069200000),
                                          recibido_en=ahora))
    db.session.commit()
    servicio.procesar_pendientes(ahora, TransporteSimulado())
    IgContacto.query.one().username = 'ana.med'
    db.session.commit()

    lista = client.get(f'{URL}/conversaciones', headers=como('setter')).get_json()['conversaciones']
    assert len(lista) == 1
    assert (lista[0]['username'], lista[0]['mensajes'], lista[0]['ultimo_de']) == ('ana.med', 2, IgMensaje.MOTOR)
    assert (lista[0]['flujo'], lista[0]['paso']['numero'], lista[0]['paso']['id']) == ('Guía', 1, 'perfil')
    assert client.get(f'{URL}/conversaciones', query_string={'buscar': 'otra'}, headers=como('setter')).get_json() \
        == {'conversaciones': [], 'mediana_respuesta': None, 'medianas_setters': []}

    detalle = client.get(f'{URL}/conversaciones/{lista[0]["id"]}', headers=como('setter')).get_json()
    assert [m['texto'] for m in detalle['mensajes']] == ['OBTENER GUIA', '¿Cuál es tu perfil?']
    assert detalle['mensajes'][1]['botones'] == ['Médico graduado', 'Estudiante']
    assert detalle['ejecucion']['flujo'] == 'Guía' and detalle['ejecucion']['estado'] == 'esperando_respuesta'
    assert [e['flujo'] for e in detalle['recorrido']] == ['Guía']


def test_una_conversacion_que_no_existe_es_404(client, como):
    assert client.get(f'{URL}/conversaciones/999', headers=como('admin')).status_code == 404
