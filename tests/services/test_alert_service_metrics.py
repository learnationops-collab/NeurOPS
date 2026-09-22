"""AlertService: cómo se calcula el valor de cada métrica que una regla de alerta vigila.

`_calculate_metric_value` resuelve el ámbito (todo/keyword/campaña/anuncio) y calcula leads, CPL, CPQL,
inversión, agendas, ventas o cash collect en un rango de fechas. `_calculate_spend_for_ads` prorratea el
gasto declarado por período entre los anuncios que corresponden. Ver test_alert_service_rules.py para el
motor que decide cuándo disparar una alerta.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models import Ad, AdPeriodSpend, AdSet, Campaign, FinancialAgenda, FinancialSale, LeadAnswer, ManychatLead
from app.services.alert_service import AlertService


@pytest.fixture()
def campana(db):
    camp = Campaign(name='Campaña Septiembre')
    db.session.add(camp)
    db.session.commit()
    adset = AdSet(campaign_id=camp.id, name='AdSet 1')
    db.session.add(adset)
    db.session.commit()
    return camp, adset


def crear_ad(db, adset, nombre='Ad1', keyword=None, total_spend=0.0, creado=None):
    ad = Ad(ad_set_id=adset.id, name=nombre, keyword=keyword, total_spend=total_spend,
           created_at=creado or datetime(2026, 1, 1))
    db.session.add(ad)
    db.session.commit()
    return ad


def lead_answer(db, ad, ig=None, qualification='null', fecha=None):
    lead = ManychatLead(manychat_id=f'mc-{ad.id}-{ig or "x"}-{fecha}', ig=ig)
    db.session.add(lead)
    db.session.commit()
    respuesta = LeadAnswer(lead_id=lead.id, ad_id=ad.id, qualification=qualification,
                           created_at=fecha or datetime(2026, 9, 5))
    db.session.add(respuesta)
    db.session.commit()
    return lead, respuesta


# --- _get_dates_for_period -----------------------------------------------------------------------

def test_7_dias_incluye_hoy_y_los_6_anteriores():
    hoy = date(2026, 9, 22)

    inicio, fin = AlertService._get_dates_for_period('7_days', hoy)

    assert (inicio, fin) == (date(2026, 9, 16), hoy)


def test_7_dias_previos_es_la_semana_anterior_a_esa():
    hoy = date(2026, 9, 22)

    inicio, fin = AlertService._get_dates_for_period('7_days_prior', hoy)

    assert (inicio, fin) == (date(2026, 9, 9), date(2026, 9, 15))


def test_1_dia_es_ayer_no_hoy():
    assert AlertService._get_dates_for_period('1_day', date(2026, 9, 22)) == (date(2026, 9, 21), date(2026, 9, 21))


def test_un_periodo_desconocido_cae_a_solo_hoy():
    hoy = date(2026, 9, 22)

    assert AlertService._get_dates_for_period('lo-que-sea', hoy) == (hoy, hoy)


# --- _calculate_metric_value: metricas de marketing (leads/cpl/cpql/inversion) -------------------

def test_leads_cuenta_las_respuestas_del_ad_en_el_rango(db, campana):
    _, adset = campana
    ad = crear_ad(db, adset)
    lead_answer(db, ad, fecha=datetime(2026, 9, 5))
    lead_answer(db, ad, fecha=datetime(2026, 9, 6))
    lead_answer(db, ad, fecha=datetime(2026, 8, 1))  # fuera de rango

    valor = AlertService._calculate_metric_value('leads', date(2026, 9, 1), date(2026, 9, 10), 'all', None)

    assert valor == 2.0


def test_sin_ningun_anuncio_las_metricas_de_marketing_dan_cero(db):
    for metrica in ('leads', 'cpl', 'cpql', 'inversion'):
        assert AlertService._calculate_metric_value(metrica, date(2026, 9, 1), date(2026, 9, 10), 'all', None) == 0.0


def test_inversion_sin_ningun_lead_da_cero_aunque_el_ad_tenga_gasto(db, campana):
    _, adset = campana
    ad = crear_ad(db, adset)
    db.session.add(AdPeriodSpend(ad_id=ad.id, start_date=date(2026, 9, 1), end_date=date(2026, 9, 10), spend=100.0))
    db.session.commit()

    assert AlertService._calculate_metric_value('inversion', date(2026, 9, 1), date(2026, 9, 10), 'all', None) == 100.0


def test_cpl_es_la_inversion_entre_los_leads(db, campana):
    _, adset = campana
    ad = crear_ad(db, adset)
    db.session.add(AdPeriodSpend(ad_id=ad.id, start_date=date(2026, 9, 1), end_date=date(2026, 9, 10), spend=100.0))
    db.session.commit()
    lead_answer(db, ad, fecha=datetime(2026, 9, 5))
    lead_answer(db, ad, fecha=datetime(2026, 9, 6))

    assert AlertService._calculate_metric_value('cpl', date(2026, 9, 1), date(2026, 9, 10), 'all', None) == 50.0


def test_cpl_sin_leads_es_cero_y_no_revienta_por_dividir_entre_cero(db, campana):
    _, adset = campana
    ad = crear_ad(db, adset)
    db.session.add(AdPeriodSpend(ad_id=ad.id, start_date=date(2026, 9, 1), end_date=date(2026, 9, 10), spend=100.0))
    db.session.commit()

    assert AlertService._calculate_metric_value('cpl', date(2026, 9, 1), date(2026, 9, 10), 'all', None) == 0.0


def test_cpql_solo_cuenta_los_leads_calificados(db, campana):
    _, adset = campana
    ad = crear_ad(db, adset)
    db.session.add(AdPeriodSpend(ad_id=ad.id, start_date=date(2026, 9, 1), end_date=date(2026, 9, 10), spend=90.0))
    db.session.commit()
    lead_answer(db, ad, qualification='true', fecha=datetime(2026, 9, 5))
    lead_answer(db, ad, qualification='false', fecha=datetime(2026, 9, 6))  # no cuenta para cpql
    lead_answer(db, ad, qualification='null', fecha=datetime(2026, 9, 7))  # no cuenta para cpql

    assert AlertService._calculate_metric_value('cpql', date(2026, 9, 1), date(2026, 9, 10), 'all', None) == 90.0


# --- _calculate_metric_value: resolucion del ambito (scope) ---------------------------------------

def test_scope_keyword_solo_cuenta_los_leads_de_ese_anuncio(db, campana):
    _, adset = campana
    del_keyword = crear_ad(db, adset, nombre='Del keyword', keyword='promo-sep')
    otro_ad = crear_ad(db, adset, nombre='Otro anuncio', keyword='otra-cosa')
    lead_answer(db, del_keyword, fecha=datetime(2026, 9, 5))
    lead_answer(db, otro_ad, fecha=datetime(2026, 9, 5))

    valor = AlertService._calculate_metric_value('leads', date(2026, 9, 1), date(2026, 9, 10), 'keyword', 'promo-sep')

    assert valor == 1.0


def test_scope_campaign_incluye_todos_los_anuncios_de_esa_campana(db):
    camp_a = Campaign(name='Campaña A')
    camp_b = Campaign(name='Campaña B')
    db.session.add_all([camp_a, camp_b])
    db.session.commit()
    adset_a = AdSet(campaign_id=camp_a.id, name='AS-A')
    adset_b = AdSet(campaign_id=camp_b.id, name='AS-B')
    db.session.add_all([adset_a, adset_b])
    db.session.commit()
    ad_a1 = crear_ad(db, adset_a, nombre='A1')
    ad_a2 = crear_ad(db, adset_a, nombre='A2')
    ad_b1 = crear_ad(db, adset_b, nombre='B1')
    lead_answer(db, ad_a1, fecha=datetime(2026, 9, 5))
    lead_answer(db, ad_a2, fecha=datetime(2026, 9, 6))
    lead_answer(db, ad_b1, fecha=datetime(2026, 9, 5))

    valor = AlertService._calculate_metric_value('leads', date(2026, 9, 1), date(2026, 9, 10), 'campaign', 'Campaña A')

    assert valor == 2.0


def test_scope_ad_por_nombre_exacto(db, campana):
    _, adset = campana
    ad1 = crear_ad(db, adset, nombre='Anuncio Elegido')
    ad2 = crear_ad(db, adset, nombre='Otro Anuncio')
    lead_answer(db, ad1, fecha=datetime(2026, 9, 5))
    lead_answer(db, ad2, fecha=datetime(2026, 9, 5))

    valor = AlertService._calculate_metric_value('leads', date(2026, 9, 1), date(2026, 9, 10), 'ad', 'Anuncio Elegido')

    assert valor == 1.0


def test_un_scope_cuyo_valor_no_matchea_ningun_anuncio_da_cero(db, campana):
    _, adset = campana
    crear_ad(db, adset, keyword='algo')

    assert AlertService._calculate_metric_value('leads', date(2026, 9, 1), date(2026, 9, 10),
                                                'keyword', 'no-existe') == 0.0


# --- _calculate_metric_value: agendas / ventas / cash_collect, scope 'all' -----------------------

def test_agendas_todas_cuenta_sin_filtrar_por_ningun_lead(db):
    db.session.add_all([
        FinancialAgenda(nombre='X', date=datetime(2026, 9, 5)),
        FinancialAgenda(nombre='Y', date=datetime(2026, 9, 6)),
        FinancialAgenda(nombre='Z', date=datetime(2026, 8, 1)),  # fuera de rango
    ])
    db.session.commit()

    assert AlertService._calculate_metric_value('agendas', date(2026, 9, 1), date(2026, 9, 10), 'all', None) == 2.0


@pytest.mark.parametrize('estado,cuenta', [
    ('Completada', True), (None, True), ('', True), ('Cancelada', False), ('Pendiente', False),
])
def test_ventas_solo_cuenta_completada_o_sin_estado(db, estado, cuenta):
    db.session.add(FinancialSale(monto=100.0, estado=estado, date=datetime(2026, 9, 5)))
    db.session.commit()

    valor = AlertService._calculate_metric_value('ventas', date(2026, 9, 1), date(2026, 9, 10), 'all', None)

    assert valor == (1.0 if cuenta else 0.0)


def test_cash_collect_suma_el_monto_de_las_ventas_que_cuentan(db):
    db.session.add_all([
        FinancialSale(monto=100.0, estado='Completada', date=datetime(2026, 9, 5)),
        FinancialSale(monto=250.5, estado='Completada', date=datetime(2026, 9, 6)),
        FinancialSale(monto=999.0, estado='Cancelada', date=datetime(2026, 9, 7)),
    ])
    db.session.commit()

    assert AlertService._calculate_metric_value('cash_collect', date(2026, 9, 1), date(2026, 9, 10),
                                                'all', None) == 350.5


# --- _calculate_metric_value: agendas / ventas acotadas por el Instagram del lead -----------------

def test_agendas_con_scope_solo_cuenta_las_del_instagram_del_lead_matcheado(db, campana):
    _, adset = campana
    ad = crear_ad(db, adset, keyword='promo-sep')
    lead_answer(db, ad, ig='@Elegido')

    db.session.add_all([
        FinancialAgenda(nombre='X', instagram='elegido', date=datetime(2026, 9, 5)),  # matchea normalizado
        FinancialAgenda(nombre='X', instagram='otro-cualquiera', date=datetime(2026, 9, 6)),
    ])
    db.session.commit()

    valor = AlertService._calculate_metric_value('agendas', date(2026, 9, 1), date(2026, 9, 10), 'keyword', 'promo-sep')

    assert valor == 1.0


def test_agendas_con_scope_pero_sin_ningun_lead_matcheado_da_cero_y_no_el_total_de_la_empresa(db, campana):
    # Antes: sin ig_list (el anuncio no tiene ningun lead todavia), el filtro se saltaba entero y
    # devolvia el conteo de TODAS las agendas de la empresa, no las de este anuncio.
    _, adset = campana
    crear_ad(db, adset, keyword='promo-sep')  # sin ninguna LeadAnswer

    db.session.add(FinancialAgenda(nombre='X', instagram='sin-relacion-alguna', date=datetime(2026, 9, 5)))
    db.session.commit()

    valor = AlertService._calculate_metric_value('agendas', date(2026, 9, 1), date(2026, 9, 10), 'keyword', 'promo-sep')

    assert valor == 0.0


def test_ventas_con_scope_pero_sin_ningun_lead_matcheado_da_cero(db, campana):
    _, adset = campana
    crear_ad(db, adset, keyword='promo-sep')

    db.session.add(FinancialSale(monto=999.0, instagram='sin-relacion', estado='Completada',
                                 date=datetime(2026, 9, 5)))
    db.session.commit()

    for metrica in ('ventas', 'cash_collect'):
        assert AlertService._calculate_metric_value(metrica, date(2026, 9, 1), date(2026, 9, 10),
                                                     'keyword', 'promo-sep') == 0.0


def test_el_instagram_se_busca_tambien_dentro_de_raw_data_si_la_columna_esta_vacia(db, campana):
    _, adset = campana
    ad = crear_ad(db, adset, keyword='promo-sep')
    lead_answer(db, ad, ig='desdeigraw')

    db.session.add(FinancialSale(monto=500.0, instagram=None, estado='Completada',
                                 raw_data={'instagram': '@DesdeIgRaw'}, date=datetime(2026, 9, 5)))
    db.session.commit()

    valor = AlertService._calculate_metric_value('ventas', date(2026, 9, 1), date(2026, 9, 10), 'keyword', 'promo-sep')

    assert valor == 1.0


# --- _calculate_spend_for_ads ----------------------------------------------------------------------

def test_spend_directo_del_ad_se_prorratea_por_los_dias_pedidos(db, campana):
    _, adset = campana
    ad = crear_ad(db, adset)
    db.session.add(AdPeriodSpend(ad_id=ad.id, start_date=date(2026, 9, 1), end_date=date(2026, 9, 7), spend=70.0))
    db.session.commit()

    completo = AlertService._calculate_spend_for_ads([ad], date(2026, 9, 1), date(2026, 9, 7))
    mitad = AlertService._calculate_spend_for_ads([ad], date(2026, 9, 1), date(2026, 9, 3))  # 3 de 7 dias

    assert completo == 70.0
    assert mitad == pytest.approx(30.0)


def test_spend_del_adset_se_reparte_entre_sus_anuncios(db, campana):
    _, adset = campana
    ad1 = crear_ad(db, adset, nombre='A1')
    ad2 = crear_ad(db, adset, nombre='A2')
    db.session.add(AdPeriodSpend(ad_set_id=adset.id, start_date=date(2026, 9, 1), end_date=date(2026, 9, 7), spend=140.0))
    db.session.commit()

    # Cada ad no tiene spend propio: toma su parte del adset (140/2=70 cada uno).
    assert AlertService._calculate_spend_for_ads([ad1], date(2026, 9, 1), date(2026, 9, 7)) == 70.0
    assert AlertService._calculate_spend_for_ads([ad1, ad2], date(2026, 9, 1), date(2026, 9, 7)) == 140.0


def test_spend_de_la_campana_se_reparte_entre_todos_sus_anuncios(db, campana):
    camp, adset = campana
    ad1 = crear_ad(db, adset, nombre='A1')
    ad2 = crear_ad(db, adset, nombre='A2')
    db.session.add(AdPeriodSpend(campaign_id=camp.id, start_date=date(2026, 9, 1), end_date=date(2026, 9, 7), spend=100.0))
    db.session.commit()

    assert AlertService._calculate_spend_for_ads([ad1], date(2026, 9, 1), date(2026, 9, 7)) == 50.0


def test_sin_ningun_ad_period_spend_cae_al_prorrateo_historico(db, campana):
    _, adset = campana
    ad = crear_ad(db, adset, total_spend=100.0, creado=datetime.utcnow() - timedelta(days=9))

    total = AlertService._calculate_spend_for_ads([ad], date.today() - timedelta(days=6), date.today())

    # tasa diaria = 100 / dias_de_vida; * 7 dias pedidos (rango de 7 dias inclusive)
    dias_de_vida = (date.today() - (date.today() - timedelta(days=9))).days + 1
    esperado = (100.0 / dias_de_vida) * 7
    assert total == pytest.approx(esperado)


def test_una_lista_vacia_de_ads_da_gasto_cero(db):
    assert AlertService._calculate_spend_for_ads([], date(2026, 9, 1), date(2026, 9, 7)) == 0.0
