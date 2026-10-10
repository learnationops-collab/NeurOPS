"""Revisar del setter › Ventas (pedido del usuario, 10/10/2026): «que vea las ventas que se van
registrando con la fuente de ese setter», como la lista de los closers pero solo con las suyas.

Hasta ese día `/comercial/tabla?tabla=ventas` le respondía 403 a un setter, porque con rol setters
la tabla no se acotaba por persona y le servía la plata de todo el equipo. Ahora se acota en el
backend a los cobros cuya FUENTE es él: los de «Setting · <setter>» de la tarjeta «Ingresos por
fuente», con la misma atribución. Lo que se prueba acá:

  · el setter recibe sus cobros y nada más, pida lo que pida;
  · un setter sin ventas recibe una lista vacía, no la del equipo (la fuga del conjunto vacío del
    24/09, ver test_comercial_cartera_alcance);
  · su lista es exactamente la de la dirección filtrada por su fuente;
  · la cartera (Clientes) le sigue prohibida, y la dirección y los closers no cambian.
"""
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import FinancialAgenda, FinancialSale

HOY = '2026-09-17 21:30:00'
TABLA = '/api/comercial/tabla'
SEPTIEMBRE = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30', 'compare': 'none'}

MARLON = 'marlon@thelearnation.com'
NERINA = 'nerina@thelearnation.com'


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'marlon': make_user(role='closer', username='Marlon', email=MARLON),
        'nerina': make_user(role='closer', username='Nerina', email=NERINA),
        'elias': make_user(role='setter', username='Elias'),
        # Una setter sin ninguna venta de su fuente en el período.
        'paula': make_user(role='setter', username='Paula'),
    }


@pytest.fixture()
def cobros(db, equipo):
    """Los cobros de septiembre: dos de la fuente de Elias (uno lo firmó cada closer), uno del
    workshop, uno de la VSL y uno sin agenda."""
    def agenda(nombre, ig, dia=datetime(2026, 8, 20)):
        db.session.add(FinancialAgenda(nombre=nombre, instagram=ig, date=dia, created_at=dia))

    def venta(ig, tipo, monto, vendedor, dia=10, setter=None):
        db.session.add(FinancialSale(instagram=ig, tipo_pago=tipo, monto=monto, metodo_pago='zelle',
                                     email_vendedor=vendedor, estado='Completada', setter=setter,
                                     date=datetime(2026, 9, dia, 15)))

    agenda('Elias', 'caro')
    venta('caro', 'RR - Parcial', 1000.0, NERINA, dia=3)
    # La cuota de caro la cobró otro closer: sigue a la agenda del primer pago, la de Elias.
    venta('caro', 'RR - Cuota', 500.0, MARLON, dia=20)
    agenda('workshop', 'ana')
    # ana volvió a agendar con Elias DESPUÉS de comprar: el cobro es del workshop, no de Elias.
    agenda('Elias', 'ana', dia=datetime(2026, 9, 15))
    venta('ana', 'RR - Completo', 2000.0, MARLON, dia=5)
    agenda('vsl', 'fede')
    venta('fede', 'RR - Completo', 1500.0, MARLON, dia=8)
    venta('nadie', 'RR - Completo', 250.0, NERINA, dia=12)
    db.session.commit()


def _ventas(client, headers, **extra):
    respuesta = client.get(TABLA, headers=headers, query_string={**SEPTIEMBRE, **extra, 'tabla': 'ventas'})
    assert respuesta.status_code == 200
    return respuesta.get_json()


# --- El setter ve sus ventas ---------------------------------------------------------------------

@freeze_time(HOY)
@pytest.mark.parametrize('pedido', [
    {}, {'miembro_id': 'otro'}, {'miembro_id': 'all'}, {'rol': 'closers'}, {'rol': 'closers', 'miembro_id': 'otro'},
])
def test_el_setter_ve_solo_los_cobros_de_su_fuente_pida_lo_que_pida(client, equipo, cobros, auth_headers,
                                                                   pedido):
    if pedido.get('miembro_id') == 'otro':
        pedido = {**pedido, 'miembro_id': equipo['marlon'].id}

    datos = _ventas(client, auth_headers(equipo['elias']), **pedido)

    assert datos['rol'] == 'setters'
    assert sorted((f['ig'], f['tipo_pago_raw'], f['closer']) for f in datos['filas']) == [
        ('caro', 'RR - Cuota', 'Marlon'), ('caro', 'RR - Parcial', 'Nerina')]
    assert {(f['procedencia']['key'], f['procedencia_detalle']['label']) for f in datos['filas']} == {
        ('setting', 'Elias')}
    # Los totales son los de SUS filas: el encabezado «N ventas · $X» de su lista.
    assert (datos['totales']['cash'], datos['totales']['ventas'], datos['totales']['filas']) == (1500.0, 1, 2)


@freeze_time(HOY)
@pytest.mark.parametrize('pedido', [{}, {'miembro_id': 'elias'}, {'miembro_id': 'all'}, {'rol': 'closers'}])
def test_un_setter_sin_ventas_recibe_una_lista_vacia_y_no_la_del_equipo(client, equipo, cobros, auth_headers,
                                                                        pedido):
    if pedido.get('miembro_id') == 'elias':
        pedido = {'miembro_id': equipo['elias'].id}

    datos = _ventas(client, auth_headers(equipo['paula']), **pedido)

    assert datos['filas'] == []
    assert (datos['totales']['cash'], datos['totales']['ventas']) == (0, 0)


