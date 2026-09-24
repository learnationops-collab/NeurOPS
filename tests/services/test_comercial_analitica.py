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

from app.models import Appointment, Client, Enrollment, FinancialSale, Payment, Program
from app.services import comercial_analitica as ca
from app.services.comercial_service import ComercialService

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
def test_el_ultimo_paso_del_embudo_cuenta_agendas_y_no_filas_de_venta(db, marlon):
    # Dos cobros del mismo lead en el período (un pago completo y una cuota) salen de UNA sola
    # llamada: el embudo tiene que decir 1 venta, no 2. Contar filas de venta mezclaba llamadas
    # con cobros y el salto "presentaciones -> ventas" dejaba de significar algo.
    cli = cliente(db, 'Compro', email='compro@test.local')
    agenda(db, marlon, cli, closer_result='Show up')
    venta(db, mail='compro@test.local', monto=990.0, tipo='AL - Completo')
    venta(db, mail='compro@test.local', monto=250.0, tipo='AL - Cuota')

    bloque = ca.bloque_closers(DESDE, HASTA)
    pasos = {p['paso']: p['n'] for p in bloque['funnel']}

    assert pasos['Ventas'] == pasos['Asistieron'] == 1
    # Programas y Payment types SÍ cuentan cobros: son otra pregunta, sobre la plata.
    assert bloque['cash'] == 1240.0


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


@freeze_time(HOY)
def test_el_close_rate_de_la_tarjeta_es_el_mismo_que_el_de_los_totales(db, marlon):
    """La tarjeta de Analizar y "Totales de lo filtrado" tienen que dar el MISMO close rate.

    Bug real encontrado mirando la pantalla con datos de producción: la tarjeta lo calculaba con
    las filas de venta del período (7) y los totales con las agendas que terminaron en venta
    (12), así que la misma pantalla mostraba 20.6% arriba y 35.3% abajo. Son dos preguntas
    distintas —una venta del período puede no tener agenda en él, y una llamada de estos días
    puede cerrar más tarde— y la que corresponde al close rate es la de las llamadas.
    """
    compro = cliente(db, 'Compro', email='compro@test.local')
    agenda(db, marlon, compro, closer_result='Show up')
    # La venta de este lead quedó registrada en otro período: el close rate de ESTAS llamadas
    # no puede depender de en qué mes se contabilizó el cobro.
    venta(db, mail='compro@test.local', fecha=datetime(2026, 8, 20))
    agenda(db, marlon, cliente(db, 'No compro'), closer_result='Show up')

    bloque = ca.bloque_closers(DESDE, HASTA)
    totales = ComercialService.totales_agendas(ComercialService.agendas(DESDE, HASTA))

    assert bloque['close_rate'] == totales['close_rate'] == 50.0
    assert bloque['cerradas'] == totales['ventas'] == 1


@freeze_time(HOY)
def test_una_llamada_a_la_que_asistieron_cuenta_como_confirmada(db, marlon):
    """El embudo es una cadena de subconjuntos: ningun paso puede superar al anterior.

    Bug real visto en el servidor de prueba: 15 asistieron sobre 7 confirmadas, o sea un 214.3%
    en la fila siguiente. Pasa porque `result='Confirmado'` lo escribe el flujo de confirmacion y
    asistir no lo exige — pero una llamada a la que el lead se presento estaba confirmada, por
    definicion. Es el mismo criterio que ya aplica `mark_sale_appointment_as_show_up`, que fuerza
    `result='Confirmado'` al registrar una venta justamente por esto.
    """
    # Asistio sin haber pasado por el flujo de confirmacion.
    agenda(db, marlon, cliente(db, 'Vino igual'), result='Pendiente', closer_result='Show up')
    agenda(db, marlon, cliente(db, 'Confirmo y vino'), result='Confirmado', closer_result='Show up')
    agenda(db, marlon, cliente(db, 'Solo confirmo'), result='Confirmado')

    pasos = {p['paso']: p['n'] for p in ca.bloque_closers(DESDE, HASTA)['funnel']}

    assert pasos['Confirmadas'] == 3
    assert pasos['Asistieron'] == 2
    # El invariante que importa, por encima de los numeros puntuales.
    orden = [p['n'] for p in ca.bloque_closers(DESDE, HASTA)['funnel']]
    assert orden == sorted(orden, reverse=True), f'el embudo no decrece: {orden}'


# --- Panel Cierre: las dos tasas de cierre ------------------------------------------------------

