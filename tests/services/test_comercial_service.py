"""ComercialService: las filas de Revisar y los totales de lo filtrado.

Lo que importa probar acá no es que sume: es que las DEFINICIONES sean las que dice el módulo,
porque son las que el dashboard entero usa después (los KPIs de Analizar agregan estas mismas
filas). Sobre todo tres, que son las que pueden dar un número plausible pero equivocado:

  · `realizadas` NO incluye canceladas ni reagendadas — si las incluyera, el show up bajaría sin
    que nadie hubiera faltado a una llamada.
  · "Venta" es un estado derivado del cruce con `FinancialSale`, no una columna.
  · el retraso solo corre para una llamada ya pasada y sin resultado.
"""
import itertools
from datetime import datetime, timedelta

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale, LeadAnswer, ManychatLead
from app.services.comercial_service import ComercialService, cerro_sin_venta, post_call_de, pre_call_de

HOY = '2026-09-17 21:30:00'
DESDE = datetime(2026, 9, 1).date()
HASTA = datetime(2026, 9, 30).date()


@pytest.fixture()
def marlon(make_user):
    return make_user(role='closer', username='Marlon', email='marlon@thelearnation.com')


@pytest.fixture()
def elias(make_user):
    return make_user(role='setter', username='Elias', email='elias@thelearnation.com')


_emails = itertools.count(1)


def cliente(db, nombre='Luciana Paredes', email=None, ig=None):
    c = Client(full_name=nombre, email=email or f'cliente{next(_emails)}@test.local', instagram=ig)
    db.session.add(c)
    db.session.commit()
    return c


def agenda(db, closer, cli, *, cuando=datetime(2026, 9, 17, 15, 0), result='Confirmado',
           closer_result='Pendiente', setter=None, **campos):
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=cuando, result=result,
                    closer_result=closer_result, origin='Setter · Elias',
                    setter_id=setter.id if setter else None, created_at=cuando - timedelta(days=2),
                    **campos)
    db.session.add(a)
    db.session.commit()
    return a


def venta(db, *, mail=None, ig=None, monto=990.0, tipo='AL - Completo', metodo='zelle',
          vendedor='marlon@thelearnation.com', fecha=datetime(2026, 9, 17), estado='Completada'):
    v = FinancialSale(mail_cliente=mail, instagram=ig, monto=monto, tipo_pago=tipo, metodo_pago=metodo,
                      email_vendedor=vendedor, date=fecha, estado=estado, nombre_cliente='Luciana Paredes')
    db.session.add(v)
    db.session.commit()
    return v


# --- Mapeo de estados ---------------------------------------------------------------------------

@pytest.mark.parametrize('result,esperado', [
    ('Confirmado', 'confirmada'),
    ('Pendiente', 'sin_confirmar'),
    (None, 'sin_confirmar'),
    ('Cancelado', 'cancelo'),
    ('cancelada', 'cancelo'),
])
def test_pre_call_sale_de_result(result, esperado):
    assert pre_call_de(Appointment(result=result)) == esperado


@pytest.mark.parametrize('estado,venta_,esperado', [
    ('show_up', True, 'venta'),
    # Asistió y no compró: "Seguimiento", tenga o no un seguimiento programado (antes, sin él, era
    # "Presentó, no cerró"; el usuario pidió que se vean todas como "Seguimiento", 09/10/2026).
    ('show_up', False, 'seguimiento'),
    ('no_show', False, 'no_show'),
    ('reagendada', False, 'reagendo'),
    ('cancelada', False, 'cancelo'),
    ('sin_reportar', False, 'pendiente'),
    ('reportada_sin_resultado', False, 'pendiente'),
    # Antes caían en "Otro estado": se muestran con lo que reportó el closer (02/10/2026).
    ('lead_perdido', False, 'lead_perdido'),
    ('no_lead', False, 'no_lead'),
    ('inventado', False, 'pendiente'),
])
def test_post_call_resuelve_los_estados_derivados(estado, venta_, esperado):
    assert post_call_de(estado, venta_) == esperado


@pytest.mark.parametrize('venta_,sena,esperado', [
    # Solo una seña: es "Seña", no "Venta" (aunque casi siempre la acompañe un seguimiento abierto).
    (False, True, 'sena'),
    # Con pago completo o split pay manda la venta, aunque la haya precedido una seña.
    (True, True, 'venta'),
])
def test_la_sena_es_un_estado_propio_y_no_una_venta(venta_, sena, esperado):
    assert post_call_de('show_up', venta_, con_sena=sena) == esperado


def test_una_sena_sin_asistencia_no_cambia_el_resultado_de_la_llamada():
    assert post_call_de('no_show', False, con_sena=True) == 'no_show'


