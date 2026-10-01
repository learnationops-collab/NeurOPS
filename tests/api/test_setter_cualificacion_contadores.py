"""Los contadores de Cualificación del setter: lo suyo y lo sin asignar, por separado.

La bandeja del setter le muestra sus leads y los que ManyChat todavía no repartió. Los contadores
"Cualificados hoy" y "Sin responder" contaban las dos cosas, y "Sin asignación" volvía a contar
las sin repartir: un lead sin dueño, que podía terminar siendo de otro setter, figuraba como
cualificado suyo. Ahora "Cualificados hoy" y "Sin responder" son solo suyos, y con "Sin
asignación" suman la lista de Hoy.
"""
import itertools
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import LeadAnswer, ManychatLead

AHORA = '2026-10-01 15:00:00'
STATS = '/api/setter/deck/stats/cualificacion'

_n = itertools.count(1)


@pytest.fixture()
def elias(make_user):
    make_user(role='setter', username='Paula', timezone='America/Buenos_Aires')
    return make_user(role='setter', username='Elias', timezone='America/Buenos_Aires')


def lead(db, setter, respuesta, cuando=datetime(2026, 10, 1, 15, 0)):
    n = next(_n)
    l = ManychatLead(manychat_id=f'mc-{n}', name=f'Lead {n}', ig=f'lead{n}', setter=setter, created_at=cuando)
    db.session.add(l)
    db.session.commit()
    db.session.add(LeadAnswer(lead_id=l.id, qualification=respuesta, created_at=cuando))
    db.session.commit()


@pytest.fixture()
def bandeja(db, elias):
    lead(db, 'Elias', 'true')
    lead(db, 'Elias', 'true')
    lead(db, 'Elias', 'null')
    lead(db, None, 'true')    # sin repartir todavía
    lead(db, '', 'null')      # sin repartir todavía
    lead(db, 'Paula', 'true')  # de otro setter: no lo ve nadie más que Paula


@freeze_time(AHORA)
def test_cualificados_y_sin_responder_son_solo_los_suyos(client, elias, bandeja, auth_headers):
    datos = client.get(STATS, headers=auth_headers(elias)).get_json()

    assert datos == {'qualified_today': 2, 'unassigned_today': 1, 'no_response_today': 1}


@freeze_time(AHORA)
def test_lo_suyo_mas_lo_sin_asignar_es_la_lista_de_hoy(client, elias, bandeja, auth_headers):
    cabeceras = auth_headers(elias)
    datos = client.get(STATS, headers=cabeceras).get_json()
    lista = client.get('/api/setter/deck', headers=cabeceras,
                       query_string={'step': 'cualificacion', 'date_range': 'today'}).get_json()

    assert len(lista) == datos['qualified_today'] + datos['unassigned_today'] == 3


@freeze_time(AHORA)
def test_un_setter_sin_leads_todavia_no_tiene_cualificados(client, db, make_user, auth_headers):
    nuevo = make_user(role='setter', username='Nuevo', timezone='America/Buenos_Aires')
    lead(db, None, 'true')

    datos = client.get(STATS, headers=auth_headers(nuevo)).get_json()

    assert datos == {'qualified_today': 0, 'unassigned_today': 1, 'no_response_today': 0}
