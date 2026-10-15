"""Lógica pura del motor: validar el grafo, reconocer palabras clave, armar mensajes y leer eventos."""
import pytest

from app.automatizaciones.nucleo import eventos as ev
from app.automatizaciones.nucleo import grafo as g
from app.automatizaciones.nucleo import mensajes
from tests.automatizaciones.flujos import CUENTA, LEAD, comentario, dm, eco, guia, lectura, postback

# --- Validación ---------------------------------------------------------------------------------

def test_el_flujo_de_la_guia_es_valido():
    assert g.validar(guia()) == []


def _nodo(grafo, nid):
    return g.nodos_por_id(grafo)[nid]


def test_sin_disparadores_ni_inicio_no_se_publica():
    errores = g.validar(guia(disparadores=[], inicio='no-existe'))

    assert any('disparadores' in e for e in errores)
    assert any('empieza' in e for e in errores)


def test_limites_de_botones_de_instagram():
    grafo = guia()
    perfil = _nodo(grafo, 'perfil')
    perfil['botones'] = [{'id': f'b{i}', 'titulo': f'Opción {i}'} for i in range(4)]
    assert any('hasta 3 botones' in e for e in g.validar(grafo))

    perfil['estilo_botones'] = 'respuestas_rapidas'
    assert not any('botones con ese estilo' in e for e in g.validar(grafo))

    perfil['botones'] = [{'id': 'b1', 'titulo': 'Un título larguísimo de más'}]
    assert any('supera los 20' in e for e in g.validar(grafo))


def test_los_botones_van_debajo_de_un_texto():
    grafo = guia()
    _nodo(grafo, 'perfil')['contenido'].append({'tipo': 'imagen', 'url': 'https://x.com/a.png'})

    assert any('debajo de un texto' in e for e in g.validar(grafo))


def test_un_mensaje_no_espera_botones_y_texto_a_la_vez():
    grafo = guia()
    _nodo(grafo, 'perfil')['espera'] = {'guardar_en': 'perfil'}

    assert any('no las dos cosas' in e for e in g.validar(grafo))


@pytest.mark.parametrize('minutos', [0, -5, 24 * 60 + 1, 'diez', True, None])
def test_las_esperas_caben_en_la_ventana_de_24_horas(minutos):
    grafo = guia()
    _nodo(grafo, 'perfil')['sin_respuesta'] = {'minutos': minutos}

    assert any('1 a 1440 minutos' in e for e in g.validar(grafo))


def test_una_conexion_desde_una_salida_que_no_existe_o_repetida():
    grafo = guia()
    grafo['conexiones'].append({'id': 'x1', 'desde': 'genial', 'salida': 'medico', 'hacia': 'fin'})
    grafo['conexiones'].append({'id': 'x2', 'desde': 'perfil', 'salida': 'medico', 'hacia': 'fin'})
    grafo['conexiones'].append({'id': 'x3', 'desde': 'perfil', 'salida': 'estudiante', 'hacia': 'fantasma'})
    errores = g.validar(grafo)

    assert any('no tiene la salida «medico»' in e for e in errores)
    assert any('conectada dos veces' in e for e in errores)
    assert any('nodos que no existen' in e for e in errores)


def test_por_comentario_arranca_con_un_mensaje_de_un_solo_contenido():
    grafo = guia(disparadores=[{'id': 'd1', 'canal': 'comentario', 'palabras': ['GUIA']}], inicio='general')

    assert any('respuesta privada' in e for e in g.validar(grafo))
    grafo['inicio'] = 'perfil'
    assert g.validar(grafo) == []


# --- Palabras clave -----------------------------------------------------------------------------

@pytest.mark.parametrize('texto, esperado', [
    ('OBTENER GUIA', True), ('obtener guía', True), ('  Obtener   Guía!! ', True),
    ('obtener la guia', False), ('quiero obtener guia', False), ('', False), (None, False),
])
def test_coincidencia_exacta_ignora_mayusculas_acentos_y_signos(texto, esperado):
    assert g.coincide({'canal': 'dm', 'palabras': ['Obtener Guía']}, texto, 'dm') is esperado


