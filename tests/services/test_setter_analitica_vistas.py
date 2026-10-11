"""El bloque de setters visto desde las tres pestañas de Analizar: el Dashboard (`resumen`, con sus
deltas por canal y la comisión del mes), Comparativas (ranking, mapa y embudos) y Variabilidad.

Las tres leen el mismo bloque (`setter_analitica`), así que lo que se fija acá es que no vuelvan a
ManyChat por ningún costado y que los totales cierren entre ellas.
"""
from datetime import date, datetime

import pytest
from freezegun import freeze_time

from app.services import comercial_analitica as ca
from app.services import setter_analitica as sa
from tests.services.reportes_setter import AGOSTO, SEPT, generada, v1, v2

HOY = '2026-10-10 15:00:00'


@pytest.fixture()
def elias(make_user):
    return make_user(role='setter', username='Elias')


@pytest.fixture()
def paula(make_user):
    return make_user(role='setter', username='Paula')


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='Marlon')


# --- Dashboard (resumen) --------------------------------------------------------------------------

@freeze_time(HOY)
def test_el_resumen_compara_cada_vista_contra_el_periodo_anterior(db, elias, closer):
    v2(db, elias, date(2026, 9, 1), ads=(30, 0, 0, 0, 0, 3), inb=(10, 0, 0, 0, 0, 1))
    v2(db, elias, date(2026, 8, 5), ads=(20, 0, 0, 0, 0, 4), inb=(10, 0, 0, 0, 0, 1))
    generada(db, elias, closer, creada=datetime(2026, 9, 3, 15))
    generada(db, elias, closer, creada=datetime(2026, 8, 3, 15))
    generada(db, elias, closer, creada=datetime(2026, 8, 4, 15))

    d = ca.resumen('setters', *SEPT, *AGOSTO, miembro_id=elias.id)

    assert d['previo']['entrantes'] == 30
    assert d['deltas']['entrantes'] == {'valor': round((40 - 30) / 30 * 100, 1), 'modo': 'pct'}
    assert d['deltas']['agendas'] == {'valor': -20.0, 'modo': 'pct'}
    assert d['deltas']['generadas'] == {'valor': -50.0, 'modo': 'pct'}
    # Una tasa se compara en puntos: 100% contra 100% de cualificación.
    assert d['deltas']['cualificacion'] == {'valor': 0.0, 'modo': 'pts'}
    # Cada pestaña de canal, contra el mismo canal del período anterior.
    assert d['deltas_canales']['anuncios']['entrantes'] == {'valor': 50.0, 'modo': 'pct'}
    assert d['deltas_canales']['anuncios']['agendas'] == {'valor': -25.0, 'modo': 'pct'}
    assert d['deltas_canales']['inbound']['entrantes'] == {'valor': 0.0, 'modo': 'pct'}


@freeze_time(HOY)
def test_sin_comparacion_no_hay_previo_ni_deltas(db, elias):
    d = ca.resumen('setters', *SEPT, miembro_id=elias.id)

    assert (d['previo'], d['deltas'], d['deltas_canales']) == (None, {}, {})


@freeze_time(HOY)
def test_el_resumen_de_setters_ya_no_trae_nada_de_manychat(db, elias):
    actual = ca.resumen('setters', *SEPT, miembro_id=elias.id)['actual']

    assert not {'leads', 'respondieron', 'respuesta', 'mensajes', 'tenacidad'} & set(actual)


@freeze_time(HOY)
def test_la_comision_del_mes_es_la_del_setter_o_la_suma_del_equipo(db, elias, paula, monkeypatch):
    from app.services.commission_service import CommissionService
    por_setter = {elias.id: 80.0, paula.id: 20.0}
    monkeypatch.setattr(CommissionService, 'get_setter_commission', staticmethod(lambda u: {
        'role': 'setter', 'month': '2026-10', 'rate': 0.08, 'cash_neto': por_setter[u.id] / 0.08,
        'commission': por_setter[u.id]}))

    suya = ca.resumen('setters', *SEPT, miembro_id=elias.id)['comision']
    del_equipo = ca.resumen('setters', *SEPT)['comision']

    assert suya['commission'] == 80.0
    assert (del_equipo['commission'], del_equipo['rate']) == (100.0, 0.08)
    assert 'comision' not in ca.resumen('closers', *SEPT)


# --- Comparativas ---------------------------------------------------------------------------------

