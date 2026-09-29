"""La cartera leída en lote: la tabla Clientes de Revisar, "Mi cartera" y la cola de cobro.

Antes cada cliente comprado costaba una docena de consultas (el cliente, su cita, sus
inscripciones, sus pagos, su cuota, dos veces su última venta, el closer...) y cada venta hasta
tres más para encontrar a su cliente: 5.682 consultas y 8,3 s para los 520 clientes de la base
local (pedido del usuario, 29/sep/2026: "en clientes se tarda un rato, se queda pegado").

Lo que se fija acá son las dos mitades del arreglo:
  · que la cantidad de consultas NO crezca con la cantidad de clientes, y
  · que el resultado sea el mismo que daba la consulta de a uno — sobre todo en los bordes, que
    es donde un cálculo reescrito da un número plausible pero distinto.
"""
import itertools
from datetime import date, datetime

import pytest
from flask import g
from freezegun import freeze_time
from sqlalchemy import event, func

from app.models import Appointment, Client, Enrollment, FinancialSale, InstallmentPlan, Payment, Program, User
from app.services.closer_followup_service import CarteraEnLote, CloserFollowUpService
from app.services.comercial_service import ComercialService

HOY = '2026-09-29 15:00:00'
_n = itertools.count(1)


@pytest.fixture()
def vendedor(make_user):
    return make_user(role='closer', username='vendedor', email='vendedor@neuro.com')


@pytest.fixture()
def programa(db):
    p = Program(name='Residency Roadmap', price=1500.0)
    db.session.add(p)
    db.session.commit()
    return p


def cliente(db, **campos):
    n = next(_n)
    campos.setdefault('full_name', f'Cliente {n}')
    campos.setdefault('email', f'cliente{n}@x.com')
    c = Client(**campos)
    db.session.add(c)
    db.session.commit()
    return c


def venta(db, *, mail=None, ig=None, telefono=None, client_id=None, tipo='RR - Parcial', monto=400.0,
          fecha=datetime(2026, 8, 1), estado='Completada', vendedor='vendedor@neuro.com'):
    v = FinancialSale(mail_cliente=mail, instagram=ig, telefono=telefono, client_id=client_id,
                      tipo_pago=tipo, monto=monto, date=fecha, estado=estado, email_vendedor=vendedor)
    db.session.add(v)
    db.session.commit()
    return v


def cita(db, closer, cli, cuando=datetime(2026, 8, 1, 15, 0)):
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=cuando,
                    closer_result='Show up', closer_processed=True)
    db.session.add(a)
    db.session.commit()
    return a


def inscripcion(db, cli, prog, pagos=(), fecha=datetime(2026, 8, 1)):
    """`pagos` son (monto, status)."""
    e = Enrollment(client_id=cli.id, program_id=prog.id, enrollment_date=fecha)
    db.session.add(e)
    db.session.commit()
    for monto, status in pagos:
        db.session.add(Payment(enrollment_id=e.id, amount=monto, status=status, date=fecha))
    db.session.commit()
    return e


def cuota(db, appt, numero=1, monto=300.0, vence=date(2026, 10, 15), estado='pendiente'):
    c = InstallmentPlan(appointment_id=appt.id, client_id=appt.client_id, numero_cuota=numero,
                        monto=monto, fecha_vencimiento=vence, estado=estado)
    db.session.add(c)
    db.session.commit()
    return c


def comprador(db, closer, prog, **campos):
    """Un cliente completo: venta, cita, inscripción con un pago y una cuota pendiente."""
    cli = cliente(db, **campos)
    venta(db, mail=cli.email)
    appt = cita(db, closer, cli)
    inscripcion(db, cli, prog, pagos=[(400.0, 'completed')])
    cuota(db, appt)
    return cli


