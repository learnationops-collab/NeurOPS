"""Finanzas › Diferencias (09/10/2026) por sus rutas: quién entra, subir CSV sin duplicar, la
conciliación del período y las correcciones rápidas sobre lo reportado, que cambian ventas reales."""
import io
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.models import Appointment, Client, ConciliacionMovimiento, FinancialSale, LeadEventLog

STRIPE = ('Created date (UTC),Amount,Fee,Total,Card Name,Customer Email,Notas\n'
          '2026-09-27 2:29:57,480.77,21.45,459.32,Kervin Prueba,kervin@prueba.com,\n'
          '2026-09-05 23:41:05,100,4.7,95.3,Adrian Prueba,adrian@prueba.com,No esta en los reportes\n')
HOTMART = ('Fecha de venta,Nombre,Precio de la Oferta,precio bruto,comision,porcentaje de comision,Email\n'
           '28/09/2026 21:15:12,Greta Prueba Castro,228.93,250,21.07,9.20%,greta@prueba.com\n')
HOJA = 'app.api.public.financial_sales._propagar_lote_a_sheets'


@pytest.fixture()
def finanzas(make_user, auth_headers):
    return auth_headers(make_user(role='director_comercial', can_view_finance=True))


@pytest.fixture()
def lead(db, make_user):
    """Un cliente con su agenda y una venta por Stripe de $480 que en el CSV entró como $480.77."""
    closer = make_user(role='closer', email='vendedor@prueba.com')
    cliente = Client(full_name='Kervin Prueba', email='kervin@prueba.com')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=datetime(2026, 9, 20, 15),
                       origin='vsl', result='Confirmado', closer_result='Show up')
    venta = FinancialSale(client_id=cliente.id, mail_cliente='kervin@prueba.com', nombre_cliente='Kervin Prueba',
                          tipo_pago='AL - Cuota', monto=480.0, metodo_pago='Stripe', estado='Completada',
                          date=datetime(2026, 9, 26, 10, 0), marca_temporal='26/09/2026 10:00:00',
                          email_vendedor='vendedor@prueba.com')
    db.session.add_all([appt, venta])
    db.session.commit()
    return {'appt': appt, 'venta': venta, 'cliente': cliente}


def subir(client, cabeceras, texto, archivo='stripe.csv', pasarela=None):
    datos = {'archivo': (io.BytesIO(texto.encode('utf-8')), archivo)}
    if pasarela:
        datos['pasarela'] = pasarela
    return client.post('/api/public/finance/conciliacion/cargas', headers=cabeceras, data=datos,
                       content_type='multipart/form-data')


def conciliacion(client, cabeceras, mes='2026-09'):
    respuesta = client.get(f'/api/public/finance/conciliacion?month={mes}', headers=cabeceras)
    assert respuesta.status_code == 200, respuesta.get_json()
    return respuesta.get_json()


def fila(datos, estado):
    filas = [f for f in datos['filas'] if f['estado'] == estado]
    assert len(filas) == 1, filas
    return filas[0]


# --- Quién entra ----------------------------------------------------------------------------------

@pytest.mark.parametrize('rol,permiso,entra', [
    ('admin', True, True), ('director_comercial', True, True),
    ('admin', False, False), ('director_comercial', False, False),
    ('closer', True, False), ('setter', True, False), ('operator', True, False),
])
def test_diferencias_es_de_quien_ve_finanzas(client, db, make_user, auth_headers, lead, rol, permiso, entra):
    cabeceras = auth_headers(make_user(role=rol, can_view_finance=permiso))
    venta = lead['venta']

    with patch(HOJA):
        respuestas = {
            'ver': client.get('/api/public/finance/conciliacion?month=2026-09', headers=cabeceras),
            'subir': subir(client, cabeceras, STRIPE),
            'corregir': client.put(f'/api/public/finance/conciliacion/ventas/{venta.id}', headers=cabeceras,
                                   json={'monto': 480.77}),
            'revisar': client.post('/api/public/finance/conciliacion/revisiones', headers=cabeceras,
                                   json={'clave': f'v{venta.id}'}),
            'borrar': client.delete('/api/public/finance/conciliacion/cargas/999', headers=cabeceras),
        }

    codigos = {k: r.status_code for k, r in respuestas.items()}
    if entra:
        assert codigos == {'ver': 200, 'subir': 201, 'corregir': 200, 'revisar': 200, 'borrar': 404}
    else:
        assert set(codigos.values()) == {403}
        # Nada cambió: ni la venta ni los cobros.
        assert db.session.get(FinancialSale, venta.id).monto == 480.0
        assert ConciliacionMovimiento.query.count() == 0


