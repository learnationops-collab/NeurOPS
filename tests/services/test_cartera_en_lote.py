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
from datetime import datetime

from flask import g
from sqlalchemy import event, func

from app.models import Client, FinancialSale
from app.services.closer_followup_service import CloserFollowUpService

_n = itertools.count(1)


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
