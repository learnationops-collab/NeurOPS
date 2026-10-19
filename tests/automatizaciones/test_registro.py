"""El motor escribe lo mismo que el webhook de ManyChat (ManychatLead + LeadAnswer) para los tableros, y la
palabra de una campaña no reinicia la conversación en curso."""
from datetime import timedelta

import pytest

from app.automatizaciones import campanas, servicio
from app.automatizaciones.modelos import AutCampana, AutEjecucion, AutFlujo
from app.models import Ad, ConversationalMessage, LeadAnswer, ManychatLead
from app.services import anuncios_service
from tests.automatizaciones import flujos as f
from tests.automatizaciones.test_motor import T0, Escenario


def texto(t):
    return [{'tipo': 'texto', 'texto': t}]


# El flujo «OBTENER GUÍA» de ManyChat con sus ids del catálogo: 1 Opening, 2 examen, 8 «¿qué quiere mejorar?».
GRAFO = f.guia(
    disparadores=[{'id': 'd1', 'canal': 'dm', 'palabras': ['NO SE USA'], 'coincidencia': 'exacta'}],
    inicio='opening',
    nodos=[
        {'id': 'opening', 'tipo': 'mensaje', 'contenido': texto('¿Médico o estudiante?'),
         'botones': [{'id': 'medico', 'titulo': 'Médico'}, {'id': 'estudiante', 'titulo': 'Estudiante'}],
         'registro': {'mensaje_id': '1', 'etapa': 1}},
        {'id': 'examen', 'tipo': 'mensaje', 'contenido': texto('¿Qué examen preparás?'),
         'espera': {'guardar_en': 'examen'}, 'registro': {'mensaje_id': '2', 'califica': True, 'etapa': 2}},
        {'id': 'mejorar', 'tipo': 'mensaje', 'contenido': texto('¿Qué querés mejorar?'),
         'espera': {'guardar_en': 'mejorar'}, 'registro': {'mensaje_id': '8'}},
        {'id': 'gracias', 'tipo': 'mensaje', 'contenido': texto('Gracias')},
    ],
    conexiones=[
        {'id': 'c1', 'desde': 'opening', 'salida': 'medico', 'hacia': 'examen'},
        {'id': 'c2', 'desde': 'opening', 'salida': 'estudiante', 'hacia': 'mejorar'},
        {'id': 'c3', 'desde': 'examen', 'salida': 'respuesta', 'hacia': 'gracias'},
    ])


@pytest.fixture()
def guia(db):
    db.session.add(ConversationalMessage(message_id='8', title='¿Qué quiere mejorar?', rama='descalificados'))
    flujo = AutFlujo(nombre='Guía', grafo=GRAFO)
    db.session.add(flujo)
    db.session.commit()
    assert servicio.publicar(flujo, momento=T0 - timedelta(days=60)) == []
    return flujo


@pytest.fixture()
def campana(db):
    def _crear(palabras, flujo, nombre='Guía octubre'):
        nueva = campanas.guardar(AutCampana(), {'nombre': nombre, 'palabras': palabras,
                                                'desde': T0 - timedelta(days=1), 'flujo_id': flujo.id})
        db.session.add(nueva)
        db.session.commit()
        return nueva
    return _crear


@pytest.fixture()
def lead(db):
    return Escenario()


def filas():
    return LeadAnswer.query.order_by(LeadAnswer.id).all()


def boton(flujo, nodo, boton_id):
    return f'AUT:{flujo.version_publicada_id}:{nodo}:{boton_id}'


# --- Lo que queda para los tableros -------------------------------------------------------------

def test_la_entrada_y_el_opening_son_una_fila_con_la_palabra_y_su_anuncio(guia, campana, lead):
    campana(['GUIA'], guia)

    lead.escribe('Guía')

    persona = ManychatLead.query.one()
    assert (persona.manychat_id, persona.last_stage) == (f'ig:{f.LEAD}', 1)
    [fila] = filas()
    anuncio = Ad.query.filter_by(clave='GUIA').one()  # la palabra nueva crea su anuncio, como el webhook
    assert (fila.keyword, fila.ad_id, fila.id_option_send, fila.id_option, fila.qualification) == \
        ('GUIA', anuncio.id, '1', '0', 'null')
    assert fila.created_at == T0


def test_la_etapa_sube_cuando_responde_como_en_manychat(db, campana, lead):
    grafo = f.guia(**{**GRAFO, 'nodos': [
        {**GRAFO['nodos'][0], 'registro': {'mensaje_id': '1', 'etapa': 0, 'etapa_respuesta': 1}},
        {**GRAFO['nodos'][1], 'registro': {'mensaje_id': '4', 'etapa_respuesta': 2}},
        *GRAFO['nodos'][2:]]})
    flujo = AutFlujo(nombre='Etapas', grafo=grafo)
    db.session.add(flujo)
    db.session.commit()
    assert servicio.publicar(flujo, momento=T0 - timedelta(days=60)) == []
    campana(['GUIA PERU'], flujo)

    lead.escribe('GUIA PERU')
    assert ManychatLead.query.one().last_stage == 0  # recibió la tarjeta
    lead.toca(boton(flujo, 'opening', 'medico'), minutos=1)
    assert ManychatLead.query.one().last_stage == 1  # eligió perfil
    lead.escribe('ENARM', minutos=1)
    assert ManychatLead.query.one().last_stage == 2  # respondió el examen


