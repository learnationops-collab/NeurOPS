"""comercial_analitica: Analizar (tiles, embudo, señas, programas) y Comparativas.

El módulo no consulta nada propio — agrega las filas de `ComercialService` —, así que lo que hay
que probar es la agregación y, sobre todo, las decisiones que no son obvias:

  · el embudo nunca puede mostrar más ventas que presentaciones;
  · una seña sin venta posterior es "en espera" mientras es reciente y "caída" después;
  · los deltas de una tasa se expresan en puntos y los de un monto en porcentaje;
  · la fila "Equipo" no es el promedio de las filas: se recalcula sobre el total.
"""
import itertools
from datetime import datetime, timedelta

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale
from app.services import comercial_analitica as ca

HOY = '2026-09-17 21:30:00'
DESDE = datetime(2026, 9, 1).date()
HASTA = datetime(2026, 9, 30).date()
AGOSTO = (datetime(2026, 8, 1).date(), datetime(2026, 8, 31).date())

_emails = itertools.count(1)


@pytest.fixture()
def marlon(make_user):
    return make_user(role='closer', username='Marlon', email='marlon@thelearnation.com')


@pytest.fixture()
def nerina(make_user):
    return make_user(role='closer', username='Nerina', email='nerina@thelearnation.com')


def cliente(db, nombre='Cliente', email=None, ig=None):
    c = Client(full_name=nombre, email=email or f'cliente{next(_emails)}@test.local', instagram=ig)
    db.session.add(c)
    db.session.commit()
    return c


def agenda(db, closer, cli, *, cuando=datetime(2026, 9, 10, 15, 0), result='Confirmado',
           closer_result='Pendiente', **campos):
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=cuando, result=result,
                    closer_result=closer_result, origin='Setter', created_at=cuando - timedelta(days=1),
                    **campos)
    db.session.add(a)
    db.session.commit()
    return a


def venta(db, *, mail=None, ig=None, monto=990.0, tipo='AL - Completo', metodo='zelle',
          vendedor='marlon@thelearnation.com', fecha=datetime(2026, 9, 10)):
    v = FinancialSale(mail_cliente=mail, instagram=ig, monto=monto, tipo_pago=tipo, metodo_pago=metodo,
                      email_vendedor=vendedor, date=fecha, estado='Completada')
    db.session.add(v)
    db.session.commit()
    return v


# --- Embudo --------------------------------------------------------------------------------------

@freeze_time(HOY)
def test_el_embudo_encadena_los_cinco_pasos(db, marlon):
    confirmada_y_asistio = cliente(db, 'Asistio', email='asistio@test.local')
    agenda(db, marlon, confirmada_y_asistio, closer_result='Show up')
    venta(db, mail='asistio@test.local')
    agenda(db, marlon, cliente(db, 'No Vino'), closer_result='No Show')
    agenda(db, marlon, cliente(db, 'Sin Confirmar'), result='Pendiente')

    pasos = {p['paso']: p['n'] for p in ca.bloque_closers(DESDE, HASTA)['funnel']}

    assert pasos == {'Agendas': 3, 'Confirmadas': 2, 'Asistieron': 1, 'Presentaciones': 1, 'Ventas': 1}


@freeze_time(HOY)
def test_una_venta_cuenta_como_presentacion_aunque_nadie_haya_tildado_la_oferta(db, marlon):
    # `offer_presented` queda en None muy seguido. Sin esta regla el embudo mostraría 1 venta
    # sobre 0 presentaciones, que es imposible.
    cli = cliente(db, 'Compro', email='compro@test.local')
    agenda(db, marlon, cli, closer_result='Show up', offer_presented=None)
    venta(db, mail='compro@test.local')

    pasos = {p['paso']: p['n'] for p in ca.bloque_closers(DESDE, HASTA)['funnel']}

    assert pasos['Presentaciones'] >= pasos['Ventas'] == 1


@freeze_time(HOY)
def test_asistio_con_la_oferta_tildada_cuenta_como_presentacion_sin_venta(db, marlon):
    agenda(db, marlon, cliente(db, 'Escucho'), closer_result='Show up', offer_presented=True)

    pasos = {p['paso']: p['n'] for p in ca.bloque_closers(DESDE, HASTA)['funnel']}

    assert (pasos['Presentaciones'], pasos['Ventas']) == (1, 0)


# --- Señas ---------------------------------------------------------------------------------------

