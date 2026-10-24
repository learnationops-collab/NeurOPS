"""Agendas de un taller (`GET /api/workshop/agendas`): la lista detrás del número «N agendas».

La lista tiene que cerrar con el número del taller (una fila por persona, `agendas_exitosas`) y cada
fila es la de Revisar › Agendas: estado, closer, si asistió y si hubo venta.
"""
import itertools
from datetime import date, datetime

import pytest

from app.models import Appointment, Client, FinancialSale, WorkshopEvent
from app.models.financial import FinancialAgenda
from app.services import agenda_contacto_service
from app.services.workshop_metrics_service import calcular_prefill

URL = '/api/workshop/agendas'
DIA = date(2026, 9, 19)
SIGUIENTE = date(2026, 9, 26)
AGENDADA = datetime(2026, 9, 20, 15, 0)
LLAMADA = datetime(2026, 9, 21, 15, 0)
_n = itertools.count(1)


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='Marlon')


@pytest.fixture()
def admin(make_user, auth_headers):
    return auth_headers(make_user(role='admin'))


@pytest.fixture()
def talleres(db):
    ev = WorkshopEvent(date=DIA, name='WEBINAR 19/09')
    otro = WorkshopEvent(date=SIGUIENTE, name='WEBINAR 26/09')
    db.session.add_all([ev, otro])
    db.session.commit()
    return ev, otro


def persona(db, nombre, creada=AGENDADA, llamada=LLAMADA, fuente='Workshop', closer=None, resultado=None,
            con_cita=True):
    """Una agenda del libro de la fuente `fuente` y, si `con_cita`, su cita con el closer."""
    n = next(_n)
    mail = f'lead{n}@test.local'
    fila = FinancialAgenda(nombre=nombre, date=llamada, created_at=creada, raw_data={'fuente': fuente},
                           closer=closer.username if closer else None)
    db.session.add(fila)
    db.session.flush()
    agenda_contacto_service.dar_persona(fila, nombre, mail, f'ig{n}')
    cli = Client(full_name=nombre, email=mail, instagram=f'ig{n}', person_uuid=fila.person_uuid)
    db.session.add(cli)
    db.session.flush()
    cita = None
    if con_cita:
        cita = Appointment(closer_id=closer.id, client_id=cli.id, person_uuid=fila.person_uuid,
                           start_time=llamada, created_at=creada, result='Confirmado',
                           closer_result=resultado or 'Pendiente', origin='Workshop')
        db.session.add(cita)
    db.session.commit()
    return fila, cli, cita


def test_la_lista_cierra_con_el_numero_del_taller(client, db, admin, closer, talleres):
    ev, _ = talleres
    persona(db, 'Ana', closer=closer, resultado='Show up')
    persona(db, 'Beto', closer=closer, resultado='No Show')
    persona(db, 'Carla', closer=closer)
    persona(db, 'Otra fuente', closer=closer, fuente='VSL')

    r = client.get(URL, headers=admin, query_string={'ids': ev.id})

    assert r.status_code == 200
    datos = r.get_json()
    assert datos['total'] == calcular_prefill(DIA)['agendas_exitosas'] == 3
    assert {f['cliente'] for f in datos['filas']} == {'Ana', 'Beto', 'Carla'}
    assert datos['talleres'][0]['agendas'] == 3


def test_cada_fila_trae_lo_de_revisar(client, db, admin, closer, talleres):
    ev, _ = talleres
    persona(db, 'Ana', closer=closer, resultado='Show up')
    persona(db, 'Beto', closer=closer, resultado='No Show')

    filas = {f['cliente']: f for f in client.get(URL, headers=admin, query_string={'ids': ev.id}).get_json()['filas']}

    assert filas['Ana']['asistio'] is True
    assert filas['Ana']['closer'] == 'Marlon'
    assert filas['Ana']['post_call']['key'] == 'seguimiento'  # asistió y no cerró
    assert filas['Beto']['asistio'] is False
    assert filas['Beto']['post_call']['key'] == 'no_show'
    assert filas['Ana']['taller_id'] == ev.id
    assert filas['Ana']['embudo'] == 'vivo'
    assert not filas['Ana'].get('sin_cita')