def test_responder_marca_el_mensaje_y_el_siguiente_registra_su_envio_y_su_calificacion(guia, campana, lead):
    campana(['GUIA'], guia)
    lead.escribe('GUIA')
    lead.toca(boton(guia, 'opening', 'medico'), 'Médico', minutos=1)
    lead.escribe('ENARM', minutos=2)

    opening, examen = filas()
    assert (opening.id_option_send, opening.id_option) == ('1', '1')
    assert (examen.keyword, examen.id_option_send, examen.id_option, examen.qualification) == ('GUIA', '2', '2', 'true')
    assert ManychatLead.query.one().last_stage == 2


def test_sin_calificacion_la_toma_de_la_rama_del_mensaje(guia, campana, lead):
    campana(['GUIA'], guia)
    lead.escribe('GUIA')
    lead.toca(boton(guia, 'opening', 'estudiante'), 'Estudiante', minutos=1)

    mejorar = filas()[-1]
    assert (mejorar.id_option_send, mejorar.qualification, mejorar.calificacion_por_rama) == ('8', 'false', True)


def test_la_accion_califica_manda(campana, lead, db):
    grafo = f.guia(inicio='a', conexiones=[{'id': 'c', 'desde': 'a', 'salida': 'siguiente', 'hacia': 'b'}],
                   nodos=[{'id': 'a', 'tipo': 'mensaje', 'contenido': texto('Hola'), 'registro': {'mensaje_id': '1'}},
                          {'id': 'b', 'tipo': 'accion', 'acciones': [{'tipo': 'califica', 'valor': False}]}])
    flujo = AutFlujo(nombre='x', grafo=grafo)
    db.session.add(flujo)
    db.session.commit()
    servicio.publicar(flujo, momento=T0 - timedelta(days=1))
    campana(['HOLA'], flujo)

    lead.escribe('HOLA')

    assert [(r.id_option_send, r.qualification) for r in filas()] == [('1', 'false')]


def test_un_flujo_sin_campana_no_escribe_en_los_tableros(lead, db):
    flujo = AutFlujo(nombre='Prueba', grafo=f.guia())  # disparador propio «OBTENER GUIA»
    db.session.add(flujo)
    db.session.commit()
    servicio.publicar(flujo, momento=T0 - timedelta(days=1))

    lead.escribe('OBTENER GUIA')

    assert lead.textos()  # el flujo corrió
    assert ManychatLead.query.count() == 0 and LeadAnswer.query.count() == 0


def test_rendimiento_de_marketing_lo_cuenta_como_un_entrante_calificado(guia, campana, lead):
    campana(['GUIA'], guia)
    lead.escribe('GUIA')
    lead.toca(boton(guia, 'opening', 'medico'), 'Médico', minutos=1)

    tablero = anuncios_service.tablero(T0.date(), T0.date())
    fila = next(r for r in tablero['filas'] if r['clave'] == 'GUIA')
    assert (fila['entrantes'], fila['calificados']) == (1, 1)


# --- La palabra no reinicia la conversación ----------------------------------------------------------

def test_la_palabra_como_respuesta_libre_no_reinicia(guia, campana, lead):
    campana(['GUIA'], guia)
    campana(['EXAMEN'], guia, nombre='Examen')
    lead.escribe('GUIA')
    lead.toca(boton(guia, 'opening', 'medico'), 'Médico', minutos=1)

    lead.escribe('Examen', minutos=2)  # contesta «¿qué examen preparás?»

    assert lead.textos()[-1] == 'Gracias'
    assert AutEjecucion.query.count() == 1
    ultima = filas()[-1]
    assert (ultima.id_option, ultima.keyword) == ('2', 'GUIA')


def test_repetir_la_palabra_de_su_campana_no_reinicia(guia, campana, lead):
    campana(['GUIA'], guia)
    lead.escribe('GUIA')
    lead.escribe('guia', minutos=1)

    assert lead.textos() == ['¿Médico o estudiante?']
    assert AutEjecucion.query.count() == 1
    assert len(filas()) == 1


def test_la_palabra_de_otra_campana_es_una_entrada_nueva(guia, campana, lead):
    campana(['GUIA'], guia)
    otra = campana(['PDF'], guia, nombre='PDF')
    lead.escribe('GUIA')

    lead.escribe('PDF', minutos=1)  # el flujo esperaba botones: es otra entrada

    assert lead.ejecucion().campana_id == otra.id
    assert [r.keyword for r in filas()] == ['GUIA', 'PDF']