def contar_consultas(db, fn, *args):
    """Corre `fn` como un pedido nuevo (sesión vacía, sin el índice de closers en `g`) y devuelve
    (resultado, consultas)."""
    db.session.expunge_all()
    g.pop('_indice_closers', None)
    consultas = [0]

    def contar(*_a, **_k):
        consultas[0] += 1

    motor = db.session.get_bind()
    event.listen(motor, 'before_cursor_execute', contar)
    try:
        resultado = fn(*args)
    finally:
        event.remove(motor, 'before_cursor_execute', contar)
    return resultado, consultas[0]


def espiar(monkeypatch, nombre, responder):
    """Cambia la consulta de a uno `CloserFollowUpService.<nombre>` por un espía que anota con qué
    se la llamó y contesta `responder(argumento)`. Devuelve la lista de llamadas.

    Es para los empates. En SQLite el desempate en memoria del lote ya elige el mismo registro que
    la base, así que comparar contra la consulta real no se entera si el lote deja de preguntarle
    — y esa pregunta es justo lo que cubre a Postgres, donde el orden entre empatados depende del
    plan. Por eso el espía contesta a propósito el registro que el lote NO elegiría solo."""
    llamadas = []

    def espia(argumento):
        llamadas.append(argumento)
        return responder(argumento)

    monkeypatch.setattr(CloserFollowUpService, nombre, staticmethod(espia))
    return llamadas


# --- Cruce venta -> cliente (`_resolve_sales_and_clients`) -------------------------------------

def _dueno(venta_):
    for cid, ventas in CloserFollowUpService._resolve_sales_and_clients().items():
        if any(v.id == venta_.id for v in ventas):
            return cid
    return None


def test_la_venta_con_client_id_va_a_ese_cliente_aunque_el_correo_sea_de_otro(db):
    guardado = cliente(db)
    otro = cliente(db, email='otro@x.com')
    v = venta(db, mail='otro@x.com', client_id=guardado.id)

    assert _dueno(v) == guardado.id
    assert otro.id != guardado.id


def test_un_client_id_que_no_existe_no_se_reasigna_por_correo(db):
    """Así era antes: el client_id manda, y si ya no existe la venta queda sin cliente."""
    cliente(db, email='ana@x.com')
    v = venta(db, mail='ana@x.com', client_id=999999)

    assert _dueno(v) is None


def test_el_correo_cruza_sin_distinguir_mayusculas_ni_espacios(db):
    c = cliente(db, email='Ana.Perez@X.com')
    v = venta(db, mail='  ana.perez@x.COM ')

    assert _dueno(v) == c.id


def test_el_instagram_cruza_sin_arroba(db):
    c = cliente(db, email=None, instagram='@Ana.Perez')
    v = venta(db, mail='sin-arroba', ig='ana.perez')

    assert _dueno(v) == c.id


def test_el_telefono_cruza_por_los_ultimos_8_caracteres_contenidos(db):
    c = cliente(db, email=None, phone='11 5555-1234')
    v = venta(db, mail=None, telefono='+54 9 11 5555-1234')

    assert _dueno(v) == c.id


def test_el_correo_gana_sobre_el_instagram_y_el_instagram_sobre_el_telefono(db):
    por_correo = cliente(db, email='ana@x.com')
    por_ig = cliente(db, email=None, instagram='ana.ig', phone='11 5555-1234')
    # Mismo teléfono que `por_ig`, pero más abajo en la tabla: el `.first()` no llegaba a él.
    cliente(db, email=None, phone='11 5555-1234')

    assert _dueno(venta(db, mail='ana@x.com', ig='ana.ig', telefono='5555-1234')) == por_correo.id
    assert _dueno(venta(db, mail='nadie@x.com', ig='ana.ig', telefono='5555-1234')) == por_ig.id
    assert _dueno(venta(db, mail=None, ig=None, telefono='+54 11 5555-1234')) == por_ig.id


def test_con_el_correo_repetido_gana_el_mismo_cliente_que_la_consulta_de_antes(db):
    """Dos clientes con el mismo correo en distinta caja: el `.first()` de antes recorría la
    tabla y se quedaba con el primero. El índice tiene que elegir ese mismo."""
    primero = cliente(db, email='Ana@x.com')
    cliente(db, email='ana@x.com')
    v = venta(db, mail='ana@x.com')

    de_antes = Client.query.filter(func.lower(Client.email) == 'ana@x.com').first()
    assert _dueno(v) == de_antes.id == primero.id


