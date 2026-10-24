"""La calificación de un lead con la descalificación posterior (Marketing, 23/10/2026).

ManyChat califica a quien dice ser médico; si después el closer lo descalifica, deja de contar como
calificado. Lo que se prueba:

  · la última calificación de ManyChat es la que vale, y sin ninguna queda pendiente;
  · el closer lo descalifica con «Descalificado» o con «No Lead» (la misma cosa);
  · la descalificación llega al lead por Instagram, y no pasa a una palabra clave en que entró después;
  · el tablero de anuncios y Entrantes dan el mismo resultado (los campos no cambian de nombre);
  · la corrección a mano del setter («Descalificado») ya cuenta y no la pisa nada;
  · la tasa de respuesta de Entrantes cuenta a quien contestó o ya tiene calificación.
"""
import itertools
from datetime import date, datetime

import pytest

from app.models import Appointment, Client, Conversation, LeadAnswer
from app.services import anuncios_service, calificacion_service

_n = itertools.count(1)
LUNES = datetime(2026, 10, 5, 12, 0)
LLAMADA = datetime(2026, 10, 12, 15, 0)
DESDE, HASTA = date(2026, 10, 1), date(2026, 10, 31)
URL = '/api/manychat-webhook/entrantes'


def lead(db, ig, *, clave='GUIA PERU', calificacion='true', contesto=True, entro=LUNES, nombre=None):
    """Una conversación con su primer webhook (y, si `calificacion`, uno más con el valor de ManyChat)."""
    n = next(_n)
    conv = Conversation(external_id=str(1000 + n), name=nombre or f'Persona {n}', ig=ig)
    db.session.add(conv)
    db.session.flush()
    db.session.add(LeadAnswer(conversation_id=conv.id, keyword=clave, qualification='null', created_at=entro,
                              id_option='4' if contesto else '0', id_option_send='1'))
    if calificacion:
        db.session.add(LeadAnswer(conversation_id=conv.id, keyword=clave, qualification=calificacion,
                                  created_at=entro.replace(minute=30), id_option='4' if contesto else '0',
                                  id_option_send='0'))
    db.session.commit()
    return conv


def agenda(db, closer, ig, resultado, *, cuando=LLAMADA):
    cli = Client(full_name=f'Cliente {next(_n)}', email=f'cal{next(_n)}@test.local', instagram=ig)
    db.session.add(cli)
    db.session.flush()
    db.session.add(Appointment(closer_id=closer.id, client_id=cli.id, start_time=cuando, result='Confirmado',
                               closer_result=resultado, origin='Setter', created_at=LUNES))
    db.session.commit()


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='Elias', email='elias@thelearnation.com')


def fila_de_tablero(clave='GUIA PERU'):
    por_clave = anuncios_service._entrantes(datetime.combine(DESDE, datetime.min.time()),
                                            datetime.combine(HASTA, datetime.max.time()),
                                            anuncios_service._clave_de_cada_anuncio())
    return por_clave[clave]


def test_la_ultima_calificacion_de_manychat_es_la_que_vale():
    assert calificacion_service.ultima_de_manychat(['null', 'true', 'null']) == 'true'
    assert calificacion_service.ultima_de_manychat(['true', 'false']) == 'false'
    assert calificacion_service.ultima_de_manychat(['null', None]) is None
    assert calificacion_service.ultima_de_manychat([]) is None


def test_sin_descalificacion_vale_lo_que_dijo_manychat():
    assert calificacion_service.efectiva('true', LUNES) == 'true'
    assert calificacion_service.efectiva('false', LUNES) == 'false'
    assert calificacion_service.efectiva(None, LUNES) is None


def test_la_descalificacion_baja_pero_nunca_califica():
    assert calificacion_service.efectiva('true', LUNES, LLAMADA) == 'false'
    assert calificacion_service.efectiva(None, LUNES, LLAMADA) == 'false'
    assert calificacion_service.efectiva('false', LUNES, LLAMADA) == 'false'


def test_una_palabra_clave_posterior_a_la_llamada_no_se_descalifica():
    despues = datetime(2026, 10, 20, 9, 0)
    assert calificacion_service.efectiva('true', despues, LLAMADA) == 'true'