@freeze_time(HOY)
def test_las_dos_tasas_de_cierre_se_miden_sobre_denominadores_distintos(db, marlon):
    """El panel Cierre muestra las MISMAS ventas contra dos puntos: todas las llamadas con show
    up, y solo las que además llegaron a presentar la oferta. Si las dos usaran el mismo
    denominador el panel no diría nada, y la brecha entre ellas —cuánto se pierde antes de
    mostrar el precio— es justamente lo que se quiere ver."""
    compro = cliente(db, 'Compro', email='compro@test.local')
    agenda(db, marlon, compro, closer_result='Show up')
    venta(db, mail='compro@test.local')
    # Escuchó la oferta y no cerró: entra en los dos denominadores.
    agenda(db, marlon, cliente(db, 'Escucho'), closer_result='Show up', offer_presented=True)
    # Asistió, quedó un seguimiento abierto y nadie tildó la oferta: la llamada ocurrió pero no
    # llegó al precio. Entra en el denominador de close_rate y NO en el de close_presentacion —
    # es la única razón de que los dos números no coincidan.
    agenda(db, marlon, cliente(db, 'Se corto'), closer_result='Show up', offer_presented=None,
           seguimiento_tipo='llamada', fecha_seguimiento=datetime(2026, 9, 20))

    bloque = ca.bloque_closers(DESDE, HASTA)

    assert (bloque['asistieron'], bloque['presentaciones'], bloque['cerradas']) == (3, 2, 1)
    assert bloque['close_rate'] == 33.3        # 1 de 3 llamadas con show up
    assert bloque['close_presentacion'] == 50.0  # 1 de 2 presentaciones
    assert bloque['presentacion_rate'] == 66.7   # 2 de 3 llegaron a la oferta


@freeze_time(HOY)
def test_sin_presentaciones_las_tasas_del_panel_cierre_son_none_y_no_cero(db, marlon):
    """Un 0% sobre cero presentaciones afirma que se presentó y no se cerró, que es falso. El
    panel tiene que poder mostrar "—", así que el denominador vacío devuelve None."""
    agenda(db, marlon, cliente(db, 'No vino'), closer_result='No Show')

    bloque = ca.bloque_closers(DESDE, HASTA)

    assert bloque['presentaciones'] == 0
    assert bloque['close_presentacion'] is None
    assert bloque['presentacion_rate'] is None


# --- Panel Cash: lo que falta cobrar -----------------------------------------------------------

def inscribir(db, cli, precio, pagado=0.0, programa='Residency Roadmap'):
    """Inscribe al cliente en un programa y le aplica un pago, que es de donde sale la deuda."""
    prog = Program.query.filter_by(name=programa).first()
    if not prog:
        prog = Program(name=programa, price=precio)
        db.session.add(prog)
        db.session.commit()
    e = Enrollment(client_id=cli.id, program_id=prog.id)
    db.session.add(e)
    db.session.commit()
    if pagado:
        db.session.add(Payment(enrollment_id=e.id, amount=pagado, status='completed'))
        db.session.commit()
    return e


@freeze_time(HOY)
def test_lo_que_falta_cobrar_es_un_saldo_a_hoy_y_no_cambia_con_el_periodo(db, marlon):
    """La deuda sale de las inscripciones vivas menos lo pagado: no tiene fecha de corte. Pedir
    el resumen de agosto o de septiembre tiene que devolver el MISMO saldo, porque la pregunta
    que contesta el panel es "cuánto se debe hoy", no "cuánto se firmó en el período". Por eso
    tampoco lleva delta — compararlo contra sí mismo daría 0% siempre."""
    cli = cliente(db, 'Debe')
    agenda(db, marlon, cli)
    inscribir(db, cli, precio=1000.0, pagado=400.0)

    septiembre = ca.resumen('closers', DESDE, HASTA, *AGOSTO, miembro_id=marlon.id)
    agosto = ca.resumen('closers', *AGOSTO, miembro_id=marlon.id)

    assert septiembre['por_cobrar']['total'] == agosto['por_cobrar']['total'] == 600.0
    assert 'por_cobrar' not in septiembre['deltas']


@freeze_time(HOY)
def test_lo_que_falta_cobrar_respeta_el_precio_negociado_del_cliente(db, marlon):
    """`Client.total_amount` manda sobre el precio de lista cuando el closer lo cargó: es lo que
    ESTE cliente negoció. La misma regla que usa el pool de llamadas cerradas desde donde se
    cobra — si acá se usara el precio de lista, un cliente con un precio más alto aparecería
    debiendo menos de lo real (caso reportado en producción)."""
    cli = cliente(db, 'Nego')
    cli.total_amount = 1000.0
    db.session.commit()
    agenda(db, marlon, cli)
    inscribir(db, cli, precio=500.0, pagado=100.0)

    datos = ca.resumen('closers', DESDE, HASTA, miembro_id=marlon.id)

    assert datos['por_cobrar']['total'] == 900.0