@freeze_time(HOY)
def test_una_senia_con_venta_posterior_cuenta_como_convertida_y_desbloquea_su_cash(db, marlon):
    venta(db, mail='lead@test.local', monto=100.0, tipo='AL - Seña', fecha=datetime(2026, 9, 5))
    venta(db, mail='lead@test.local', monto=990.0, tipo='AL - Completo', fecha=datetime(2026, 9, 12))

    senas = ca.bloque_closers(DESDE, HASTA)['senas']

    assert (senas['total'], senas['completo'], senas['parcial']) == (1, 1, 0)
    assert (senas['cobrado'], senas['desbloqueado']) == (100.0, 990.0)
    assert senas['conversion'] == 100.0


@freeze_time(HOY)
def test_una_senia_reciente_sin_venta_queda_en_espera_no_caida(db, marlon):
    venta(db, mail='lead@test.local', monto=100.0, tipo='AL - Seña', fecha=datetime(2026, 9, 12))

    senas = ca.bloque_closers(DESDE, HASTA)['senas']

    assert (senas['espera'], senas['caida']) == (1, 0)


@freeze_time(HOY)
def test_una_senia_vieja_sin_venta_cuenta_como_caida(db, marlon):
    # 1 de agosto contra un período que termina el 30 de septiembre: más de 30 días sin completar.
    venta(db, mail='lead@test.local', monto=100.0, tipo='AL - Seña', fecha=datetime(2026, 8, 1))

    senas = ca.bloque_closers(*AGOSTO)['senas']

    assert (senas['espera'], senas['caida']) == (0, 1)


@freeze_time(HOY)
def test_una_venta_anterior_a_la_senia_no_la_convierte(db, marlon):
    # El lead ya había comprado otra cosa en agosto; la seña de septiembre sigue sin completarse.
    venta(db, mail='lead@test.local', monto=990.0, tipo='AL - Completo', fecha=datetime(2026, 8, 1))
    venta(db, mail='lead@test.local', monto=100.0, tipo='RR - Seña', fecha=datetime(2026, 9, 12))

    senas = ca.bloque_closers(DESDE, HASTA)['senas']

    assert (senas['completo'], senas['espera']) == (0, 1)


@freeze_time(HOY)
def test_sin_senias_los_contadores_son_cero_y_la_conversion_none(db, marlon):
    venta(db, mail='lead@test.local', tipo='AL - Completo')

    senas = ca.bloque_closers(DESDE, HASTA)['senas']

    assert (senas['total'], senas['cobrado'], senas['conversion']) == (0, 0.0, None)


# --- Programas y tipos de pago ---------------------------------------------------------------------

@freeze_time(HOY)
def test_cada_programa_trae_su_desglose_por_tipo_de_pago(db, marlon):
    venta(db, mail='a@test.local', monto=990.0, tipo='AL - Completo')
    venta(db, mail='b@test.local', monto=500.0, tipo='AL - Parcial')
    venta(db, mail='c@test.local', monto=1500.0, tipo='RR - Completo')

    programas = {p['programa']: p for p in ca.bloque_closers(DESDE, HASTA)['programas']}

    # Ordenados por cash: Residency (1500) antes que Ace (1490).
    assert [p['programa'] for p in ca.bloque_closers(DESDE, HASTA)['programas']][0] == 'Residency Roadmap'
    assert programas['Ace Learners']['ventas'] == 2
    assert {t['key']: t['cash'] for t in programas['Ace Learners']['por_tipo']} == {
        'completo': 990.0, 'parcial': 500.0}


@freeze_time(HOY)
def test_los_cuatro_tipos_de_pago_aparecen_siempre_aunque_esten_en_cero(db, marlon):
    venta(db, mail='a@test.local', tipo='AL - Completo')

    tipos = ca.bloque_closers(DESDE, HASTA)['payment_types']

    assert [t['key'] for t in tipos] == ['completo', 'parcial', 'cuota', 'seña']
    assert [t['ventas'] for t in tipos] == [1, 0, 0, 0]


@freeze_time(HOY)
def test_el_cash_por_dia_cubre_todo_el_periodo_y_marca_el_mejor_dia(db, marlon):
    venta(db, mail='a@test.local', monto=300.0, fecha=datetime(2026, 9, 3))
    venta(db, mail='b@test.local', monto=1943.0, fecha=datetime(2026, 9, 11))

    bloque = ca.bloque_closers(DESDE, HASTA)

    assert len(bloque['cash_por_dia']) == 30
    assert bloque['mejor_dia'] == {'dia': '2026-09-11', 'cash': 1943.0}


# --- Deltas ----------------------------------------------------------------------------------------