@pytest.mark.parametrize('resultado', ['Descalificado', 'No Lead', ' descalificado '])
def test_el_closer_descalifica_a_un_lead_calificado_por_manychat(db, closer, resultado):
    conv = lead(db, 'ana.medica')
    agenda(db, closer, 'ana.medica', resultado)

    assert calificacion_service.por_closer() == {conv.id: LLAMADA}
    fila = fila_de_tablero()
    assert (fila['entrantes'], fila['calificados'], fila['descalificados']) == (1, 0, 1)


def test_otros_resultados_del_closer_no_descalifican(db, closer):
    lead(db, 'beto.med')
    agenda(db, closer, 'beto.med', 'Show Up')
    agenda(db, closer, 'beto.med', 'Cancelado')

    assert calificacion_service.por_closer() == {}
    assert fila_de_tablero()['calificados'] == 1


def test_la_descalificacion_llega_por_el_instagram_aunque_cambie_la_arroba(db, closer):
    conv = lead(db, 'carla.sosa')
    agenda(db, closer, '@Carla.Sosa', 'Descalificado')

    assert list(calificacion_service.por_closer()) == [conv.id]


def test_un_lead_sin_agenda_descalificada_sigue_calificado(db, closer):
    lead(db, 'dani.ok')
    lead(db, 'eli.no', calificacion='true')
    agenda(db, closer, 'eli.no', 'Descalificado')

    fila = fila_de_tablero()
    assert (fila['entrantes'], fila['calificados'], fila['descalificados']) == (2, 1, 1)


def test_el_closer_descalifica_tambien_a_quien_estaba_en_conversacion(db, closer):
    lead(db, 'fede.med', calificacion=None)
    agenda(db, closer, 'fede.med', 'No Lead')

    fila = fila_de_tablero()
    assert (fila['calificados'], fila['descalificados'], fila['en_conversacion']) == (0, 1, 0)


def test_la_correccion_a_mano_del_setter_ya_cuenta(db, client, make_user, auth_headers):
    conv = lead(db, 'gabi.med')
    admin = make_user(role='admin')

    r = client.put(f'/api/manychat-webhook/lead/{conv.id}/calificacion', json={'estado': 'descalificado'},
                   headers=auth_headers(admin))

    assert r.status_code == 200
    fila = fila_de_tablero()
    assert (fila['calificados'], fila['descalificados']) == (0, 1)


def test_entrantes_y_el_tablero_dan_lo_mismo_con_los_campos_de_siempre(db, client, make_user, auth_headers, closer):
    lead(db, 'ana.medica')
    lead(db, 'beto.med')
    lead(db, 'sin.respuesta', calificacion=None, contesto=False)
    agenda(db, closer, 'ana.medica', 'Descalificado')

    r = client.get(URL, query_string={'desde': DESDE.isoformat(), 'hasta': HASTA.isoformat()},
                   headers=auth_headers(make_user(role='admin')))

    assert r.status_code == 200
    filas = {f['ig']: f for f in r.get_json()['filas']}
    assert filas['ana.medica']['estado'] == 'descalificado'
    assert filas['ana.medica']['descalificado_por_closer'] is True
    assert filas['beto.med']['estado'] == 'calificado'
    assert filas['beto.med']['descalificado_por_closer'] is False
    tablero = fila_de_tablero()
    por_estado = {e: sum(f['estado'] == e for f in filas.values()) for e in ('calificado', 'descalificado')}
    assert (tablero['calificados'], tablero['descalificados']) == (por_estado['calificado'], por_estado['descalificado'])


def test_respondio_cuenta_a_quien_contesto_o_ya_tiene_calificacion(db, client, make_user, auth_headers):
    lead(db, 'contesto', calificacion=None, contesto=True)
    lead(db, 'calificado', calificacion='true', contesto=False)
    lead(db, 'nada', calificacion=None, contesto=False)

    r = client.get(URL, query_string={'desde': DESDE.isoformat(), 'hasta': HASTA.isoformat()},
                   headers=auth_headers(make_user(role='admin')))

    respondio = {f['ig']: f['respondio'] for f in r.get_json()['filas']}
    assert respondio == {'contesto': True, 'calificado': True, 'nada': False}
