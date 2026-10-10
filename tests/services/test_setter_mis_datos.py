"""«Mis datos» del setter: el reporte sumado, el sistema al lado y el embudo de punta a punta.

Lo que se fija acá es lo que hacía que «no cuadrara» (10/10/2026): que el reporte y el sistema no se
mezclen, que los reportes v1 sumen sin inventar canales, que el período sea el pedido y que la
comparación salga de la misma cuenta. Y los embudos de Comparativas: uno por setter y el del
equipo recalculado sobre el total.
"""
import itertools
from datetime import date, datetime, timedelta

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, SetterDailyStats
from app.services import comercial_analitica as ca
from app.services import setter_mis_datos as smd
from app.services import setter_reporte_v2 as rv2

SEPT = (date(2026, 9, 1), date(2026, 9, 30))
AGOSTO = (date(2026, 8, 1), date(2026, 8, 31))
_mails = itertools.count(1)


@pytest.fixture()
def elias(make_user):
    return make_user(role='setter', username='Elias')


@pytest.fixture()
def paula(make_user):
    return make_user(role='setter', username='Paula')


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='Marlon')


def v2(db, setter, dia, *, ads=(0, 0, 0, 0, 0, 0), inb=(0, 0, 0, 0, 0, 0), bnv=(0, 0, 0),
       embudo=(0, 0, 0), fu=(0, 0, 0, 0), win='', no_laborable=False):
    """Un reporte v2. `ads`/`inb`: (entrantes, no_lead, inabribles, ap_entrantes, ap_dolor, agendas)."""
    datos = rv2.vacio()
    for canal, valores in (('anuncios', ads), ('inbound', inb)):
        datos[canal].update(dict(zip(rv2.CAMPOS_CANAL, valores)))
    datos['bienvenidas'].update(dict(zip(('hechas', 'respondidas', 'aperturas'), bnv)))
    datos['embudo'].update(dict(zip(('dolor', 'oferta', 'link'), embudo)))
    datos['followups'].update(dict(zip(('entrantes', 'dolor', 'oferta', 'link'), fu)))
    datos['reflexion']['win_del_dia'] = win
    stat = rv2.escribir(SetterDailyStats(setter_id=setter.id, date=dia), datos)
    stat.is_non_working_day = no_laborable
    db.session.add(stat)
    db.session.commit()
    return stat


def v1(db, setter, dia, *, entrantes=0, no_lead=0, inabribles=0, respondieron=0, dolor=0,
       oferta=0, link=0, agenda=0, win=None):
    """Un reporte como los de antes del 10/10/2026: solo totales, sin canales ni bienvenidas."""
    stat = SetterDailyStats(
        setter_id=setter.id, date=dia, inbox_entrantes=entrantes, not_lead=no_lead,
        inbox_inabribles=inabribles, funnel_qualification=respondieron, funnel_pain=dolor,
        funnel_offer=oferta, funnel_link=link, funnel_agenda=agenda,
        reflections={'daily_reflection': 'algo', 'win_of_day': win} if win is not None else None)
    db.session.add(stat)
    db.session.commit()
    return stat


def generada(db, setter, closer, *, creada=datetime(2026, 9, 10, 15), reunion=None,
             closer_result='Pendiente'):
    cli = Client(full_name=f'Lead {next(_mails)}', email=f'lead{next(_mails)}@test.local')
    db.session.add(cli)
    db.session.commit()
    a = Appointment(closer_id=closer.id, client_id=cli.id, setter_id=setter.id, origin='Setter',
                    start_time=reunion or creada + timedelta(days=2), created_at=creada,
                    result='Confirmado', closer_result=closer_result)
    db.session.add(a)
    db.session.commit()
    return a


# --- El reporte sumado ----------------------------------------------------------------------------