def test_con_el_instagram_repetido_gana_el_mismo_cliente_que_la_consulta_de_antes(db):
    """El gemelo del correo repetido: el índice de instagram también se queda con el primero."""
    primero = cliente(db, email=None, instagram='@Ana.IG')
    cliente(db, email=None, instagram='ana.ig')
    v = venta(db, mail=None, ig='ana.ig')

    de_antes = Client.query.filter(func.lower(func.replace(Client.instagram, '@', '')) == 'ana.ig').first()
    assert _dueno(v) == de_antes.id == primero.id


def test_un_telefono_con_letras_se_lo_pregunta_a_la_base(db):
    """Con letras el LIKE deja de ser un "contiene" (SQLite no distingue mayúsculas, Postgres sí):
    se resuelve con la misma consulta de antes, no con el índice."""
    c = cliente(db, email=None, phone='TELEFONO pendiente')
    v = venta(db, mail=None, telefono='sin telefono')

    de_antes = Client.query.filter(Client.phone.like('%telefono%')).first()
    assert _dueno(v) == (de_antes.id if de_antes else None) == c.id


def test_una_venta_anulada_no_entra_a_la_cartera(db):
    c = cliente(db)
    venta(db, mail=c.email, estado='Anulada')

    assert CloserFollowUpService._resolve_sales_and_clients() == {}


def test_el_cruce_no_consulta_una_vez_por_venta(db):
    for _ in range(3):
        c = cliente(db)
        venta(db, mail=c.email)
    _, pocas = contar_consultas(db, CloserFollowUpService._resolve_sales_and_clients)
    for _ in range(12):
        c = cliente(db)
        venta(db, mail=c.email)
    _, muchas = contar_consultas(db, CloserFollowUpService._resolve_sales_and_clients)

    assert muchas == pocas == 2


# --- La tabla Clientes en lote ------------------------------------------------------------------

@freeze_time(HOY)
def _compradores(db, closer_id, programa_id, cuantos):
    # Por id: `contar_consultas` vacía la sesión y deja sueltos los objetos de los fixtures.
    closer, prog = db.session.get(User, closer_id), db.session.get(Program, programa_id)
    for _ in range(cuantos):
        comprador(db, closer, prog)


@freeze_time(HOY)
def test_la_tabla_clientes_no_hace_una_consulta_por_cliente(db, vendedor, programa):
    ids = vendedor.id, programa.id
    _compradores(db, *ids, 3)
    filas, pocas = contar_consultas(db, ComercialService.clientes)
    assert len(filas) == 3
    _compradores(db, *ids, 12)
    filas, muchas = contar_consultas(db, ComercialService.clientes)

    assert len(filas) == 15
    assert muchas == pocas
    assert muchas < 40


@freeze_time(HOY)
def test_acotada_a_un_closer_tampoco_crece_con_sus_clientes(db, vendedor, programa):
    ids = vendedor.id, programa.id
    _compradores(db, *ids, 2)
    _, pocas = contar_consultas(db, ComercialService.clientes, ids[0])
    _compradores(db, *ids, 8)
    filas, muchas = contar_consultas(db, ComercialService.clientes, ids[0])

    assert len(filas) == 10
    assert muchas == pocas


def _items(db, ids):
    """(con lote, de a uno) para cada cliente: los dos caminos de `_build_cartera_item`."""
    ventas = CloserFollowUpService._resolve_sales_and_clients()
    lote = CarteraEnLote(ids)
    pares = {}
    for cid in ids:
        cli = Client.query.get(cid)
        appt = CloserFollowUpService._ultima_cita_de(cid)
        pares[cid] = (CloserFollowUpService._build_cartera_item(cid, cli, appt, ventas, lote=lote),
                      CloserFollowUpService._build_cartera_item(cid, cli, appt, ventas))
    return pares


