"""Dos datos que la tabla de Revisar no sabía dar y el dashboard necesita para poder filtrar.

1. `sena_estado`: en qué terminó cada seña, fila por fila. El panel Señas ya contaba
   "3 completaron, 2 caídas", pero la tabla Ventas no tenía el dato, así que al tocar el número no
   había forma de mostrar CUÁLES eran. Se resuelve con la misma función que cuenta el panel: si la
   clasificación estuviera duplicada, el panel diría una cosa y la lista mostraría otra.

2. El estado de la cartera tiene que distinguir «Sin cronograma» de «Con deuda» y de «Cuota
   vencida». Son tres trabajos distintos: al que debe con cuotas hay que cobrarle, al que debe sin
   cronograma primero hay que armárselo, y una cuota vencida es urgente.
"""
from datetime import date, datetime

import pytest
from freezegun import freeze_time

from app.models import Client, FinancialSale
from app.services.comercial_analitica import clasificar_senas, senas_de
from app.services.comercial_service import ComercialService, chip

HOY = '2026-09-17 12:00:00'
DESDE = date(2026, 1, 1)
HASTA = date(2026, 12, 31)


@pytest.fixture()
def vendedor(make_user):
    return make_user(role='closer', username='Marlon', email='marlon@thelearnation.com')


def venta(db, *, mail, tipo, monto=200.0, fecha=datetime(2026, 9, 1), nombre='Luciana'):
    v = FinancialSale(mail_cliente=mail, nombre_cliente=nombre, monto=monto, tipo_pago=tipo,
                      metodo_pago='zelle', email_vendedor='marlon@thelearnation.com',
                      date=fecha, estado='Completada')
    db.session.add(v)
    db.session.commit()
    return v


def estados(filas):
    """Cliente -> estado de su seña; las otras filas solo cuando el cliente no dejó seña."""
    orden = sorted(filas, key=lambda f: f['sena_estado'] is not None)
    return {f['cliente']: f['sena_estado'] for f in orden}


# --- `sena_estado` en cada fila de la tabla Ventas --------------------------------------------

@freeze_time(HOY)
def test_una_sena_que_se_completo_queda_como_pago_completo(client, db, vendedor):
    venta(db, mail='ana@x.com', tipo='AL - Seña', monto=200.0, fecha=datetime(2026, 9, 1),
          nombre='Ana')
    venta(db, mail='ana@x.com', tipo='AL - Completo', monto=800.0, fecha=datetime(2026, 9, 10),
          nombre='Ana')

    filas = ComercialService.ventas(DESDE, HASTA)

    senas = [f for f in filas if f['tipo_pago']['key'] == 'seña']
    assert [f['sena_estado'] for f in senas] == ['pago_completo']


@freeze_time(HOY)
def test_una_sena_que_se_convirtio_en_parcial_queda_como_pago_parcial(client, db, vendedor):
    venta(db, mail='luis@x.com', tipo='RR - Seña', fecha=datetime(2026, 9, 1), nombre='Luis')
    venta(db, mail='luis@x.com', tipo='RR - Parcial', monto=400.0, fecha=datetime(2026, 9, 5),
          nombre='Luis')

    filas = [f for f in ComercialService.ventas(DESDE, HASTA) if f['tipo_pago']['key'] == 'seña']

    assert filas[0]['sena_estado'] == 'pago_parcial'


@freeze_time(HOY)
def test_una_sena_reciente_sin_convertir_queda_en_espera(client, db, vendedor):
    venta(db, mail='nuevo@x.com', tipo='AL - Seña', fecha=datetime(2026, 9, 10), nombre='Nuevo')

    filas = [f for f in ComercialService.ventas(DESDE, HASTA) if f['tipo_pago']['key'] == 'seña']

    assert filas[0]['sena_estado'] == 'en_espera'


@freeze_time(HOY)
def test_una_sena_vieja_sin_convertir_se_da_por_caida(client, db, vendedor):
    """Pasados 30 días sin completarse, es la única señal real de que el lead no va a volver."""
    venta(db, mail='viejo@x.com', tipo='AL - Seña', fecha=datetime(2026, 6, 1), nombre='Viejo')

    filas = [f for f in ComercialService.ventas(DESDE, HASTA) if f['tipo_pago']['key'] == 'seña']

    assert filas[0]['sena_estado'] == 'caida'