def test_sin_sesion_no_se_entra(client, db):
    assert client.get('/api/public/finance/conciliacion?month=2026-09').status_code == 401
    assert client.post('/api/public/finance/conciliacion/revisiones', json={'clave': 'v1'}).status_code == 401


# --- Subir CSV ------------------------------------------------------------------------------------

def test_subir_el_mismo_csv_dos_veces_no_duplica(client, db, finanzas):
    primera = subir(client, finanzas, STRIPE)
    segunda = subir(client, finanzas, STRIPE)

    assert primera.status_code == 201 and segunda.status_code == 201
    assert (primera.get_json()['nuevas'], segunda.get_json()['nuevas'], segunda.get_json()['repetidas']) == (2, 0, 2)
    assert ConciliacionMovimiento.query.count() == 2


def test_un_csv_que_no_dice_de_que_pasarela_es_pide_elegirla(client, db, finanzas):
    generico = 'Fecha,Monto,Email\n2026-09-02 10:00:00,75,a@prueba.com\n'

    sin_elegir = subir(client, finanzas, generico, archivo='cobros.csv')
    elegida = subir(client, finanzas, generico, archivo='cobros.csv', pasarela='hotmart')

    assert sin_elegir.status_code == 400
    error = sin_elegir.get_json()
    assert (error['codigo'], error['columnas']) == ('pasarela', ['Fecha', 'Monto', 'Email'])
    assert elegida.status_code == 201 and elegida.get_json()['pasarela'] == 'hotmart'


def test_sin_archivo_o_con_uno_ilegible_es_un_400(client, db, finanzas):
    assert client.post('/api/public/finance/conciliacion/cargas', headers=finanzas, data={},
                       content_type='multipart/form-data').status_code == 400
    ilegible = subir(client, finanzas, 'Amount,Customer Email\n10,a@b.com\n', pasarela='stripe')
    assert (ilegible.status_code, ilegible.get_json()['codigo']) == (400, 'columnas')


def test_borrar_una_carga(client, db, finanzas):
    carga = subir(client, finanzas, STRIPE).get_json()['carga']

    assert client.delete(f'/api/public/finance/conciliacion/cargas/{carga}', headers=finanzas).status_code == 200
    assert ConciliacionMovimiento.query.count() == 0
    assert conciliacion(client, finanzas)['cargas'] == []


# --- La conciliación ------------------------------------------------------------------------------

def test_la_conciliacion_del_mes_con_sus_kpis_y_las_opciones_de_medio(client, db, finanzas, lead):
    subir(client, finanzas, STRIPE)

    datos = conciliacion(client, finanzas)

    assert sorted(f['estado'] for f in datos['filas']) == ['monto_distinto', 'sin_reportar']
    kpis = datos['kpis']['stripe']
    assert (kpis['reportado'], kpis['ingresado'], kpis['diferencia']) == (480.0, 580.77, 100.77)
    assert datos['kpis']['hotmart']['con_csv'] is False
    assert 'Hotmart' in [m['clave'] for m in datos['opciones']['medios']]
    assert [o['clave'] for o in datos['opciones']['transferido_a']] == ['pedro', 'jean_carlo', 'otro']
    # Un período que no se entiende es un 400, como el resto de Finanzas.
    assert client.get('/api/public/finance/conciliacion?month=sept', headers=finanzas).status_code == 400