@freeze_time(HOY)
def test_sin_total_negociado_la_deuda_sale_del_precio_del_programa(db, vendedor, programa):
    cli = cliente(db, total_amount=None)
    venta(db, mail=cli.email)
    cita(db, vendedor, cli)
    # El pago pendiente no cuenta: la deuda se mide contra lo cobrado de verdad.
    inscripcion(db, cli, programa, pagos=[(500.0, 'completed'), (200.0, 'pending')])

    con_lote, de_a_uno = _items(db, [cli.id])[cli.id]

    assert con_lote['deuda'] == de_a_uno['deuda'] == 1000.0
    assert con_lote == de_a_uno


@freeze_time(HOY)
def test_con_varias_inscripciones_se_suma_cada_programa(db, vendedor, programa):
    otro = Program(name='Ace Learners', price=1000.0)
    db.session.add(otro)
    db.session.commit()
    cli = cliente(db, total_amount=None)
    venta(db, mail=cli.email)
    cita(db, vendedor, cli)
    inscripcion(db, cli, programa, pagos=[(1500.0, 'completed')], fecha=datetime(2026, 3, 1))
    inscripcion(db, cli, otro, pagos=[(100.0, 'completed'), (150.0, 'completed')],
                fecha=datetime(2026, 7, 1))

    con_lote, de_a_uno = _items(db, [cli.id])[cli.id]

    assert con_lote['deuda'] == 750.0
    # La fecha de ingreso es la de la inscripción más reciente, no la de la primera.
    assert con_lote['enrollment_date'] == '2026-07-01T00:00:00'
    assert con_lote == de_a_uno


@freeze_time(HOY)
def test_el_total_negociado_manda_sobre_el_precio_de_los_programas(db, vendedor, programa):
    cli = cliente(db, total_amount=2000.0)
    venta(db, mail=cli.email)
    cita(db, vendedor, cli)
    inscripcion(db, cli, programa, pagos=[(300.0, 'completed')])
    inscripcion(db, cli, programa, pagos=[(200.0, 'completed'), (999.0, 'failed')])

    con_lote, de_a_uno = _items(db, [cli.id])[cli.id]

    assert con_lote['deuda'] == 1500.0
    assert con_lote == de_a_uno


@freeze_time(HOY)
def test_sin_inscripciones_no_debe_nada_aunque_tenga_total(db, vendedor):
    cli = cliente(db, total_amount=1000.0)
    venta(db, mail=cli.email)
    cita(db, vendedor, cli)

    con_lote, de_a_uno = _items(db, [cli.id])[cli.id]

    assert con_lote['deuda'] == 0.0
    assert con_lote['proxima_cuota'] is None
    assert con_lote == de_a_uno


@freeze_time(HOY)
def test_cuota_pendiente_contra_sin_cronograma(db, vendedor, programa):
    con_plan = cliente(db, total_amount=None)
    venta(db, mail=con_plan.email)
    appt = cita(db, vendedor, con_plan)
    inscripcion(db, con_plan, programa, pagos=[(500.0, 'completed')])
    cuota(db, appt, numero=1, vence=date(2026, 9, 1), estado='pagado')
    vencida = cuota(db, appt, numero=2, vence=date(2026, 9, 20))
    cuota(db, appt, numero=3, vence=date(2026, 10, 20))

    sin_plan = cliente(db, total_amount=None)
    venta(db, mail=sin_plan.email)
    cita(db, vendedor, sin_plan)
    inscripcion(db, sin_plan, programa, pagos=[(500.0, 'completed')])

    pares = _items(db, [con_plan.id, sin_plan.id])

    cuota_plan = pares[con_plan.id][0]['proxima_cuota']
    assert (cuota_plan['id'], cuota_plan['vencida'], cuota_plan['sin_plan']) == (vencida.id, True, False)
    cuota_sin = pares[sin_plan.id][0]['proxima_cuota']
    assert (cuota_sin['sin_plan'], cuota_sin['monto']) == (True, 1000.0)
    assert all(con_lote == de_a_uno for con_lote, de_a_uno in pares.values())