@pytest.mark.parametrize('estado,venta_,sena,seguimiento,esperado', [
    # Lo que antes era "Presentó, no cerró": asistió, sin venta, sin seña y sin nada programado.
    ('show_up', False, False, False, True),
    # Con un seguimiento abierto la venta sigue en curso: no "terminó sin venta".
    ('show_up', False, False, True, False),
    ('show_up', True, False, False, False),
    ('show_up', False, True, False, False),
    # Sin asistencia no hubo llamada que cerrar.
    ('no_show', False, False, False, False),
    ('sin_reportar', False, False, False, False),
])
def test_cerro_sin_venta_es_el_viejo_presento_no_cerro(estado, venta_, sena, seguimiento, esperado):
    assert cerro_sin_venta(estado, venta_, seguimiento, con_sena=sena) is esperado


# --- Filas de agendas ---------------------------------------------------------------------------

@freeze_time(HOY)
def test_una_agenda_con_venta_cruzada_queda_como_venta(db, marlon):
    cli = cliente(db, 'Luciana Paredes', email='luciana@test.local')
    agenda(db, marlon, cli, closer_result='Show up')
    venta(db, mail='luciana@test.local')

    fila = ComercialService.agendas(DESDE, HASTA)[0]

    assert fila['post_call']['key'] == 'venta'
    assert fila['post_call']['tone'] == 'success'
    assert fila['con_venta'] is True
    assert fila['asistio'] and fila['realizada']


@freeze_time(HOY)
def test_un_split_pay_tambien_es_venta(db, marlon):
    cli = cliente(db, 'Luciana Paredes', email='luciana@test.local')
    agenda(db, marlon, cli, closer_result='Show up')
    venta(db, mail='luciana@test.local', tipo='RR - Parcial')

    fila = ComercialService.agendas(DESDE, HASTA)[0]
    assert fila['post_call']['key'] == 'venta'
    assert fila['venta_tipo'] == 'parcial'


@freeze_time(HOY)
def test_el_desglose_de_ventas_suma_las_agendas_en_venta(db, marlon):
    """El panel Cierre dice "N ventas · X PC + Y SP". Una agenda es UNA venta aunque el lead pagara
    un completo y además abriera un split (dos programas): manda el pago completo, y el desglose
    sigue sumando el total."""
    for email, tipos in [('pif@test.local', ['AL - Completo']), ('split@test.local', ['RR - Parcial']),
                         ('dos@test.local', ['RR - Parcial', 'AL - Completo']),
                         ('sena@test.local', ['RR - Seña'])]:
        agenda(db, marlon, cliente(db, email=email), closer_result='Show up')
        for tipo in tipos:
            venta(db, mail=email, tipo=tipo)

    filas = ComercialService.agendas(DESDE, HASTA)
    totales = ComercialService.totales_agendas(filas)

    assert {f['email']: f['venta_tipo'] for f in filas} == {
        'pif@test.local': 'completo', 'split@test.local': 'parcial',
        'dos@test.local': 'completo', 'sena@test.local': None}
    assert (totales['ventas'], totales['ventas_completo'], totales['ventas_split']) == (3, 2, 1)


@freeze_time(HOY)
def test_un_lead_que_solo_dejo_sena_queda_como_sena_y_no_como_venta(db, marlon):
    """El pedido: "no podemos tomar las señas acá". Antes cualquier fila cruzada marcaba la agenda
    como Venta, y la seña terminaba contada como cierre en la tabla y en el close rate."""
    cli = cliente(db, 'Kary Mendez', email='kary@test.local')
    agenda(db, marlon, cli, closer_result='Show up', seguimiento_tipo='tomada')
    venta(db, mail='kary@test.local', monto=100.0, tipo='RR - Seña')

    fila = ComercialService.agendas(DESDE, HASTA)[0]

    assert fila['post_call']['key'] == 'sena'
    assert (fila['con_venta'], fila['con_sena']) == (False, True)
    # Asistió, y para dejar una seña tuvo que ver la oferta.
    assert fila['asistio'] and fila['realizada'] and fila['presento']


@freeze_time(HOY)
def test_la_sena_que_despues_se_completo_es_venta(db, marlon):
    cli = cliente(db, 'Kary Mendez', email='kary@test.local')
    agenda(db, marlon, cli, closer_result='Show up')
    venta(db, mail='kary@test.local', monto=100.0, tipo='RR - Seña', fecha=datetime(2026, 9, 3))
    venta(db, mail='kary@test.local', monto=1900.0, tipo='RR - Completo', fecha=datetime(2026, 9, 10))

    fila = ComercialService.agendas(DESDE, HASTA)[0]

    assert fila['post_call']['key'] == 'venta'
    assert (fila['con_venta'], fila['con_sena']) == (True, True)


