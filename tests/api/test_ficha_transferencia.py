"""A quién del equipo se le hizo un pago por transferencia, en cada lugar donde se carga un pago.

Pedido de Kerwin (09/10/2026): marcarlo en la sección Pagos de la ficha (Pedro, Jean Carlo u otro)
y preguntarlo al registrar: la venta de «Resultado», «Registrar pago» de Acciones, «Agregar pago»
del historial y el alta de Operaciones. Un alta nueva por transferencia sin a quién es un 400; los
pagos viejos quedan «sin marcar» (null) y se corrigen igual. Lo marca quien hoy puede editar pagos
(el permiso `cobrar`: la dirección y cualquier closer; ni setter ni triage).
"""
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.models import Appointment, Client, FinancialSale, LeadEventLog, Payment, PaymentMethod, Program

SHEETS = 'app.services.sheets_service.SheetsService.post_to_sheets'


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'relevo': make_user(role='closer', username='relevo', email='relevo@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
        'triage': make_user(role='triage', username='triaje', email='triaje@neuro.com'),
    }


@pytest.fixture()
def lead(db, equipo):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g', phone='+59171234567')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id,
                       client_id=cliente.id, start_time=datetime.utcnow() - timedelta(hours=1),
                       origin='vsl', examen='ENARM', result='Confirmado', closer_result='Pendiente')
    db.session.add(appt)
    db.session.add_all([Program(name='Residency Roadmap v3', price=1500.0), PaymentMethod(name='Stripe')])
    db.session.commit()
    return appt


def url(appt, sufijo=''):
    return f'/api/ficha/{appt.id}{sufijo}'


def _pago(lead, metodo='Transferencia Bancaria', transferido_a=None, monto=150.0):
    """Un pago del cliente como lo deja una venta declarada: la seña de $150 de la captura."""
    venta = FinancialSale(client_id=lead.client_id, mail_cliente='ana@x.com', nombre_cliente='Ana Gomez',
                          tipo_pago='RR - Seña', monto=monto, metodo_pago=metodo,
                          transferido_a=transferido_a, estado='Completada', date=datetime(2026, 9, 9),
                          email_vendedor='vendedor@neuro.com')
    from app import db
    db.session.add(venta)
    db.session.commit()
    return venta


def _ficha(client, lead, usuario, auth_headers):
    return client.get(f'/api/ficha/lead?appointment_id={lead.id}', headers=auth_headers(usuario)).get_json()


# --- La lectura -----------------------------------------------------------------------------------

def test_la_ficha_dice_de_cada_pago_si_es_transferencia_y_a_quien(client, db, lead, equipo, auth_headers):
    _pago(lead, transferido_a='jean_carlo')
    _pago(lead, monto=200.0)                    # una transferencia vieja: sin marcar
    _pago(lead, metodo='Stripe', monto=300.0)

    ficha = _ficha(client, lead, equipo['closer'], auth_headers)

    assert [(p['monto'], p['es_transferencia'], p['transferido_a']) for p in ficha['cobro']['pagos']] == [
        (150.0, True, 'jean_carlo'), (200.0, True, None), (300.0, False, None)]
    assert [o['clave'] for o in ficha['vocabulario']['transferido_a']] == ['pedro', 'jean_carlo', 'otro']


# --- Marcar, cambiar y limpiar desde la sección Pagos --------------------------------------------

def _corregir(client, lead, venta, cambios, usuario, auth_headers):
    return client.patch(url(lead, f'/pago/{venta.id}'), json=cambios, headers=auth_headers(usuario))


def test_se_marca_a_quien_se_le_hizo_una_transferencia_vieja(client, db, lead, equipo, auth_headers):
    """El caso de la captura: la seña de $150 por transferencia que se le pasó a Jean Carlo."""
    venta = _pago(lead)

    r = _corregir(client, lead, venta, {'transferido_a': 'jean_carlo'}, equipo['director'], auth_headers)

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['cambios'] == ['transferido_a']
    assert venta.transferido_a == 'jean_carlo'
    evento = LeadEventLog.query.filter_by(action_type='pago_corregido').one()
    assert 'transferido a sin marcar → Jean Carlo' in evento.description


