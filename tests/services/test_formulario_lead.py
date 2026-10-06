"""El formulario híbrido: una agenda de Agendas 2.0 se lee de su payload; una vieja, de `form_data`."""
from datetime import datetime

from app.models import Appointment, Client, User
from app.services.formulario_lead import form_data_de


def _payload(respuesta='Mucho', origen='workshop', setter_user_id=None):
    return {'version': 1, 'respuestas': [{'pregunta': '¿Cuánto?', 'respuesta': respuesta}],
            'lead': {'nombre': 'Lucía', 'telefono': '+591 7123', 'email': 'l@x.com', 'instagram': 'lu'},
            'origen': origen, 'setter_user_id': setter_user_id, 'enviado': '2026-10-05T12:00:00'}


def test_una_agenda_nueva_se_lee_de_su_payload(db):
    c = Client(full_name='Lucía', form_data={'examen': 'viejo', 'fuente_form': 'VSL'},
               formulario_payload=_payload('Último'))
    db.session.add(c)
    db.session.flush()
    a = Appointment(client_id=c.id, start_time=datetime(2026, 10, 5, 13), agenda_payload=_payload('De esta agenda'))
    fd = form_data_de(c, a)
    assert fd['¿Cuánto?'] == 'De esta agenda' and fd['fuente_form'] == 'workshop'
    assert fd['mail'] == 'l@x.com' and fd['submitted_at'] == '2026-10-05T12:00:00'
    assert 'examen' not in fd


def test_una_agenda_vieja_usa_el_ultimo_formulario_nuevo_y_si_no_el_form_data(db):
    viejo = {'examen': 'sí', 'fuente_form': 'VSL'}
    a = Appointment(start_time=datetime(2026, 9, 1, 13))  # de n8n: sin agenda_payload
    assert form_data_de(Client(form_data=viejo), a) == viejo
    assert form_data_de(Client(form_data=viejo, formulario_payload=_payload('Último')), a)['¿Cuánto?'] == 'Último'
    assert form_data_de(Client(form_data=None), a) == {}


def test_la_fuente_es_el_setter_si_entro_por_su_link(db):
    s = User(username='paula', email='paula@x.com', role='setter')
    db.session.add(s)
    db.session.flush()
    assert form_data_de(Client(formulario_payload=_payload(setter_user_id=s.id)))['fuente_form'] == 'paula'
