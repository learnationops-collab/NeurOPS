"""El Call Confirmer (`encargado_triage`) salió del Tablero de Agendas el 10/10/2026.

Kerwin: «Ya no se está usando lo de call confirmer, quítalo… los closers están confirmando sus
propias agendas». El tablero ya no lo filtra, no lo lista entre sus opciones ni lo edita en lote.

Lo que se queda a propósito: el dato. La columna sigue en la base, la ingesta de n8n lo guarda si
llega y el PUT lo sigue escribiendo, porque la pantalla del rol triage (/triage/deck) manda su
usuario al confirmar y el prefill de su reporte diario cuenta las agendas por ese campo.
"""
from datetime import datetime, timedelta

import pytest

from app.models import FinancialAgenda


@pytest.fixture()
def admin(make_user, auth_headers):
    return auth_headers(make_user(role='admin', username='jefa', email='jefa@neuro.com'))


@pytest.fixture()
def agendas(db):
    manana = datetime.utcnow().replace(microsecond=0) + timedelta(days=1)
    filas = [
        FinancialAgenda(nombre='workshop', lead='Ana Gomez', closer='cerrador', date=manana,
                        fecha_meet=manana.isoformat(), estado='Pendiente', encargado_triage='confirmadora'),
        FinancialAgenda(nombre='workshop', lead='Beto Diaz', closer='cerrador', date=manana + timedelta(hours=2),
                        fecha_meet=manana.isoformat(), estado='Pendiente', encargado_triage=None),
    ]
    db.session.add_all(filas)
    db.session.commit()
    return filas


def _rango(fila):
    dia = fila.date.strftime('%Y-%m-%d')
    return {'start_date': dia, 'end_date': dia}


# --- El tablero ya no lo ofrece ------------------------------------------------------------------

def test_el_listado_no_trae_las_opciones_del_call_confirmer(client, db, admin, agendas):
    r = client.get('/api/public/financial-agendas', query_string={**_rango(agendas[0]), 'page': 1},
                   headers=admin)

    cuerpo = r.get_json()
    assert r.status_code == 200
    assert 'unique_triage' not in cuerpo
    assert 'by_triage_state' not in cuerpo
    assert cuerpo['total'] == 2


@pytest.mark.parametrize('valor', ['confirmadora', 'Sin Asignar'])
def test_el_filtro_por_call_confirmer_se_ignora(client, db, admin, agendas, valor):
    r = client.get('/api/public/financial-agendas',
                   query_string={**_rango(agendas[0]), 'page': 1, 'encargado_triage': valor}, headers=admin)

    assert r.status_code == 200
    assert r.get_json()['total'] == 2


def test_la_edicion_masiva_no_ofrece_el_call_confirmer(client, db, admin):
    r = client.get('/api/public/financial-agendas/bulk-options', headers=admin)

    cuerpo = r.get_json()
    assert r.status_code == 200
    assert 'encargado_triage' not in cuerpo['fields']
    assert 'encargados_triage' not in cuerpo
    assert set(cuerpo['fields']) == {'nombre', 'closer', 'estado'}


def test_la_edicion_masiva_rechaza_el_call_confirmer(client, db, admin, agendas):
    r = client.post('/api/public/financial-agendas/bulk-update', headers=admin,
                    json={'fields': {'encargado_triage': 'otra'}, 'ids': [a.id for a in agendas]})

    assert r.status_code == 400
    assert 'encargado_triage' in r.get_json()['error']
    assert {a.encargado_triage for a in FinancialAgenda.query.all()} == {'confirmadora', None}


# --- El dato se queda: el rol triage lo sigue usando ----------------------------------------------

def test_el_triage_sigue_quedando_a_cargo_al_confirmar(client, db, make_user, auth_headers, agendas):
    """TriageWorkflowPage manda `encargado_triage` con su usuario al cambiar el estado."""
    triage = make_user(role='triage', username='confirmadora2', email='c2@neuro.com')
    fila = agendas[1]

    r = client.put(f'/api/public/financial-agendas/{fila.id}', headers=auth_headers(triage),
                   json={'estado': 'Confirmado', 'encargado_triage': 'confirmadora2'})

    assert r.status_code == 200, r.get_json()
    db.session.refresh(fila)
    assert fila.encargado_triage == 'confirmadora2'
    assert fila.estado == 'Confirmado'


def test_el_reporte_del_triage_sigue_contando_sus_agendas(client, db, make_user, auth_headers, agendas):
    triage = make_user(role='triage', username='confirmadora', email='c@neuro.com')

    r = client.get('/api/public/triage-report/prefill', headers=auth_headers(triage),
                   query_string={'triage_name': 'confirmadora', 'date': agendas[0].date.strftime('%Y-%m-%d')})

    assert r.status_code == 200
    assert r.get_json()['today_agendas'] == 1


def test_la_ingesta_de_n8n_lo_sigue_guardando(client, db, admin):
    """n8n puede seguir mandándolo: no rompe y queda guardado."""
    manana = (datetime.utcnow() + timedelta(days=2)).replace(microsecond=0)
    r = client.post('/api/public/financial-agendas', headers=admin, json=[{
        'fuente': 'workshop', 'lead': 'Carla Ruiz', 'mail': 'carla@x.com', 'closer': 'cerrador',
        'fecha_meet': manana.strftime('%Y-%m-%d %H:%M'), 'call_confirmer': 'confirmadora',
    }])

    assert r.status_code in (200, 201), r.get_json()
    assert FinancialAgenda.query.filter_by(lead='Carla Ruiz').one().encargado_triage == 'confirmadora'