@pytest.mark.parametrize('texto, esperado', [
    ('quiero la guia por favor', True), ('GUIA', True), ('guiame', False), ('la guía.', True),
])
def test_coincidencia_contiene_respeta_palabras_completas(texto, esperado):
    assert g.coincide({'canal': 'dm', 'palabras': ['guia'], 'coincidencia': 'contiene'}, texto, 'dm') is esperado


def test_el_canal_y_la_publicacion_tienen_que_coincidir():
    d = {'canal': 'comentario', 'palabras': ['guia'], 'publicacion_id': '111'}

    assert g.coincide(d, 'guia', 'comentario', '111')
    assert not g.coincide(d, 'guia', 'comentario', '222')
    assert not g.coincide(d, 'guia', 'dm')


# --- Mensajes ------------------------------------------------------------------------------------

def test_botones_como_plantilla_con_payload_propio():
    [cuerpo] = mensajes.construir(_nodo(guia(), 'perfil'), {}, version_id=7)

    plantilla = cuerpo['attachment']['payload']
    assert plantilla['template_type'] == 'button'
    assert plantilla['text'] == '¿Cuál es tu perfil?'
    assert plantilla['buttons'][0] == {'type': 'postback', 'title': 'Médico graduado', 'payload': 'AUT:7:perfil:medico'}


def test_respuestas_rapidas_y_adjuntos():
    nodo = {**_nodo(guia(), 'perfil'), 'estilo_botones': 'respuestas_rapidas'}
    [cuerpo] = mensajes.construir(nodo, {}, version_id=1)
    assert cuerpo['quick_replies'][1] == {'content_type': 'text', 'title': 'Estudiante', 'payload': 'AUT:1:perfil:estudiante'}

    texto, imagen = mensajes.construir(_nodo(guia(), 'general'), {}, version_id=1)
    assert texto == {'text': 'Recursos generales'}
    assert imagen == {'attachment': {'type': 'image', 'payload': {'url': 'https://x.com/guia.png'}}}


def test_variables_en_el_texto_y_las_que_faltan_quedan_vacias():
    assert mensajes.completar('Hola {{nombre}}, {{ examen }}{{nada}}!', {'nombre': 'Ana', 'examen': 'ENARM'}) == 'Hola Ana, ENARM!'


def test_payloads_propios_y_ajenos():
    assert mensajes.leer_payload('AUT:12:perfil:medico') == (12, 'perfil', 'medico')
    assert mensajes.leer_payload('ACT::007eb259d50abca2a4b9484804837078') is None  # ManyChat
    assert mensajes.leer_payload(None) is None


# --- Lectura de eventos -------------------------------------------------------------------------

def test_lee_dm_boton_respuesta_rapida_eco_y_comentario():
    [mensaje] = ev.leer(dm('ENARM', 'm1', 1792027531751))
    assert (mensaje.tipo, mensaje.igsid, mensaje.texto, mensaje.mid) == (ev.MENSAJE, LEAD, 'ENARM', 'm1')
    assert mensaje.momento.year == 2026

    [boton] = ev.leer(postback('Médico graduado', 'AUT:1:perfil:medico', 'm2', 1792027514802))
    assert (boton.tipo, boton.payload) == (ev.BOTON, 'AUT:1:perfil:medico')

    [rapida] = ev.leer(dm('Estudiante', 'm3', 1792027514802, quick_reply='AUT:1:perfil:estudiante'))
    assert rapida.payload == 'AUT:1:perfil:estudiante'

    [salida] = ev.leer(eco('Te paso el link', 'm4', 1792027514802))
    assert (salida.tipo, salida.igsid) == (ev.ECO, LEAD)

    [com] = ev.leer(comentario('GUIA', 'c1', 1792027514802))
    assert (com.tipo, com.comentario_id, com.publicacion_id, com.username) == (ev.COMENTARIO, 'c1', '1790000', 'ana')
    assert com.momento.year == 2026


def test_descarta_lecturas_borrados_y_lo_que_hace_la_propia_cuenta():
    borrado = dm('x', 'm9', 1792027514802)
    borrado['entry'][0]['messaging'][0]['message']['is_deleted'] = True

    assert ev.leer(lectura(1792027514802)) == []
    assert ev.leer(borrado) == []
    assert ev.leer(comentario('respuesta', 'c2', 1792027514802, lead=CUENTA)) == []