def test_se_cambia_y_se_vuelve_a_sin_marcar(client, db, lead, equipo, auth_headers):
    venta = _pago(lead, transferido_a='jean_carlo')

    assert _corregir(client, lead, venta, {'transferido_a': 'pedro'}, equipo['closer'],
                     auth_headers).status_code == 200
    assert venta.transferido_a == 'pedro'
    assert _corregir(client, lead, venta, {'transferido_a': None}, equipo['closer'],
                     auth_headers).status_code == 200
    assert venta.transferido_a is None


def test_marcar_no_toca_la_plata_ni_su_registro_en_la_deuda(client, db, lead, equipo, auth_headers):
    venta = _pago(lead)

    r = _corregir(client, lead, venta, {'transferido_a': 'otro'}, equipo['closer'], auth_headers)

    assert r.status_code == 200
    assert (venta.monto, venta.metodo_pago, venta.tipo_pago) == (150.0, 'Transferencia Bancaria', 'RR - Seña')
    assert Payment.query.count() == 0


def test_cambiar_el_medio_a_otro_limpia_la_marca(client, db, lead, equipo, auth_headers):
    venta = _pago(lead, transferido_a='jean_carlo')

    r = _corregir(client, lead, venta, {'metodo_pago': 'Stripe'}, equipo['closer'], auth_headers)

    assert r.status_code == 200, r.get_json()
    assert (venta.metodo_pago, venta.transferido_a) == ('Stripe', None)
    assert sorted(r.get_json()['cambios']) == ['metodo_pago', 'transferido_a']


def test_un_pago_que_pasa_a_transferencia_pide_a_quien(client, db, lead, equipo, auth_headers):
    venta = _pago(lead, metodo='Stripe')

    sin = _corregir(client, lead, venta, {'metodo_pago': 'Transferencia'}, equipo['closer'], auth_headers)
    assert sin.status_code == 400
    assert sin.get_json()['campo'] == 'transferido_a'
    assert venta.metodo_pago == 'Stripe'

    con = _corregir(client, lead, venta, {'metodo_pago': 'Transferencia', 'transferido_a': 'pedro'},
                    equipo['closer'], auth_headers)
    assert con.status_code == 200, con.get_json()
    assert (venta.metodo_pago, venta.transferido_a) == ('Transferencia', 'pedro')


def test_un_pago_que_no_es_transferencia_no_se_marca(client, db, lead, equipo, auth_headers):
    venta = _pago(lead, metodo='Stripe')

    r = _corregir(client, lead, venta, {'transferido_a': 'jean_carlo'}, equipo['closer'], auth_headers)

    assert r.status_code == 400
    assert 'no es por transferencia' in r.get_json()['message']
    assert venta.transferido_a is None


def test_una_opcion_que_no_es_de_la_lista_no_se_guarda(client, db, lead, equipo, auth_headers):
    venta = _pago(lead)

    r = _corregir(client, lead, venta, {'transferido_a': 'kerwin'}, equipo['closer'], auth_headers)

    assert r.status_code == 400
    assert venta.transferido_a is None


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_quien_no_edita_pagos_no_los_marca(client, db, lead, equipo, auth_headers, rol):
    venta = _pago(lead)

    r = _corregir(client, lead, venta, {'transferido_a': 'jean_carlo'}, equipo[rol], auth_headers)

    assert r.status_code == 403
    assert venta.transferido_a is None


def test_cualquier_closer_marca_como_corrige_cualquier_pago(client, db, lead, equipo, auth_headers):
    """El mismo permiso que corregir el pago (`cobrar`): no hace falta ser el closer de la agenda."""
    venta = _pago(lead)

    r = _corregir(client, lead, venta, {'transferido_a': 'pedro'}, equipo['relevo'], auth_headers)

    assert r.status_code == 200


# --- «Agregar pago» del historial ----------------------------------------------------------------