@freeze_time(HOY)
def test_dos_cuotas_que_vencen_el_mismo_dia_las_desempata_la_base(db, vendedor, programa, monkeypatch):
    cli = cliente(db, total_amount=None)
    venta(db, mail=cli.email)
    appt = cita(db, vendedor, cli)
    inscripcion(db, cli, programa)
    cuota(db, appt, numero=2, monto=250.0, vence=date(2026, 10, 1))
    # Solo, el lote se quedaría con la de id menor (la de arriba).
    la_de_la_base = cuota(db, appt, numero=1, monto=300.0, vence=date(2026, 10, 1))
    # Sin empate no hay nada que preguntar.
    en_orden = cliente(db, total_amount=None)
    appt_orden = cita(db, vendedor, en_orden)
    primera = cuota(db, appt_orden, numero=1, vence=date(2026, 10, 1))
    cuota(db, appt_orden, numero=2, vence=date(2026, 11, 1))
    preguntas = espiar(monkeypatch, '_cuota_pendiente_de',
                       lambda cid: db.session.get(InstallmentPlan, la_de_la_base.id))

    lote = CarteraEnLote([cli.id, en_orden.id])

    assert preguntas == [cli.id]
    assert lote.cuota_pendiente[cli.id].id == la_de_la_base.id
    assert lote.cuota_pendiente[en_orden.id].id == primera.id


@freeze_time(HOY)
def test_el_programa_es_el_de_la_ultima_venta_por_correo_o_instagram(db, vendedor):
    cli = cliente(db, instagram='@luci')
    venta(db, mail=cli.email, tipo='AL - Completo', fecha=datetime(2026, 1, 1))
    # La más nueva cruza por instagram, y cuenta aunque esté anulada: así lo resolvía siempre.
    venta(db, mail='otro@x.com', ig='luci', tipo='SI - Seña', fecha=datetime(2026, 6, 1), estado='Anulada')
    cita(db, vendedor, cli)

    con_lote, de_a_uno = _items(db, [cli.id])[cli.id]

    assert con_lote['programa_code'] == 'SI'
    assert con_lote == de_a_uno


@freeze_time(HOY)
def test_dos_ventas_del_mismo_dia_con_programas_distintos_las_desempata_la_base(db, vendedor, monkeypatch):
    cli = cliente(db)
    # Solo, el lote se quedaría con la de id menor: RR.
    venta(db, mail=cli.email, tipo='RR - Completo', fecha=datetime(2026, 6, 1))
    la_de_la_base = venta(db, mail=cli.email, tipo='AL - Upsell', fecha=datetime(2026, 6, 1))
    # Empatadas pero con el mismo programa: da igual cuál gane, no se pregunta.
    mismo_programa = cliente(db)
    venta(db, mail=mismo_programa.email, tipo='SI - Seña', fecha=datetime(2026, 6, 1))
    venta(db, mail=mismo_programa.email, tipo='SI - Saldo', fecha=datetime(2026, 6, 1))
    # Sin empate tampoco.
    en_orden = cliente(db)
    venta(db, mail=en_orden.email, tipo='AL - Completo', fecha=datetime(2026, 1, 1))
    venta(db, mail=en_orden.email, tipo='RR - Upsell', fecha=datetime(2026, 6, 1))
    preguntas = espiar(monkeypatch, '_ultima_venta_de',
                       lambda cli_: db.session.get(FinancialSale, la_de_la_base.id))

    lote = CarteraEnLote([cli.id, mismo_programa.id, en_orden.id])

    assert [c.id for c in preguntas] == [cli.id]
    assert [lote.programa[c.id] for c in (cli, mismo_programa, en_orden)] == ['AL', 'SI', 'RR']