@freeze_time(HOY)
def test_su_lista_es_la_de_la_direccion_filtrada_por_su_fuente(client, equipo, cobros, auth_headers):
    """Las mismas filas que la dirección ve en Revisar › Ventas con la faceta «Setting · Elias»: la
    fuente se calcula con todo el período para los dos, así que un cobro no cambia de balde según
    quién mire."""
    del_equipo = _ventas(client, auth_headers(equipo['director']))['filas']
    del_setter = _ventas(client, auth_headers(equipo['elias']))['filas']

    filtradas = [f for f in del_equipo
                 if f['procedencia']['key'] == 'setting' and f['procedencia_detalle']['label'] == 'Elias']
    assert [f['id'] for f in del_setter] == [f['id'] for f in filtradas]
    assert del_setter == filtradas


@freeze_time(HOY)
def test_el_setter_escrito_en_la_venta_cuenta_si_no_hay_agenda(client, db, equipo, auth_headers):
    """La misma regla que la nómina: sin agenda que la origine, manda el setter de la venta."""
    db.session.add(FinancialSale(instagram='solo', tipo_pago='AL - Completo', monto=700.0, setter='Elias',
                                 email_vendedor=MARLON, estado='Completada', date=datetime(2026, 9, 9, 12)))
    db.session.commit()

    assert [f['ig'] for f in _ventas(client, auth_headers(equipo['elias']))['filas']] == ['solo']
    assert _ventas(client, auth_headers(equipo['paula']))['filas'] == []


@freeze_time(HOY)
def test_la_fuente_se_calcula_una_sola_vez_tambien_para_el_setter(client, equipo, cobros, auth_headers,
                                                                  monkeypatch):
    """Elegir sus filas necesita la fuente ANTES del bucle; la de cada fila la reusa en vez de
    volver a correr la atribución, que recorre todas las agendas."""
    from app.services import procedencia_ingresos_service as servicio

    llamadas = []
    original = servicio.AttributionService.get_sales_attribution

    def contada(*args, **kwargs):
        llamadas.append(1)
        return original(*args, **kwargs)

    monkeypatch.setattr(servicio.AttributionService, 'get_sales_attribution', staticmethod(contada))

    assert len(_ventas(client, auth_headers(equipo['elias']))['filas']) == 2
    assert len(llamadas) == 1


# --- Lo que no cambia ----------------------------------------------------------------------------

@freeze_time(HOY)
@pytest.mark.parametrize('quien', ['elias', 'paula'])
def test_la_cartera_le_sigue_prohibida_al_setter(client, equipo, cobros, auth_headers, quien):
    respuesta = client.get(TABLA, headers=auth_headers(equipo[quien]),
                           query_string={**SEPTIEMBRE, 'tabla': 'clientes'})
    assert respuesta.status_code == 403


@freeze_time(HOY)
def test_la_direccion_y_los_closers_ven_lo_mismo_que_antes(client, equipo, cobros, auth_headers):
    todas = _ventas(client, auth_headers(equipo['director']))
    con_setters = _ventas(client, auth_headers(equipo['director']), rol='setters')
    de_nerina = _ventas(client, auth_headers(equipo['nerina']))

    assert len(todas['filas']) == len(con_setters['filas']) == 5
    assert todas['totales']['cash'] == 5250.0
    assert sorted(f['ig'] for f in de_nerina['filas']) == ['caro', 'nadie']


@freeze_time(HOY)
def test_la_direccion_puede_mirar_las_ventas_de_un_setter(client, equipo, cobros, auth_headers):
    """Con Setters y una persona elegida, la misma lista que ve ese setter."""
    datos = _ventas(client, auth_headers(equipo['director']), rol='setters', miembro_id=equipo['elias'].id)
    vacia = _ventas(client, auth_headers(equipo['director']), rol='setters', miembro_id=equipo['paula'].id)

    assert [f['id'] for f in datos['filas']] == [f['id'] for f in _ventas(client, auth_headers(equipo['elias']))['filas']]
    assert vacia['filas'] == []


# --- Agendas: la palabra clave ---------------------------------------------------------------------

@freeze_time(HOY)
def test_cada_agenda_trae_su_palabra_clave_o_vacia(client, db, equipo, auth_headers):
    """Su lista cuenta las que todavía no tienen la palabra clave del anuncio: la fila la trae, sin
    espacios, y vacía (no None) cuando falta."""
    from app.models import Appointment, Client

    for nombre, palabra in (('Con', ' AULA '), ('Sin', None), ('Blanco', '')):
        cliente = Client(full_name=nombre, email=f'{nombre.lower()}@test.local')
        db.session.add(cliente)
        db.session.commit()
        db.session.add(Appointment(closer_id=equipo['marlon'].id, client_id=cliente.id, setter_id=equipo['elias'].id,
                                   start_time=datetime(2026, 9, 12, 15), created_at=datetime(2026, 9, 10, 12),
                                   origin='Elias', keyword=palabra))
    db.session.commit()

    filas = client.get(TABLA, headers=auth_headers(equipo['elias']),
                       query_string={**SEPTIEMBRE, 'tabla': 'generadas'}).get_json()['filas']

    assert sorted((f['cliente'], f['palabra_clave']) for f in filas) == [
        ('Blanco', ''), ('Con', 'AULA'), ('Sin', '')]


def test_acotar_a_un_setter_sin_nombre_es_acotar_a_nadie(db):
    """None es "no acotar"; un nombre vacío no es de nadie (la fuga del conjunto vacío)."""
    from app.services.comercial_service import ComercialService

    procedencias = {1: ('setting', 'elias', 'Elias'), 2: ('setting', 'sin_identificar', 'Sin identificar'),
                    3: ('workshop', 'vivo', 'En vivo'), 4: ('setting', 'paula', 'Paula')}
    assert ComercialService.de_la_fuente_del_setter('Elías', procedencias) == {1}
    assert ComercialService.de_la_fuente_del_setter('', procedencias) == set()
    assert ComercialService.de_la_fuente_del_setter('Ivan', procedencias) == set()
