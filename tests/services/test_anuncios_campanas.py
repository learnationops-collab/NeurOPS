"""Campañas y conjuntos de la tabla de anuncios (pedido de Kerwin, 15/10/2026).

"Me gustaría ver las campañas [...] buscar otra forma de organizar por conjuntos y campañas como antes, pero más
fácil, me gustaría incluso conectarlo con Meta Ads". Cada palabra clave tiene una campaña y un conjunto: los
elegidos a mano, si no los de sus anuncios de Meta (donde más gastó), si no los de la carga vieja. Los leads van
enteros a esa campaña; el gasto se reparte entre las campañas de sus anuncios de Meta.
"""
import itertools
from datetime import date, datetime

from app.models import Ad, AdSet, Campaign, LeadAnswer, ManychatLead, MetaAnuncio, MetaGastoDiario
from app.services import anuncios_service as servicio

DESDE, HASTA = date(2026, 10, 1), date(2026, 10, 31)
_n = itertools.count(1)


def lead_con(db, keyword, calificacion='true'):
    lead = ManychatLead(manychat_id=f'mc-{next(_n)}', name='Lead')
    db.session.add(lead)
    db.session.flush()
    db.session.add(LeadAnswer(lead_id=lead.id, keyword=keyword, qualification=calificacion,
                              created_at=datetime(2026, 10, 5), updated_at=datetime(2026, 10, 5)))
    db.session.commit()


def meta(db, ad_id, clave, campana, conjunto, gasto, estado='ACTIVE'):
    db.session.add(MetaAnuncio(meta_ad_id=ad_id, clave=clave, mapeo='auto', campana=campana, conjunto=conjunto,
                               estado=estado, nombre=ad_id))
    if gasto:
        db.session.add(MetaGastoDiario(meta_ad_id=ad_id, fecha=date(2026, 10, 3), gasto=gasto, moneda='USD'))
    db.session.commit()


def fila(clave):
    return next(f for f in servicio.tablero(DESDE, HASTA)['filas'] if f['clave'] == clave)


def test_sin_meta_ni_carga_no_tiene_campana(db):
    lead_con(db, 'APLICAR')

    f = fila('APLICAR')

    assert (f['campana'], f['conjunto'], f['agrupacion'], f['gasto_por_grupo']) == (None, None, None, [])


def test_la_campana_de_meta_es_la_que_mas_gasto_y_el_gasto_se_reparte(db):
    lead_con(db, 'APLICAR')
    meta(db, '1', 'APLICAR', 'DM Funnel | Testing Ads', 'AD 5 | APLICAR', 241.43, estado='ADSET_PAUSED')
    meta(db, '2', 'APLICAR', 'DMV | Test Públicos', 'DMV | H2 | BRD', 76.7)
    meta(db, '3', 'APLICAR', 'DMV | Test Públicos', 'DMV | M2 | LAGD', 14.58)

    f = fila('APLICAR')

    assert (f['campana'], f['conjunto'], f['agrupacion']) == ('DM Funnel | Testing Ads', 'AD 5 | APLICAR', 'meta')
    assert sorted(f['gasto_por_grupo']) == [['DM Funnel | Testing Ads', 'AD 5 | APLICAR', 241.43],
                                            ['DMV | Test Públicos', 'DMV | H2 | BRD', 76.7],
                                            ['DMV | Test Públicos', 'DMV | M2 | LAGD', 14.58]]
    assert f['gasto'] == 332.71


def test_sin_gasto_en_el_periodo_usa_el_anuncio_activo(db):
    lead_con(db, 'EARN')
    meta(db, '1', 'EARN', 'Vieja', 'Pausado', 0, estado='PAUSED')
    meta(db, '2', 'EARN', 'Nueva', 'Activo', 0)

    assert (fila('EARN')['campana'], fila('EARN')['conjunto']) == ('Nueva', 'Activo')


def test_la_carga_vieja_vale_hasta_que_hay_meta(db):
    campana = Campaign(name='DM Funnel | Testing Ads | Broad')
    db.session.add(campana)
    db.session.flush()
    conjunto = AdSet(campaign_id=campana.id, name='AD 6 | CURSO GRATUITO')
    db.session.add(conjunto)
    db.session.add(Ad(ad_set_id=None, name='CURSO GRATUITO', keyword='CURSO GRATUITO'))
    db.session.flush()
    Ad.query.one().ad_set_id = conjunto.id
    db.session.commit()
    lead_con(db, 'CURSO GRATUITO')

    assert (fila('CURSO GRATUITO')['campana'], fila('CURSO GRATUITO')['agrupacion']) == \
        ('DM Funnel | Testing Ads | Broad', 'anterior')

    meta(db, '1', 'CURSO GRATUITO', 'Campaña de Meta', 'Conjunto de Meta', 10)

    assert (fila('CURSO GRATUITO')['campana'], fila('CURSO GRATUITO')['agrupacion']) == ('Campaña de Meta', 'meta')


def test_a_mano_manda_sobre_meta_y_se_puede_volver_a_la_automatica(db):
    lead_con(db, 'Guia Peru')  # llegó antes de tener anuncio: se le crea al elegir
    meta(db, '1', 'GUIA PERU', 'LM Funnel', 'Guía Perú', 50)

    servicio.agrupar('GUIA PERU', 'Guías por país', '')

    f = fila('GUIA PERU')
    assert (f['campana'], f['conjunto'], f['agrupacion']) == ('Guías por país', 'Sin conjunto', 'manual')
    assert f['gasto_por_grupo'] == [['Guías por país', 'Sin conjunto', 50.0]]
    # La misma campaña escrita distinto (mayúsculas, tildes) no crea otra.
    servicio.agrupar('GUIA PERU', 'GUIAS POR PAÍS', 'Perú')
    assert [c.name for c in Campaign.query.all()] == ['Guías por país']
    assert (fila('GUIA PERU')['campana'], fila('GUIA PERU')['conjunto']) == ('Guías por país', 'Perú')

    servicio.agrupar('GUIA PERU', None, None)

    assert (fila('GUIA PERU')['campana'], fila('GUIA PERU')['agrupacion']) == ('LM Funnel', 'meta')


def test_las_opciones_son_las_campanas_guardadas_y_las_de_meta(db):
    lead_con(db, 'APLICAR')
    meta(db, '1', 'APLICAR', 'DMV | Test Públicos', 'DMV | H2 | BRD', 5)
    servicio.agrupar('APLICAR', 'Mi campaña', 'Mi conjunto')

    opciones = servicio.tablero(DESDE, HASTA)['agrupaciones']

    assert opciones == [{'campana': 'DMV | Test Públicos', 'conjuntos': ['DMV | H2 | BRD']},
                        {'campana': 'Mi campaña', 'conjuntos': ['Mi conjunto']}]