@freeze_time('2026-10-10 15:00:00')
def test_suma_v1_y_v2_en_los_totales_y_el_v1_va_aparte_en_lo_por_canal(db, elias):
    v2(db, elias, date(2026, 9, 1), ads=(10, 1, 0, 3, 5, 2), inb=(6, 0, 1, 1, 3, 1), embudo=(10, 7, 5))
    v1(db, elias, date(2026, 9, 2), entrantes=20, no_lead=4, respondieron=16, dolor=6, oferta=3,
       link=2, agenda=2)

    d = smd.mis_datos(elias.id, *SEPT)

    rep = d['reporte']
    assert rep['totales']['entrantes'] == 36
    assert rep['totales']['agendas'] == 5
    # Cualificados: v2 = (10-1-0) + (6-0-1) = 14; v1 = respondieron - no leads = 12.
    assert rep['totales']['cualificados'] == 26
    assert rep['canales']['anuncios']['entrantes'] == 10 and rep['canales']['inbound']['entrantes'] == 6
    assert rep['sin_canal']['entrantes'] == 20 and rep['sin_canal']['agendas'] == 2
    assert (rep['reportes'], rep['reportes_v2']) == (2, 1)
    agendas = next(e for e in d['embudo'] if e['key'] == 'agendas')
    assert {p['key']: p['n'] for p in agendas['partes']} == {'anuncios': 2, 'inbound': 1, 'sin_canal': 2}
    assert sum(p['n'] for p in agendas['partes']) == agendas['n']


@freeze_time('2026-10-10 15:00:00')
def test_las_tasas_se_miden_como_en_el_formulario(db, elias):
    v2(db, elias, date(2026, 9, 1), ads=(10, 1, 0, 3, 5, 2), inb=(6, 0, 1, 1, 3, 1),
       bnv=(12, 5, 4), embudo=(10, 7, 5), fu=(9, 5, 3, 3))

    rep = smd.mis_datos(elias.id, *SEPT)['reporte']

    assert rep['tasas']['cualificacion'] == round(14 / 16 * 100, 1)
    assert rep['tasas']['apertura'] == round(12 / 16 * 100, 1)
    assert rep['tasas']['bienvenidas_respuesta'] == round(5 / 12 * 100, 1)
    assert rep['tasas']['bienvenidas_apertura'] == 80.0
    assert rep['tasas']['conversion'] == round(3 / 14 * 100, 1)
    assert rep['canales']['anuncios']['cualificacion'] == 90.0
    assert rep['followups_total'] == 20


@freeze_time('2026-10-10 15:00:00')
def test_sin_reportes_las_tasas_son_none_y_no_cero(db, elias):
    rep = smd.mis_datos(elias.id, *SEPT)['reporte']

    assert rep['totales']['entrantes'] == 0
    assert all(v is None for v in rep['tasas'].values())


# --- El período --------------------------------------------------------------------------------

@freeze_time('2026-10-10 15:00:00')
def test_solo_cuentan_los_reportes_y_las_agendas_del_periodo(db, elias, closer):
    v2(db, elias, date(2026, 9, 30), ads=(5, 0, 0, 0, 0, 1))
    v2(db, elias, date(2026, 10, 1), ads=(50, 0, 0, 0, 0, 9))
    generada(db, elias, closer, creada=datetime(2026, 9, 20, 15))
    # Creada en octubre para una reunión de septiembre: no es trabajo de septiembre.
    generada(db, elias, closer, creada=datetime(2026, 10, 2, 15), reunion=datetime(2026, 9, 29, 15))

    d = smd.mis_datos(elias.id, *SEPT)

    assert d['reporte']['totales']['entrantes'] == 5
    assert d['sistema']['generadas'] == 1


