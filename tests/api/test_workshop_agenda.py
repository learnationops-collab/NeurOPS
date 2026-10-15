"""Hora, Meet y grupo de WhatsApp de cada taller: lo que antes era workshops.csv de institute-site.

La hora se carga en la zona de quien la escribe y se guarda como instante absoluto: Kerwin
(Venezuela) y su jefe (Argentina) cargan y ven el mismo taller cada uno en su hora. Las
landings leen /api/public/workshops/proximos.
"""
from datetime import date, datetime

import pytest

from app.models import WorkshopEvent
from app.services import workshop_agenda_service

MEET = 'https://meet.google.com/fne-suag-bbr'
GRUPO = 'https://chat.whatsapp.com/LGAwcWMUa725XRJnp3z2qN'


@pytest.fixture()
def marketing(make_user, auth_headers):
    return auth_headers(make_user(role='director_marketing', timezone='America/Caracas'))


def test_crear_con_hora_de_venezuela_guarda_el_instante_en_utc(client, db, marketing):
    # Lunes 19/10 a las 16:00 de Caracas (UTC-4) = 17:00 de Buenos Aires = 20:00 UTC.
    res = client.post('/api/workshop/events', headers=marketing, json={
        'inicio_at': '2026-10-19T16:00', 'zona': 'America/Caracas',
        'meet_url': MEET, 'whatsapp_url': GRUPO,
    })
    assert res.status_code == 201, res.get_json()
    data = res.get_json()
    assert data['date'] == '2026-10-19'
    assert data['name'] == 'WEBINAR 19 DE OCTUBRE 2026'
    assert data['inicio_at'] == '2026-10-19T20:00:00Z'
    assert data['meet_url'] == MEET and data['whatsapp_url'] == GRUPO


def test_quien_edita_desde_argentina_mueve_el_mismo_instante(client, db, marketing):
    creado = client.post('/api/workshop/events', headers=marketing, json={
        'date': '2026-10-19', 'name': 'WEBINAR', 'inicio_at': '2026-10-19T20:00:00Z'}).get_json()

    res = client.put(f"/api/workshop/events/{creado['id']}", headers=marketing, json={
        'inicio_at': '2026-10-19T18:30', 'zona': 'America/Argentina/Buenos_Aires'})
    assert res.status_code == 200
    assert res.get_json()['inicio_at'] == '2026-10-19T21:30:00Z'


def test_mover_el_taller_de_dia_respeta_que_haya_uno_solo_por_dia(client, db, marketing):
    a = client.post('/api/workshop/events', headers=marketing, json={'date': '2026-10-19', 'name': 'A'}).get_json()
    client.post('/api/workshop/events', headers=marketing, json={'date': '2026-10-26', 'name': 'B'})

    choca = client.put(f"/api/workshop/events/{a['id']}", headers=marketing, json={'date': '2026-10-26'})
    assert choca.status_code == 400

    ok = client.put(f"/api/workshop/events/{a['id']}", headers=marketing, json={'date': '2026-10-20'})
    assert ok.status_code == 200 and ok.get_json()['date'] == '2026-10-20'


def test_links_que_no_son_links_se_rechazan(client, db, marketing):
    res = client.post('/api/workshop/events', headers=marketing, json={
        'date': '2026-10-19', 'name': 'A', 'whatsapp_url': 'chat.whatsapp.com/abc'})
    assert res.status_code == 400
    assert 'WhatsApp' in res.get_json()['error']
    assert WorkshopEvent.query.count() == 0


def test_programar_crea_un_taller_por_semana_a_la_misma_hora(client, db, marketing):
    client.post('/api/workshop/events', headers=marketing, json={'date': '2026-10-26', 'name': 'YA ESTABA'})

    res = client.post('/api/workshop/events/programar', headers=marketing, json={
        'inicio_local': '2026-10-19T17:00', 'zona': 'America/Argentina/Buenos_Aires', 'semanas': 3,
        'meet_url': MEET, 'whatsapp_url': GRUPO,
    })
    assert res.status_code == 201, res.get_json()
    data = res.get_json()
    assert [e['date'] for e in data['creados']] == ['2026-10-19', '2026-11-02']
    assert data['existentes'] == ['2026-10-26']
    assert [e['inicio_at'] for e in data['creados']] == ['2026-10-19T20:00:00Z', '2026-11-02T20:00:00Z']
    # El que ya estaba no se toca.
    assert WorkshopEvent.query.filter_by(date=date(2026, 10, 26)).one().name == 'YA ESTABA'


def test_programar_pide_rol_de_workshop(client, db, make_user, auth_headers):
    closer = auth_headers(make_user(role='closer'))
    res = client.post('/api/workshop/events/programar', headers=closer, json={
        'inicio_local': '2026-10-19T17:00', 'semanas': 1})
    assert res.status_code in (401, 403)