@pytest.mark.parametrize('actual,previo,modo,esperado', [
    (63.2, 55.0, 'pts', {'valor': 8.2, 'modo': 'pts'}),
    (1000.0, 800.0, 'pct', {'valor': 25.0, 'modo': 'pct'}),
    # Sin período comparado, o sin base contra la que dividir, no hay delta: un "+∞%" no informa.
    (100.0, None, 'pct', None),
    (None, 100.0, 'pct', None),
    (100.0, 0, 'pct', None),
    # En puntos, en cambio, pasar de 0 a 40 sí es un dato legible.
    (40.0, 0, 'pts', {'valor': 40.0, 'modo': 'pts'}),
])
def test_delta_distingue_puntos_de_porcentaje(actual, previo, modo, esperado):
    assert ca.delta(actual, previo, modo) == esperado


@freeze_time(HOY)
def test_el_resumen_compara_contra_el_periodo_anterior(db, marlon):
    venta(db, mail='a@test.local', monto=1000.0, fecha=datetime(2026, 9, 10))
    venta(db, mail='b@test.local', monto=800.0, fecha=datetime(2026, 8, 10))

    resumen = ca.resumen('closers', DESDE, HASTA, *AGOSTO)

    assert resumen['actual']['cash'] == 1000.0
    assert resumen['previo']['cash'] == 800.0
    assert resumen['deltas']['cash'] == {'valor': 25.0, 'modo': 'pct'}


@freeze_time(HOY)
def test_sin_comparacion_el_resumen_no_trae_deltas(db, marlon):
    venta(db, mail='a@test.local', monto=1000.0)

    resumen = ca.resumen('closers', DESDE, HASTA)

    assert resumen['previo'] is None
    assert resumen['deltas'] == {}


# --- Comparativas ------------------------------------------------------------------------------------

@freeze_time(HOY)
def test_el_ranking_trae_una_fila_por_persona_activa(db, marlon, nerina):
    venta(db, mail='a@test.local', monto=1000.0, vendedor='marlon@thelearnation.com')
    venta(db, mail='b@test.local', monto=400.0, vendedor='nerina@thelearnation.com')

    comp = ca.comparativas('closers', DESDE, HASTA)

    por_nombre = {f['nombre']: f for f in comp['filas']}
    assert set(por_nombre) == {'Marlon', 'Nerina'}
    assert (por_nombre['Marlon']['cash'], por_nombre['Nerina']['cash']) == (1000.0, 400.0)


@freeze_time(HOY)
def test_la_fila_de_equipo_recalcula_las_tasas_en_vez_de_promediarlas(db, marlon, nerina):
    # Marlon: 1 de 1 asistió (100%). Nerina: 0 de 3 (0%). El promedio de las dos tasas sería 50%,
    # pero el show up real del equipo es 1 de 4 = 25%.
    agenda(db, marlon, cliente(db, 'Vino'), closer_result='Show up')
    for i in range(3):
        agenda(db, nerina, cliente(db, f'No vino {i}'), closer_result='No Show')

    comp = ca.comparativas('closers', DESDE, HASTA)

    por_nombre = {f['nombre']: f for f in comp['filas']}
    assert (por_nombre['Marlon']['show_up'], por_nombre['Nerina']['show_up']) == (100.0, 0.0)
    assert comp['equipo']['show_up'] == 25.0


@freeze_time(HOY)
def test_las_metricas_rankeables_son_las_del_disenio_y_en_ese_orden(db, marlon):
    comp = ca.comparativas('closers', DESDE, HASTA)

    assert [m['key'] for m in comp['metricas']] == [
        'cash', 'show_up', 'close_rate', 'ticket', 'comision', 'senas_conversion', 'agendas']
    # Los tipos de pago y los programas no rankean: son columnas informativas del mapa.
    assert [c['key'] for c in comp['columnas_info']] == ['completo_pct', 'residency_pct']


@freeze_time(HOY)
def test_la_comision_es_el_diez_por_ciento_del_cash_neto(db, marlon):
    venta(db, mail='a@test.local', monto=1000.0, metodo='Stripe')

    fila = ca.comparativas('closers', DESDE, HASTA)['filas'][0]

    assert fila['cash'] == 1000.0
    assert fila['comision'] == 95.5  # 1000 × 0.955 de fee × 10%


@freeze_time(HOY)
def test_cada_fila_del_ranking_trae_su_delta_por_metrica(db, marlon):
    venta(db, mail='a@test.local', monto=1000.0, fecha=datetime(2026, 9, 10))
    venta(db, mail='b@test.local', monto=500.0, fecha=datetime(2026, 8, 10))

    fila = ca.comparativas('closers', DESDE, HASTA, *AGOSTO)['filas'][0]

    assert fila['deltas']['cash'] == {'valor': 100.0, 'modo': 'pct'}
