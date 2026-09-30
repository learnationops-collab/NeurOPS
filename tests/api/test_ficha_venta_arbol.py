"""La venta ENTERA desde la pestaña «Resultado» de la ficha, en un solo guardado.

El wizard «Declarar venta» del mazo registraba una venta con seis llamadas encadenadas desde el
navegador. La ficha manda todo junto (`POST /ficha/<id>/venta` con un bloque `venta` y los demas
al lado) y el backend las hace en el mismo orden. Hasta este cambio la pestaña mandaba ese payload
y la ruta solo entendia la forma plana: la venta no se registraba nunca.

`post_to_sheets` se reemplaza por un doble: es la puerta a Google Sheets y n8n, y lo que se fija
aca es que reciba SOLO los campos de la venta y que los pasos de despues ocurran.
"""
from datetime import date, datetime, timedelta
from unittest.mock import patch

import pytest

from app.models import Appointment, Client, Comment, InstallmentPlan, LeadEventLog

SHEETS = 'app.services.sheets_service.SheetsService.post_to_sheets'
ACADEMIA = 'app.services.academy_access_service.AcademyAccessService.grant_access'


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
                       origin='vsl', examen='ENARM', result='Confirmado',
                       closer_result='Pendiente')
    db.session.add(appt)
    db.session.commit()
    return appt


def url(appt, sufijo=''):
    return f'/api/ficha/{appt.id}{sufijo}'


def venta_del_arbol(**extra):
    """El payload que arma `construirPayload` del frontend para una venta parcial."""
    return {
        'venta': {
            'email_vendedor': 'vendedor@neuro.com', 'nombre_cliente': 'Ana Gómez',
            'telefono': '59171234567', 'mail_cliente': 'ana@x.com', 'instagram': 'ana.g',
            'documento_identidad': '30111222', 'setter': 'captador',
            'tipo_pago': 'RR - parcial', 'monto': 500, 'precio_total': 1500,
            'segundo_pago': 'resto en cuotas', 'metodo_pago': 'Stripe',
            'examen': 'ENARM | cerró rápido', 'estado': 'Completada',
            'marca_temporal': '29/9/2026, 10:30:00', 'enviar_webhook': True,
            'enviar_mensaje': True, 'sold_in_call': True, 'appointment_id': 99999,
        },
        'liquidar_saldo': None, 'acceso_academia': None, 'seguimiento_cobro': None,
        'agenda': {'with_decision_maker': True, 'offer_presented': True},
        'cuota_cobrada': None, 'plan_cuotas': None, 'deck': None,
        'referidos': {'pedido': 'no', 'filas': []},
        'respuestas': {'res': 'asistio', 'cierre': True},
        **extra,
    }


def declarar(client, auth_headers, usuario, appt, payload, respuesta=None):
    respuesta = respuesta or {'status': 'success', 'client_id': appt.client_id}
    with patch(SHEETS, return_value=respuesta) as enviado:
        r = client.post(url(appt, '/venta'), json=payload, headers=auth_headers(usuario))
    return r, enviado


# --- La venta ----------------------------------------------------------------------------------

def test_a_sheets_viajan_solo_los_campos_de_la_venta(client, db, lead, equipo, auth_headers):
    """`post_to_sheets` manda su payload ENTERO a Google Sheets y a n8n: el plan, el acceso o los
    referidos no son columnas de la venta."""
    r, enviado = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol(
        plan_cuotas={'total': 1500, 'cobrado_hoy': 500, 'num_cuotas': 2, 'programa_code': 'RR'}))

    assert r.status_code == 201, r.get_json()
    tabla, payload = enviado.call_args[0]
    assert tabla == 'Ventas_DB'
    assert payload['tipo_pago'] == 'RR - parcial' and payload['monto'] == 500
    assert payload['documento_identidad'] == '30111222'
    assert payload['nombre_cliente'] == 'Ana Gómez'
    # La agenda es la que tiene abierta la ficha, no la que diga el payload.
    assert payload['appointment_id'] == lead.id
    for clave in ('venta', 'plan_cuotas', 'acceso_academia', 'referidos', 'agenda', 'respuestas',
                  'cuota_cobrada', 'liquidar_saldo', 'deck', 'seguimiento_cobro'):
        assert clave not in payload


def test_la_direccion_comercial_tambien_declara_la_venta_entera(client, db, lead, equipo,
                                                                auth_headers):
    r, enviado = declarar(client, auth_headers, equipo['director'], lead, venta_del_arbol())

    assert r.status_code == 201
    enviado.assert_called_once()