@freeze_time('2026-10-10 15:00:00')
def test_compara_contra_el_periodo_anterior_con_la_misma_cuenta(db, elias, closer):
    v2(db, elias, date(2026, 9, 1), ads=(30, 0, 0, 0, 0, 3))
    v2(db, elias, date(2026, 8, 5), ads=(20, 0, 0, 0, 0, 4))
    generada(db, elias, closer, creada=datetime(2026, 9, 3, 15))
    generada(db, elias, closer, creada=datetime(2026, 8, 3, 15))
    generada(db, elias, closer, creada=datetime(2026, 8, 4, 15))

    d = smd.mis_datos(elias.id, *SEPT, *AGOSTO)

    assert d['previo']['reporte']['totales']['entrantes'] == 20
    assert d['previo']['sistema']['generadas'] == 2
    assert d['deltas']['entrantes'] == {'valor': 50.0, 'modo': 'pct'}
    assert d['deltas']['agendas'] == {'valor': -25.0, 'modo': 'pct'}
    assert d['deltas']['generadas'] == {'valor': -50.0, 'modo': 'pct'}
    # Una tasa se compara en puntos: 100% contra 100% de cualificación.
    assert d['deltas']['cualificacion'] == {'valor': 0.0, 'modo': 'pts'}


@freeze_time('2026-10-10 15:00:00')
def test_sin_comparacion_no_hay_previo_ni_deltas(db, elias):
    d = smd.mis_datos(elias.id, *SEPT)

    assert d['previo'] is None and d['deltas'] == {}


# --- Reporte y sistema, cada uno con su nombre ------------------------------------------------------

@freeze_time('2026-10-10 15:00:00')
def test_las_agendas_reportadas_y_las_generadas_van_juntas_con_su_diferencia(db, elias, closer):
    v2(db, elias, date(2026, 9, 10), ads=(10, 0, 0, 0, 0, 3))
    generada(db, elias, closer, creada=datetime(2026, 9, 10, 15))
    generada(db, elias, closer, creada=datetime(2026, 9, 11, 15), closer_result='Show up')

    d = smd.mis_datos(elias.id, *SEPT)

    agendas = next(f for f in d['contraste'] if f['key'] == 'agendas')
    assert (agendas['reportado'], agendas['sistema'], agendas['diferencia']) == (3, 2, 1)
    assert (d['sistema']['generadas'], d['sistema']['asistieron']) == (2, 1)


@freeze_time('2026-10-10 15:00:00')
def test_el_embudo_va_de_los_entrantes_a_las_ventas_con_cada_conversion(db, elias, closer):
    v2(db, elias, date(2026, 9, 10), ads=(20, 4, 0, 0, 0, 4), embudo=(10, 8, 5))
    generada(db, elias, closer, creada=datetime(2026, 9, 10, 15), closer_result='Show up')
    generada(db, elias, closer, creada=datetime(2026, 9, 11, 15), closer_result='No Show')

    etapas = smd.mis_datos(elias.id, *SEPT)['embudo']

    assert [e['key'] for e in etapas] == ['entrantes', 'cualificados', 'dolor', 'oferta', 'link',
                                          'agendas', 'generadas', 'asistieron', 'ventas']
    assert [e['n'] for e in etapas] == [20, 16, 10, 8, 5, 4, 2, 1, 0]
    assert [e['fuente'] for e in etapas] == ['reporte'] * 6 + ['sistema'] * 3
    assert etapas[0]['tasa'] is None
    assert (etapas[1]['tasa'], etapas[5]['tasa'], etapas[7]['tasa']) == (80.0, 80.0, 50.0)
    # El paso del reporte al sistema no es una conversión: se marca como cruce.
    assert [e.get('cruce', False) for e in etapas].index(True) == 6


@freeze_time('2026-10-10 15:00:00')
def test_cuenta_los_dias_reportados_contra_los_habiles(db, elias):
    v2(db, elias, date(2026, 9, 1))           # martes
    v2(db, elias, date(2026, 9, 5))           # sábado
    v2(db, elias, date(2026, 9, 7), no_laborable=True)

    dias = smd.mis_datos(elias.id, *SEPT)['dias']

    assert (dias['habiles'], dias['periodo']) == (22, 30)
    assert (dias['reportados'], dias['en_fin_de_semana'], dias['no_laborables']) == (2, 1, 1)
    estados = {d['fecha']: d['estado'] for d in dias['detalle']}
    assert (estados['2026-09-01'], estados['2026-09-02'], estados['2026-09-06'],
            estados['2026-09-07']) == ('reportado', 'falta', 'finde', 'no_laborable')


