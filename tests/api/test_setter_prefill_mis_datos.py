"""El reporte del día del setter arranca con los números de "Mis datos" de ese día.

Antes el autocompletado contaba con su propia regla (01/10/2026, septiembre en producción):
"Entrantes" eran las interacciones del día de todo el equipo —5.503 en el mes para Elias y para
Paula, contra 692 y 480 leads suyos— y "Agendas", todas sus citas creadas ese día sin depurar y
con el marcador de cualificación. El setter veía dos verdades del mismo día.
"""
import itertools
from datetime import date, datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, LeadAnswer, ManychatLead
from app.services import comercial_analitica as ca

HOY = '2026-10-01 18:00:00'
DIA = date(2026, 10, 1)
PREFILL = '/api/public/setter-report/prefill'

_n = itertools.count(1)


@pytest.fixture()
def equipo(make_user):
    return {
        'marlon': make_user(role='closer', username='Marlon'),
        'elias': make_user(role='setter', username='Elias'),
        'paula': make_user(role='setter', username='Paula'),
    }


def lead(db, setter, *respuestas, cuando=datetime(2026, 10, 1, 12, 0)):
    n = next(_n)
    l = ManychatLead(manychat_id=f'mc-{n}', name=f'Lead {n}', ig=f'lead{n}', setter=setter,
                     created_at=cuando)
    db.session.add(l)
    db.session.commit()
    for valor in respuestas:
        db.session.add(LeadAnswer(lead_id=l.id, qualification=valor, created_at=cuando))
    db.session.commit()
    return l


def agenda(db, closer, setter, *, creada, reunion, cliente=None, result='Confirmado'):
    cliente = cliente or Client(full_name=f'Cliente {next(_n)}', email=f'c{next(_n)}@test.local')
    db.session.add(cliente)
    db.session.commit()
    a = Appointment(closer_id=closer.id, client_id=cliente.id, setter_id=setter.id, result=result,
                    start_time=reunion, created_at=creada, origin='Setter')
    db.session.add(a)
    db.session.commit()
    return a


@pytest.fixture()
def dia_de_elias(db, equipo):
    elias, marlon = equipo['elias'], equipo['marlon']
    # Leads de Elias que entraron hoy: dos contestaron y califican, uno contestó y no, uno no
    # contestó. Las interacciones son cinco: "Entrantes" cuenta personas.
    lead(db, 'Elias', 'true', 'null')
    lead(db, 'Elias', 'true')
    lead(db, 'Elias', 'false')
    lead(db, 'Elias', 'null')
    # Lo que antes se colaba: un lead sin repartir, uno de Paula y uno de Elias de ayer.
    lead(db, None, 'true')
    lead(db, 'Paula', 'true')
    lead(db, 'Elias', 'true', cuando=datetime(2026, 9, 30, 12, 0))

    # Agendas que generó hoy: la misma persona dos veces (reagendó) es UNA.
    reagendo = Client(full_name='Reagendó', email='reagendo@test.local')
    agenda(db, marlon, elias, cliente=reagendo, creada=datetime(2026, 10, 1, 10, 0),
           reunion=datetime(2026, 10, 3, 15, 0))
    agenda(db, marlon, elias, cliente=reagendo, creada=datetime(2026, 10, 1, 11, 0),
           reunion=datetime(2026, 10, 4, 15, 0))
    agenda(db, marlon, elias, creada=datetime(2026, 10, 1, 13, 0), reunion=datetime(2026, 10, 2, 15, 0))
    # No son agendas generadas hoy: el marcador de cualificar y una reservada ayer para hoy.
    agenda(db, marlon, elias, creada=datetime(2026, 10, 1, 14, 0), reunion=datetime(2026, 10, 1, 14, 0),
           result='Cualificado')
    agenda(db, marlon, elias, creada=datetime(2026, 9, 30, 9, 0), reunion=datetime(2026, 10, 1, 15, 0))


@freeze_time(HOY)
def test_el_reporte_del_dia_arranca_con_los_numeros_de_mis_datos(client, equipo, dia_de_elias,
                                                                 auth_headers):
    elias = equipo['elias']
    datos = client.get(PREFILL, headers=auth_headers(elias),
                       query_string={'setter_id': elias.id, 'date': DIA.isoformat()}).get_json()
    mis_datos = ca.bloque_setters(DIA, DIA, setter_id=elias.id, setter_nombre='Elias')

    assert {k: datos[k] for k in ('inbox_entrantes', 'funnel_qualification', 'not_lead', 'funnel_agenda')}         == {'inbox_entrantes': 4, 'funnel_qualification': 3, 'not_lead': 1, 'funnel_agenda': 2}
    assert datos['inbox_entrantes'] == mis_datos['leads']
    assert datos['funnel_qualification'] == mis_datos['respondieron']
    # El formulario deriva "Leads netos" = Cualificación − No Lead: son los cualificados.
    assert datos['funnel_qualification'] - datos['not_lead'] == mis_datos['cualificados']
    assert datos['funnel_agenda'] == mis_datos['generadas']


@freeze_time(HOY)
def test_el_dia_del_reporte_es_el_dia_de_mis_datos(client, db, equipo, dia_de_elias, auth_headers):
    """Otra fecha, otros números: los de "Mis datos" con ese día como rango."""
    elias = equipo['elias']
    ayer = date(2026, 9, 30)
    lead(db, None, 'true', 'null', cuando=datetime(2026, 9, 30, 9, 0))  # sin repartir: de nadie
    datos = client.get(PREFILL, headers=auth_headers(elias),
                       query_string={'setter_id': elias.id, 'date': ayer.isoformat()}).get_json()
    mis_datos = ca.bloque_setters(ayer, ayer, setter_id=elias.id, setter_nombre='Elias')

    assert (datos['inbox_entrantes'], datos['funnel_agenda']) == (1, 1)
    assert (datos['inbox_entrantes'], datos['funnel_agenda']) == (mis_datos['leads'], mis_datos['generadas'])


@freeze_time(HOY)
def test_un_setter_no_autocompleta_con_los_numeros_de_otro(client, equipo, dia_de_elias, auth_headers):
    respuesta = client.get(PREFILL, headers=auth_headers(equipo['paula']),
                           query_string={'setter_id': equipo['elias'].id, 'date': DIA.isoformat()})

    assert respuesta.status_code == 403