@pytest.mark.parametrize('tipo,estado', [
    ('RR - Cuota', 'Completada'),
    ('RR - Renovación', 'Completada'),
    ('AL - Upsell', 'Completada'),
    # Una venta anulada no cerró nada.
    ('AL - Completo', 'Cancelada'),
])
@freeze_time(HOY)
def test_solo_pago_completo_y_split_pay_marcan_la_agenda_como_venta(db, marlon, tipo, estado):
    cli = cliente(db, 'Tomas Ibarra', email='tomas@test.local')
    agenda(db, marlon, cli, closer_result='Show up')
    venta(db, mail='tomas@test.local', tipo=tipo, estado=estado)

    fila = ComercialService.agendas(DESDE, HASTA)[0]

    assert fila['post_call']['key'] == 'seguimiento'
    assert fila['con_venta'] is False


@freeze_time(HOY)
def test_el_cruce_con_la_venta_tambien_funciona_por_instagram(db, marlon):
    cli = cliente(db, 'Gonzalo Ruiz', email='gonzalo@test.local', ig='@gonza.ruiz')
    agenda(db, marlon, cli, closer_result='Show up')
    venta(db, mail='otro@test.local', ig='gonza.ruiz')

    assert ComercialService.agendas(DESDE, HASTA)[0]['post_call']['key'] == 'venta'


@freeze_time(HOY)
def test_asistio_sin_venta_ni_seguimiento_se_muestra_como_seguimiento(db, marlon):
    """Pedido del usuario (09/10/2026): «Presentó, no cerró» no se muestra más, «que digan
    Seguimiento». Pero esa llamada se sigue contando como presentación, igual que antes: cambiar la
    etiqueta no puede mover el embudo ni el cierre por presentación."""
    agenda(db, marlon, cliente(db, 'Fernanda Ortiz'), closer_result='Show up')

    fila = ComercialService.agendas(DESDE, HASTA)[0]

    assert fila['post_call'] == {'key': 'seguimiento', 'label': 'Seguimiento', 'tone': 'warning'}
    assert fila['asistio'] is True
    assert fila['presento'] is True


@freeze_time(HOY)
def test_con_un_seguimiento_abierto_la_presentacion_sigue_dependiendo_del_tilde(db, marlon):
    # Las dos se ven igual, «Seguimiento», pero solo la que terminó sin nada programado cuenta como
    # presentación sin que nadie tildara la oferta: es la regla de siempre, no una nueva.
    agenda(db, marlon, cliente(db, 'Lo pienso'), closer_result='Show up',
           seguimiento_tipo='llamada', fecha_seguimiento=datetime(2026, 9, 20))
    agenda(db, marlon, cliente(db, 'Lo pienso con oferta'), closer_result='Show up',
           seguimiento_tipo='llamada', fecha_seguimiento=datetime(2026, 9, 20), offer_presented=True)

    filas = {f['cliente']: f for f in ComercialService.agendas(DESDE, HASTA)}

    assert {f['post_call']['key'] for f in filas.values()} == {'seguimiento'}
    assert filas['Lo pienso']['presento'] is False
    assert filas['Lo pienso con oferta']['presento'] is True


@freeze_time(HOY)
def test_el_total_de_seguimiento_cuenta_una_vez_cada_agenda(db, marlon):
    agenda(db, marlon, cliente(db, 'Sin nada programado'), closer_result='Show up')
    agenda(db, marlon, cliente(db, 'Con llamada'), closer_result='Show up', seguimiento_tipo='llamada')

    totales = ComercialService.totales_agendas(ComercialService.agendas(DESDE, HASTA))

    assert totales['seguimiento'] == 2


@freeze_time(HOY)
def test_un_seguimiento_ya_hecho_no_deja_la_agenda_en_curso(db, marlon):
    # `seguimiento_realizado` cerrado significa que el seguimiento ya pasó: la llamada no está
    # esperando nada. Se ve como «Seguimiento» (la venta sigue abierta) y cuenta como presentada.
    agenda(db, marlon, cliente(db, 'Tomas Ibarra'), closer_result='Show up',
           seguimiento_tipo='tomada', seguimiento_realizado=True)

    fila = ComercialService.agendas(DESDE, HASTA)[0]
    assert fila['post_call']['key'] == 'seguimiento'
    assert fila['presento'] is True