def test_lo_que_dice_el_resumen_es_el_ingreso_del_resumen(client, db, finanzas, lead):
    """La brecha (09/10/2026) parte de lo que muestra Finanzas › Resumen: si las dos cuentas se
    separaran, la brecha explicaría un número que nadie ve. Con ventas de todos los medios: una
    cancelada, una por Hotmart sin CSV, otra por Zelle y una transferencia."""
    def otra(monto, metodo, estado='Completada'):
        db.session.add(FinancialSale(monto=monto, metodo_pago=metodo, estado=estado, tipo_pago='AL - Cuota',
                                     date=datetime(2026, 9, 12, 10), nombre_cliente='Otra Prueba'))

    otra(333.33, 'Hotmart')
    otra(120.0, 'Zelle')
    otra(150.0, 'Transferencia Bancaria')
    otra(999.0, 'Stripe', estado='Cancelada')
    db.session.commit()
    subir(client, finanzas, STRIPE)

    resumen = conciliacion(client, finanzas)['kpis']['todas']['resumen']
    ingresos = client.get('/api/public/finance/summary?month=2026-09', headers=finanzas).get_json()

    assert resumen['total'] == ingresos['kpis']['total_income']
    assert round(sum(p['monto'] for p in resumen['partes']), 2) == resumen['brecha']


# --- Correcciones ---------------------------------------------------------------------------------

def test_usar_el_bruto_real_corrige_la_venta_por_la_ficha_y_la_hoja_en_segundo_plano(client, db, finanzas, lead):
    subir(client, finanzas, STRIPE)
    distinta = fila(conciliacion(client, finanzas), 'monto_distinto')
    venta = lead['venta']

    with patch(HOJA) as hoja:
        respuesta = client.put(f'/api/public/finance/conciliacion/ventas/{venta.id}', headers=finanzas,
                               json={'monto': distinta['ingresado']})

    cuerpo = respuesta.get_json()
    assert respuesta.status_code == 200
    assert (cuerpo['ficha'], cuerpo['cambios'], cuerpo['hoja']) == (True, ['monto'], True)
    assert db.session.get(FinancialSale, venta.id).monto == 480.77
    # La hoja de ventas se pone al día con la venta corregida, fuera de la request.
    (_, filas), _ = hoja.call_args
    assert [(marca, datos['monto'], datos['metodo_pago']) for marca, datos in filas] == [
        ('26/09/2026 10:00:00', 480.77, 'Stripe')]
    # Quedó en la bitácora del lead, como una corrección desde la ficha.
    eventos = LeadEventLog.query.filter_by(appointment_id=lead['appt'].id).all()
    assert [e.action_type for e in eventos] == ['pago_corregido']
    assert '$480.00 → $480.77' in eventos[0].description
    assert 'desde Finanzas › Diferencias' in eventos[0].description
    # Y la fila ya coincide: la conciliación se recalcula.
    assert [f['estado'] for f in conciliacion(client, finanzas)['filas']] == ['coincide', 'sin_reportar']


def test_corregir_la_fecha_conserva_la_hora_y_un_monto_invalido_es_un_400(client, db, finanzas, lead):
    venta = lead['venta']

    with patch(HOJA):
        fecha = client.put(f'/api/public/finance/conciliacion/ventas/{venta.id}', headers=finanzas,
                           json={'fecha': '2026-09-27'})
        invalido = client.put(f'/api/public/finance/conciliacion/ventas/{venta.id}', headers=finanzas,
                              json={'monto': 'mucho'})
        vacio = client.put(f'/api/public/finance/conciliacion/ventas/{venta.id}', headers=finanzas, json={})

    assert fecha.status_code == 200
    assert db.session.get(FinancialSale, venta.id).date == datetime(2026, 9, 27, 10, 0)
    assert invalido.status_code == 400 and 'número' in invalido.get_json()['error']
    assert vacio.status_code == 400
    assert client.put('/api/public/finance/conciliacion/ventas/999999', headers=finanzas,
                      json={'monto': 1}).status_code == 404


