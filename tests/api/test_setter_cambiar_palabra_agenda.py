"""Cambiar la palabra clave de una agenda completada (Kerwin, 18/10/2026: «debería haber forma de
cambiar la palabra clave si es incorrecta»).

La elección del setter queda en sus agendas (`Appointment.anuncio_id`) y manda sobre ManyChat en
Marketing y en la bandeja: una respuesta nueva en la conversación no alcanzaba, porque Marketing toma la
ÚLTIMA antes de la reunión.
"""
from datetime import datetime

from freezegun import freeze_time

from app.models import Appointment
from tests.api.test_setter_palabras_clave import (  # noqa: F401  (fixtures)
    HOY, URL, agenda, agendas_de_marketing, anuncios, bandeja, cliente, conversacion, equipo,
)


@freeze_time(HOY)
def test_una_completada_por_manychat_se_cambia_y_marketing_la_cuenta_en_el_nuevo(client, db, equipo, anuncios,
                                                                                 auth_headers):
    ana = cliente(db, 'Ana Lopez', ig='ana.lopez')
    # ManyChat la atribuyó a GUIA, también justo antes de la reunión.
    conversacion(db, 'ana.lopez', ad=anuncios['GUIA'], cuando=datetime(2026, 10, 7, 10))
    conversacion(db, 'ana.lopez', ad=anuncios['GUIA'], cuando=datetime(2026, 10, 11, 10))
    cita = agenda(db, equipo, ana)
    assert agendas_de_marketing(anuncios['GUIA']) == 1
    hechas = bandeja(client, equipo['elias'], auth_headers)['completadas']
    assert [(f['id'], f['palabra_clave']) for f in hechas] == [(cita.id, 'GUIA')]

    r = client.post(URL, headers=auth_headers(equipo['elias']),
                    json={'appointment_id': cita.id, 'ad_id': anuncios['PROTOCOLO'].id, 'cambiar': True})

    assert r.status_code == 200, r.get_json()
    assert (agendas_de_marketing(anuncios['GUIA']), agendas_de_marketing(anuncios['PROTOCOLO'])) == (0, 1)
    datos = bandeja(client, equipo['elias'], auth_headers)
    assert [(f['id'], f['palabra_clave'], f['por']) for f in datos['completadas']] == [(cita.id, 'PROTOCOLO', 'setter')]
    assert datos['pendientes'] == []
    assert db.session.get(Appointment, cita.id).keyword == 'PROTOCOLO'


@freeze_time(HOY)
def test_cambiar_no_pide_instagram_ni_deja_cambiar_la_de_otro(client, db, equipo, anuncios, auth_headers):
    sin_ig = cliente(db, 'Sin Instagram', ig=None)
    cita = agenda(db, equipo, sin_ig)
    de_paula = agenda(db, equipo, cliente(db, 'Beto Ruiz', ig='beto'), setter='paula')

    r = client.post(URL, headers=auth_headers(equipo['elias']),
                    json={'appointment_id': cita.id, 'ad_id': anuncios['GUIA'].id, 'cambiar': True})
    assert r.status_code == 200, r.get_json()
    assert agendas_de_marketing(anuncios['GUIA']) == 1
    otro = client.post(URL, headers=auth_headers(equipo['elias']),
                       json={'appointment_id': de_paula.id, 'ad_id': anuncios['GUIA'].id, 'cambiar': True})
    assert otro.status_code == 403


@freeze_time(HOY)
def test_asignar_una_pendiente_tambien_guarda_la_eleccion(client, db, equipo, anuncios, auth_headers):
    ana = cliente(db, 'Ana Lopez', ig='ana.lopez')
    vieja = agenda(db, equipo, ana, creada=datetime(2026, 10, 1, 14), reunion=datetime(2026, 10, 3, 14))
    nueva = agenda(db, equipo, ana)

    r = client.post(URL, headers=auth_headers(equipo['elias']), json={'appointment_id': nueva.id, 'ad_id': anuncios['GUIA'].id})

    assert r.status_code == 200
    assert {db.session.get(Appointment, a.id).anuncio_id for a in (vieja, nueva)} == {anuncios['GUIA'].id}
