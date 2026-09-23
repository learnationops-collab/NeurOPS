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
from app.services.comercial_service import ComercialService, post_call_de, pre_call_de

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


@pytest.mark.parametrize('estado,venta_,seguimiento,esperado', [
    ('show_up', True, False, 'venta'),
    ('show_up', False, True, 'seguimiento'),
    ('show_up', False, False, 'presento_no_cerro'),
    # La venta manda sobre el seguimiento: si compró, el resultado de esa llamada fue una venta.
    ('show_up', True, True, 'venta'),
    ('no_show', False, False, 'no_show'),
    ('reagendada', False, False, 'reagendo'),
    ('cancelada', False, False, 'cancelo'),
    ('sin_reportar', False, False, 'pendiente'),
    ('reportada_sin_resultado', False, False, 'pendiente'),
    ('lead_perdido', False, False, 'otro'),
])
def test_post_call_resuelve_los_estados_derivados(estado, venta_, seguimiento, esperado):
    assert post_call_de(estado, venta_, seguimiento) == esperado


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
def test_el_cruce_con_la_venta_tambien_funciona_por_instagram(db, marlon):
    cli = cliente(db, 'Gonzalo Ruiz', email='gonzalo@test.local', ig='@gonza.ruiz')
    agenda(db, marlon, cli, closer_result='Show up')
    venta(db, mail='otro@test.local', ig='gonza.ruiz')

    assert ComercialService.agendas(DESDE, HASTA)[0]['post_call']['key'] == 'venta'


@freeze_time(HOY)
def test_asistio_sin_venta_ni_seguimiento_es_presento_no_cerro(db, marlon):
    agenda(db, marlon, cliente(db, 'Fernanda Ortiz'), closer_result='Show up')

    fila = ComercialService.agendas(DESDE, HASTA)[0]

    assert fila['post_call']['key'] == 'presento_no_cerro'
    assert fila['asistio'] is True


@freeze_time(HOY)
def test_un_seguimiento_ya_hecho_no_deja_la_agenda_en_seguimiento(db, marlon):
    # `seguimiento_realizado` cerrado significa que el seguimiento ya pasó: la llamada no está
    # esperando nada, así que vuelve a ser "presentó, no cerró".
    agenda(db, marlon, cliente(db, 'Tomas Ibarra'), closer_result='Show up',
           seguimiento_tipo='tomada', seguimiento_realizado=True)

    assert ComercialService.agendas(DESDE, HASTA)[0]['post_call']['key'] == 'presento_no_cerro'


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
    assert totales['ticket'] == 1240.0  # cash / ventas: la cuota es cash cobrado igual


@freeze_time(HOY)
def test_una_venta_anulada_no_entra_al_cash(db, marlon):
    venta(db, mail='a@test.local', monto=990.0)
    venta(db, mail='b@test.local', monto=500.0, estado='Anulada')

    assert ComercialService.totales_ventas(ComercialService.ventas(DESDE, HASTA))['cash'] == 990.0


@freeze_time(HOY)
def test_el_cash_neto_descuenta_la_fee_de_la_pasarela(db, marlon):
    venta(db, mail='a@test.local', monto=1000.0, metodo='Stripe')

    totales = ComercialService.totales_ventas(ComercialService.ventas(DESDE, HASTA))

    assert (totales['cash'], totales['cash_neto']) == (1000.0, 955.0)


@freeze_time(HOY)
def test_las_ventas_se_acotan_por_el_nombre_canonico_del_closer(db, marlon):
    # Las dos son de Marlon aunque el correo esté escrito distinto: resolver_nombre_closer las une.
    venta(db, mail='a@test.local', vendedor='marlon@thelearnation.com', monto=100.0)
    venta(db, mail='b@test.local', vendedor='marlongarcia27948@gmail.com', monto=200.0)
    venta(db, mail='c@test.local', vendedor='jeancarlo@thelearnation.com', monto=900.0)

    filas = ComercialService.ventas(DESDE, HASTA, closer_nombre='Marlon')

    assert ComercialService.totales_ventas(filas)['cash'] == 300.0


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
    agenda(db, marlon, cliente(db, 'Agendo Cliente', ig='@agendo'))

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
    agenda(db, marlon, cliente(db, 'Insistente Cliente', ig='insistente'))

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