def test_cambiar_el_metodo_de_una_venta_que_entro_por_la_otra_pasarela(client, db, finanzas):
    greta = FinancialSale(mail_cliente='greta.vieja@prueba.com', nombre_cliente='Greta Castro', monto=250.0,
                          metodo_pago='Stripe', estado='Completada', tipo_pago='AL - Parcial',
                          date=datetime(2026, 9, 28, 18, 57))
    db.session.add(greta)
    db.session.commit()
    subir(client, finanzas, STRIPE)
    subir(client, finanzas, HOTMART, archivo='hotmart.csv')
    sugerencia = fila(conciliacion(client, finanzas), 'sin_ingreso')['sugerencia']
    assert sugerencia == {'venta_id': greta.id, 'metodo_pago': 'Hotmart'}

    with patch(HOJA):
        respuesta = client.put(f'/api/public/finance/conciliacion/ventas/{greta.id}', headers=finanzas,
                               json={'metodo_pago': sugerencia['metodo_pago']})

    # Sin cliente en el sistema: se corrige la venta sola, con las mismas validaciones.
    assert (respuesta.status_code, respuesta.get_json()['ficha']) == (200, False)
    datos = conciliacion(client, finanzas)
    assert [(f['pasarela'], f['estado']) for f in datos['filas'] if f['venta']] == [('hotmart', 'coincide')]


def test_pasar_una_venta_a_transferencia_pide_a_quien(client, db, finanzas, lead):
    venta = lead['venta']

    with patch(HOJA):
        sin_quien = client.put(f'/api/public/finance/conciliacion/ventas/{venta.id}', headers=finanzas,
                               json={'metodo_pago': 'Transferencia Bancaria'})
        con_quien = client.put(f'/api/public/finance/conciliacion/ventas/{venta.id}', headers=finanzas,
                               json={'metodo_pago': 'Transferencia Bancaria', 'transferido_a': 'pedro'})
        no_lista = client.put(f'/api/public/finance/conciliacion/ventas/{venta.id}', headers=finanzas,
                              json={'metodo_pago': 'Mercado de pulgas'})

    assert (sin_quien.status_code, sin_quien.get_json()['campo']) == (400, 'transferido_a')
    assert con_quien.status_code == 200
    guardada = db.session.get(FinancialSale, venta.id)
    assert (guardada.metodo_pago, guardada.transferido_a) == ('Transferencia Bancaria', 'pedro')
    assert no_lista.status_code == 400


# --- Revisadas ------------------------------------------------------------------------------------

def test_marcar_y_desmarcar_una_diferencia_revisada(client, db, finanzas, lead):
    subir(client, finanzas, STRIPE)
    distinta = fila(conciliacion(client, finanzas), 'monto_distinto')

    marcar = client.post('/api/public/finance/conciliacion/revisiones', headers=finanzas,
                         json={'clave': distinta['clave'], 'estado': 'monto_distinto', 'nota': 'redondeo'})
    revisada = fila(conciliacion(client, finanzas), 'monto_distinto')['revisada']
    desmarcar = client.post('/api/public/finance/conciliacion/revisiones', headers=finanzas,
                            json={'clave': distinta['clave'], 'revisada': False})
    datos = conciliacion(client, finanzas)

    assert (marcar.status_code, desmarcar.status_code) == (200, 200)
    assert revisada['nota'] == 'redondeo' and revisada['por'].startswith('director_comercial')
    assert fila(datos, 'monto_distinto')['revisada'] is None
    assert datos['kpis']['todas']['pendientes']['total'] == 2
    assert client.post('/api/public/finance/conciliacion/revisiones', headers=finanzas,
                       json={'clave': 'cualquier cosa'}).status_code == 400


def test_el_periodo_personalizado_tambien_sirve(client, db, finanzas, lead):
    subir(client, finanzas, STRIPE)
    desde = (datetime(2026, 9, 20)).date().isoformat()
    hasta = (datetime(2026, 9, 20) + timedelta(days=10)).date().isoformat()

    datos = client.get(f'/api/public/finance/conciliacion?start_date={desde}&end_date={hasta}',
                       headers=finanzas).get_json()

    # El cobro del 05/09 queda afuera; la venta del 26/09 y su cobro, adentro.
    assert [f['estado'] for f in datos['filas']] == ['monto_distinto']
    assert datos['mes'] is None