@freeze_time(HOY)
def test_retraso_solo_para_llamadas_pasadas_sin_resultado(db, marlon):
    pasada = agenda(db, marlon, cliente(db, 'Valeria Sotomayor'),
                    cuando=datetime(2026, 9, 14, 10, 0), closer_result='Pendiente')
    futura = agenda(db, marlon, cliente(db, 'Kary Mendez'),
                    cuando=datetime(2026, 9, 25, 10, 0), closer_result='Pendiente')
    reportada = agenda(db, marlon, cliente(db, 'Angie Rios'),
                       cuando=datetime(2026, 9, 14, 12, 0), closer_result='No Show')

    por_id = {f['id']: f for f in ComercialService.agendas(DESDE, HASTA)}

    assert por_id[pasada.id]['retraso_dias'] == 3
    assert por_id[futura.id]['retraso_dias'] == 0
    assert por_id[reportada.id]['retraso_dias'] == 0


@freeze_time(HOY)
def test_ya_paso_mira_la_hora_y_no_solo_el_dia(db, marlon):
    # HOY son las 21:30. Una llamada de hoy a las 15 ya pasó aunque no tenga días de retraso: se
    # mostraba como "Aún no ocurrió" (02/10/2026). Una de hoy a las 23 todavía no.
    tarde = agenda(db, marlon, cliente(db, 'Esta tarde'), cuando=datetime(2026, 9, 17, 15, 0))
    noche = agenda(db, marlon, cliente(db, 'Esta noche'), cuando=datetime(2026, 9, 17, 23, 0))

    por_id = {f['id']: f for f in ComercialService.agendas(DESDE, HASTA)}

    assert (por_id[tarde.id]['retraso_dias'], por_id[tarde.id]['ya_paso']) == (0, True)
    assert por_id[noche.id]['ya_paso'] is False


@freeze_time(HOY)
@pytest.mark.parametrize('closer_result,result,etiqueta', [
    ('Lead Perdido', 'Confirmado', 'Lead perdido'),
    ('No Lead', 'Confirmado', 'No lead'),
    ('Cancelado', 'Confirmado', 'Canceló'),
])
def test_las_descartadas_se_marcan_y_conservan_su_nombre(db, marlon, closer_result, result, etiqueta):
    a = agenda(db, marlon, cliente(db, 'Descartada'), cuando=datetime(2026, 9, 10, 15, 0),
               closer_result=closer_result, result=result)
    viva = agenda(db, marlon, cliente(db, 'Viva'), cuando=datetime(2026, 9, 10, 16, 0))

    por_id = {f['id']: f for f in ComercialService.agendas(DESDE, HASTA)}

    assert por_id[a.id]['post_call']['label'] == etiqueta
    assert por_id[a.id]['descartada'] is True
    assert por_id[a.id]['realizada'] is False
    assert por_id[viva.id]['descartada'] is False


@freeze_time(HOY)
def test_el_toggle_de_fecha_de_creacion_cambia_que_filas_entran(db, marlon):
    # Creada el 30 de agosto, reunión el 17 de septiembre: entra por fecha meet, no por creación.
    a = agenda(db, marlon, cliente(db, 'Jose Luis'), cuando=datetime(2026, 9, 17, 15, 0))
    a.created_at = datetime(2026, 8, 30, 9, 0)
    db.session.commit()

    assert len(ComercialService.agendas(DESDE, HASTA, basis='meet')) == 1
    assert ComercialService.agendas(DESDE, HASTA, basis='creacion') == []


@freeze_time(HOY)
def test_las_agendas_se_pueden_acotar_por_closer_y_por_setter(db, marlon, elias, make_user):
    otro = make_user(role='closer', username='Nerina')
    agenda(db, marlon, cliente(db, 'Cliente A'), setter=elias)
    agenda(db, otro, cliente(db, 'Cliente B'))

    assert [f['closer'] for f in ComercialService.agendas(DESDE, HASTA, closer_id=marlon.id)] == ['Marlon']
    assert [f['setter'] for f in ComercialService.agendas(DESDE, HASTA, setter_id=elias.id)] == ['Elias']


# --- Totales de lo filtrado ---------------------------------------------------------------------

@freeze_time(HOY)
def test_las_canceladas_y_reagendadas_no_entran_al_denominador_del_show_up(db, marlon):
    agenda(db, marlon, cliente(db, 'Asistio Uno'), closer_result='Show up')
    agenda(db, marlon, cliente(db, 'No Vino'), closer_result='No Show')
    agenda(db, marlon, cliente(db, 'Cancelo'), closer_result='Cancelado')
    agenda(db, marlon, cliente(db, 'Reagendo'), closer_result='Reagendado')

    totales = ComercialService.totales_agendas(ComercialService.agendas(DESDE, HASTA))

    assert totales['agendas'] == 4
    # Si canceladas y reagendadas entraran, serían 4 y el show up caería a 25%.
    assert totales['realizadas'] == 2
    assert totales['show_up'] == 50.0