@freeze_time(HOY)
def test_el_ranking_de_setters_mide_con_el_reporte_y_el_sistema(db, elias, paula, closer):
    v2(db, elias, date(2026, 9, 3), ads=(30, 10, 0, 6, 0, 3), bnv=(10, 4, 2))
    v2(db, paula, date(2026, 9, 3), ads=(10, 0, 0, 5, 0, 2))
    generada(db, elias, closer, closer_result='Show up')
    generada(db, elias, closer, closer_result='No Show')

    datos = ca.comparativas('setters', *SEPT)

    assert [m['key'] for m in datos['metricas']] == ['entrantes', 'cualificacion', 'apertura', 'agendas',
                                                     'conversion', 'bienvenidas_respuesta', 'show_up',
                                                     'ventas_originadas']
    fila = next(f for f in datos['filas'] if f['nombre'] == 'Elias')
    assert (fila['entrantes'], fila['cualificacion'], fila['apertura'], fila['agendas']) == (30, 66.7, 20.0, 3)
    assert (fila['conversion'], fila['bienvenidas_respuesta'], fila['show_up']) == (10.0, 40.0, 50.0)
    assert (fila['bienvenidas_hechas'], fila['bienvenidas_respondidas'], fila['generadas']) == (10, 4, 2)
    # La fila Equipo recalcula las tasas sobre el total, no promedia las de cada uno.
    assert datos['equipo']['entrantes'] == 40
    assert datos['equipo']['cualificacion'] == 75.0


@freeze_time(HOY)
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


@freeze_time(HOY)
def test_la_comparativa_de_closers_no_trae_embudos(db, closer):
    assert 'embudos' not in ca.comparativas('closers', *SEPT)


@freeze_time(HOY)
@pytest.mark.parametrize('comparar, lecturas', [((), 1), (AGOSTO, 2)])
def test_comparativas_lee_los_reportes_una_vez_por_periodo(db, elias, paula, monkeypatch, comparar, lecturas):
    llamadas = []
    original = sa.lecturas_por_setter
    monkeypatch.setattr(sa, 'lecturas_por_setter', lambda *a, **k: llamadas.append(a) or original(*a, **k))

    ca.comparativas('setters', *SEPT, *comparar)

    assert len(llamadas) == lecturas


# --- Variabilidad ---------------------------------------------------------------------------------

@freeze_time(HOY)
def test_las_series_del_setter_salen_del_reporte_y_del_sistema(db, elias, closer):
    v2(db, elias, date(2026, 9, 1), ads=(10, 2, 0, 4, 0, 2), inb=(6, 0, 0, 3, 0, 1), bnv=(4, 2, 0))
    v1(db, elias, date(2026, 9, 2), entrantes=20, no_lead=4, respondieron=16, agenda=2)
    generada(db, elias, closer, creada=datetime(2026, 9, 3, 15))

    datos = ca.variabilidad('setters', *SEPT, miembro_id=elias.id)
    series = {s['key']: s for s in datos['series']}

    assert list(series) == ['entrantes', 'cualificacion', 'apertura', 'agendas', 'generadas', 'bienvenidas']
    entrantes = {s['label']: s['vals'] for s in series['entrantes']['series']}
    # «Todos» suma lo mismo que el tablero; los canales, solo lo que se cargó por canal (el v1, no).
    assert sum(entrantes['Todos']) == ca.bloque_setters(*SEPT, setter_id=elias.id)['entrantes'] == 36
    assert (sum(entrantes['Anuncios']), sum(entrantes['Inbound'])) == (10, 6)
    assert entrantes['Todos'][:3] == [16, 20, 0]
    cualificacion = {s['label']: s['vals'] for s in series['cualificacion']['series']}
    # El v1: respondieron − no leads = 12 de 20.
    assert cualificacion['Todos'][:2] == [round(14 / 16 * 100, 1), 60.0]
    assert cualificacion['Anuncios'][:2] == [80.0, 0]
    assert sum(series['generadas']['vals']) == 1
    assert series['bienvenidas']['vals'][0] == 50.0


@freeze_time(HOY)
def test_sin_reportes_por_canal_las_series_van_sin_tira(db, elias):
    v1(db, elias, date(2026, 9, 2), entrantes=20, agenda=2)

    series = {s['key']: s for s in ca.variabilidad('setters', *SEPT, miembro_id=elias.id)['series']}

    assert 'series' not in series['entrantes'] and sum(series['entrantes']['vals']) == 20
