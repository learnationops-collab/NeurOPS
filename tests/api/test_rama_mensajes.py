"""La calificación que deja la rama del flujo cuando ManyChat no la manda (Kerwin, 18/10/2026).

Después del Opening, a los calificados ManyChat les manda «¿Qué examen prepara?» con cualificacion = sí;
a los demás, «¿Qué quiere mejorar?» sin calificación: quedaban «Sin dato». Ese mensaje es de la rama de
los descalificados en el catálogo de Conversaciones, y recibirlo deja a la persona descalificada si
ManyChat no mandó ningún sí o no. Lo que manda ManyChat después, o la corrección a mano, manda.
"""
import pytest

from app.models import ConversationalMessage, LeadAnswer, ManychatLead
from app.services import anuncios_service

WEBHOOK = '/api/manychat-webhook'
TOKEN = 'token-de-manychat-de-prueba-largo-1234'
MENSAJES = '/api/conversational/messages'


@pytest.fixture(autouse=True)
def token_configurado(monkeypatch):
    monkeypatch.setenv('MANYCHAT_WEBHOOK_TOKEN', TOKEN)


@pytest.fixture()
def catalogo(db):
    mensajes = {
        'opening': ConversationalMessage(message_id='1', title='Opening: ¿médico o estudiante?', category='opening'),
        'examen': ConversationalMessage(message_id='4', title='¿Qué examen prepara?', category='cualificacion'),
        'mejorar': ConversationalMessage(message_id='11', title='¿Qué quiere mejorar?', category='dolor',
                                         rama='descalificados'),
    }
    db.session.add_all(mensajes.values())
    db.session.commit()
    return mensajes


def enviar(client, **cuerpo):
    return client.post(WEBHOOK, json={'keyword': 'Obtener Guia', **cuerpo}, headers={'X-ManyChat-Token': TOKEN})


def flujo_de_raissa(client, manychat_id='716'):
    """Los tres webhooks de Raissa del 18/10: inicio, respuesta al Opening y envío de «¿Qué quiere mejorar?»."""
    enviar(client, manychat_id=manychat_id, lead_ig='raissapoli_manzanedo', cualificacion='')
    enviar(client, manychat_id=manychat_id, id_option_send='1', id_option='0', cualificacion='')
    enviar(client, manychat_id=manychat_id, id_option_send='0', id_option='1', cualificacion='')
    enviar(client, manychat_id=manychat_id, id_option_send='11', id_option='0', cualificacion='')
    return ManychatLead.query.filter_by(manychat_id=manychat_id).one()


def calificacion_de(lead):
    """La que cuentan Marketing y el resto: la última sí o no de sus webhooks."""
    return next((r.qualification for r in LeadAnswer.query.filter_by(lead_id=lead.id)
                 .order_by(LeadAnswer.created_at.desc(), LeadAnswer.id.desc())
                 if r.qualification in ('true', 'false')), None)


def test_recibir_que_quiere_mejorar_sin_dato_de_manychat_descalifica(client, db, catalogo):
    lead = flujo_de_raissa(client)

    envio = LeadAnswer.query.filter_by(lead_id=lead.id, id_option_send='11').one()
    assert (envio.qualification, envio.calificacion_por_rama) == ('false', True)
    assert calificacion_de(lead) == 'false'


def test_si_manychat_ya_mando_un_si_la_rama_no_lo_pisa(client, db, catalogo):
    enviar(client, manychat_id='9', id_option_send='0', id_option='1', cualificacion='yes')
    enviar(client, manychat_id='9', id_option_send='11', id_option='0', cualificacion='')

    lead = ManychatLead.query.filter_by(manychat_id='9').one()
    assert calificacion_de(lead) == 'true'
    assert not LeadAnswer.query.filter_by(calificacion_por_rama=True).count()


def test_lo_que_manda_manychat_despues_vale_mas_que_lo_deducido(client, db, catalogo):
    lead = flujo_de_raissa(client)
    # Le mandan «¿Qué examen prepara?» y en la respuesta ManyChat manda cualificacion = sí.
    enviar(client, manychat_id='716', id_option_send='4', id_option='0', cualificacion='')
    enviar(client, manychat_id='716', id_option_send='0', id_option='4', cualificacion='yes')

    assert calificacion_de(lead) == 'true'


def test_un_mensaje_sin_rama_no_califica(client, db, catalogo):
    enviar(client, manychat_id='5', id_option_send='4', id_option='0', cualificacion='')

    assert LeadAnswer.query.one().qualification == 'null'


def test_cambiar_la_rama_en_el_catalogo_recalcula_para_atras(client, db, catalogo, make_user, auth_headers):
    lead = flujo_de_raissa(client)
    cabeceras = auth_headers(make_user(role='director_marketing'))
    mejorar = catalogo['mejorar']

    sin_rama = client.put(f'{MENSAJES}/{mejorar.id}', json={'rama': None}, headers=cabeceras)
    assert sin_rama.status_code == 200 and sin_rama.get_json()['message']['rama'] is None
    assert calificacion_de(lead) is None

    client.put(f'{MENSAJES}/{mejorar.id}', json={'rama': 'descalificados'}, headers=cabeceras)
    assert calificacion_de(lead) == 'false'
    assert client.put(f'{MENSAJES}/{mejorar.id}', json={'rama': 'otra'}, headers=cabeceras).status_code == 400
    assert [m['rama'] for m in client.get(MENSAJES, headers=cabeceras).get_json() if m['message_id'] == '11'] \
        == ['descalificados']


def test_la_correccion_a_mano_manda_y_deja_de_ser_deducida(client, db, catalogo, make_user, auth_headers):
    lead = flujo_de_raissa(client)
    cabeceras = auth_headers(make_user(role='director_marketing'))

    client.put(f'/api/manychat-webhook/lead/{lead.id}/calificacion', json={'estado': 'calificado'}, headers=cabeceras)
    # Quitar la rama ya no toca lo elegido a mano.
    client.put(f"{MENSAJES}/{catalogo['mejorar'].id}", json={'rama': None}, headers=cabeceras)

    assert calificacion_de(lead) == 'true'


def test_marketing_cuenta_a_raissa_como_descalificada(client, db, catalogo):
    flujo_de_raissa(client)

    hoy = LeadAnswer.query.first().created_at.date()
    [fila] = anuncios_service.tablero(hoy, hoy)['filas']
    assert (fila['entrantes'], fila['calificados'], fila['descalificados']) == (1, 0, 1)