@freeze_time(HOY)
def test_close_rate_se_mide_sobre_los_que_asistieron(db, marlon):
    compro = cliente(db, 'Luciana Paredes', email='luciana@test.local')
    agenda(db, marlon, compro, closer_result='Show up')
    venta(db, mail='luciana@test.local')
    agenda(db, marlon, cliente(db, 'No Compro'), closer_result='Show up')
    agenda(db, marlon, cliente(db, 'No Vino'), closer_result='No Show')

    totales = ComercialService.totales_agendas(ComercialService.agendas(DESDE, HASTA))

    assert (totales['asistieron'], totales['ventas']) == (2, 1)
    assert totales['close_rate'] == 50.0


@freeze_time(HOY)
def test_el_close_rate_no_cuenta_senas_y_el_close_rate_con_senas_si(db, marlon):
    for i, tipo in enumerate(['AL - Completo', 'RR - Parcial', 'RR - Seña']):
        cli = cliente(db, f'Asistio {i}', email=f'asistio{i}@test.local')
        agenda(db, marlon, cli, closer_result='Show up')
        venta(db, mail=f'asistio{i}@test.local', tipo=tipo)
    agenda(db, marlon, cliente(db, 'Sin compra'), closer_result='Show up')

    totales = ComercialService.totales_agendas(ComercialService.agendas(DESDE, HASTA))

    assert (totales['asistieron'], totales['ventas'], totales['senas']) == (4, 2, 1)
    assert totales['close_rate'] == 50.0
    assert totales['close_rate_con_senas'] == 75.0


@freeze_time(HOY)
def test_sin_denominador_el_total_es_none_y_no_cero(db, marlon):
    # Ninguna llamada tuvo resultado todavía: decir "0% de show up" sería afirmar que nadie
    # asistió, cuando lo cierto es que no se sabe.
    agenda(db, marlon, cliente(db, 'Pendiente Uno'), closer_result='Pendiente')

    totales = ComercialService.totales_agendas(ComercialService.agendas(DESDE, HASTA))

    assert totales['show_up'] is None
    assert totales['close_rate'] is None


@freeze_time(HOY)
def test_los_totales_cuentan_las_pendientes_con_retraso(db, marlon):
    agenda(db, marlon, cliente(db, 'Vencida'), cuando=datetime(2026, 9, 10, 10, 0))
    agenda(db, marlon, cliente(db, 'Futura'), cuando=datetime(2026, 9, 25, 10, 0))

    totales = ComercialService.totales_agendas(ComercialService.agendas(DESDE, HASTA))

    assert (totales['pendientes'], totales['pendientes_con_retraso'], totales['retraso_max']) == (2, 1, 7)


# --- Ventas ---------------------------------------------------------------------------------------

@freeze_time(HOY)
def test_una_cuota_suma_cash_pero_no_cuenta_como_venta(db, marlon):
    venta(db, mail='a@test.local', monto=990.0, tipo='AL - Completo')
    venta(db, mail='b@test.local', monto=250.0, tipo='RR - Cuota')

    totales = ComercialService.totales_ventas(ComercialService.ventas(DESDE, HASTA))

    assert totales['cash'] == 1240.0
    assert totales['ventas'] == 1
    # El ticket es por venta nueva: la cuota suma al cash pero no al ticket.
    assert totales['ticket'] == 990.0


@freeze_time(HOY)
def test_el_ticket_promedia_solo_lo_cobrado_en_las_ventas_nuevas(db, marlon):
    # El caso de producción: una sola venta de $250 en el mes y mucho cash de cuotas y señas.
    # El ticket tiene que decir $250, no el cash total dividido por una venta.
    venta(db, mail='a@test.local', monto=250.0, tipo='RR - Parcial')
    venta(db, mail='b@test.local', monto=600.0, tipo='RR - Cuota')
    venta(db, mail='c@test.local', monto=400.0, tipo='AL - Cuota')
    venta(db, mail='d@test.local', monto=100.0, tipo='RR - Seña')

    totales = ComercialService.totales_ventas(ComercialService.ventas(DESDE, HASTA))

    assert (totales['cash'], totales['ventas'], totales['ticket']) == (1350.0, 1, 250.0)


@freeze_time(HOY)
def test_una_venta_anulada_no_entra_al_cash(db, marlon):
    venta(db, mail='a@test.local', monto=990.0)
    venta(db, mail='b@test.local', monto=500.0, estado='Anulada')

    assert ComercialService.totales_ventas(ComercialService.ventas(DESDE, HASTA))['cash'] == 990.0