@freeze_time(HOY)
def test_la_ultima_cita_empatada_la_desempata_la_base(db, vendedor, make_user, monkeypatch):
    otro = make_user(role='closer', username='otro_closer')
    cli = cliente(db)
    venta(db, mail=cli.email)
    la_de_la_base = cita(db, vendedor, cli, cuando=datetime(2026, 8, 1, 15, 0))
    # Solo, el lote se quedaría con la de id mayor (esta).
    sin_preguntar = cita(db, otro, cli, cuando=datetime(2026, 8, 1, 15, 0))
    en_orden = cliente(db)
    cita(db, vendedor, en_orden, cuando=datetime(2026, 7, 1, 15, 0))
    ultima = cita(db, vendedor, en_orden, cuando=datetime(2026, 8, 1, 15, 0))
    preguntas = espiar(monkeypatch, '_ultima_cita_de',
                       lambda cid: db.session.get(Appointment, la_de_la_base.id))

    lote = CarteraEnLote([cli.id, en_orden.id])

    assert preguntas == [cli.id]
    assert lote.ultima_cita[cli.id].id == la_de_la_base.id
    assert lote.ultima_cita[en_orden.id].id == ultima.id
    # La tabla Clientes no usa la cita (`cita_exacta=False`): ahí no se pregunta nada.
    del preguntas[:]
    sin_exacta = CarteraEnLote([cli.id, en_orden.id], cita_exacta=False)
    assert preguntas == []
    assert sin_exacta.ultima_cita[cli.id].id == sin_preguntar.id


@freeze_time(HOY)
def test_el_cliente_sin_cita_recibe_su_ancla_una_sola_vez(db, vendedor, programa):
    cli = cliente(db)
    venta(db, mail=cli.email, fecha=datetime(2026, 5, 4))
    inscripcion(db, cli, programa, pagos=[(400.0, 'completed')])
    comprador(db, vendedor, programa)
    cid = cli.id

    primera = ComercialService.clientes()
    anclas = Appointment.query.filter_by(client_id=cid).all()
    segunda = ComercialService.clientes()

    assert [(a.origin, a.closer_id, a.start_time) for a in anclas] == [
        ('Venta histórica sin agenda', vendedor.id, datetime(2026, 5, 4))]
    assert Appointment.query.filter_by(client_id=cid).count() == 1
    assert primera == segunda
    assert {f['client_id'] for f in primera} >= {cid}


@freeze_time(HOY)
def test_el_ancla_no_toma_la_venta_de_otro_por_tener_los_dos_el_instagram_vacio(db, vendedor, make_user):
    """El cliente solo tiene correo. La búsqueda de su venta comparaba también el instagram, y con
    el del cliente vacío la condición quedaba `instagram == ''`: encontraba la venta más vieja de
    cualquiera sin instagram, y el ancla salía con la fecha y el closer de esa."""
    make_user(role='closer', username='ajeno', email='ajeno@neuro.com')
    venta(db, mail='otra.persona@x.com', ig='', fecha=datetime(2025, 12, 5), vendedor='ajeno@neuro.com')
    cli = cliente(db, instagram=None)
    venta(db, mail=cli.email, fecha=datetime(2026, 2, 3))

    ancla = CloserFollowUpService._ensure_appointment_for_client(cli)

    assert (ancla.closer_id, ancla.start_time) == (vendedor.id, datetime(2026, 2, 3))


@freeze_time(HOY)
def test_el_ancla_sin_correo_ni_instagram_no_cruza_con_ventas_vacias(db, vendedor, make_user):
    """Sin correo ni instagram la venta se encuentra por `client_id`, que es como está enlazada (5
    clientes así en la copia de producción). Sin ese enlace tampoco, el ancla va al closer comodín
    'otro' como cuando la venta no aparece; nunca a la del primero que dejó vacíos esos dos datos.
    Se crea igual: sin ella el cobro no tiene dónde guardarse."""
    otro = make_user(role='closer', username='otro', email='otro@neuro.com', is_active=False)
    make_user(role='closer', username='ajeno', email='ajeno@neuro.com')
    venta(db, mail='', ig='', fecha=datetime(2025, 12, 5), vendedor='ajeno@neuro.com')
    enlazado = cliente(db, email='  ', instagram='@')
    venta(db, mail='suyo@x.com', client_id=enlazado.id, fecha=datetime(2026, 6, 16))
    suelto = cliente(db, email=None, instagram=None, phone='11 5555-1234')

    del_enlazado = CloserFollowUpService._ensure_appointment_for_client(enlazado)
    del_suelto = CloserFollowUpService._ensure_appointment_for_client(suelto)

    assert (del_enlazado.closer_id, del_enlazado.start_time) == (vendedor.id, datetime(2026, 6, 16))
    assert (del_suelto.closer_id, del_suelto.start_time) == (otro.id, datetime(2026, 9, 29, 15, 0))