def test_la_venta_se_atribuye_al_closer_elegido_por_id(client, db, lead, equipo, auth_headers):
    """La lista de closers de la ficha viaja por id: el correo, que es lo que lee la comision, lo
    resuelve el backend."""
    payload = venta_del_arbol()
    payload['venta']['vendedor_id'] = equipo['relevo'].id

    r, enviado = declarar(client, auth_headers, equipo['closer'], lead, payload)

    assert r.status_code == 201
    assert enviado.call_args[0][1]['email_vendedor'] == 'relevo@neuro.com'
    assert 'vendedor_id' not in enviado.call_args[0][1]


def test_un_closer_que_no_existe_no_se_lleva_la_venta(client, db, lead, equipo, auth_headers):
    payload = venta_del_arbol()
    payload['venta']['vendedor_id'] = 424242

    r, enviado = declarar(client, auth_headers, equipo['closer'], lead, payload)

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'vendedor_id'
    enviado.assert_not_called()


def test_si_sheets_no_guardo_la_venta_no_se_dice_que_se_registro(client, db, lead, equipo,
                                                                  auth_headers):
    """`post_to_sheets` no levanta: devuelve `status: error`. Antes eso salia como 201 y la ficha
    decia «Venta registrada» sobre una venta que no existia."""
    r, _ = declarar(client, auth_headers, equipo['closer'], lead,
                    venta_del_arbol(plan_cuotas={'total': 1500, 'cobrado_hoy': 500,
                                                 'num_cuotas': 2, 'programa_code': 'RR'}),
                    respuesta={'status': 'error', 'message': 'Error local de base de datos: x'})

    assert r.status_code == 400
    assert 'Error local de base de datos' in r.get_json()['message']
    assert InstallmentPlan.query.count() == 0
    assert lead.with_decision_maker is None


# --- Lo que viene con la venta -------------------------------------------------------------------

def test_el_decisor_y_la_oferta_quedan_en_la_agenda(client, db, lead, equipo, auth_headers):
    r, _ = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol())

    assert r.status_code == 201
    assert (lead.with_decision_maker, lead.offer_presented) == (True, True)


def test_un_decisor_que_no_se_pregunto_no_pisa_el_que_habia(client, db, lead, equipo,
                                                          auth_headers):
    """La venta que llega desde la cadencia de seguimiento no vuelve a preguntar por el decisor."""
    lead.with_decision_maker = True
    db.session.commit()

    r, _ = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol(
        agenda={'with_decision_maker': None, 'offer_presented': None}))

    assert r.status_code == 201
    assert lead.with_decision_maker is True


def test_la_venta_desde_la_cadencia_cierra_el_seguimiento_y_deja_el_de_cobro(client, db, lead,
                                                                            equipo, auth_headers):
    lead.fecha_seguimiento = '2026-09-28'
    db.session.commit()

    r, _ = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol(
        deck={'closer_notes': 'cerró por WhatsApp', 'seguimiento_realizado': True,
              'fecha_seguimiento': None, 'contact_result': 'cerro'},
        seguimiento_cobro={'fecha_seguimiento_cobro': '2026-10-20',
                           'fecha_seguimiento': '2026-10-20', 'seguimiento_tipo': 'cerrada',
                           'seguimiento_sub': 'Seguimiento de cobro', 'seguimiento_intento': 1,
                           'seguimiento_realizado': False}))

    assert r.status_code == 201
    assert str(lead.fecha_seguimiento_cobro) == '2026-10-20'
    assert str(lead.fecha_seguimiento) == '2026-10-20'
    assert lead.seguimiento_sub == 'Seguimiento de cobro'
    assert lead.last_contact_outcome == 'cerro'


def test_pago_en_el_seguimiento_de_cobro_lo_da_por_hecho(client, db, lead, equipo, auth_headers):
    """«Pagó» del cobro de un cliente: la cuota se registra y el seguimiento queda hecho."""
    lead.seguimiento_tipo = 'cerrada'
    lead.fecha_seguimiento = '2026-09-28'
    lead.seguimiento_realizado = False
    db.session.commit()

    r, _ = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol(
        deck={'closer_notes': 'transfirió la cuota de octubre', 'seguimiento_realizado': True,
              'fecha_seguimiento': None, 'contact_result': 'pago'}))

    assert r.status_code == 201
    assert (lead.seguimiento_realizado, lead.fecha_seguimiento) == (True, None)
    assert lead.last_contact_outcome == 'pago'


def test_el_plan_de_cuotas_se_arma_con_las_fechas_y_montos_elegidos(client, db, lead, equipo,
                                                                   auth_headers):
    r, _ = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol(
        plan_cuotas={'total': 1500, 'cobrado_hoy': 500, 'num_cuotas': 2,
                     'fechas': ['2026-10-10', '2026-11-10'], 'montos': [600, 400],
                     'programa_code': 'RR'}))

    assert r.status_code == 201
    assert r.get_json()['cuotas'] == 2
    cuotas = InstallmentPlan.query.order_by(InstallmentPlan.numero_cuota).all()
    assert [(c.fecha_vencimiento, c.monto, c.programa_code) for c in cuotas] == [
        (date(2026, 10, 10), 600, 'RR'), (date(2026, 11, 10), 400, 'RR')]


