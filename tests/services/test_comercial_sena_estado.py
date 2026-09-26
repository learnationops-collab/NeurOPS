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
    return {f['cliente']: f['sena_estado'] for f in filas}


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
