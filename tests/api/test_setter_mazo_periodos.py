"""Los chips de fecha del mazo del setter son los períodos de "Mis datos" con el mismo nombre.

Antes "Esta semana" eran 8 días y "Este mes" los últimos 31, y en "Mis datos" "Este mes" es el mes
calendario: el 01/10/2026 el chip "Este mes" de Agendas mostraba 84 agendas de Elias y "Mis datos"
con "Este mes", 1. Ahora son "7 días" (hoy y los 6 anteriores) y "30 días" (hoy y los 29
anteriores), los mismos rangos que '7d' y '30d' del dashboard, en las dos listas del mazo.
"""
from datetime import date, datetime, timedelta

import pytest
from freezegun import freeze_time

from app.models import LeadAnswer, ManychatLead
from app.models.financial import FinancialAgenda
from app.services.comercial_service import ComercialService

# 12:00 en Buenos Aires: el "hoy" del setter y el del servidor son el mismo día.
AHORA = '2026-10-01 15:00:00'
HOY = date(2026, 10, 1)


@pytest.fixture()
def elias(make_user):
    return make_user(role='setter', username='Elias', timezone='America/Buenos_Aires')


def mediodia_local(dia):
    """Las 12:00 de Buenos Aires de ese día, en UTC naive como en la base."""
    return datetime.combine(dia, datetime.min.time()) + timedelta(hours=15)


@pytest.fixture()
def agendas_por_dia(db, elias):
    """Una agenda de Elias por cada día de atrás que importa, con su propio instagram."""
    for atras in (0, 6, 7, 29, 30):
        cuando = mediodia_local(HOY - timedelta(days=atras))
        db.session.add(FinancialAgenda(nombre='Elias', lead=f'Hace {atras}', instagram=f'hace{atras}',
                                       date=cuando, created_at=cuando))
    db.session.commit()


@pytest.fixture()
def cualificados_por_dia(db, elias):
    for atras in (0, 6, 7, 29, 30):
        cuando = mediodia_local(HOY - timedelta(days=atras))
        lead = ManychatLead(manychat_id=f'mc-{atras}', name=f'Hace {atras}', ig=f'hace{atras}',
                            setter='Elias', created_at=cuando)
        db.session.add(lead)
        db.session.commit()
        db.session.add(LeadAnswer(lead_id=lead.id, qualification='true', created_at=cuando))
    db.session.commit()


def _dias(filas, campo):
    return sorted(int(f[campo].split()[-1]) for f in filas)


@freeze_time(AHORA)
@pytest.mark.parametrize('chip, periodo, dias', [
    ('today', 'hoy', [0]),
    ('week', '7d', [0, 6]),
    ('month', '30d', [0, 6, 7, 29]),
])
def test_cada_chip_de_agendas_es_el_periodo_de_mis_datos(client, elias, agendas_por_dia, auth_headers,
                                                         chip, periodo, dias):
    filas = client.get('/api/setter/deck/agendas', headers=auth_headers(elias),
                       query_string={'date_range': chip}).get_json()

    assert _dias(filas, 'cliente') == dias
    # El mismo rango de días que el período del dashboard con ese nombre.
    inicio, fin = ComercialService.rango(periodo)
    assert (inicio, fin) == (HOY - timedelta(days=max(dias)), HOY)


@freeze_time(AHORA)
@pytest.mark.parametrize('chip, dias', [('week', [0, 6]), ('month', [0, 6, 7, 29])])
def test_la_lista_de_cualificacion_usa_los_mismos_rangos(client, elias, cualificados_por_dia,
                                                        auth_headers, chip, dias):
    filas = client.get('/api/setter/deck', headers=auth_headers(elias),
                       query_string={'step': 'cualificacion', 'date_range': chip}).get_json()

    assert _dias(filas, 'lead_name') == dias


@freeze_time(AHORA)
def test_sin_chip_la_cualificacion_sigue_trayendo_todo(client, elias, cualificados_por_dia, auth_headers):
    filas = client.get('/api/setter/deck', headers=auth_headers(elias),
                       query_string={'step': 'cualificacion'}).get_json()

    assert _dias(filas, 'lead_name') == [0, 6, 7, 29, 30]