def test_un_plan_que_no_se_puede_rehacer_no_tumba_la_venta(client, db, lead, equipo,
                                                          auth_headers):
    """La venta ya esta comiteada cuando llega el plan: un 400 haria que el closer la declare de
    nuevo. Se avisa y la venta queda."""
    db.session.add(InstallmentPlan(appointment_id=lead.id, client_id=lead.client_id,
                                   programa_code='RR', numero_cuota=1, monto=300,
                                   fecha_vencimiento=date(2026, 9, 1), estado='pagado'))
    db.session.commit()

    r, enviado = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol(
        plan_cuotas={'total': 1500, 'cobrado_hoy': 500, 'num_cuotas': 2, 'programa_code': 'RR'}))

    assert r.status_code == 201
    enviado.assert_called_once()
    avisos = r.get_json()['avisos']
    assert len(avisos) == 1 and 'plan de cuotas' in avisos[0]


def test_cobrar_una_cuota_del_plan_la_marca_pagada(client, db, lead, equipo, auth_headers):
    cuota = InstallmentPlan(appointment_id=lead.id, client_id=lead.client_id, programa_code='RR',
                            numero_cuota=1, monto=500, fecha_vencimiento=date(2026, 10, 1),
                            estado='pendiente')
    db.session.add(cuota)
    db.session.commit()

    payload = venta_del_arbol(cuota_cobrada={'cuota_id': cuota.id, 'estado': 'pagado',
                                             'monto': 500})
    payload['venta']['tipo_pago'] = 'RR - Cuota'
    r, _ = declarar(client, auth_headers, equipo['closer'], lead, payload)

    assert r.status_code == 201
    assert cuota.estado == 'pagado' and cuota.fecha_pago is not None


def test_una_cuota_de_otro_cliente_frena_la_venta_antes_de_declararla(client, db, lead, equipo,
                                                                     auth_headers):
    otro = Client(full_name='Otro', email='otro@x.com')
    db.session.add(otro)
    db.session.commit()
    ajena = InstallmentPlan(appointment_id=lead.id, client_id=otro.id, programa_code='RR',
                            numero_cuota=1, monto=500, fecha_vencimiento=date(2026, 10, 1),
                            estado='pendiente')
    db.session.add(ajena)
    db.session.commit()

    r, enviado = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol(
        cuota_cobrada={'cuota_id': ajena.id, 'estado': 'pagado', 'monto': 500}))

    assert r.status_code == 400
    enviado.assert_not_called()
    assert ajena.estado == 'pendiente'


def test_el_acceso_a_la_academia_se_da_con_el_email_de_la_venta(client, db, lead, equipo,
                                                               auth_headers):
    with patch(ACADEMIA, return_value={'was_created': True}) as acceso:
        r, _ = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol(
            acceso_academia={'programa_code': 'RR', 'tipo_venta': 'parcial',
                             'email': 'ana.nueva@x.com'}))

    assert r.status_code == 201
    cliente, programa, tipo, vence, email = acceso.call_args[0]
    assert (cliente.id, programa, tipo, vence, email) == (lead.client_id, 'RR', 'parcial', None,
                                                         'ana.nueva@x.com')
    assert r.get_json()['academia'] == {'creada': True}


def test_si_la_academia_falla_la_venta_queda_y_se_avisa(client, db, lead, equipo, auth_headers):
    from app.services.academy_access_service import AcademyAccessError

    with patch(ACADEMIA, side_effect=AcademyAccessError('La Academia no responde')):
        r, enviado = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol(
            acceso_academia={'programa_code': 'RR', 'tipo_venta': 'parcial',
                             'email': 'ana@x.com'}))

    assert r.status_code == 201
    enviado.assert_called_once()
    cuerpo = r.get_json()
    assert cuerpo['academia'] is None
    assert any('Academia no responde' in a for a in cuerpo['avisos'])


def test_sin_pedir_acceso_no_se_toca_la_academia(client, db, lead, equipo, auth_headers):
    with patch(ACADEMIA) as acceso:
        r, _ = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol())

    assert r.status_code == 201
    acceso.assert_not_called()