@freeze_time(HOY)
def test_el_cash_neto_descuenta_la_fee_de_la_pasarela(db, marlon):
    venta(db, mail='a@test.local', monto=1000.0, metodo='Stripe')

    totales = ComercialService.totales_ventas(ComercialService.ventas(DESDE, HASTA))

    assert (totales['cash'], totales['cash_neto']) == (1000.0, 956.0)


@freeze_time(HOY)
def test_las_ventas_se_acotan_por_el_nombre_canonico_del_closer(db, marlon):
    # Las dos son de Marlon aunque el correo esté escrito distinto: resolver_nombre_closer las une.
    venta(db, mail='a@test.local', vendedor='marlon@thelearnation.com', monto=100.0)
    venta(db, mail='b@test.local', vendedor='marlongarcia27948@gmail.com', monto=200.0)
    venta(db, mail='c@test.local', vendedor='jeancarlo@thelearnation.com', monto=900.0)

    filas = ComercialService.ventas(DESDE, HASTA, closer_nombre='Marlon')

    assert ComercialService.totales_ventas(filas)['cash'] == 300.0


# --- El cliente de cada venta, para poder abrirle la ficha --------------------------------------
#
# Sin `client_id` en la fila, la tabla Ventas cae al modal viejo. Y `FinancialSale.client_id` solo
# lo tienen las ventas nuevas: en la base local faltaba en 711 de 897.

@freeze_time(HOY)
def test_la_venta_lleva_el_cliente_que_ya_tenia_guardado(db, marlon):
    cliente = Client(full_name='Luciana Paredes', email='luciana@test.local')
    db.session.add(cliente)
    db.session.commit()
    v = venta(db, mail='luciana@test.local')
    v.client_id = cliente.id
    db.session.commit()

    fila = ComercialService.ventas(DESDE, HASTA)[0]

    assert fila['client_id'] == cliente.id


@freeze_time(HOY)
def test_una_venta_vieja_se_cruza_por_correo(db, marlon):
    """El caso de los datos historicos: la venta no guardo el cliente, pero es el mismo correo."""
    cliente = Client(full_name='Luciana Paredes', email='Luciana@Test.local')
    db.session.add(cliente)
    db.session.commit()
    venta(db, mail='luciana@test.local')

    fila = ComercialService.ventas(DESDE, HASTA)[0]

    assert fila['client_id'] == cliente.id


@freeze_time(HOY)
def test_si_no_hay_correo_se_cruza_por_instagram(db, marlon):
    cliente = Client(full_name='Luciana Paredes', instagram='@luci.paredes')
    db.session.add(cliente)
    db.session.commit()
    venta(db, mail=None, ig='luci.paredes')

    fila = ComercialService.ventas(DESDE, HASTA)[0]

    assert fila['client_id'] == cliente.id


@freeze_time(HOY)
def test_el_correo_gana_sobre_el_instagram(db, marlon):
    """Mismo orden de precedencia que `create_or_update_client`, o la ficha abriria otro cliente."""
    por_correo = Client(full_name='La del correo', email='luciana@test.local')
    por_ig = Client(full_name='La del instagram', instagram='luci.paredes')
    db.session.add_all([por_correo, por_ig])
    db.session.commit()
    venta(db, mail='luciana@test.local', ig='luci.paredes')

    fila = ComercialService.ventas(DESDE, HASTA)[0]

    assert fila['client_id'] == por_correo.id


@freeze_time(HOY)
def test_el_correo_inventado_por_neurops_no_cruza_a_nadie(db, marlon):
    """`no-email-<hex>@neurops.com` no identifica a nadie: cruzar por el juntaria dos leads."""
    cliente = Client(full_name='Otro', email='no-email-abc123@neurops.com')
    db.session.add(cliente)
    db.session.commit()
    venta(db, mail='no-email-abc123@neurops.com')

    fila = ComercialService.ventas(DESDE, HASTA)[0]

    assert fila['client_id'] is None


@freeze_time(HOY)
def test_una_venta_que_no_cruza_con_nadie_no_inventa_un_cliente(db, marlon):
    """Esa fila se queda con el modal viejo, que es lo unico honesto: no hay ficha que abrir."""
    venta(db, mail='nadie@test.local', ig='nadie')

    fila = ComercialService.ventas(DESDE, HASTA)[0]

    assert fila['client_id'] is None


