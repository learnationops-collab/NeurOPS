"""«Mis agendas»: asignar la palabra clave (23/10/2026, Elias: «no me deja cargar esto»).

Escribir una palabra que no tiene anuncio lo crea y deja la agenda atribuida; con un anuncio de la
lista también. El error tiene que ser siempre uno que se entienda, no un 500.
"""
import itertools
from datetime import datetime

import pytest

from app.models import Ad, Appointment, Client, Conversation, LeadAnswer
from app.models.financial import FinancialAgenda
from app.services import agenda_contacto_service

URL = '/api/setter/palabras-clave'
_n = itertools.count(1)


@pytest.fixture()
def equipo(make_user):
    return {
        'marlon': make_user(role='closer', username='Marlon'),
        'elias': make_user(role='setter', username='Elias', timezone='America/La_Paz'),
    }


def agenda(db, equipo, ig='te_amare2409', instagram='te_amare2409'):
    cli = Client(full_name='Gabriela Gomes Chavez', email=f'lead{next(_n)}@test.local', instagram=ig)
    db.session.add(cli)
    db.session.commit()
    cita = Appointment(closer_id=equipo['marlon'].id, client_id=cli.id, start_time=datetime(2026, 10, 26, 22),
                       created_at=datetime(2026, 10, 22, 14), result='Confirmado', closer_result='Pendiente',
                       origin='Elias', setter_id=equipo['elias'].id)
    db.session.add(cita)
    fila = FinancialAgenda(nombre='Elias', date=cita.start_time, created_at=cita.created_at)
    db.session.add(fila)
    db.session.flush()
    # El contacto de la fila es de su persona; el cliente, de la misma.
    agenda_contacto_service.dar_persona(fila, cli.full_name, cli.email, instagram or None)
    cli.person_uuid = fila.person_uuid
    db.session.commit()
    return cita


def test_palabra_nueva_crea_el_anuncio_y_atribuye(client, db, equipo, auth_headers):
    cita = agenda(db, equipo)
    r = client.post(URL, headers=auth_headers(equipo['elias']),
                    json={'appointment_id': cita.id, 'palabra_clave': 'CURSO GRATUITO'})
    assert r.status_code == 200, r.get_json()
    ad = Ad.query.filter_by(clave='CURSO GRATUITO').one()
    assert r.get_json()['anuncio']['id'] == ad.id
    assert db.session.get(Appointment, cita.id).anuncio_id == ad.id
    conversacion = Conversation.query.filter_by(ig='@te_amare2409').one()
    assert LeadAnswer.query.filter_by(conversation_id=conversacion.id, ad_id=ad.id).count() == 1


def test_anuncio_de_la_lista_atribuye(client, db, equipo, auth_headers):
    cita = agenda(db, equipo)
    ad = Ad(name='GUIA', keyword='GUIA', status='active')
    db.session.add(ad)
    db.session.commit()
    r = client.post(URL, headers=auth_headers(equipo['elias']), json={'appointment_id': cita.id, 'ad_id': ad.id})
    assert r.status_code == 200, r.get_json()


def test_la_fila_sin_instagram_lo_recibe_del_cliente(client, db, equipo, auth_headers):
    cita = agenda(db, equipo, instagram=None)
    r = client.post(URL, headers=auth_headers(equipo['elias']),
                    json={'appointment_id': cita.id, 'palabra_clave': 'CURSO GRATUITO'})
    assert r.status_code == 200, r.get_json()
    fila = FinancialAgenda.query.one()
    assert fila.contacto()['instagram'] == 'te_amare2409'


def test_instagram_corregido_va_a_la_persona_de_la_fila(client, db, equipo, auth_headers):
    cita = agenda(db, equipo)
    r = client.post(URL, headers=auth_headers(equipo['elias']),
                    json={'appointment_id': cita.id, 'palabra_clave': 'CURSO GRATUITO', 'instagram': '@gabi.nueva'})
    assert r.status_code == 200, r.get_json()
    assert r.get_json()['instagram'] == 'gabi.nueva'
    assert FinancialAgenda.query.one().contacto()['instagram'] == 'gabi.nueva'