PAGO = {'fecha': '2026-09-09', 'monto': 150, 'metodo_pago': 'Transferencia Bancaria',
        'programa_code': 'RR', 'tipo': 'seña'}


def test_agregar_un_pago_por_transferencia_pide_a_quien(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/pago'), json=PAGO, headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'transferido_a'
    assert '¿A quién se le hizo la transferencia?' in r.get_json()['message']
    assert FinancialSale.query.count() == 0


def test_agregar_un_pago_por_transferencia_guarda_a_quien(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/pago'), json={**PAGO, 'transferido_a': 'jean_carlo'},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 201, r.get_json()
    assert FinancialSale.query.one().transferido_a == 'jean_carlo'
    evento = LeadEventLog.query.filter_by(action_type='pago_cargado').one()
    assert 'transferido a Jean Carlo' in evento.description


def test_agregar_un_pago_por_otro_medio_no_guarda_a_nadie(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/pago'), json={**PAGO, 'metodo_pago': 'Stripe', 'transferido_a': 'pedro'},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 201
    assert FinancialSale.query.one().transferido_a is None


# --- La venta de «Resultado» y «Registrar pago» de Acciones ----------------------------------------

def _venta_del_arbol(metodo='Transferencia Bancaria', **venta):
    return {
        'venta': {'nombre_cliente': 'Ana Gómez', 'mail_cliente': 'ana@x.com', 'instagram': 'ana.g',
                  'tipo_pago': 'RR - Seña', 'monto': 150, 'metodo_pago': metodo, 'estado': 'Completada',
                  'marca_temporal': '9/9/2026, 10:30:00', 'enviar_webhook': True, **venta},
        'agenda': {'with_decision_maker': True, 'offer_presented': True},
        'referidos': {'pedido': 'no', 'filas': []}, 'respuestas': {'res': 'asistio', 'cierre': True},
    }


def _declarar(client, auth_headers, usuario, lead, payload):
    with patch(SHEETS, return_value={'status': 'success', 'client_id': lead.client_id}) as enviado:
        r = client.post(url(lead, '/venta'), json=payload, headers=auth_headers(usuario))
    return r, enviado


def test_la_venta_por_transferencia_sin_a_quien_no_se_declara(client, db, lead, equipo, auth_headers):
    r, enviado = _declarar(client, auth_headers, equipo['closer'], lead, _venta_del_arbol())

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'transferido_a'
    enviado.assert_not_called()


def test_la_venta_por_transferencia_lleva_a_quien_hasta_la_venta(client, db, lead, equipo, auth_headers):
    r, enviado = _declarar(client, auth_headers, equipo['closer'], lead,
                           _venta_del_arbol(transferido_a='jean_carlo'))

    assert r.status_code == 201, r.get_json()
    assert enviado.call_args[0][1]['transferido_a'] == 'jean_carlo'


def test_la_venta_por_otro_medio_no_pregunta(client, db, lead, equipo, auth_headers):
    r, enviado = _declarar(client, auth_headers, equipo['closer'], lead,
                           _venta_del_arbol(metodo='Stripe', transferido_a='pedro'))

    assert r.status_code == 201
    assert enviado.call_args[0][1]['transferido_a'] is None


def test_el_saldo_liquidado_por_transferencia_va_a_la_misma_persona(client, db, lead, equipo, auth_headers):
    payload = {**_venta_del_arbol(transferido_a='pedro', tipo_pago='RR - Renovacion'),
               'liquidar_saldo': {'monto': 300, 'tipo_pago': 'RR - Cuota'}}

    r, enviado = _declarar(client, auth_headers, equipo['closer'], lead, payload)

    assert r.status_code == 201, r.get_json()
    cuota, renovacion = (llamada[0][1] for llamada in enviado.call_args_list)
    assert (cuota['tipo_pago'], cuota['transferido_a']) == ('RR - Cuota', 'pedro')
    assert renovacion['transferido_a'] == 'pedro'


def test_registrar_pago_de_acciones_por_transferencia_pide_a_quien(client, db, lead, equipo, auth_headers):
    cobro = {'tipo_pago': 'RR - Cuota', 'monto': 150, 'metodo_pago': 'Transferencia',
             'marca_temporal': '2026-09-09'}

    sin, enviado = _declarar(client, auth_headers, equipo['director'], lead, cobro)
    assert sin.status_code == 400
    enviado.assert_not_called()

    con, enviado = _declarar(client, auth_headers, equipo['director'], lead, {**cobro, 'transferido_a': 'otro'})
    assert con.status_code == 201
    assert enviado.call_args[0][1]['transferido_a'] == 'otro'


def test_la_venta_guarda_a_quien_y_no_lo_manda_a_la_hoja_ni_a_n8n(db, lead):
    """`post_to_sheets` es el camino real: guarda la venta y manda el payload entero a Google
    Sheets y a n8n. `transferido_a` es de NeurOPS, como `appointment_id`: no viaja."""
    from app.services.sheets_service import SheetsService

    base = 'app.services.sheets_service'
    with patch(f'{base}.requests.post') as hoja, \
            patch(f'{base}.SheetsService._trigger_n8n_webhook') as n8n, \
            patch('app.services.closer_service.CloserService.check_and_notify_down_payment_conversion'), \
            patch('app.services.closer_service.CloserService.mark_sale_appointment_as_show_up', return_value=None):
        hoja.return_value.status_code = 200
        SheetsService.post_to_sheets('Ventas_DB', {
            'nombre_cliente': 'Ana Gomez', 'mail_cliente': 'ana@x.com', 'tipo_pago': 'RR - Seña', 'monto': 150,
            'metodo_pago': 'Transferencia Bancaria', 'transferido_a': 'jean_carlo', 'estado': 'Completada',
            'marca_temporal': '09/09/2026 10:30:00', 'email_vendedor': 'vendedor@neuro.com'})

    assert FinancialSale.query.one().transferido_a == 'jean_carlo'
    assert 'transferido_a' not in hoja.call_args.kwargs['json']['datos']
    assert 'transferido_a' not in n8n.call_args[0][0]


# --- El alta y la edición de Operaciones -------------------------------------------------------------

@pytest.fixture()
def operador(make_user, auth_headers):
    return auth_headers(make_user(role='operator'))


def test_el_alta_de_operaciones_por_transferencia_pide_a_quien(client, db, operador):
    venta = {'nombre_cliente': 'Ana Gomez', 'monto': 150, 'tipo_pago': 'RR - Seña',
             'metodo_pago': 'Transferencia Bancaria'}

    with patch(SHEETS, return_value={'status': 'success'}) as enviado:
        sin = client.post('/api/public/financial-sales/new', json=venta, headers=operador)
        con = client.post('/api/public/financial-sales/new', json={**venta, 'transferido_a': 'pedro'},
                          headers=operador)

    assert sin.status_code == 400
    assert con.status_code == 201
    enviado.assert_called_once()
    assert enviado.call_args[0][1]['transferido_a'] == 'pedro'


def test_la_edicion_de_operaciones_marca_y_limpia(client, db, lead, operador):
    venta = _pago(lead)

    r = client.put(f'/api/public/financial-sales/{venta.id}', json={'transferido_a': 'jean_carlo'},
                   headers=operador)
    assert r.status_code == 200, r.get_json()
    assert r.get_json()['sale']['transferido_a'] == 'jean_carlo'

    r = client.put(f'/api/public/financial-sales/{venta.id}', json={'payment_type': 'Stripe'}, headers=operador)
    assert r.status_code == 200
    assert venta.transferido_a is None


def test_el_cambio_de_medio_en_lote_limpia_la_marca(client, db, lead, operador):
    venta = _pago(lead, transferido_a='pedro')

    r = client.post('/api/public/financial-sales/bulk-update', json={'sale_ids': [venta.id], 'metodo_pago': 'Stripe'},
                    headers=operador)

    assert r.status_code == 200, r.get_json()
    assert venta.transferido_a is None