def test_los_referidos_con_nombre_entran_como_leads_nuevos(client, db, lead, equipo, auth_headers):
    r, _ = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol(
        referidos={'pedido': 'si', 'filas': [{'nombre': 'Beto', 'contacto': '@beto.ig'},
                                             {'nombre': 'Caro', 'contacto': '+59170000000'},
                                             {'nombre': '  ', 'contacto': 'sin nombre'}]}))

    assert r.status_code == 201
    assert r.get_json()['referidos'] == 2
    nuevas = Appointment.query.filter(Appointment.id != lead.id).all()
    assert {a.origin for a in nuevas} == {'Referido de Ana Gomez'}
    assert {a.closer_id for a in nuevas} == {equipo['closer'].id}
    assert {a.client.instagram for a in nuevas} == {'beto.ig', None}
    assert Comment.query.filter_by(associated_id=lead.client_id, comment_type='client').filter(
        Comment.text.contains('Referencia otorgada')).count() == 2


def test_las_respuestas_del_arbol_de_la_venta_quedan_en_la_bitacora(client, db, lead, equipo,
                                                                   auth_headers):
    r, _ = declarar(client, auth_headers, equipo['closer'], lead, venta_del_arbol())

    assert r.status_code == 201
    assert LeadEventLog.query.filter_by(appointment_id=lead.id,
                                        action_type='reporte_arbol').count() == 1


# --- Liquidar el saldo viejo -----------------------------------------------------------------------

def test_el_saldo_viejo_se_liquida_a_nombre_del_comprador_de_la_venta(client, db, lead, equipo,
                                                                     auth_headers):
    payload = venta_del_arbol(liquidar_saldo={'monto': 750, 'tipo_pago': 'RR - Cuota',
                                              'comentario': 'Liquidación de saldo previo'})
    payload['venta']['tipo_pago'] = 'RR - Renovacion'

    r, enviado = declarar(client, auth_headers, equipo['closer'], lead, payload)

    assert r.status_code == 201
    liquidacion, principal = [llamada[0][1] for llamada in enviado.call_args_list]
    assert (liquidacion['tipo_pago'], liquidacion['monto']) == ('RR - Cuota', 750)
    assert liquidacion['nombre_cliente'] == 'Ana Gómez'
    assert liquidacion['segundo_pago'] == 'Liquidación de saldo previo'
    assert liquidacion['enviar_webhook'] is False
    assert principal['tipo_pago'] == 'RR - Renovacion'


def test_si_la_liquidacion_no_se_guardo_no_se_declara_la_renovacion(client, db, lead, equipo,
                                                                    auth_headers):
    payload = venta_del_arbol(liquidar_saldo={'monto': 750})
    payload['venta']['tipo_pago'] = 'RR - Renovacion'

    r, enviado = declarar(client, auth_headers, equipo['closer'], lead, payload,
                          respuesta={'status': 'error', 'message': 'sin base'})

    assert r.status_code == 400
    assert enviado.call_count == 1
    assert 'saldo pendiente' in r.get_json()['message']


# --- Venta directa --------------------------------------------------------------------------------

def test_la_venta_directa_no_se_ata_a_la_agenda_de_la_ficha(client, db, lead, equipo, auth_headers):
    """Una renovacion o una venta cerrada por WhatsApp no sale de la llamada de esta agenda:
    `post_to_sheets` elige la agenda de la venta por fecha, como `/closer/sales/new`, en vez de
    marcar 'Show up' la que tenga abierta la ficha. Y la Cuota que liquida el saldo, igual."""
    payload = venta_del_arbol(venta_directa=True, agenda={'with_decision_maker': None,
                                                          'offer_presented': None},
                              liquidar_saldo={'monto': 750})
    payload['venta']['tipo_pago'] = 'RR - Renovacion'

    r, enviado = declarar(client, auth_headers, equipo['closer'], lead, payload)

    assert r.status_code == 201, r.get_json()
    liquidacion, principal = [llamada[0][1] for llamada in enviado.call_args_list]
    assert principal['appointment_id'] is None
    assert liquidacion['appointment_id'] is None


def test_la_venta_de_la_llamada_sigue_atada_a_su_agenda(client, db, lead, equipo, auth_headers):
    payload = venta_del_arbol(liquidar_saldo={'monto': 750})
    payload['venta']['tipo_pago'] = 'RR - Renovacion'

    r, enviado = declarar(client, auth_headers, equipo['closer'], lead, payload)

    assert r.status_code == 201
    assert [llamada[0][1]['appointment_id'] for llamada in enviado.call_args_list] == [lead.id] * 2


# --- Quien puede --------------------------------------------------------------------------------

@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_setter_y_triage_no_declaran_la_venta(client, db, lead, equipo, auth_headers, rol):
    r, enviado = declarar(client, auth_headers, equipo[rol], lead, venta_del_arbol())

    assert r.status_code == 403
    enviado.assert_not_called()