@freeze_time(HOY)
def test_el_cruce_no_consulta_una_vez_por_venta(db, marlon):
    """El indice se arma UNA vez: con una consulta por fila, la tabla del periodo se arrastra."""
    from sqlalchemy import event

    db.session.add(Client(full_name='Luciana Paredes', email='luciana@test.local'))
    db.session.commit()
    for i in range(12):
        venta(db, mail='luciana@test.local', monto=100.0 + i)

    consultas = []
    motor = db.session.get_bind()

    def contar(conn, cursor, sentencia, *a, **k):
        if 'clients' in sentencia.lower():
            consultas.append(sentencia)

    event.listen(motor, 'before_cursor_execute', contar)
    try:
        filas = ComercialService.ventas(DESDE, HASTA)
    finally:
        event.remove(motor, 'before_cursor_execute', contar)

    assert len(filas) == 12
    assert all(f['client_id'] for f in filas)
    # Una sola lectura de `clients` para las 12 ventas, no doce.
    assert len(consultas) == 1, consultas


@freeze_time(HOY)
def test_el_programa_sale_del_prefijo_del_tipo_de_pago(db, marlon):
    venta(db, mail='a@test.local', tipo='RR - Completo')

    assert ComercialService.ventas(DESDE, HASTA)[0]['programa'] == 'Residency Roadmap'


# --- Leads entrantes del setter -------------------------------------------------------------------

def lead(db, nombre, ig, setter='Elias', cuando=datetime(2026, 9, 10)):
    l = ManychatLead(manychat_id=f'mc-{nombre}', name=nombre, ig=ig, setter=setter, created_at=cuando)
    db.session.add(l)
    db.session.commit()
    return l


def respuesta(db, lead_, qualification='null'):
    db.session.add(LeadAnswer(lead_id=lead_.id, qualification=qualification))
    db.session.commit()


@freeze_time(HOY)
def test_el_estado_del_lead_se_deriva_de_lo_que_hizo(db, marlon, elias):
    sin_respuesta = lead(db, 'Callado', '@callado')
    # Contestó y cualificó, pero todavía no agendó: eso es estar en conversación.
    conversando = lead(db, 'Charlando', '@charlando')
    respuesta(db, conversando, qualification='true')
    descartado = lead(db, 'Descartado', '@descartado')
    respuesta(db, descartado, qualification='false')
    agendo = lead(db, 'Agendo', '@agendo')
    respuesta(db, agendo, qualification='true')
    # Una cita que generó un setter: con el equipo entero, eso es agendar (ver test_comercial_setters).
    agenda(db, marlon, cliente(db, 'Agendo Cliente', ig='@agendo'), setter=elias)

    por_id = {f['id']: f['estado']['key'] for f in ComercialService.leads(DESDE, HASTA)}

    assert por_id[sin_respuesta.id] == 'sin_respuesta'
    assert por_id[conversando.id] == 'en_conversacion'
    assert por_id[descartado.id] == 'descartado'
    assert por_id[agendo.id] == 'agendo'


@freeze_time(HOY)
def test_agendar_manda_sobre_cualquier_otro_estado(db, marlon, elias):
    # Un lead que ManyChat descartó pero que igual terminó agendando: lo que vale es que agendó.
    descartado_que_agendo = lead(db, 'Insistente', '@insistente')
    respuesta(db, descartado_que_agendo, qualification='false')
    agenda(db, marlon, cliente(db, 'Insistente Cliente', ig='insistente'), setter=elias)

    assert ComercialService.leads(DESDE, HASTA)[0]['estado']['key'] == 'agendo'


@freeze_time(HOY)
def test_los_leads_se_acotan_por_las_variantes_reales_del_nombre_del_setter(db, elias):
    lead(db, 'Suyo', '@suyo', setter='elias')
    lead(db, 'De Otro', '@otro', setter='Paula')

    filas = ComercialService.leads(DESDE, HASTA, setter_nombre='Elias')

    assert [f['cliente'] for f in filas] == ['Suyo']


@freeze_time(HOY)
def test_una_interaccion_registrada_sin_respuesta_no_cuenta_como_respondida(db, elias):
    """Todo lead de ManyChat nace con una fila en `LeadAnswer`, así que contar filas daba 100%
    de tasa de respuesta para todo el mundo — un KPI que no informa nada. Lo que cuenta es que
    la cualificación tenga un valor real, el mismo criterio de la bandeja del setter."""
    for i, valor in enumerate(['null', '', 'undefined']):
        respuesta(db, lead(db, f'Callado{i}', f'@callado{i}'), qualification=valor)
    respuesta(db, lead(db, 'Contesto', '@contesto'), qualification='true')

    totales = ComercialService.totales_leads(ComercialService.leads(DESDE, HASTA))

    assert (totales['leads'], totales['respondieron'], totales['respuesta']) == (4, 1, 25.0)