@freeze_time(HOY)
def test_una_venta_anterior_a_la_sena_no_la_convirtio(client, db, vendedor):
    venta(db, mail='previo@x.com', tipo='AL - Completo', monto=900.0, fecha=datetime(2026, 5, 1),
          nombre='Previo')
    venta(db, mail='previo@x.com', tipo='AL - Seña', fecha=datetime(2026, 9, 10), nombre='Previo')

    filas = [f for f in ComercialService.ventas(DESDE, HASTA) if f['tipo_pago']['key'] == 'seña']

    assert filas[0]['sena_estado'] == 'en_espera'


@freeze_time(HOY)
def test_una_sena_sin_contacto_no_se_da_por_caida(client, db, vendedor):
    """Sin email ni instagram no hay forma de saber si se convirtió: afirmar que cayó sería
    inventar."""
    venta(db, mail=None, tipo='AL - Seña', fecha=datetime(2026, 1, 5), nombre='Anonimo')

    filas = [f for f in ComercialService.ventas(DESDE, HASTA) if f['tipo_pago']['key'] == 'seña']

    assert filas[0]['sena_estado'] == 'en_espera'


@freeze_time(HOY)
def test_una_fila_que_no_es_una_sena_trae_la_clave_en_null(client, db, vendedor):
    """La clave nunca falta: el frontend no tiene que preguntar si existe."""
    venta(db, mail='pif@x.com', tipo='AL - Completo', monto=900.0, nombre='Pif')

    filas = ComercialService.ventas(DESDE, HASTA)

    assert estados(filas) == {'Pif': None}


@freeze_time(HOY)
def test_el_panel_y_la_tabla_cuentan_lo_mismo(client, db, vendedor):
    """Es el punto de compartir la función: si divergieran, el panel diría "1 caída" y el filtro de
    la tabla mostraría otra."""
    venta(db, mail='ana@x.com', tipo='AL - Seña', fecha=datetime(2026, 9, 1), nombre='Ana')
    venta(db, mail='ana@x.com', tipo='AL - Completo', monto=800.0, fecha=datetime(2026, 9, 3),
          nombre='Ana')
    venta(db, mail='viejo@x.com', tipo='AL - Seña', fecha=datetime(2026, 6, 1), nombre='Viejo')
    venta(db, mail='nuevo@x.com', tipo='RR - Seña', fecha=datetime(2026, 9, 12), nombre='Nuevo')

    filas = ComercialService.ventas(DESDE, HASTA)
    panel = senas_de(filas)

    por_estado = [f['sena_estado'] for f in filas if f['sena_estado']]
    assert sorted(por_estado) == ['caida', 'en_espera', 'pago_completo']
    assert (panel['total'], panel['completo'], panel['caida'], panel['espera']) == (3, 1, 1, 1)
    # El cash que la seña destrabó: el argumento para seguir pidiéndolas.
    assert panel['desbloqueado'] == 800.0


# --- La seña completada con una cuota (19/10/2026) ----------------------------------------------

@freeze_time('2026-10-19 18:00:00')
def test_una_sena_completada_como_cuota_cuenta_como_pago_completo(client, db, vendedor):
    """Caso real de Erika Moreira: seña de $50 «paga completo mañana» y el resto, $1.950, cargado
    como «RR - Cuota». Llegan al precio del programa: la seña se convirtió en un pago completo."""
    venta(db, mail='erika@x.com', tipo='RR - Seña', monto=50.0, fecha=datetime(2026, 10, 15),
          nombre='Erika')
    venta(db, mail='erika@x.com', tipo='RR - Cuota', monto=1950.0, fecha=datetime(2026, 10, 19),
          nombre='Erika')
    venta(db, mail='mauricio@x.com', tipo='AL - Seña', monto=75.0, fecha=datetime(2026, 10, 13),
          nombre='Mauricio')

    filas = ComercialService.ventas(date(2026, 10, 1), date(2026, 10, 31))
    panel = senas_de(filas)

    assert estados(filas)['Erika'] == 'pago_completo'
    assert (panel['total'], panel['completo'], panel['parcial'], panel['espera']) == (2, 1, 0, 1)
    assert panel['conversion'] == 50.0
    assert panel['desbloqueado'] == 1950.0


