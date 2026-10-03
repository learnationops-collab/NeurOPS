"""Pestaña «Tráfico landings»: visitas de las landings de institute-site y clics al grupo de WhatsApp.

Pedido del 03/10/2026. Las visitas llegan por /api/v1/metrics/track-visit y, desde ese dia, los
clics al grupo de WhatsApp del evento por el mismo endpoint con `evento='clic_whatsapp'`. La
grabacion (/replay/) se cuenta desde `landing_sessions`.
"""
from datetime import datetime

import pytest

from app.models import LandingTracking, LandingSession

RANGO = 'desde=2026-10-01&hasta=2026-10-05'


@pytest.fixture()
def director(make_user, auth_headers):
    return auth_headers(make_user(role='director_marketing'))


def visita(db, path, *, fuente='ig', campana='T5', evento=None, cuando=datetime(2026, 10, 3, 15, 0)):
    db.session.add(LandingTracking(page_path=path, utm_source=fuente, utm_campaign=campana,
                                   evento=evento, created_at=cuando))
    db.session.commit()


def trafico(client, director):
    respuesta = client.get(f'/api/workshop/landing/trafico?{RANGO}', headers=director)
    assert respuesta.status_code == 200
    return respuesta.get_json()


def test_track_visit_guarda_el_clic_al_grupo_y_cualquier_otro_evento_es_visita(client, db):
    client.post('/api/v1/metrics/track-visit', json={'page_path': '/live-class-t5/', 'evento': 'clic_whatsapp'})
    client.post('/api/v1/metrics/track-visit', json={'page_path': '/live-class-t5/', 'evento': 'cualquier_cosa'})
    client.post('/api/v1/metrics/track-visit', json={'page_path': '/live-class-t5/'})

    assert sorted(t.evento for t in LandingTracking.query.all()) == ['clic_whatsapp', 'visita', 'visita']


def test_el_listado_viejo_de_visitas_no_cuenta_los_clics(client, db, make_user, auth_headers):
    visita(db, '/live-class-t5/')
    visita(db, '/live-class-t5/', evento='clic_whatsapp')
    admin = auth_headers(make_user(role='admin'))

    filas = client.get('/api/v1/metrics/track-visits', headers=admin).get_json()

    assert len(filas) == 1


def test_agrupa_la_misma_landing_aunque_llegue_con_o_sin_barra_o_con_query(client, db, director):
    visita(db, '/live-class-t4/')
    visita(db, '/live-class-t4')
    visita(db, '/LIVE-CLASS-T4/?utm_source=ig')
    visita(db, 'https://institute.thelearnation.com/live-class-t4/')

    data = trafico(client, director)

    assert [(x['path'], x['visitas']) for x in data['por_landing']] == [('/live-class-t4/', 4)]


def test_tasa_al_grupo_solo_con_las_visitas_posteriores_al_primer_clic_medido(client, db, director):
    # Visita de antes de que institute-site mandara clics: no puede sumar a la tasa
    visita(db, '/live-class-t5/', cuando=datetime(2026, 10, 2, 15, 0))
    visita(db, '/live-class-t5/', evento='clic_whatsapp', cuando=datetime(2026, 10, 3, 15, 0))
    visita(db, '/live-class-t5/', cuando=datetime(2026, 10, 3, 15, 1))
    visita(db, '/live-class-t5/', cuando=datetime(2026, 10, 3, 15, 2))

    data = trafico(client, director)

    t5 = data['por_landing'][0]
    assert (t5['visitas'], t5['clics_whatsapp'], t5['tasa_whatsapp']) == (3, 1, 50.0)
    assert data['totales']['tasa_whatsapp'] == 50.0
    assert data['whatsapp_medido_desde'].startswith('2026-10-03T15:00')


def test_sin_clics_medidos_la_tasa_queda_vacia_y_no_en_cero(client, db, director):
    visita(db, '/live-class-t3/')
    visita(db, '/bienvenido/')

    data = trafico(client, director)

    por_path = {x['path']: x for x in data['por_landing']}
    assert por_path['/live-class-t3/']['lleva_whatsapp'] is True
    assert por_path['/live-class-t3/']['tasa_whatsapp'] is None
    assert por_path['/bienvenido/']['lleva_whatsapp'] is False
    assert data['totales']['tasa_whatsapp'] is None


def test_la_grabacion_sale_de_las_sesiones_y_no_se_cuenta_dos_veces(client, db, director):
    visita(db, '/replay/')                                  # fila vieja de track-visit
    db.session.add(LandingSession(session_key='s1', page_path='/replay/', utm_source='fb',
                                  created_at=datetime(2026, 10, 3, 16, 0)))
    db.session.commit()

    data = trafico(client, director)

    replay = next(x for x in data['por_landing'] if x['path'] == '/replay/')
    assert (replay['visitas'], replay['origen_datos'], replay['fuente_principal']) == (1, 'sesiones', 'Facebook')


def test_fuentes_unificadas_y_serie_diaria_sin_huecos(client, db, director):
    visita(db, '/live-class-t5/', fuente='ig')
    visita(db, '/live-class-t5/', fuente='instagram')
    visita(db, '/live-class-t5/', fuente=None)

    data = trafico(client, director)

    assert {x['fuente']: x['visitas'] for x in data['por_fuente']} == {'Instagram': 2, 'Directo / sin UTM': 1}
    assert [d['dia'] for d in data['por_dia']] == ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
    assert sum(d['visitas'] for d in data['por_dia']) == 3


def test_un_closer_no_ve_el_trafico(client, db, make_user, auth_headers):
    closer = auth_headers(make_user(role='closer'))

    assert client.get(f'/api/workshop/landing/trafico?{RANGO}', headers=closer).status_code == 403


def test_el_rango_son_dias_de_la_paz_y_no_de_utc(client, db, director):
    # 02:00 UTC del 01/10 son las 22:00 del 30/09 en La Paz: fuera del rango que arranca el 01/10
    visita(db, '/live-class-t5/', cuando=datetime(2026, 10, 1, 2, 0))
    visita(db, '/live-class-t5/', cuando=datetime(2026, 10, 1, 5, 0))

    data = trafico(client, director)

    assert data['totales']['visitas'] == 1
    assert data['por_dia'][0] == {'dia': '2026-10-01', 'visitas': 1, 'clics_whatsapp': 0}