@freeze_time(HOY)
def test_los_setters_no_reciben_lo_que_falta_cobrar(db, make_user):
    """No es una cifra del setter: la deuda se atribuye al closer dueño de la agenda. Mandarla en
    el resumen de setters invitaría a ponerla en una pantalla donde no le corresponde a nadie."""
    setter = make_user(role='setter', username='Ana', email='ana@thelearnation.com')

    datos = ca.resumen('setters', DESDE, HASTA, miembro_id=setter.id)

    assert 'por_cobrar' not in datos


# --- Panel Estados -----------------------------------------------------------------------------

@freeze_time(HOY)
def test_una_agenda_vencida_sin_reportar_no_se_mezcla_con_una_que_todavia_no_ocurrio(db, marlon):
    """Las dos son "Pendiente" en la tabla, y en el panel son cosas opuestas: la de mañana es el
    curso normal de las cosas y la de la semana pasada es un agujero — mientras nadie la cargue,
    el show up queda medido sobre menos llamadas de las que hubo. Juntarlas en una sola fila
    hacía que el panel no pudiera decir eso."""
    agenda(db, marlon, cliente(db, 'Ya paso'), cuando=datetime(2026, 9, 10, 15, 0))
    agenda(db, marlon, cliente(db, 'Manana'), cuando=datetime(2026, 9, 25, 15, 0))

    estados = {e['key']: e for e in ca.bloque_closers(DESDE, HASTA)['estados']}

    assert estados['sin_reporte']['n'] == 1
    assert estados['por_ocurrir']['n'] == 1
    # Y cada una lleva a SU corte de Revisar, que deriva el estado fila por fila igual que acá
    # (`estadoDeAgenda`). Mientras las dos mandaron 'Pendiente', el clic en "Sin reporte" abría
    # la tabla con las dos mitades juntas.
    assert estados['sin_reporte']['filtro'] == 'Sin reporte'
    assert estados['por_ocurrir']['filtro'] == 'Aún no ocurrió'


@freeze_time(HOY)
def test_los_estados_suman_todas_las_agendas_del_periodo_y_no_solo_las_realizadas(db, marlon):
    """El panel contesta "qué pasó con cada cita agendada", así que su total son las agendas —no
    las realizadas, que es el denominador del show up. Si el panel usara ese otro denominador
    las canceladas y las reagendadas desaparecerían de la pantalla sin dejar rastro."""
    compro = cliente(db, 'Compro', email='compro@test.local')
    agenda(db, marlon, compro, closer_result='Show up')
    venta(db, mail='compro@test.local')
    agenda(db, marlon, cliente(db, 'No vino'), closer_result='No Show')
    agenda(db, marlon, cliente(db, 'Cancelo'), closer_result='Cancelado')
    agenda(db, marlon, cliente(db, 'Reagendo'), closer_result='Reagendado')

    bloque = ca.bloque_closers(DESDE, HASTA)

    assert sum(e['n'] for e in bloque['estados']) == bloque['agendas'] == 4
    assert bloque['realizadas'] == 2


@freeze_time(HOY)
def test_los_estados_sin_ninguna_agenda_no_aparecen_en_el_panel(db, marlon):
    """Siete filas en cero esconden las dos que importan."""
    agenda(db, marlon, cliente(db, 'No vino'), closer_result='No Show')

    estados = ca.bloque_closers(DESDE, HASTA)['estados']

    assert [(e['key'], e['n']) for e in estados] == [('no_show', 1)]


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
def test_un_programa_con_solo_cuotas_no_declara_ventas_que_no_existen(db, marlon):
    # Antes `ventas` caía a la cantidad de FILAS cuando no había ninguna venta real, así que un
    # programa con solo cuotas decía "2 ventas" y en el mapa del equipo salía un "Residency 200%"
    # (2 sobre 1 venta real del período). Reportado mirando producción.
    venta(db, mail='a@test.local', monto=990.0, tipo='AL - Completo')
    venta(db, mail='b@test.local', monto=250.0, tipo='RR - Cuota')
    venta(db, mail='c@test.local', monto=250.0, tipo='RR - Cuota')

    programas = {p['programa']: p for p in ca.bloque_closers(DESDE, HASTA)['programas']}
    fila = ca.comparativas('closers', DESDE, HASTA)['filas'][0]

    assert (programas['Residency Roadmap']['ventas'], programas['Residency Roadmap']['cobros']) == (0, 2)
    assert programas['Residency Roadmap']['cash'] == 500.0  # el cash sí se cuenta
    assert fila['residency_pct'] == 0.0


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

# --- Variabilidad (series por día) --------------------------------------------------------------

