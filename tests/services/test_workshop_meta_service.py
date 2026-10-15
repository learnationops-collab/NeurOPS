"""La inversión, el CPM, el CPC y los clics de cada workshop salen de Meta (15/10/2026).

Los anuncios de embudo «workshop» (solos o elegidos a mano); a cada taller le toca el gasto del día siguiente al
taller anterior hasta el día del taller (el criterio con el que el equipo los cargaba a mano).
"""
from datetime import date

import pytest

from app.models import MetaAnuncio, MetaGastoDiario, WorkshopEvent
from app.services import meta_ads_service, workshop_meta_service


def _dia(ad, fecha, gasto, impresiones=1000, clics=50, enlace=20):
    return MetaGastoDiario(meta_ad_id=ad, fecha=date.fromisoformat(fecha), gasto=gasto, moneda='USD',
                           impresiones=impresiones, clics=clics, clics_enlace=enlace)


@pytest.fixture()
def talleres(db):
    eventos = {
        'jul8': WorkshopEvent(date=date(2026, 7, 8), name='Webinar 8 de julio', inversion=500.0, cpm=4.6, cpc=0.4, clics=1815),
        'jul14': WorkshopEvent(date=date(2026, 7, 14), name='Webinar 14 de julio', inversion=450.0, cpm=3.7, cpc=0.42, clics=1618),
    }
    db.session.add_all(eventos.values())
    db.session.add_all([
        MetaAnuncio(meta_ad_id='ws1', nombre='Ad 4', campana='WORKSHOP FUNNEL', campana_id='c-ws'),
        MetaAnuncio(meta_ad_id='ws2', nombre='Launch', campana='SPI-TRIPODE-LAUNCH', campana_id='c-launch'),
        MetaAnuncio(meta_ad_id='dm1', nombre='APLICAR', campana='DM Funnel', campana_id='c-dm'),
        _dia('ws1', '2026-07-02', 30.0),   # 7 días que terminan en el primer taller: cuenta
        _dia('ws1', '2026-07-01', 7.0),    # el octavo día para atrás: ya no
        _dia('ws1', '2026-07-08', 100.0),  # el día del taller: es de ese taller
        _dia('ws1', '2026-07-09', 40.0),   # el día siguiente: es del taller del 14
        _dia('ws2', '2026-07-14', 60.0),
        _dia('ws1', '2026-07-15', 999.0),  # después del último taller: de ninguno todavía
        _dia('dm1', '2026-07-10', 500.0),  # anuncio de setting: no cuenta
    ])
    db.session.commit()
    return eventos


def test_sin_anuncios_de_workshop_quedan_los_cargados_a_mano(db, talleres):
    workshop_meta_service.recalcular()

    datos = talleres['jul8'].to_dict()
    assert (datos['inversion'], datos['cpm'], datos['cpc'], datos['clics']) == (500.0, 4.6, 0.4, 1815)
    assert (datos['inversion_de_meta'], datos['clics_de_meta']) == (False, False)


def test_cada_taller_suma_el_gasto_desde_el_dia_siguiente_al_anterior(db, talleres):
    meta_ads_service.asignar_embudo('ws1', 'workshop')
    meta_ads_service.asignar_embudo('ws2', 'workshop')

    jul8, jul14 = talleres['jul8'].to_dict(), talleres['jul14'].to_dict()
    assert jul8['inversion'] == 130.0  # 02/07 (sin anterior: 7 días) + 08/07
    assert jul14['inversion'] == 100.0  # 09/07 + 14/07; el DM no cuenta
    # CPM = gasto / impresiones × 1000; CPC por clic en el enlace; clics = todos.
    assert (jul14['cpm'], jul14['cpc'], jul14['clics']) == (50.0, 2.5, 100)
    assert jul14['inversion_de_meta'] and jul14['clics_de_meta']
    # Lo cargado a mano queda guardado aparte, y el ROAS y el CPL usan lo de Meta.
    assert jul14['a_mano'] == {'inversion': 450.0, 'cpm': 3.7, 'cpc': 0.42, 'clics': 1618}
    assert talleres['jul14'].inversion_real == 100.0


def test_sacar_el_anuncio_de_workshop_vuelve_a_lo_cargado_a_mano(db, talleres):
    meta_ads_service.asignar_embudo('ws1', 'workshop')
    meta_ads_service.asignar_embudo('ws1', 'otro')

    assert talleres['jul8'].to_dict()['inversion'] == 500.0


def test_dias_sin_impresiones_dejan_cpm_cpc_y_clics_a_mano(db, talleres):
    """Días sincronizados antes de que se trajeran impresiones y clics: la inversión sí es de Meta."""
    MetaGastoDiario.query.filter_by(meta_ad_id='ws1', fecha=date(2026, 7, 9)).one().impresiones = None
    db.session.commit()
    meta_ads_service.asignar_embudo('ws1', 'workshop')

    datos = talleres['jul14'].to_dict()
    assert (datos['inversion'], datos['inversion_de_meta'], datos['clics_de_meta']) == (40.0, True, False)
    assert (datos['cpm'], datos['cpc'], datos['clics']) == (3.7, 0.42, 1618)