@freeze_time(HOY)
def test_el_pedido_que_crea_un_ancla_tampoco_relee_venta_por_venta(db, vendedor, programa):
    """El commit del ancla vence las ventas ya leídas: sin releerlas juntas, cada una se volvía a
    pedir sola al armar su fila."""
    ids = vendedor.id, programa.id

    def con_un_cliente_sin_cita(cuantos):
        cli = cliente(db)
        venta(db, mail=cli.email)
        _compradores(db, *ids, cuantos)
        _, consultas = contar_consultas(db, ComercialService.clientes)
        return consultas

    pocas = con_un_cliente_sin_cita(2)
    muchas = con_un_cliente_sin_cita(10)

    assert muchas == pocas


# --- "Mi cartera" y la cola de cobro del closer ---------------------------------------------------

@freeze_time(HOY)
def test_mi_cartera_y_la_cola_de_cobro_no_hacen_una_consulta_por_cliente(db, vendedor, programa):
    ids = vendedor.id, programa.id
    _compradores(db, *ids, 2)
    _, cartera_pocas = contar_consultas(db, CloserFollowUpService._cartera_items, ids[0])
    _, cola_pocas = contar_consultas(db, CloserFollowUpService._cerrada_pool_items, ids[0])
    _compradores(db, *ids, 10)
    cartera, cartera_muchas = contar_consultas(db, CloserFollowUpService._cartera_items, ids[0])
    cola, cola_muchas = contar_consultas(db, CloserFollowUpService._cerrada_pool_items, ids[0])

    assert (len(cartera), len(cola)) == (12, 12)
    assert (cartera_muchas, cola_muchas) == (cartera_pocas, cola_pocas)


@freeze_time(HOY)
def test_la_cola_de_cobro_decide_el_dueno_con_la_misma_cita_que_antes(db, vendedor, make_user):
    """Dos citas a la misma hora con closers distintos: la cola sigue al dueño de la cita que
    devuelve la consulta de siempre, no a la que elegiría un desempate propio."""
    otro = make_user(role='closer', username='otro_closer', email='otro@neuro.com')
    cli = cliente(db)
    venta(db, mail=cli.email)
    cita(db, vendedor, cli, cuando=datetime(2026, 8, 1, 15, 0))
    cita(db, otro, cli, cuando=datetime(2026, 8, 1, 15, 0))
    dueno = CloserFollowUpService._ultima_cita_de(cli.id).closer_id
    ajeno = otro.id if dueno == vendedor.id else vendedor.id

    assert [i['client_id'] for i in CloserFollowUpService._cerrada_pool_items(dueno)] == [cli.id]
    assert CloserFollowUpService._cerrada_pool_items(ajeno) == []


@freeze_time(HOY)
def test_mi_cartera_sigue_anclando_al_cliente_sin_cita(db, vendedor, programa):
    cli = cliente(db)
    venta(db, mail=cli.email, fecha=datetime(2026, 5, 4))
    cid = cli.id

    items = CloserFollowUpService._cartera_items(vendedor.id)

    ancla = Appointment.query.filter_by(client_id=cid).one()
    assert [(i['client_id'], i['id']) for i in items] == [(cid, ancla.id)]
    assert ancla.origin == 'Venta histórica sin agenda'