@freeze_time(HOY)
def test_las_series_van_sobre_el_calendario_del_periodo_y_no_solo_los_dias_con_datos(db, marlon):
    """El eje es el período completo: un día sin actividad va en cero y no se omite. Comprimiendo
    la serie a los días con datos, un fin de semana desaparece y la forma de la curva miente —
    dos picos separados por cuatro días muertos se verían pegados."""
    agenda(db, marlon, cliente(db, 'Uno'), cuando=datetime(2026, 9, 2, 15, 0))
    agenda(db, marlon, cliente(db, 'Dos'), cuando=datetime(2026, 9, 2, 17, 0))
    agenda(db, marlon, cliente(db, 'Tres'), cuando=datetime(2026, 9, 5, 15, 0))

    datos = ca.variabilidad('closers', datetime(2026, 9, 1).date(), datetime(2026, 9, 5).date())

    assert datos['dias'] == ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']
    serie = next(s for s in datos['series'] if s['key'] == 'agendas')
    assert serie['vals'] == [0, 2, 0, 0, 1]


@freeze_time(HOY)
def test_una_tasa_diaria_sin_denominador_da_cero_y_no_divide_por_cero(db, marlon):
    """Un día sin llamadas con resultado no tiene show up. Va en cero para que el eje no se
    rompa, y el panel lo cuenta como "día sin movimiento" en vez de como un 0% de rendimiento
    (que es el mismo criterio con el que `realizadas` excluye las canceladas)."""
    asistio = cliente(db, 'Asistio')
    falto = cliente(db, 'Falto')
    agenda(db, marlon, asistio, cuando=datetime(2026, 9, 2, 15, 0), closer_result='Show up')
    agenda(db, marlon, falto, cuando=datetime(2026, 9, 2, 17, 0), closer_result='No Show')

    datos = ca.variabilidad('closers', datetime(2026, 9, 1).date(), datetime(2026, 9, 3).date())
    serie = next(s for s in datos['series'] if s['key'] == 'showup')

    # 1 de 2 el día 2; los otros dos días no tuvieron ninguna llamada con resultado.
    assert serie['vals'] == [0, 50.0, 0]


@freeze_time(HOY)
def test_una_serie_con_una_sola_categoria_no_trae_sub_series(db, marlon):
    """Las sub-series son un filtro: con una sola categoría no hay nada que aislar y la tira de
    pestañas sería una sola pestaña, que no filtra nada. También evita la lista fija del
    prototipo, que mostraba categorías vacías y esconde cualquier valor nuevo."""
    venta(db, mail='unica@test.local', tipo='AL - Completo', fecha=datetime(2026, 9, 2))

    datos = ca.variabilidad('closers', datetime(2026, 9, 1).date(), datetime(2026, 9, 3).date())
    programas = next(s for s in datos['series'] if s['key'] == 'programas')

    # Solo queda "Todos": un único programa no abre sub-series propias.
    assert [sub['label'] for sub in programas['series']] == ['Todos']


@freeze_time(HOY)
def test_el_cash_por_dia_se_abre_por_tipo_de_cobro_y_las_partes_cierran_con_el_total(db, marlon):
    """Es la propiedad que hace verificable el panel: la serie "Todo" tiene que ser la suma de las
    otras, día por día.

    La renovación es la que obliga a tener un cajón "Otros": el vocabulario del tablero tiene
    cuatro tipos canónicos, pero en la base hay filas con otros (medido: $300 de renovación en
    septiembre de 2026), y sin el cajón las tres partes daban menos que el total."""
    venta(db, mail='completa@test.local', tipo='AL - Completo', monto=990, fecha=datetime(2026, 9, 2))
    venta(db, mail='cuota@test.local', tipo='AL - Cuota 2', monto=200, fecha=datetime(2026, 9, 2))
    venta(db, mail='sena@test.local', tipo='AL - Seña', monto=100, fecha=datetime(2026, 9, 3))
    venta(db, mail='renov@test.local', tipo='AL - Renovacion', monto=300, fecha=datetime(2026, 9, 3))

    datos = ca.variabilidad('closers', datetime(2026, 9, 1).date(), datetime(2026, 9, 3).date())
    cash = next(s for s in datos['series'] if s['key'] == 'cash')
    por_label = {sub['label']: sub['vals'] for sub in cash['series']}

    assert por_label['Todo'] == [0, 1190.0, 400.0]
    assert por_label['Ventas nuevas'] == [0, 990.0, 0]
    assert por_label['Cuotas'] == [0, 200.0, 0]
    assert por_label['Señas'] == [0, 0, 100.0]
    assert por_label['Otros'] == [0, 0, 300.0]
    partes = [v for k, v in por_label.items() if k != 'Todo']
    assert [sum(dia) for dia in zip(*partes)] == por_label['Todo']