@freeze_time(HOY)
def test_totales_de_leads_encadenan_los_denominadores_del_embudo(db, marlon, elias):
    respondio = lead(db, 'Respondio', '@respondio')
    respuesta(db, respondio, qualification='true')
    otro = lead(db, 'Otro', '@otro')
    respuesta(db, otro, qualification='false')
    lead(db, 'Callado', '@callado')
    lead(db, 'Callado2', '@callado2')

    totales = ComercialService.totales_leads(ComercialService.leads(DESDE, HASTA))

    assert totales['leads'] == 4
    assert (totales['respondieron'], totales['respuesta']) == (2, 50.0)
    # La cualificación se mide sobre los que respondieron, no sobre todos los entrantes.
    assert (totales['cualificados'], totales['cualificacion']) == (1, 50.0)

# --- Clientes (cartera) -------------------------------------------------------------------------

@freeze_time(HOY)
def test_la_cartera_es_de_quien_vendio_y_no_de_quien_tiene_hoy_la_agenda(db, marlon, make_user):
    """La misma regla que "Mi cartera" del closer, y por el mismo motivo: si se atribuyera por el
    dueño actual de la cita, un cliente vendido por otro aparecería en la cartera de quien
    después lo atendió — el bug que `_cartera_items` arregló."""
    otro = make_user(role='closer', username='Nerina', email='nerina@thelearnation.com')
    mio = cliente(db, 'Cliente de Marlon', email='mio@test.local')
    ajeno = cliente(db, 'Cliente de Nerina', email='ajeno@test.local')
    # Las dos citas las tiene MARLON hoy; lo que cambia es quién facturó.
    agenda(db, marlon, mio, closer_result='show_up')
    agenda(db, marlon, ajeno, closer_result='show_up')
    venta(db, mail='mio@test.local', vendedor='marlon@thelearnation.com')
    venta(db, mail='ajeno@test.local', vendedor='nerina@thelearnation.com')

    del otro  # existe solo para que el email del vendedor resuelva a un closer del sistema

    nombres = [f['cliente'] for f in ComercialService.clientes(closer_id=marlon.id)]
    assert nombres == ['Cliente de Marlon']

    # Sin acotar por persona entran las dos, cada una atribuida a quien la vendió.
    equipo = {f['cliente']: f['closer'] for f in ComercialService.clientes()}
    assert equipo == {'Cliente de Marlon': 'Marlon', 'Cliente de Nerina': 'Nerina'}


@freeze_time(HOY)
def test_la_cartera_no_se_acota_al_periodo(db, marlon):
    """Es un saldo a hoy, no un flujo: acotarla al mes dejaría afuera justamente a los clientes
    que arrastran deuda de antes, que son los que hay que ir a cobrar."""
    viejo = cliente(db, 'Compro en marzo', email='marzo@test.local')
    agenda(db, marlon, viejo, cuando=datetime(2026, 3, 4, 15, 0), closer_result='show_up')
    venta(db, mail='marzo@test.local', vendedor='marlon@thelearnation.com',
          fecha=datetime(2026, 3, 4))

    filas = ComercialService.clientes(closer_id=marlon.id)

    assert [f['cliente'] for f in filas] == ['Compro en marzo']


@pytest.mark.parametrize('cuota,esperado', [
    (None, 'al_dia'),
    ({'sin_plan': True, 'vencida': False}, 'sin_plan'),
    ({'sin_plan': False, 'vencida': True}, 'vencida'),
    ({'sin_plan': False, 'vencida': False}, 'por_vencer'),
])
def test_estado_de_cartera_sigue_el_orden_de_urgencia(cuota, esperado):
    """El mismo orden con el que `_sort_by_urgency` ordena la cartera del closer. "Debe, sin plan"
    existe porque una venta parcial declarada sin armar el cronograma deja deuda sin cuotas, y sin
    ese estado esos clientes se leían como "al día" pese a deber."""
    assert ComercialService._estado_cartera({'proxima_cuota': cuota}) == esperado


def test_totales_de_la_cartera_separan_el_saldo_del_vencido():
    filas = [
        {'deuda': 500.0, 'pagado': 1000.0, 'cuota_vencida': True, 'cuota_monto': 250.0},
        {'deuda': 300.0, 'pagado': 700.0, 'cuota_vencida': False, 'cuota_monto': 300.0},
        {'deuda': 0.0, 'pagado': 990.0, 'cuota_vencida': False, 'cuota_monto': None},
    ]

    totales = ComercialService.totales_clientes(filas)

    assert (totales['clientes'], totales['con_deuda'], totales['al_dia']) == (3, 2, 1)
    assert totales['deuda'] == 800.0
    # El vencido es la CUOTA vencida, no la deuda entera de ese cliente: es lo que hay que cobrar
    # ya, y confundirlos hacía parecer vencido un saldo que todavía no lo está.
    assert (totales['vencidas'], totales['deuda_vencida']) == (1, 250.0)
    assert totales['pagado'] == 2690.0