def test_la_venta_se_ve_en_la_fila(client, db, admin, closer, talleres):
    ev, _ = talleres
    fila, cli, _ = persona(db, 'Ana', closer=closer, resultado='Show up')
    db.session.add(FinancialSale(person_uuid=fila.person_uuid, instagram=f'ig{next(_n) - 1}', tipo_pago='Pago Completo',
                                 monto=500.0, date=datetime(2026, 9, 22, 15), created_at=datetime(2026, 9, 22, 15),
                                 estado='Completada'))
    db.session.commit()

    filas = client.get(URL, headers=admin, query_string={'ids': ev.id}).get_json()['filas']

    assert filas[0]['con_venta'] is True
    assert filas[0]['post_call']['key'] == 'venta'


def test_quien_solo_esta_en_el_libro_igual_aparece(client, db, admin, closer, talleres):
    ev, _ = talleres
    persona(db, 'Sin cita', closer=closer, con_cita=False)

    datos = client.get(URL, headers=admin, query_string={'ids': ev.id}).get_json()

    assert datos['total'] == calcular_prefill(DIA)['agendas_exitosas'] == 1
    assert datos['filas'][0]['sin_cita'] is True
    assert datos['filas'][0]['id'] < 0


def test_una_persona_con_dos_agendas_es_una_fila(client, db, admin, closer, talleres):
    ev, _ = talleres
    fila, cli, _ = persona(db, 'Ana', closer=closer)
    otra = FinancialAgenda(nombre='Ana', date=datetime(2026, 9, 23, 15), created_at=datetime(2026, 9, 21, 9),
                           raw_data={'fuente': 'Workshop'}, person_uuid=fila.person_uuid)
    db.session.add(otra)
    db.session.commit()

    datos = client.get(URL, headers=admin, query_string={'ids': ev.id}).get_json()

    assert datos['total'] == calcular_prefill(DIA)['agendas_exitosas'] == 1


def test_cada_taller_se_queda_con_las_de_su_ventana(client, db, admin, closer, talleres):
    ev, otro = talleres
    persona(db, 'Ana', closer=closer)
    persona(db, 'Dana', closer=closer, creada=datetime(2026, 9, 27, 12), llamada=datetime(2026, 9, 28, 15))

    solo = client.get(URL, headers=admin, query_string={'ids': ev.id}).get_json()
    juntos = client.get(URL, headers=admin, query_string={'ids': f'{ev.id},{otro.id}'}).get_json()

    assert [f['cliente'] for f in solo['filas']] == ['Ana']
    assert juntos['total'] == 2
    assert {f['cliente']: f['taller_id'] for f in juntos['filas']} == {'Ana': ev.id, 'Dana': otro.id}


def test_la_grabacion_se_distingue_del_vivo(client, db, admin, closer, talleres):
    ev, _ = talleres
    persona(db, 'Ana', closer=closer, fuente='Workshop Landing')

    filas = client.get(URL, headers=admin, query_string={'ids': ev.id}).get_json()['filas']

    assert filas[0]['embudo'] == 'landing'


@pytest.mark.parametrize('role', ['closer', 'setter', 'director_comercial'])
def test_solo_lo_ve_quien_ve_workshop(client, make_user, auth_headers, talleres, role):
    ev, _ = talleres

    r = client.get(URL, headers=auth_headers(make_user(role=role)), query_string={'ids': ev.id})

    assert r.status_code == 403


def test_el_director_de_marketing_lo_ve(client, make_user, auth_headers, talleres):
    ev, _ = talleres

    r = client.get(URL, headers=auth_headers(make_user(role='director_marketing')), query_string={'ids': ev.id})

    assert r.status_code == 200


def test_sin_sesion_no_entra(client, talleres):
    assert client.get(URL, query_string={'ids': talleres[0].id}).status_code in (401, 403)


@pytest.mark.parametrize('ids,codigo', [('', 400), ('abc', 400), ('9999', 404)])
def test_pedidos_invalidos(client, admin, ids, codigo):
    assert client.get(URL, headers=admin, query_string={'ids': ids}).status_code == codigo