@freeze_time('2026-10-10 15:00:00')
def test_los_wins_son_los_ultimos_con_texto_tambien_los_del_v1(db, elias):
    v1(db, elias, date(2026, 9, 1), win='Agendé a una fría')
    v1(db, elias, date(2026, 9, 2), win='-')
    v2(db, elias, date(2026, 9, 3), win='Volvió un lead de agosto')
    v2(db, elias, date(2026, 9, 4), win='ninguno')

    wins = smd.mis_datos(elias.id, *SEPT)['wins']

    assert wins == [{'fecha': '2026-09-03', 'texto': 'Volvió un lead de agosto'},
                    {'fecha': '2026-09-01', 'texto': 'Agendé a una fría'}]


@freeze_time('2026-10-10 15:00:00')
def test_un_setter_sin_nada_ve_ceros_y_no_lo_del_equipo(db, elias, paula, closer):
    v2(db, paula, date(2026, 9, 3), ads=(40, 0, 0, 0, 0, 5), win='De Paula')
    generada(db, paula, closer, creada=datetime(2026, 9, 3, 15))

    d = smd.mis_datos(elias.id, *SEPT)

    assert d['reporte']['totales']['entrantes'] == 0
    assert d['sistema']['generadas'] == 0
    assert d['wins'] == []
    assert d['dias']['reportados'] == 0


def test_lecturas_por_setter_con_una_lista_vacia_no_trae_a_todos(db, elias):
    v2(db, elias, date(2026, 9, 3), ads=(4, 0, 0, 0, 0, 0))

    assert smd.lecturas_por_setter(*SEPT, setter_ids=[]) == {}
    assert list(smd.lecturas_por_setter(*SEPT)) == [elias.id]


def test_los_reportes_de_alguien_que_no_es_setter_no_cuentan(db, elias, closer):
    v2(db, closer, date(2026, 9, 3), ads=(99, 0, 0, 0, 0, 9))

    assert smd.lecturas_por_setter(*SEPT) == {}


# --- Los embudos de Comparativas -----------------------------------------------------------------

@freeze_time('2026-10-10 15:00:00')
def test_comparativas_de_setters_trae_un_embudo_por_setter_y_el_del_equipo(db, elias, paula, closer):
    v2(db, elias, date(2026, 9, 3), ads=(30, 10, 0, 0, 0, 3), embudo=(8, 5, 4))
    v2(db, paula, date(2026, 9, 3), ads=(10, 0, 0, 0, 0, 2), embudo=(6, 4, 2))
    generada(db, elias, closer, creada=datetime(2026, 9, 3, 15), closer_result='Show up')
    generada(db, paula, closer, creada=datetime(2026, 9, 4, 15))

    emb = ca.comparativas('setters', *SEPT)['embudos']

    por_nombre = {f['nombre']: [e['n'] for e in f['etapas']] for f in emb['filas']}
    assert por_nombre == {'Elias': [30, 20, 8, 5, 4, 3, 1, 1, 0], 'Paula': [10, 10, 6, 4, 2, 2, 1, 0, 0]}
    equipo = emb['equipo']
    assert [e['n'] for e in equipo['etapas']] == [40, 30, 14, 9, 6, 5, 2, 1, 0]
    # La tasa del equipo sale del total (30 de 40 = 75%), no del promedio de 66,7% y 100%.
    assert equipo['etapas'][1]['tasa'] == 75.0


@freeze_time('2026-10-10 15:00:00')
def test_la_comparativa_de_closers_no_trae_embudos(db, closer):
    assert 'embudos' not in ca.comparativas('closers', *SEPT)


@freeze_time('2026-10-10 15:00:00')
def test_comparativas_lee_los_reportes_una_sola_vez(db, elias, paula, monkeypatch):
    llamadas = []
    original = smd.lecturas_por_setter
    monkeypatch.setattr(smd, 'lecturas_por_setter', lambda *a, **k: llamadas.append(a) or original(*a, **k))

    ca.comparativas('setters', *SEPT, *AGOSTO)

    assert len(llamadas) == 1