@freeze_time(HOY)
def test_una_cuota_que_no_llega_al_precio_es_pago_parcial(client, db, vendedor):
    venta(db, mail='gabi@x.com', tipo='AL - Seña', monto=25.0, fecha=datetime(2026, 9, 1),
          nombre='Gabi')
    venta(db, mail='gabi@x.com', tipo='AL - Cuota', monto=125.0, fecha=datetime(2026, 9, 14),
          nombre='Gabi')

    filas = ComercialService.ventas(DESDE, HASTA)

    assert estados(filas)['Gabi'] == 'pago_parcial'


@freeze_time(HOY)
def test_el_precio_propio_del_cliente_manda_sobre_el_de_lista(client, db, vendedor):
    db.session.add(Client(full_name='Caro', email='caro@x.com', total_amount=500.0))
    db.session.commit()
    venta(db, mail='caro@x.com', tipo='AL - Seña', monto=100.0, fecha=datetime(2026, 9, 1),
          nombre='Caro')
    venta(db, mail='caro@x.com', tipo='AL - Cuota', monto=400.0, fecha=datetime(2026, 9, 10),
          nombre='Caro')

    filas = ComercialService.ventas(DESDE, HASTA)

    assert estados(filas)['Caro'] == 'pago_completo'


@freeze_time(HOY)
def test_una_cuota_a_mas_de_un_mes_no_convierte_la_sena(client, db, vendedor):
    """Misma ventana que la primera cuota del ticket promedio: pasado un mes es otra venta."""
    venta(db, mail='tarde@x.com', tipo='AL - Seña', fecha=datetime(2026, 7, 10), nombre='Tarde')
    venta(db, mail='tarde@x.com', tipo='AL - Cuota', fecha=datetime(2026, 8, 10), nombre='Tarde')

    filas = ComercialService.ventas(DESDE, HASTA)

    assert estados(filas)['Tarde'] == 'caida'


@freeze_time(HOY)
def test_una_cuota_anterior_a_la_sena_no_la_convierte(client, db, vendedor):
    venta(db, mail='antes@x.com', tipo='AL - Cuota', fecha=datetime(2026, 9, 5), nombre='Antes')
    venta(db, mail='antes@x.com', tipo='AL - Seña', fecha=datetime(2026, 9, 10), nombre='Antes')

    filas = ComercialService.ventas(DESDE, HASTA)

    assert estados(filas)['Antes'] == 'en_espera'


def test_sin_senas_no_hay_nada_que_clasificar(client, db, vendedor):
    assert clasificar_senas([]) == {}
    assert senas_de([])['total'] == 0


# --- El estado de la cartera ------------------------------------------------------------------

@pytest.mark.parametrize('cuota,esperado,etiqueta', [
    (None, 'al_dia', 'Al día'),
    ({'sin_plan': True, 'vencida': False}, 'sin_plan', 'Sin cronograma'),
    ({'sin_plan': False, 'vencida': False}, 'por_vencer', 'Con deuda'),
    ({'sin_plan': False, 'vencida': True}, 'vencida', 'Cuota vencida'),
])
def test_la_cartera_distingue_sin_cronograma_de_con_deuda_y_de_vencida(cuota, esperado, etiqueta):
    clave = ComercialService._estado_cartera({'proxima_cuota': cuota})

    assert clave == esperado
    assert chip('estado_cartera', clave)['label'] == etiqueta


def test_el_estado_viaja_en_el_chip_de_la_fila_del_cliente(client, db, vendedor):
    """Una venta parcial declarada sin armar el cronograma deja deuda sin cuotas: sin este estado
    esos clientes se leían como "al día" pese a deber."""
    from app.models import Enrollment, Payment, Program

    programa = Program(name='Residency Roadmap', price=1000.0)
    db.session.add(programa)
    cliente = Client(full_name='Debe sin plan', email='debe@x.com', total_amount=1000.0)
    db.session.add(cliente)
    db.session.commit()
    venta(db, mail='debe@x.com', tipo='RR - Parcial', monto=400.0, nombre='Debe sin plan')
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id, closer_id=vendedor.id,
                             enrollment_date=date(2026, 9, 1))
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=400.0, date=date(2026, 9, 1),
                           payment_type='first_payment', status='completed'))
    db.session.commit()

    filas = ComercialService.clientes(closer_id=vendedor.id)

    assert len(filas) == 1
    assert filas[0]['deuda'] == 600.0
    assert filas[0]['estado'] == {'key': 'sin_plan', 'label': 'Sin cronograma', 'tone': 'warning'}
