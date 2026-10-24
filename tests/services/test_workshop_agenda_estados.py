"""Qué pasó con las personas que agendaron en un taller, por estado del libro de agendas.

Parte de las mismas agendas que cuenta el embudo (ventana del taller, una persona = una) y las reparte
con `derivar_estado`, el mismo criterio del libro del closer.
"""
from datetime import date, datetime

import pytest

from app.models import Appointment, Client, FinancialAgenda, WorkshopEvent
from app.services import agenda_contacto_service, workshop_agenda_estados_service as servicio

DIA = date(2026, 9, 19)
SIGUIENTE = date(2026, 9, 26)          # cierra la ventana del taller del 19: del 19 al 25
ALTA = datetime(2026, 9, 20, 15, 0)    # creada dentro de la ventana
AHORA = datetime(2026, 9, 30, 12, 0)   # todas las llamadas de abajo ya pasaron
FUTURA = datetime(2026, 10, 5, 15, 0)


@pytest.fixture()
def taller(db):
    for dia in (DIA, SIGUIENTE):
        db.session.add(WorkshopEvent(date=dia, name=f'WEBINAR {dia}'))
    db.session.commit()
    return WorkshopEvent.query.filter_by(date=DIA).one()


def agenda(db, nombre, estado='Pendiente', cita=ALTA, nombre_fuente='workshop'):
    fila = FinancialAgenda(nombre=nombre_fuente, estado=estado, date=cita, created_at=ALTA,
                           raw_data={'fuente': nombre_fuente}, closer='Sin asignar')
    db.session.add(fila)
    agenda_contacto_service.dar_persona(fila, nombre=nombre, mail=f'{nombre.lower()}@test.local')
    db.session.commit()
    return fila


def reporta(db, fila, closer, resultado, **campos):
    """El closer reportó la llamada: un Appointment de la persona de la agenda."""
    cliente = Client.query.filter_by(person_uuid=fila.person_uuid).first() or Client(
        full_name=fila.nombre_persona, email=f'{fila.nombre_persona.lower()}@test.local', person_uuid=fila.person_uuid)
    db.session.add(cliente)
    db.session.flush()
    db.session.add(Appointment(closer_id=closer.id, client_id=cliente.id, start_time=fila.date,
                               closer_result=resultado, **campos))
    db.session.commit()


def estados(resultado):
    return {e['key']: e['n'] for e in resultado['estados']}


def grupos(resultado):
    return {g['key']: g['n'] for g in resultado['grupos']}


def test_la_hoja_reparte_a_cada_persona_en_su_estado(db, taller):
    agenda(db, 'Ana', 'Show Up')
    agenda(db, 'Beto', 'No Show')
    agenda(db, 'Carla', 'Cancelada')
    agenda(db, 'Dani', 'Reagendada')
    agenda(db, 'Eli', 'Pendiente')                  # la hora ya pasó y nadie la reportó
    agenda(db, 'Fede', 'Pendiente', cita=FUTURA)    # todavía no ocurre

    r = servicio.estados_del_taller(taller, ahora=AHORA)

    assert r['total'] == 6
    assert estados(r) == {
        'por_confirmar': 1, 'confirmada': 0, 'sin_reportar': 1, 'reportada_sin_resultado': 0, 'show_up': 1,
        'segunda_llamada': 0, 'no_show': 1, 'reagendada': 1, 'cancelada': 1, 'lead_perdido': 0,
        'archivada_sin_reporte': 0, 'descalificada': 0,
    }
    assert grupos(r) == {'asistieron': 1, 'no_asistieron': 1, 'sin_reporte': 1, 'se_cayeron': 2, 'por_ocurrir': 1}


def test_lo_que_reporto_el_closer_manda_sobre_la_hoja(db, taller, make_user):
    closer = make_user(role='closer')
    fila = agenda(db, 'Ana', 'Pendiente')
    reporta(db, fila, closer, 'No Show')

    r = servicio.estados_del_taller(taller, ahora=AHORA)

    assert estados(r)['no_show'] == 1 and estados(r)['sin_reportar'] == 0


def test_una_venta_cargada_en_la_hoja_cuenta_como_asistio(db, taller):
    agenda(db, 'Ana', 'Cierre')

    assert estados(servicio.estados_del_taller(taller, ahora=AHORA))['show_up'] == 1


def test_quien_reprogramo_cuenta_una_vez_con_su_ultima_cita(db, taller):
    primera = agenda(db, 'Ana', 'Reagendada', cita=datetime(2026, 9, 21, 15, 0))
    segunda = agenda(db, 'Ana', 'No Show', cita=datetime(2026, 9, 24, 15, 0))
    assert primera.person_uuid == segunda.person_uuid

    r = servicio.estados_del_taller(taller, ahora=AHORA)

    assert r['total'] == 1 and r['llamadas'] == 2
    assert estados(r)['no_show'] == 1 and estados(r)['reagendada'] == 0


def test_haber_asistido_no_lo_borra_una_cita_posterior(db, taller):
    agenda(db, 'Ana', 'Show Up', cita=datetime(2026, 9, 21, 15, 0))
    agenda(db, 'Ana', 'Cancelada', cita=datetime(2026, 9, 24, 15, 0))

    r = servicio.estados_del_taller(taller, ahora=AHORA)

    assert r['total'] == 1 and estados(r)['show_up'] == 1 and estados(r)['cancelada'] == 0


def test_reparte_por_entrada_y_la_grabacion_no_repite_a_quien_esta_en_el_vivo(db, taller):
    agenda(db, 'Ana', 'Show Up')
    agenda(db, 'Beto', 'No Show')
    agenda(db, 'Beto', 'No Show', nombre_fuente='workshop landing')   # la misma persona, ya contada
    agenda(db, 'Carla', 'Cancelada', nombre_fuente='workshop landing')

    r = servicio.estados_del_taller(taller, ahora=AHORA)

    assert r['total'] == 3
    assert r['por_entrada']['vivo']['total'] == 2
    assert r['por_entrada']['landing']['total'] == 1
    assert estados(r['por_entrada']['landing'])['cancelada'] == 1


def test_no_cuenta_lo_de_otro_taller_ni_las_repetidas_descartadas(db, taller):
    agenda(db, 'Ana', 'Show Up')
    repetida = agenda(db, 'Beto', 'No Show')
    repetida.duplicada_de_id = agenda(db, 'Carla', 'Show Up').id
    db.session.commit()
    otra = agenda(db, 'Dani', 'Show Up')
    otra.created_at = datetime(2026, 9, 28, 15, 0)    # ya es del taller siguiente
    db.session.commit()

    assert servicio.estados_del_taller(taller, ahora=AHORA)['total'] == 2


def test_un_taller_sin_agendas_devuelve_ceros(db, taller):
    r = servicio.estados_del_taller(taller, ahora=AHORA)

    assert r['total'] == 0 and set(grupos(r).values()) == {0}
    assert r['ventana']['abierta'] is False


def test_el_endpoint_responde_con_el_reparto(client, db, taller, make_user, auth_headers):
    agenda(db, 'Ana', 'Show Up')
    director = auth_headers(make_user(role='admin'))

    respuesta = client.get(f'/api/workshop/events/{taller.id}/agendas-estados', headers=director)

    assert respuesta.status_code == 200
    assert respuesta.get_json()['total'] == 1
    assert client.get('/api/workshop/events/9999/agendas-estados', headers=director).status_code == 404