def test_un_taller_antes_de_los_datos_de_meta_queda_a_mano(db, talleres):
    db.session.add(WorkshopEvent(date=date(2026, 6, 1), name='Webinar de junio', inversion=321.0))
    db.session.commit()
    meta_ads_service.asignar_embudo('ws1', 'workshop')

    junio = WorkshopEvent.query.filter_by(date=date(2026, 6, 1)).one()
    assert (junio.inversion_real, junio.inversion_de_meta) == (321.0, False)
    # El del 8/07 ahora va del 02/06 al 08/07, y Meta empieza el 01/07: no se sabe todo, queda a mano.
    assert (talleres['jul8'].inversion_real, talleres['jul8'].inversion_de_meta) == (500.0, False)
    assert talleres['jul14'].inversion_real == 40.0


def test_registrar_y_borrar_un_taller_mueve_la_ventana_del_siguiente(client, db, talleres, make_user, auth_headers):
    meta_ads_service.asignar_embudo('ws1', 'workshop')
    cabeceras = auth_headers(make_user(role='admin'))

    respuesta = client.post('/api/workshop/events', json={'date': '2026-07-11', 'name': 'Extra'}, headers=cabeceras)

    assert respuesta.status_code == 201
    assert respuesta.get_json()['inversion'] == 40.0  # el 09/07 ahora es de este
    assert talleres['jul14'].inversion_real == 0.0
    client.delete(f"/api/workshop/events/{respuesta.get_json()['id']}", headers=cabeceras)
    assert talleres['jul14'].inversion_real == 40.0


def test_el_desglose_del_taller_por_campana_conjunto_y_anuncio(client, db, talleres, make_user, auth_headers):
    from datetime import datetime

    from app.models import LandingTracking

    MetaAnuncio.query.filter_by(meta_ad_id='ws1').one().conjunto = 'Broad | Pizarra'
    meta_ads_service.asignar_embudo('ws1', 'workshop')
    meta_ads_service.asignar_embudo('ws2', 'workshop')
    # Visitas y clics al grupo que trajo cada campaña (el id viaja en utm_campaign), en hora UTC.
    db.session.add_all([
        LandingTracking(page_path='/live-class-t3/', utm_campaign='c-ws', created_at=datetime(2026, 7, 10, 15)),
        LandingTracking(page_path='/live-class-t3/', utm_campaign='c-ws', created_at=datetime(2026, 7, 12, 15)),
        LandingTracking(page_path='/live-class-t3/', utm_campaign='c-ws', evento='clic_whatsapp',
                        created_at=datetime(2026, 7, 12, 15, 5)),
        LandingTracking(page_path='/replay/', utm_campaign='c-ws', created_at=datetime(2026, 7, 12, 16)),  # otro embudo
        LandingTracking(page_path='/live-class-t3/', utm_campaign='c-ws', created_at=datetime(2026, 7, 16, 15)),  # otro taller
    ])
    db.session.commit()

    respuesta = client.get(f"/api/workshop/events/{talleres['jul14'].id}/anuncios",
                           headers=auth_headers(make_user(role='admin')))

    datos = respuesta.get_json()
    assert respuesta.status_code == 200
    assert (datos['desde'], datos['hasta'], datos['anuncios_workshop']) == ('2026-07-09', '2026-07-14', 2)
    assert [(c['nombre'], c['gasto']) for c in datos['campanas']] == [('SPI-TRIPODE-LAUNCH', 60.0), ('WORKSHOP FUNNEL', 40.0)]
    ws = datos['campanas'][1]
    assert (ws['visitas'], ws['clics_whatsapp'], ws['costo_whatsapp']) == (2, 1, 40.0)
    [conjunto] = ws['conjuntos']
    assert conjunto['nombre'] == 'Broad | Pizarra'
    assert [(a['nombre'], a['gasto'], a['cpc'], a['ctr']) for a in conjunto['anuncios']] == [('Ad 4', 40.0, 2.0, 5.0)]
    assert (datos['totales']['gasto'], datos['totales']['visitas']) == (100.0, 2)


def test_editar_el_taller_no_pisa_lo_cargado_a_mano_con_lo_de_meta(client, db, talleres, make_user, auth_headers):
    """El panel manda el evento entero (con los valores de Meta) al resincronizar el embudo."""
    meta_ads_service.asignar_embudo('ws1', 'workshop')
    evento = talleres['jul8']

    client.put(f'/api/workshop/events/{evento.id}', json=evento.to_dict(), headers=auth_headers(make_user(role='admin')))

    assert (evento.inversion, evento.cpm, evento.cpc, evento.clics) == (500.0, 4.6, 0.4, 1815)


def test_mover_un_taller_de_dia_o_programar_semanas_mueve_las_ventanas(client, db, talleres, make_user, auth_headers):
    """Desde que el día y la hora se editan en el panel y se programan semanas enteras (15/10/2026)."""
    meta_ads_service.marcar_workshop('c-ws', True)
    meta_ads_service.marcar_workshop('c-launch', True)
    cabeceras = auth_headers(make_user(role='admin'))

    # El del 14 pasa al 9: le queda solo el 09/07, y el 14/07 ya no es de ningún taller.
    movido = client.put(f"/api/workshop/events/{talleres['jul14'].id}", json={'date': '2026-07-09'}, headers=cabeceras)
    assert movido.status_code == 200
    assert movido.get_json()['inversion'] == 40.0

    programado = client.post('/api/workshop/events/programar', headers=cabeceras, json={
        'inicio_local': '2026-07-14T17:00', 'zona': 'America/Argentina/Buenos_Aires', 'semanas': 1})
    assert programado.status_code == 201
    assert programado.get_json()['creados'][0]['inversion'] == 60.0  # del 10/07 al 14/07
