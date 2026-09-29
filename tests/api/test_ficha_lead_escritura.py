"""Las escrituras de `/api/ficha`: la direccion comercial puede confirmar y reportar.

Es el punto del ejercicio. Hoy `director_comercial` recibe 403 en todas las rutas de
`/api/closer/*`, asi que la unica forma de reportar una llamada es ser closer; la ficha unificada
tiene que servir a los dos roles desde la misma puerta, delegando en los mismos servicios (si
duplicara la logica, el mazo y la ficha dirian cosas distintas del mismo lead).

Cada test cubre una accion, mas el caso de permiso denegado: `permisos` no es decorado, cada ruta
lo comprueba de verdad.
"""
from datetime import date, datetime, timedelta
from unittest.mock import patch

import pytest

from app.models import (
    Appointment, Client, ClientComment, Comment, Enrollment, FinancialSale, InstallmentPlan,
    LeadEventLog, Notification, Payment, Program,
)


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
                       client_id=cliente.id, start_time=datetime.utcnow() + timedelta(days=1),
                       origin='vsl', examen='ENARM', result='conversando',
                       closer_result='Pendiente')
    db.session.add(appt)
    db.session.commit()
    return appt


def url(appt, sufijo=''):
    return f'/api/ficha/{appt.id}{sufijo}'


# --- Confirmacion -----------------------------------------------------------------------------

def test_la_direccion_comercial_guarda_la_etapa_de_confirmacion(client, db, lead, equipo,
                                                                auth_headers):
    r = client.patch(url(lead, '/confirmacion'),
                     json={'etapa': 'videoask', 'como_viene': 'confirmo_asiste',
                           'dolores': ['ansiedad'],
                           'nota': 'llamar después de las 20'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200
    assert lead.confirmation_stage == 'videoask'
    assert lead.confirmation_pain_points == 'ansiedad'
    # La regla del mazo vale igual por esta puerta: el autoguardado no saca la cita del mazo.
    assert lead.closer_processed is False


def test_lo_que_devuelve_la_lectura_se_puede_volver_a_escribir(client, db, lead, equipo,
                                                              auth_headers):
    """El GET y el PATCH tienen que hablar el mismo idioma.

    Este es el test que faltaba cuando el modal mandaba `etapa`/`como_viene`/`dolores` —los
    nombres que devuelve la lectura— y la escritura exigia los de la base: cada lado pasaba sus
    propios tests y en pantalla guardar una etapa respondia "No hay nada que guardar".
    """
    leido = client.get(f'/api/ficha/lead?appointment_id={lead.id}',
                       headers=auth_headers(equipo['closer'])).get_json()['confirmacion']

    # Se devuelve lo leido tal cual, sin traducir ni una clave.
    r = client.patch(url(lead, '/confirmacion'),
                     json={'etapa': leido['etapa'],
                           'como_viene': (leido['como_viene'] or {}).get('clave'),
                           'dolores': [d['clave'] for d in leido['dolores']],
                           'nota': leido['nota'] or 'sin nota'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 200


def test_confirmar_no_puede_reportar_de_contrabando(client, db, lead, equipo, auth_headers):
    """Aceptar `result` acá seria reportar la llamada desde el paso de confirmacion."""
    r = client.patch(url(lead, '/confirmacion'),
                     json={'result': 'Show up', 'etapa': 'horario'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 200
    assert lead.closer_result == 'Pendiente'


def test_un_payload_vacio_es_un_pedido_mal_hecho(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/confirmacion'), json={},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


def test_un_setter_ajeno_a_la_agenda_no_confirma(client, db, lead, equipo, auth_headers):
    lead.setter_id = None
    db.session.commit()

    r = client.patch(url(lead, '/confirmacion'), json={'confirmation_stage': 'horario'},
                     headers=auth_headers(equipo['setter']))

    assert r.status_code == 403
    assert r.get_json()['accion'] == 'confirmar'


def test_una_agenda_que_no_existe_da_404(client, db, equipo, auth_headers):
    r = client.patch('/api/ficha/999999/confirmacion', json={'confirmation_stage': 'horario'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 404


# --- Resultado de la llamada ------------------------------------------------------------------

def test_la_direccion_comercial_reporta_la_llamada(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/resultado'),
                    json={'resultado': 'asistio', 'con_decisor': True, 'oferta_presentada': True},
                    headers=auth_headers(equipo['director']))

    assert r.status_code == 200
    assert lead.closer_result == 'Show up'
    assert lead.closer_processed is True
    assert (lead.with_decision_maker, lead.offer_presented) == (True, True)
    assert 'show_up_reported' in [e.action_type for e in LeadEventLog.query.all()]


def test_reportar_un_no_show_deja_la_agenda_resuelta(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/resultado'), json={'resultado': 'no_show'},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 200
    assert lead.closer_result == 'No Show'


def test_un_resultado_inventado_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/resultado'), json={'resultado': 'se_fue_a_marte'},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert lead.closer_result == 'Pendiente'


def test_triage_no_reporta_llamadas(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/resultado'), json={'resultado': 'asistio'},
                    headers=auth_headers(equipo['triage']))

    assert r.status_code == 403
    assert lead.closer_result == 'Pendiente'


# --- Venta ------------------------------------------------------------------------------------

def test_la_venta_pasa_por_el_unico_camino_real(client, db, lead, equipo, auth_headers):
    """`SheetsService.post_to_sheets` es el unico que crea el Client, valida la secuencia, crea la
    FinancialSale, espeja Enrollment/Payment, marca Show up y dispara n8n. Un atajo propio crearia
    ventas a medias."""
    with patch('app.services.sheets_service.SheetsService.post_to_sheets',
               return_value={'status': 'ok', 'client_id': lead.client_id}) as enviado:
        r = client.post(url(lead, '/venta'),
                        json={'tipo_pago': 'RR - Parcial', 'monto': 400, 'precio_total': 1000,
                              'metodo_pago': 'Stripe'},
                        headers=auth_headers(equipo['director']))

    assert r.status_code == 201
    tabla, payload = enviado.call_args[0]
    assert tabla == 'Ventas_DB'
    # El vendedor es el closer DUENO de la agenda, no quien apreto el boton: la comision es suya.
    assert payload['email_vendedor'] == 'vendedor@neuro.com'
    assert payload['appointment_id'] == lead.id
    assert (payload['mail_cliente'], payload['telefono']) == ('ana@x.com', '59171234567')
    assert payload['instagram'] == 'ana.g'


def test_una_venta_sin_monto_ni_tipo_no_se_declara(client, db, lead, equipo, auth_headers):
    with patch('app.services.sheets_service.SheetsService.post_to_sheets') as enviado:
        r = client.post(url(lead, '/venta'), json={'tipo_pago': 'RR - Parcial'},
                        headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    enviado.assert_not_called()


def test_un_setter_no_declara_ventas(client, db, lead, equipo, auth_headers):
    with patch('app.services.sheets_service.SheetsService.post_to_sheets') as enviado:
        r = client.post(url(lead, '/venta'), json={'tipo_pago': 'RR - Parcial', 'monto': 400},
                        headers=auth_headers(equipo['setter']))

    assert r.status_code == 403
    enviado.assert_not_called()


# --- Reprogramar ------------------------------------------------------------------------------

def test_reprogramar_crea_la_agenda_nueva(client, db, lead, equipo, auth_headers):
    nueva_fecha = (datetime.utcnow() + timedelta(days=7)).isoformat()

    r = client.post(url(lead, '/reprogramar'),
                    json={'fecha': nueva_fecha, 'motivo': 'estaba de guardia'},
                    headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert Appointment.query.filter_by(is_rescheduled=True).count() == 1


def test_reprogramar_sin_fecha_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/reprogramar'), json={'motivo': 'sin fecha'},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


def test_una_segunda_llamada_se_marca_como_tal(client, db, lead, equipo, auth_headers):
    fecha = (datetime.utcnow() + timedelta(days=3)).isoformat()

    r = client.post(url(lead, '/reprogramar'), json={'fecha': fecha, 'segunda_llamada': True},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert Appointment.query.filter_by(result='2TH Call').count() == 1


# --- Descartar --------------------------------------------------------------------------------

def test_descartar_un_lead_que_no_calificaba_lo_marca_no_lead(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/descartar'), json={'motivo': 'no era lo que buscaba'},
                    headers=auth_headers(equipo['director']))

    assert r.status_code == 200
    assert lead.closer_result == 'No Lead'


def test_descartar_un_lead_que_si_calificaba_lo_marca_perdido(client, db, lead, equipo, auth_headers):
    """No Lead y Lead Perdido son dos cosas distintas para el embudo: la decision viaja, no se
    adivina."""
    r = client.post(url(lead, '/descartar'), json={'motivo': 'le parece caro', 'califico': True},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 200
    assert lead.closer_result == 'Lead Perdido'


def test_descartar_sin_motivo_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/descartar'), json={}, headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert lead.closer_result == 'Pendiente'


# --- Reasignar --------------------------------------------------------------------------------

def test_pasar_el_lead_a_otro_closer(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/closer'), json={'closer_id': equipo['relevo'].id},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200
    assert lead.closer_id == equipo['relevo'].id
    assert ClientComment.query.count() == 1


def test_no_se_reasigna_a_quien_ya_lo_tiene(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/closer'), json={'closer_id': equipo['closer'].id},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


def test_un_setter_no_reasigna(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/closer'), json={'closer_id': equipo['relevo'].id},
                     headers=auth_headers(equipo['setter']))

    assert r.status_code == 403
    assert lead.closer_id == equipo['closer'].id


# --- Seguimiento, plan de cuotas y baja -------------------------------------------------------

def test_registrar_un_seguimiento_guarda_canal_y_nota(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/seguimiento'),
                    json={'fecha': '2026-10-02', 'canal': 'WhatsApp', 'nota': 'recordarle la cuota'},
                    headers=auth_headers(equipo['director']))

    assert r.status_code == 200
    assert lead.fecha_seguimiento == '2026-10-02'
    assert lead.seguimiento_sub == 'WhatsApp · recordarle la cuota'
    assert lead.seguimiento_realizado is False


def test_un_seguimiento_sin_fecha_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/seguimiento'), json={'canal': 'WhatsApp'},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


def test_armar_el_plan_de_cuotas(client, db, lead, equipo, auth_headers):
    r = client.put(url(lead, '/plan-cuotas'),
                   json={'total': 1000, 'cobrado_hoy': 400, 'num_cuotas': 2, 'programa_code': 'RR'},
                   headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    cuotas = InstallmentPlan.query.filter_by(client_id=lead.client_id).all()
    assert [c.monto for c in cuotas] == [300.0, 300.0]


def test_un_plan_sin_cuotas_no_es_un_plan(client, db, lead, equipo, auth_headers):
    r = client.put(url(lead, '/plan-cuotas'), json={'total': 1000, 'num_cuotas': 0},
                   headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


def test_no_se_rehace_un_plan_con_pagos_ya_registrados(client, db, lead, equipo, auth_headers):
    """Rehacerlo perderia el rastro de lo cobrado: misma negativa que la ruta del closer."""
    db.session.add(InstallmentPlan(client_id=lead.client_id, appointment_id=lead.id,
                                   programa_code='RR', numero_cuota=1, monto=500.0,
                                   fecha_vencimiento=date(2026, 10, 1), estado='pagado'))
    db.session.commit()

    r = client.put(url(lead, '/plan-cuotas'),
                   json={'total': 1000, 'cobrado_hoy': 0, 'num_cuotas': 2, 'programa_code': 'RR'},
                   headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert 'pagos registrados' in r.get_json()['message']


# El editor de la ficha no manda `num_cuotas`: manda el cronograma entero, fila por fila, porque
# tiene que poder mover una fecha sola o marcar una cuota como cobrada. Es otra forma del mismo
# pedido y se reconcilia en vez de rehacerse.

def _cuota(fecha, monto, estado='pendiente', id=None):
    return {'id': id, 'monto': monto, 'fecha_vencimiento': fecha, 'estado': estado}


def test_el_cronograma_explicito_arma_el_plan(client, db, lead, equipo, auth_headers):
    r = client.put(url(lead, '/plan-cuotas'),
                   json={'programa_code': 'RR', 'total': 600,
                         'cuotas': [_cuota('2026-11-10', 250), _cuota('2026-12-10', 350)]},
                   headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    cuotas = (InstallmentPlan.query.filter_by(client_id=lead.client_id)
              .order_by(InstallmentPlan.numero_cuota).all())
    assert [(c.numero_cuota, c.monto, c.fecha_vencimiento) for c in cuotas] == [
        (1, 250.0, date(2026, 11, 10)), (2, 350.0, date(2026, 12, 10))]


def test_un_plan_con_una_cuota_cobrada_si_se_puede_corregir(client, db, lead, equipo, auth_headers):
    """Lo que `create_plan` bloquea es rehacerlo. Corregirlo sin perder el cobro es otra cosa."""
    pagada = InstallmentPlan(client_id=lead.client_id, appointment_id=lead.id, programa_code='RR',
                             numero_cuota=1, monto=300.0, fecha_vencimiento=date(2026, 10, 1),
                             estado='pagado', fecha_pago=datetime(2026, 10, 1))
    pendiente = InstallmentPlan(client_id=lead.client_id, appointment_id=lead.id, programa_code='RR',
                                numero_cuota=2, monto=300.0, fecha_vencimiento=date(2026, 11, 1))
    db.session.add_all([pagada, pendiente])
    db.session.commit()
    id_pagada, id_pendiente = pagada.id, pendiente.id

    r = client.put(url(lead, '/plan-cuotas'),
                   json={'programa_code': 'RR',
                         'cuotas': [_cuota('2026-10-01', 300, 'pagado', id_pagada),
                                    _cuota('2026-12-05', 400, 'pendiente', id_pendiente)]},
                   headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert InstallmentPlan.query.get(id_pagada).estado == 'pagado'
    corregida = InstallmentPlan.query.get(id_pendiente)
    assert (corregida.monto, corregida.fecha_vencimiento) == (400.0, date(2026, 12, 5))


def test_sacar_una_cuota_del_cronograma_no_borra_la_que_ya_se_cobro(client, db, lead, equipo,
                                                                    auth_headers):
    """Una pantalla que dice "editar el plan" no puede borrar la constancia de un pago."""
    pagada = InstallmentPlan(client_id=lead.client_id, appointment_id=lead.id, programa_code='RR',
                             numero_cuota=1, monto=300.0, fecha_vencimiento=date(2026, 10, 1),
                             estado='pagado')
    sobra = InstallmentPlan(client_id=lead.client_id, appointment_id=lead.id, programa_code='RR',
                            numero_cuota=2, monto=300.0, fecha_vencimiento=date(2026, 11, 1))
    db.session.add_all([pagada, sobra])
    db.session.commit()
    id_pagada, id_sobra = pagada.id, sobra.id

    r = client.put(url(lead, '/plan-cuotas'),
                   json={'programa_code': 'RR', 'cuotas': [_cuota('2026-12-01', 500)]},
                   headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert InstallmentPlan.query.get(id_pagada) is not None
    assert InstallmentPlan.query.get(id_sobra) is None


def test_una_cuota_vencida_se_guarda_como_pendiente(client, db, lead, equipo, auth_headers):
    """'vencido' lo deriva `to_dict()` de la fecha; guardarlo dejaria un estado que nadie busca."""
    r = client.put(url(lead, '/plan-cuotas'),
                   json={'programa_code': 'RR', 'cuotas': [_cuota('2020-01-10', 300, 'vencido')]},
                   headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    cuota = InstallmentPlan.query.filter_by(client_id=lead.client_id).one()
    assert (cuota.estado, cuota.fecha_pago) == ('pendiente', None)
    assert r.get_json()['cuotas'][0]['estado'] == 'vencido'


def test_una_cuota_sin_fecha_no_entra_al_cronograma(client, db, lead, equipo, auth_headers):
    r = client.put(url(lead, '/plan-cuotas'),
                   json={'programa_code': 'RR', 'cuotas': [_cuota(None, 300)]},
                   headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert 'fecha' in r.get_json()['message'].lower()
    assert InstallmentPlan.query.filter_by(client_id=lead.client_id).count() == 0


# El total a pagar (`Client.total_amount`) es de donde sale la deuda: `_client_debt` lo prefiere
# al precio de lista del programa. Corregirlo desde la ficha es corregir la cartera.

@pytest.fixture()
def inscripto(db, lead, equipo):
    """El lead ya comprado: $500 de total y $400 cobrados, o sea $100 de deuda.

    La deuda cuelga de `Enrollment`/`Payment`, no de la venta: sin inscripcion `_client_debt`
    devuelve 0 por mucho total que tenga el cliente.
    """
    programa = Program(name='Residency Roadmap', price=800.0)
    db.session.add(programa)
    lead.client.total_amount = 500.0
    db.session.commit()
    inscripcion = Enrollment(client_id=lead.client_id, program_id=programa.id,
                             closer_id=equipo['closer'].id, enrollment_date=date(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=400.0, date=date(2026, 8, 1),
                           payment_type='first_payment', status='completed'))
    db.session.commit()
    return lead.client


def test_corregir_el_total_a_pagar_recalcula_la_deuda(client, db, lead, inscripto, equipo,
                                                      auth_headers):
    """Es el punto de poder editarlo: el saldo que el closer ve sale de este numero."""
    r = client.patch(url(lead, '/total'), json={'total': 1200},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert inscripto.total_amount == 1200.0
    assert r.get_json()['deuda'] == 800.0   # 1200 negociados - 400 cobrados


def test_el_total_a_pagar_queda_en_la_bitacora(client, db, lead, equipo, auth_headers):
    """Un registro financiero no se cambia en silencio."""
    client.patch(url(lead, '/total'), json={'total': 900},
                 headers=auth_headers(equipo['closer']))

    evento = LeadEventLog.query.filter_by(appointment_id=lead.id,
                                          action_type='total_amount_edited').one()
    assert '900' in evento.description


def test_un_total_a_pagar_negativo_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/total'), json={'total': -1},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert lead.client.total_amount is None


def test_un_total_a_pagar_que_no_es_numero_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/total'), json={'total': 'mil'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


def test_el_setter_no_toca_el_total_a_pagar(client, db, lead, equipo, auth_headers):
    """`cobrar` es de la direccion y del closer: el setter ve la ficha pero no la cartera."""
    r = client.patch(url(lead, '/total'), json={'total': 900},
                     headers=auth_headers(equipo['setter']))

    assert r.status_code == 403
    assert lead.client.total_amount is None


# El registro de eventos es reescribible y borrable por decision explicita del usuario
# (29/09/2026): con esto deja de servir como auditoria. Lo que si se comprueba es que el evento
# sea de ESTE lead — sin eso, el id de la URL alcanzaria para borrar el registro de cualquier otro.

@pytest.fixture()
def evento(db, lead, equipo):
    from app.services.booking_service import BookingService
    BookingService.log_lead_event(lead.id, equipo['closer'].id, 'comment', 'texto original')
    return LeadEventLog.query.filter_by(appointment_id=lead.id).one()


def test_se_reescribe_el_texto_de_un_evento(client, db, lead, evento, equipo, auth_headers):
    r = client.patch(f'/api/ficha/{lead.id}/evento/{evento.id}',
                     json={'detalle': 'lo que de verdad pasó'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert evento.description == 'lo que de verdad pasó'


def test_un_evento_no_se_queda_sin_texto(client, db, lead, evento, equipo, auth_headers):
    r = client.patch(f'/api/ficha/{lead.id}/evento/{evento.id}', json={'detalle': '   '},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert evento.description == 'texto original'


def test_se_borra_un_evento_del_registro(client, db, lead, evento, equipo, auth_headers):
    evento_id = evento.id

    r = client.delete(f'/api/ficha/{lead.id}/evento/{evento_id}',
                      headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert db.session.get(LeadEventLog, evento_id) is None


def test_no_se_toca_el_evento_de_otro_lead(client, db, lead, equipo, auth_headers):
    """El id de la URL no puede alcanzar para editar el registro de cualquiera."""
    from app.services.booking_service import BookingService

    otro_cliente = Client(full_name='Otro', email='otro@x.com')
    db.session.add(otro_cliente)
    db.session.commit()
    ajena = Appointment(closer_id=equipo['closer'].id, client_id=otro_cliente.id,
                        start_time=datetime.utcnow())
    db.session.add(ajena)
    db.session.commit()
    BookingService.log_lead_event(ajena.id, equipo['closer'].id, 'comment', 'de otro lead')
    de_otro = LeadEventLog.query.filter_by(appointment_id=ajena.id).one()

    r = client.delete(f'/api/ficha/{lead.id}/evento/{de_otro.id}',
                      headers=auth_headers(equipo['director']))

    assert r.status_code == 400
    assert db.session.get(LeadEventLog, de_otro.id) is not None


def test_un_evento_que_no_existe_da_un_pedido_mal_hecho(client, db, lead, equipo, auth_headers):
    r = client.delete(f'/api/ficha/{lead.id}/evento/999999',
                      headers=auth_headers(equipo['director']))

    assert r.status_code == 400


def test_el_setter_no_borra_eventos(client, db, lead, evento, equipo, auth_headers):
    r = client.delete(f'/api/ficha/{lead.id}/evento/{evento.id}',
                      headers=auth_headers(equipo['setter']))

    assert r.status_code == 403
    assert db.session.get(LeadEventLog, evento.id) is not None


# El historial lista TODAS las agendas del cliente y desde ahi se corrige cualquiera: la de hace
# tres meses es justamente la que ninguna otra pantalla deja tocar.

def test_se_corrige_el_post_call_de_una_agenda_vieja_del_mismo_cliente(client, db, lead, equipo,
                                                                       auth_headers):
    vieja = Appointment(closer_id=equipo['closer'].id, client_id=lead.client_id,
                        start_time=datetime.utcnow() - timedelta(days=90),
                        closer_result='Pendiente')
    db.session.add(vieja)
    db.session.commit()

    r = client.patch(f'/api/ficha/{vieja.id}/estado',
                     json={'campo': 'post_call', 'valor': 'no_show'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert vieja.closer_result == 'No Show'
    # Darle un resultado es reportarla: si no, seguiria apareciendo como pendiente en el mazo.
    assert vieja.closer_processed is True
    assert lead.closer_result == 'Pendiente'   # la agenda abierta no se toca


def test_corregir_el_pre_call_escribe_el_result(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/estado'), json={'campo': 'pre_call', 'valor': 'confirmada'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert lead.result == 'Confirmado'


def test_un_estado_que_no_esta_en_el_vocabulario_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/estado'), json={'campo': 'post_call', 'valor': 'venta'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert lead.closer_result == 'Pendiente'


def test_la_correccion_del_estado_queda_en_la_bitacora(client, db, lead, equipo, auth_headers):
    client.patch(url(lead, '/estado'), json={'campo': 'post_call', 'valor': 'asistio'},
                 headers=auth_headers(equipo['director']))

    evento = LeadEventLog.query.filter_by(appointment_id=lead.id,
                                          action_type='status_changed').one()
    assert 'closer_result' in evento.description


def test_agendar_otra_llamada_con_el_mismo_cliente(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/agenda'), json={'fecha': '2026-12-15T16:00'},
                    headers=auth_headers(equipo['director']))

    assert r.status_code == 201, r.get_json()
    nueva = Appointment.query.filter(Appointment.client_id == lead.client_id,
                                     Appointment.id != lead.id).one()
    assert nueva.start_time == datetime(2026, 12, 15, 16, 0)
    # El closer por defecto es el del lead, no quien apretó el botón: la dirección agenda PARA él.
    assert nueva.closer_id == equipo['closer'].id


def test_no_se_agenda_dos_veces_al_mismo_closer_a_la_misma_hora(client, db, lead, equipo,
                                                                auth_headers):
    client.post(url(lead, '/agenda'), json={'fecha': '2026-12-15T16:00'},
                headers=auth_headers(equipo['closer']))

    r = client.post(url(lead, '/agenda'), json={'fecha': '2026-12-15T16:00'},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert 'misma hora' in r.get_json()['message']


def test_una_agenda_sin_fecha_no_se_crea(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/agenda'), json={},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


def test_el_setter_no_corrige_el_estado_de_una_agenda(client, db, lead, equipo, auth_headers):
    """Corregir el estado es reportar, y reportar es de la dirección y del closer."""
    r = client.patch(url(lead, '/estado'), json={'campo': 'post_call', 'valor': 'no_show'},
                     headers=auth_headers(equipo['setter']))

    assert r.status_code == 403


# El resto de la fila de una agenda —fecha y hora, fuente y closer— tambien se corrige desde el
# historial (pedido del 29/09/2026). `start_time` se guarda en UTC: lo que llega del navegador es
# la hora local convertida a un instante con zona.

def _agenda_vieja(db, lead, equipo, **campos):
    datos = {'closer_id': equipo['closer'].id, 'client_id': lead.client_id,
             'start_time': datetime.utcnow() - timedelta(days=30), 'closer_result': 'Pendiente',
             **campos}
    agenda = Appointment(**datos)
    db.session.add(agenda)
    db.session.commit()
    return agenda


def test_la_hora_local_de_la_agenda_se_guarda_en_utc(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/agenda'), json={'fecha': '2026-12-15T10:00:00-04:00'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert lead.start_time == datetime(2026, 12, 15, 14, 0)
    assert r.get_json()['cambios'] == ['fecha']


def test_la_fecha_que_manda_el_navegador_en_utc_se_guarda_tal_cual(client, db, lead, equipo,
                                                                  auth_headers):
    """`Date.toISOString()` manda la Z y los milisegundos."""
    r = client.patch(url(lead, '/agenda'), json={'fecha': '2026-12-15T14:30:00.000Z'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert lead.start_time == datetime(2026, 12, 15, 14, 30)


def test_una_fecha_sin_zona_no_se_adivina(client, db, lead, equipo, auth_headers):
    """Es lo que manda un `datetime-local` crudo: la hora local sin zona. Tomarla por UTC corre
    la llamada cuatro horas para el mazo y el contador."""
    antes = lead.start_time

    r = client.patch(url(lead, '/agenda'), json={'fecha': '2026-12-15T10:00'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 400
    assert 'zona horaria' in r.get_json()['message']
    assert lead.start_time == antes


@pytest.mark.parametrize('fecha', ['0202-12-15T10:00:00Z', 'mañana a las diez', ''])
def test_una_fecha_que_no_es_de_una_llamada_no_pasa(client, db, lead, equipo, auth_headers,
                                                    fecha):
    antes = lead.start_time

    r = client.patch(url(lead, '/agenda'), json={'fecha': fecha},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 400
    assert lead.start_time == antes


def test_mover_al_futuro_una_llamada_sin_resultado_la_devuelve_al_mazo(client, db, lead, equipo,
                                                                     auth_headers):
    """Con `closer_processed` prendido quedaria «Por confirmar» en la ficha pero fuera del mazo:
    el bug del 08/sep/2026 que el reagendado del mazo ya habia arreglado."""
    vieja = _agenda_vieja(db, lead, equipo, closer_processed=True)
    futuro = (datetime.utcnow() + timedelta(days=5)).replace(microsecond=0)

    r = client.patch(f'/api/ficha/{vieja.id}/agenda', json={'fecha': futuro.isoformat() + 'Z'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert vieja.start_time == futuro
    assert vieja.closer_processed is False


def test_corregir_la_fecha_de_una_llamada_con_resultado_no_la_des_reporta(client, db, lead,
                                                                        equipo, auth_headers):
    vieja = _agenda_vieja(db, lead, equipo, closer_result='No Show', closer_processed=True)

    r = client.patch(f'/api/ficha/{vieja.id}/agenda',
                     json={'fecha': (datetime.utcnow() - timedelta(days=29)).isoformat() + 'Z'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert (vieja.closer_result, vieja.closer_processed) == ('No Show', True)


def test_no_se_mueve_una_agenda_encima_de_otra_llamada_del_mismo_closer(client, db, lead, equipo,
                                                                       auth_headers):
    ocupada = datetime(2026, 12, 20, 15, 0)
    _agenda_vieja(db, lead, equipo, start_time=ocupada)
    antes = lead.start_time

    r = client.patch(url(lead, '/agenda'), json={'fecha': '2026-12-20T15:00:00Z'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 400
    assert 'misma hora' in r.get_json()['message']
    assert lead.start_time == antes


def test_la_fuente_sale_del_catalogo_y_le_atribuye_la_agenda_al_setter(client, db, lead, equipo,
                                                                      make_user, auth_headers):
    """Misma regla que la edicion masiva del Tablero: una fuente que es un setter es suya, y un
    embudo no es de ningun setter. El sync del tablero la recalcula igual cada vez que corre."""
    paula = make_user(role='setter', username='Paula', email='paula@neuro.com')

    r = client.patch(url(lead, '/agenda'), json={'fuente': 'Paula'},
                     headers=auth_headers(equipo['director']))
    assert r.status_code == 200, r.get_json()
    assert (lead.origin, lead.setter_id) == ('Paula', paula.id)

    r = client.patch(url(lead, '/agenda'), json={'fuente': 'workshop'},
                     headers=auth_headers(equipo['director']))
    assert r.status_code == 200, r.get_json()
    assert (lead.origin, lead.setter_id) == ('workshop', None)


def test_una_fuente_fuera_del_catalogo_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/agenda'), json={'fuente': 'Instagram orgánico'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 400
    assert 'catálogo' in r.get_json()['message']
    assert lead.origin == 'vsl'


def test_una_fuente_historica_se_conserva_si_no_se_toca(client, db, lead, equipo, auth_headers):
    """La fila puede quedarse con su fuente vieja; lo que no puede es recibir una nueva inventada."""
    vieja = _agenda_vieja(db, lead, equipo, origin='Entrevista Diagnóstica Gratuita',
                          setter_id=equipo['setter'].id)

    r = client.patch(f'/api/ficha/{vieja.id}/agenda',
                     json={'fuente': 'Entrevista Diagnóstica Gratuita',
                           'fecha': '2026-08-01T15:00:00Z'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['cambios'] == ['fecha']
    assert (vieja.origin, vieja.setter_id) == ('Entrevista Diagnóstica Gratuita',
                                               equipo['setter'].id)


def test_se_cambia_el_closer_de_una_agenda(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/agenda'), json={'closer_id': equipo['relevo'].id},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert lead.closer_id == equipo['relevo'].id


def test_la_agenda_de_un_closer_que_ya_no_esta_se_corrige_igual(client, db, lead, equipo,
                                                               make_user, auth_headers):
    """Su propio closer, inactivo, no puede hacerla rebotar: se valida solo un closer NUEVO."""
    ex = make_user(role='closer', username='ex_closer', email='ex@neuro.com')
    ex.is_active = False
    vieja = _agenda_vieja(db, lead, equipo, closer_id=ex.id)

    r = client.patch(f'/api/ficha/{vieja.id}/agenda',
                     json={'fecha': '2026-08-01T15:00:00Z', 'closer_id': ex.id},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert (vieja.start_time, vieja.closer_id) == (datetime(2026, 8, 1, 15, 0), ex.id)


def test_un_closer_que_no_existe_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/agenda'), json={'closer_id': equipo['setter'].id},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 400
    assert lead.closer_id == equipo['closer'].id


def test_cambiar_el_closer_pide_el_permiso_de_reasignar(client, db, lead, equipo, auth_headers):
    """Hoy lo tienen los mismos roles que corrigen la agenda; si se separan, esta ruta no puede ser
    la puerta de atras de la reasignacion."""
    from app.services.ficha_lead_service import permisos_de as reales

    def sin_reasignar(usuario, appt=None):
        return {**reales(usuario, appt), 'reasignar': False}

    with patch('app.api.ficha.escritura.permisos_de', side_effect=sin_reasignar):
        r = client.patch(url(lead, '/agenda'), json={'closer_id': equipo['relevo'].id},
                         headers=auth_headers(equipo['closer']))
        assert r.status_code == 403
        assert lead.closer_id == equipo['closer'].id

        r = client.patch(url(lead, '/agenda'), json={'fecha': '2026-12-15T14:00:00Z'},
                         headers=auth_headers(equipo['closer']))
        assert r.status_code == 200, r.get_json()


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_quien_no_reporta_no_corrige_una_agenda(client, db, lead, equipo, auth_headers, rol):
    antes = lead.start_time

    r = client.patch(url(lead, '/agenda'), json={'fecha': '2026-12-15T14:00:00Z'},
                     headers=auth_headers(equipo[rol]))

    assert r.status_code == 403
    assert lead.start_time == antes


def test_un_pedido_sin_nada_que_corregir_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/agenda'), json={'nota': 'nada de la agenda'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 400


def test_la_correccion_de_la_agenda_queda_en_la_bitacora(client, db, lead, equipo, auth_headers):
    client.patch(url(lead, '/agenda'),
                 json={'fecha': '2026-12-15T14:00:00Z', 'fuente': 'workshop',
                       'closer_id': equipo['relevo'].id},
                 headers=auth_headers(equipo['director']))

    evento = LeadEventLog.query.filter_by(appointment_id=lead.id,
                                          action_type='agenda_corregida').one()
    # La hora va en la zona de quien corrigio (La Paz por defecto): 14:00 UTC son las 10:00.
    assert '15/12/2026 10:00' in evento.description
    assert 'fuente vsl → workshop' in evento.description
    assert 'closer vendedor → relevo' in evento.description


def test_mover_la_agenda_mueve_su_fila_del_tablero(client, db, lead, equipo, auth_headers):
    """El sync del Tablero hacia las citas busca la cita a ±12 h de la fecha de la fila y le pisa
    hora y fuente. Si la fila se quedara con la fecha vieja, la proxima sincronizacion crearia
    una SEGUNDA cita a la hora vieja."""
    from app.models import FinancialAgenda
    from app.services.booking_service import BookingService

    espejo = FinancialAgenda(nombre='vsl', lead='Ana Gomez', closer='vendedor', mail='ana@x.com',
                             instagram='ana.g', whatsapp='+59171234567', estado='Pendiente',
                             date=lead.start_time, fecha_meet=lead.start_time.isoformat())
    db.session.add(espejo)
    db.session.commit()
    nueva = (lead.start_time + timedelta(days=3)).replace(microsecond=0)

    r = client.patch(url(lead, '/agenda'), json={'fecha': nueva.isoformat() + 'Z',
                                                 'fuente': 'workshop'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert (espejo.date, espejo.nombre) == (nueva, 'workshop')

    BookingService.sync_financial_agenda_to_appointment(espejo)
    assert Appointment.query.filter_by(client_id=lead.client_id).count() == 1
    assert (lead.start_time, lead.origin) == (nueva, 'workshop')


# --- Seguimientos del historial ---------------------------------------------------------------
#
# Pedido del 29/09/2026: los seguimientos se crean y se les cambia el estado desde el historial.
# Un seguimiento vive en columnas de su agenda (uno por agenda), y la ruta apunta a ESA agenda.

def seguimiento(appt):
    return f'/api/ficha/{appt.id}/seguimiento'


def test_se_agenda_un_seguimiento_sobre_una_agenda_vieja_del_mismo_cliente(client, db, lead,
                                                                         equipo, auth_headers):
    vieja = _agenda_vieja(db, lead, equipo, closer_result='Show up', closer_processed=True)

    r = client.put(seguimiento(vieja),
                   json={'fecha': '2026-10-06', 'tipo': 'tomada', 'nota': '  Lo habla con la esposa '},
                   headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert (vieja.fecha_seguimiento, vieja.seguimiento_tipo, vieja.seguimiento_sub) == \
        ('2026-10-06', 'tomada', 'Lo habla con la esposa')
    assert (vieja.seguimiento_realizado, vieja.seguimiento_intento) == (False, 1)
    assert r.get_json()['reemplazado'] is False
    # La agenda que abrió la ficha no se tocó.
    assert lead.fecha_seguimiento is None


def test_el_seguimiento_agendado_le_aparece_al_closer_en_su_pestana(client, db, lead, equipo,
                                                                   auth_headers):
    """Lo que importa de agendarlo: que el closer dueño de la agenda lo vea ese día, en el grupo
    del tipo elegido, con la nota que se escribió."""
    from app.services.closer_followup_service import CloserFollowUpService

    vieja = _agenda_vieja(db, lead, equipo, closer_result='No Show', closer_processed=True)
    client.put(seguimiento(vieja), json={'fecha': '2026-10-06', 'tipo': 'cerrada',
                                         'nota': 'Cobrar la segunda cuota'},
               headers=auth_headers(equipo['director']))

    del_dia = CloserFollowUpService.get_today_grouped(equipo['closer'].id, '2026-10-06')

    assert [(s['id'], s['seguimiento_sub']) for s in del_dia['cerrada']] == \
        [(vieja.id, 'Cobrar la segunda cuota')]
    assert del_dia['no_tomada'] == [] and del_dia['tomada'] == []
    # El día anterior todavía no le toca.
    assert CloserFollowUpService.get_today_grouped(equipo['closer'].id, '2026-10-05')['cerrada'] == []


def test_agendar_un_seguimiento_no_saca_la_llamada_del_mazo_ni_inventa_un_contacto(
        client, db, lead, equipo, auth_headers):
    """El guardado del mazo marca la agenda como procesada con cualquier campo de seguimiento;
    por aca no se pasa por ahi: la llamada de mañana seguiria sin ocurrir, fuera del mazo."""
    r = client.put(seguimiento(lead), json={'fecha': '2026-10-06', 'tipo': 'no_tomada'},
                   headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert lead.closer_processed is False
    assert (lead.closer_result, lead.result) == ('Pendiente', 'conversando')
    # «Seguimientos hechos hoy» y la meta diaria salen de un contacto real, no de esto.
    assert (lead.last_contact_outcome, lead.last_contact_at) == (None, None)


def test_agendar_sobre_una_agenda_con_seguimiento_lo_reemplaza_y_queda_en_la_bitacora(
        client, db, lead, equipo, auth_headers):
    vieja = _agenda_vieja(db, lead, equipo, closer_result='No Show', closer_processed=True,
                          fecha_seguimiento='2026-09-20', seguimiento_tipo='no_tomada',
                          seguimiento_sub='No show: no contestó', seguimiento_intento=3,
                          followup_reminder_enabled=True, followup_reminder_time='10:00')

    r = client.put(seguimiento(vieja), json={'fecha': '2026-10-06', 'tipo': 'tomada'},
                   headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['reemplazado'] is True
    # Es un seguimiento nuevo: la cadencia arranca del primer contacto, sin nota heredada.
    assert (vieja.seguimiento_intento, vieja.seguimiento_sub) == (1, None)
    # El aviso por WhatsApp se pide por seguimiento: el del anterior no se hereda.
    assert vieja.followup_reminder_enabled is False
    evento = LeadEventLog.query.filter_by(appointment_id=vieja.id,
                                          action_type='seguimiento_agendado').one()
    assert 'direccion agendó un seguimiento' in evento.description
    assert '2026-10-06 · pendiente · Llamadas tomadas' in evento.description
    assert 'reemplaza al que tenía la agenda (2026-09-20 · pendiente · Llamadas no tomadas · ' \
           '«No show: no contestó»)' in evento.description


@pytest.mark.parametrize('datos', [
    {},
    {'fecha': '2026-10-06'},                                   # sin tipo
    {'fecha': '2026-10-06', 'tipo': 'urgente'},                # tipo que no existe
    {'fecha': '2026-10-06T10:00', 'tipo': 'tomada'},           # un instante, no un día
    {'fecha': 'la semana que viene', 'tipo': 'tomada'},
    {'fecha': '0202-10-06', 'tipo': 'tomada'},                 # año mal tipeado
    {'fecha': '2026-02-30', 'tipo': 'tomada'},
    {'fecha': '2026-10-06', 'tipo': 'tomada', 'nota': 'x' * 256},
    {'fecha': '2026-10-06', 'tipo': 'tomada', 'nota': ['una', 'lista']},
])
def test_un_seguimiento_mal_pedido_no_se_agenda(client, db, lead, equipo, auth_headers, datos):
    r = client.put(seguimiento(lead), json=datos, headers=auth_headers(equipo['director']))

    assert r.status_code == 400
    assert r.get_json()['message']
    assert (lead.fecha_seguimiento, lead.seguimiento_tipo) == (None, None)


@pytest.mark.parametrize('metodo', ['put', 'patch'])
def test_un_tipo_que_no_es_texto_se_rechaza_con_un_motivo_en_castellano(client, db, lead, equipo,
                                                                        auth_headers, metodo):
    """Una lista en el `in` del diccionario es un TypeError: sin la guarda, la ruta devolvía
    «unhashable type: 'list'» como motivo."""
    lead.seguimiento_tipo = 'tomada'
    db.session.commit()

    r = getattr(client, metodo)(seguimiento(lead), json={'fecha': '2026-10-06', 'tipo': ['tomada']},
                                headers=auth_headers(equipo['director']))

    assert r.status_code == 400
    assert r.get_json()['message'] == 'Elegí el tipo de seguimiento de la lista.'


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_quien_no_reporta_no_agenda_seguimientos(client, db, lead, equipo, auth_headers, rol):
    r = client.put(seguimiento(lead), json={'fecha': '2026-10-06', 'tipo': 'tomada'},
                   headers=auth_headers(equipo[rol]))

    assert r.status_code == 403
    assert r.get_json()['accion'] == 'reportar'
    assert lead.fecha_seguimiento is None


def _con_seguimiento(db, lead, equipo, **campos):
    """Una agenda vieja con un seguimiento pendiente para el 6 de octubre."""
    datos = {'closer_result': 'Show up', 'closer_processed': True,
             'fecha_seguimiento': '2026-10-06', 'seguimiento_tipo': 'tomada',
             'seguimiento_sub': 'Lo habla con la esposa', 'seguimiento_intento': 2,
             'seguimiento_realizado': False, **campos}
    return _agenda_vieja(db, lead, equipo, **datos)


def test_marcar_realizado_un_seguimiento_lo_saca_de_la_pestana_del_closer(client, db, lead, equipo,
                                                                         auth_headers):
    from app.services.closer_followup_service import CloserFollowUpService

    vieja = _con_seguimiento(db, lead, equipo)

    r = client.patch(seguimiento(vieja), json={'realizado': True},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['cambios'] == ['realizado']
    assert vieja.seguimiento_realizado is True
    # La fecha se conserva: reabrirlo por un error de dedo no pierde el dato.
    assert vieja.fecha_seguimiento == '2026-10-06'
    assert CloserFollowUpService.get_today_grouped(equipo['closer'].id, '2026-10-06')['tomada'] == []
    evento = LeadEventLog.query.filter_by(appointment_id=vieja.id,
                                          action_type='seguimiento_corregido').one()
    assert evento.description == ('vendedor corrigió el seguimiento desde el historial de la '
                                  'ficha: estado pendiente → realizado.')


def test_reabrir_un_seguimiento_lo_devuelve_a_la_pestana_del_closer(client, db, lead, equipo,
                                                                   auth_headers):
    from app.services.closer_followup_service import CloserFollowUpService

    vieja = _con_seguimiento(db, lead, equipo, seguimiento_realizado=True)

    r = client.patch(seguimiento(vieja), json={'realizado': False},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    del_dia = CloserFollowUpService.get_today_grouped(equipo['closer'].id, '2026-10-06')
    assert [s['id'] for s in del_dia['tomada']] == [vieja.id]


def test_se_corrigen_el_dia_el_tipo_y_la_nota_en_un_solo_pedido(client, db, lead, equipo,
                                                                auth_headers):
    vieja = _con_seguimiento(db, lead, equipo, followup_reminder_enabled=True,
                             followup_reminder_time='10:00',
                             followup_reminder_sent_at=datetime(2026, 10, 1, 10, 5))

    r = client.patch(seguimiento(vieja),
                     json={'fecha': '2026-10-09', 'tipo': 'cerrada', 'nota': 'Cobrar la cuota'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['cambios'] == ['fecha', 'tipo', 'nota']
    assert (vieja.fecha_seguimiento, vieja.seguimiento_tipo, vieja.seguimiento_sub) == \
        ('2026-10-09', 'cerrada', 'Cobrar la cuota')
    # El aviso que el closer había pedido sigue pedido, y vuelve a salir el día nuevo.
    assert (vieja.followup_reminder_enabled, vieja.followup_reminder_sent_at) == (True, None)
    evento = LeadEventLog.query.filter_by(appointment_id=vieja.id,
                                          action_type='seguimiento_corregido').one()
    assert 'fecha 2026-10-06 → 2026-10-09' in evento.description
    assert 'tipo Llamadas tomadas → Llamadas cerradas' in evento.description
    assert 'nota «Lo habla con la esposa» → «Cobrar la cuota»' in evento.description


def test_corregir_un_seguimiento_no_toca_el_mazo_ni_la_cadencia(client, db, lead, equipo,
                                                               auth_headers):
    lead.fecha_seguimiento, lead.seguimiento_tipo = '2026-10-06', 'no_tomada'
    db.session.commit()

    r = client.patch(seguimiento(lead), json={'realizado': True, 'nota': ''},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert lead.closer_processed is False
    assert lead.seguimiento_intento == 1
    assert (lead.last_contact_outcome, lead.last_contact_at) == (None, None)


def test_una_nota_vacia_borra_la_nota(client, db, lead, equipo, auth_headers):
    vieja = _con_seguimiento(db, lead, equipo)

    r = client.patch(seguimiento(vieja), json={'nota': '   '},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert vieja.seguimiento_sub is None


def test_una_agenda_sin_seguimiento_no_tiene_nada_que_corregir(client, db, lead, equipo,
                                                              auth_headers):
    r = client.patch(seguimiento(lead), json={'realizado': True},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 400
    assert 'no tiene ningún seguimiento' in r.get_json()['message']
    assert lead.seguimiento_realizado is False


@pytest.mark.parametrize('datos', [
    {},
    {'intento': 4},                                  # no se corrige desde acá
    {'realizado': 'si'},
    {'fecha': ''},
    {'fecha': '2026-13-01'},
    {'tipo': 'urgente'},
    {'nota': 'x' * 256},
    # Uno bueno y uno malo: no se escribe ninguno.
    {'realizado': True, 'tipo': 'urgente'},
])
def test_una_correccion_mal_pedida_no_escribe_nada(client, db, lead, equipo, auth_headers, datos):
    vieja = _con_seguimiento(db, lead, equipo)

    r = client.patch(seguimiento(vieja), json=datos, headers=auth_headers(equipo['director']))

    assert r.status_code == 400
    assert r.get_json()['message']
    assert (vieja.seguimiento_realizado, vieja.fecha_seguimiento, vieja.seguimiento_tipo,
            vieja.seguimiento_intento) == (False, '2026-10-06', 'tomada', 2)
    assert LeadEventLog.query.filter_by(action_type='seguimiento_corregido').count() == 0


def test_un_pedido_que_no_cambia_nada_no_deja_rastro(client, db, lead, equipo, auth_headers):
    vieja = _con_seguimiento(db, lead, equipo)

    r = client.patch(seguimiento(vieja),
                     json={'realizado': False, 'fecha': '2026-10-06', 'tipo': 'tomada',
                           'nota': 'Lo habla con la esposa'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['cambios'] == []
    assert LeadEventLog.query.filter_by(action_type='seguimiento_corregido').count() == 0


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_quien_no_reporta_no_corrige_seguimientos(client, db, lead, equipo, auth_headers, rol):
    vieja = _con_seguimiento(db, lead, equipo)

    r = client.patch(seguimiento(vieja), json={'realizado': True},
                     headers=auth_headers(equipo[rol]))

    assert r.status_code == 403
    assert vieja.seguimiento_realizado is False


# El programa de un cliente vive en el prefijo de `tipo_pago`. Asignarlo es reetiquetar sus
# ventas, porque es de ahi que lo leen el libro comercial, el plan de cuotas y la comision.

def _venta(lead, tipo_pago, monto=400.0, cuando=datetime(2026, 8, 1)):
    return FinancialSale(client_id=lead.client_id, mail_cliente='ana@x.com',
                         nombre_cliente='Ana Gomez', tipo_pago=tipo_pago, monto=monto,
                         metodo_pago='Stripe', estado='Completada', date=cuando,
                         email_vendedor='vendedor@neuro.com')


def test_asignar_el_programa_reetiqueta_las_ventas_sin_prefijo(client, db, lead, equipo,
                                                               auth_headers):
    """El caso de los datos historicos: 'Parcial' a secas es lo que se lee como "Sin programa"."""
    venta = _venta(lead, 'Parcial')
    db.session.add(venta)
    db.session.commit()

    r = client.patch(url(lead, '/programa'), json={'programa_code': 'RR'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert venta.tipo_pago == 'RR - Parcial'
    assert r.get_json()['programa_nombre'] == 'Residency Roadmap'


def test_el_prefijo_vacio_de_los_datos_viejos_se_reemplaza(client, db, lead, equipo, auth_headers):
    venta = _venta(lead, 'Desconocido - Seña')
    db.session.add(venta)
    db.session.commit()

    r = client.patch(url(lead, '/programa'), json={'programa_code': 'AL'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200, r.get_json()
    assert venta.tipo_pago == 'AL - Seña'


def test_corregir_el_programa_se_lleva_el_plan_de_cuotas(client, db, lead, equipo, auth_headers):
    """El plan cuelga del par (cliente, programa): dejarlo atras lo vuelve invisible."""
    db.session.add(_venta(lead, 'RR - Parcial'))
    cuota = InstallmentPlan(client_id=lead.client_id, appointment_id=lead.id, programa_code='RR',
                            numero_cuota=1, monto=600.0, fecha_vencimiento=date(2026, 11, 1))
    db.session.add(cuota)
    db.session.commit()

    r = client.patch(url(lead, '/programa'), json={'programa_code': 'SI'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    db.session.refresh(cuota)
    assert cuota.programa_code == 'SI'


def test_un_cliente_con_dos_programas_no_lo_decide_un_desplegable(client, db, lead, equipo,
                                                                  auth_headers):
    """Pisar el otro programa seria borrar una compra: eso se corrige venta por venta."""
    db.session.add_all([_venta(lead, 'RR - Parcial'),
                        _venta(lead, 'AL - Completo', cuando=datetime(2026, 9, 1))])
    db.session.commit()

    r = client.patch(url(lead, '/programa'), json={'programa_code': 'SI'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert 'más de un programa' in r.get_json()['message']


def test_un_cliente_sin_ventas_no_tiene_programa_que_asignar(client, db, lead, equipo,
                                                             auth_headers):
    r = client.patch(url(lead, '/programa'), json={'programa_code': 'RR'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert 'venta' in r.get_json()['message']


def test_un_programa_que_no_existe_no_pasa(client, db, lead, equipo, auth_headers):
    db.session.add(_venta(lead, 'Parcial'))
    db.session.commit()

    r = client.patch(url(lead, '/programa'), json={'programa_code': 'ZZ'},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


def test_el_setter_no_asigna_el_programa(client, db, lead, equipo, auth_headers):
    r = client.patch(url(lead, '/programa'), json={'programa_code': 'RR'},
                     headers=auth_headers(equipo['setter']))

    assert r.status_code == 403


def test_dar_de_baja_no_falsea_el_resultado_de_la_llamada(client, db, lead, equipo, auth_headers):
    """La llamada ocurrio y fue una venta: reescribirla como Lead Perdido falsearia el embudo."""
    lead.closer_result = 'Show up'
    db.session.commit()

    r = client.post(url(lead, '/baja'), json={'motivo': 'perdió ingresos'},
                    headers=auth_headers(equipo['director']))

    assert r.status_code == 200
    assert lead.closer_result == 'Show up'
    assert lead.seguimiento_sub == 'Baja: perdió ingresos'
    assert ClientComment.query.count() == 1


def test_una_baja_sin_motivo_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/baja'), json={}, headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


def test_un_setter_no_cobra(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/baja'), json={'motivo': 'x'}, headers=auth_headers(equipo['setter']))

    assert r.status_code == 403


# --- Nota del equipo --------------------------------------------------------------------------

def test_cualquiera_de_los_cinco_roles_puede_comentar(client, db, lead, equipo, auth_headers):
    for rol in ('director', 'closer', 'setter', 'triage'):
        r = client.post(url(lead, '/nota'), json={'texto': f'nota de {rol}'},
                        headers=auth_headers(equipo[rol]))
        assert r.status_code == 201, rol

    assert Comment.query.filter_by(comment_type='appointment').count() == 4


def test_la_nota_avisa_al_setter_del_lead_y_queda_en_la_bitacora(client, db, lead, equipo,
                                                                auth_headers):
    client.post(url(lead, '/nota'), json={'texto': 'el lead pidió hablar con la esposa'},
                headers=auth_headers(equipo['director']))

    aviso = Notification.query.one()
    assert aviso.target_users == [equipo['setter'].id]
    assert aviso.associated_type == 'deck_comment'
    assert [e.action_type for e in LeadEventLog.query.all()] == ['comment']


def test_un_lead_de_manychat_avisa_al_rol_setter_entero(client, db, lead, equipo, auth_headers):
    lead.origin = 'ManyChat'
    db.session.commit()

    client.post(url(lead, '/nota'), json={'texto': 'hola'}, headers=auth_headers(equipo['closer']))

    assert Notification.query.one().target_users == 'role:setter'


def test_una_nota_vacia_no_pasa(client, db, lead, equipo, auth_headers):
    r = client.post(url(lead, '/nota'), json={'texto': '   '}, headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert Comment.query.count() == 0


# --- Eliminar ---------------------------------------------------------------------------------

def test_cancelar_no_es_lo_mismo_que_descartar(client, db, lead, equipo, auth_headers):
    """Cancelar dice que ESTA cita no se hace; descartar saca al lead del embudo.

    Si cancelar marcara `No Lead`, un lead que solo se corrio de fecha quedaria contado como
    perdido y el embudo mentiria.
    """
    r = client.post(url(lead, '/cancelar'),
                    json={'motivo': 'Sin tiempo o imprevisto', 'fecha_seguimiento': '2026-10-10'},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 200
    assert lead.closer_result == 'Cancelado'
    assert lead.closer_result not in ('No Lead', 'Lead Perdido')
    assert lead.fecha_seguimiento == '2026-10-10'


def test_cancelar_sin_motivo_no_pasa(client, db, lead, equipo, auth_headers):
    """«Cancelo» sin motivo es el dato que despues no le sirve a nadie."""
    r = client.post(url(lead, '/cancelar'), json={}, headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert lead.closer_result == 'Pendiente'


def test_una_agenda_la_borra_su_closer_o_la_direccion(client, db, lead, equipo, auth_headers):
    """Corregir un estado y borrar la fila no son la misma responsabilidad: el setter que la
    genero corrige su pre call pero no la borra, y un closer solo borra la suya. El dueño si,
    porque es lo que `DELETE /closer/deck/<id>` ya le permite desde el mazo."""
    assert client.delete(url(lead), headers=auth_headers(equipo['setter'])).status_code == 403
    assert client.delete(url(lead), headers=auth_headers(equipo['relevo'])).status_code == 403
    assert Appointment.query.count() == 1

    r = client.delete(url(lead), headers=auth_headers(equipo['closer']))

    assert r.status_code == 200
    assert Appointment.query.count() == 0


def test_la_direccion_borra_una_agenda_que_no_es_suya(client, db, lead, equipo, auth_headers):
    r = client.delete(url(lead), headers=auth_headers(equipo['director']))

    assert r.status_code == 200
    assert Appointment.query.count() == 0


# --- Opciones nuevas de vocabulario -----------------------------------------------------------

def test_una_opcion_creada_desde_la_ui_vuelve_en_la_lectura_siguiente(client, db, lead, equipo,
                                                                     auth_headers):
    r = client.post('/api/ficha/vocabulario/como_viene/opciones',
                    json={'label': 'Viajó al exterior'}, headers=auth_headers(equipo['closer']))
    assert r.status_code == 201
    assert r.get_json() == {'clave': 'viajo_al_exterior', 'label': 'Viajó al exterior'}

    ficha = client.get(f'/api/ficha/lead?appointment_id={lead.id}',
                       headers=auth_headers(equipo['director'])).get_json()

    otros = ficha['vocabulario']['como_viene'][-1]
    assert otros['titulo'] == 'Otros'
    assert otros['opciones'] == [{'clave': 'viajo_al_exterior', 'label': 'Viajó al exterior'}]


def test_un_grupo_cerrado_no_acepta_opciones_nuevas(client, db, equipo, auth_headers):
    r = client.post('/api/ficha/vocabulario/etapas_confirmacion/opciones',
                    json={'label': 'Etapa inventada'}, headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


def test_una_opcion_sin_nombre_no_pasa(client, db, equipo, auth_headers):
    r = client.post('/api/ficha/vocabulario/dolores/opciones', json={'label': '  '},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 400


# --- Ninguna ruta de escritura queda abierta --------------------------------------------------

def test_ninguna_escritura_responde_a_un_anonimo(client, db, lead):
    llamadas = [
        client.patch(url(lead, '/confirmacion'), json={'confirmation_stage': 'horario'}),
        client.post(url(lead, '/resultado'), json={'resultado': 'asistio'}),
        client.post(url(lead, '/venta'), json={'tipo_pago': 'RR - Parcial', 'monto': 1}),
        client.post(url(lead, '/reprogramar'), json={'fecha': '2026-10-01'}),
        client.post(url(lead, '/descartar'), json={'motivo': 'x'}),
        client.patch(url(lead, '/closer'), json={'closer_id': 1}),
        client.post(url(lead, '/seguimiento'), json={'fecha': '2026-10-01'}),
        client.put(url(lead, '/seguimiento'), json={'fecha': '2026-10-01', 'tipo': 'tomada'}),
        client.patch(url(lead, '/seguimiento'), json={'realizado': True}),
        client.put(url(lead, '/plan-cuotas'), json={'total': 1, 'num_cuotas': 1}),
        client.post(url(lead, '/baja'), json={'motivo': 'x'}),
        client.post(url(lead, '/nota'), json={'texto': 'x'}),
        client.delete(url(lead)),
        client.post('/api/ficha/vocabulario/dolores/opciones', json={'label': 'x'}),
    ]

    assert [r.status_code for r in llamadas] == [401] * len(llamadas) or \
        all(r.status_code in (401, 403) for r in llamadas)
    assert Appointment.query.count() == 1
    assert FinancialSale.query.count() == 0


# --- Anadidos que pidio la pestana Resultado --------------------------------------------------

def test_liquidar_el_saldo_se_cobra_antes_que_la_venta_nueva(client, db, lead, equipo, auth_headers):
    """Al reves, la renovacion quedaria registrada con el saldo viejo sin cobrar y la validacion de
    secuencia leeria un historial que no cierra."""
    with patch('app.services.sheets_service.SheetsService.post_to_sheets',
               return_value={'status': 'ok', 'client_id': 7}) as enviado:
        r = client.post(url(lead, '/venta'),
                        json={'tipo_pago': 'RR - Renovacion', 'monto': 900,
                              'metodo_pago': 'Stripe',
                              'liquidar_saldo': {'monto': 200}},
                        headers=auth_headers(equipo['closer']))

    assert r.status_code == 201
    primera, segunda = [llamada[0][1] for llamada in enviado.call_args_list]
    assert primera['tipo_pago'] == 'RR - Cuota' and primera['monto'] == 200
    assert segunda['tipo_pago'] == 'RR - Renovacion'


def test_si_la_liquidacion_del_saldo_falla_no_se_declara_la_venta(client, db, lead, equipo,
                                                                 auth_headers):
    with patch('app.services.sheets_service.SheetsService.post_to_sheets',
               side_effect=Exception('Sheets no responde')) as enviado:
        r = client.post(url(lead, '/venta'),
                        json={'tipo_pago': 'RR - Renovacion', 'monto': 900,
                              'liquidar_saldo': {'monto': 200}},
                        headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert enviado.call_count == 1


def test_una_liquidacion_sin_monto_no_pasa(client, db, lead, equipo, auth_headers):
    with patch('app.services.sheets_service.SheetsService.post_to_sheets') as enviado:
        r = client.post(url(lead, '/venta'),
                        json={'tipo_pago': 'RR - Renovacion', 'monto': 900,
                              'liquidar_saldo': {'metodo_pago': 'Stripe'}},
                        headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    enviado.assert_not_called()


def test_la_venta_devuelve_el_aviso_de_la_validacion_de_secuencia(client, db, lead, equipo,
                                                                 auth_headers):
    """El `warning` lo ve el closer en pantalla: comerselo seria esconderle que la venta quedo con
    una secuencia rara."""
    with patch('app.services.sheets_service.SheetsService.post_to_sheets',
               return_value={'status': 'ok', 'warning': 'No se encontro el Parcial anterior',
                             'client_id': 42}):
        r = client.post(url(lead, '/venta'), json={'tipo_pago': 'RR - Cuota', 'monto': 300},
                        headers=auth_headers(equipo['closer']))

    cuerpo = r.get_json()
    assert cuerpo['warning'] == 'No se encontro el Parcial anterior'
    assert (cuerpo['status'], cuerpo['client_id']) == ('ok', 42)


def test_las_instrucciones_del_payload_no_viajan_a_sheets(client, db, lead, equipo, auth_headers):
    """`liquidar_saldo` y `respuestas` son para esta capa: mandarlas a Sheets ensuciaria la fila."""
    with patch('app.services.sheets_service.SheetsService.post_to_sheets',
               return_value={'status': 'ok'}) as enviado:
        client.post(url(lead, '/venta'),
                    json={'tipo_pago': 'RR - Completo', 'monto': 900,
                          'respuestas': {'objeciones': 'precio'}},
                    headers=auth_headers(equipo['closer']))

    payload = enviado.call_args[0][1]
    assert 'respuestas' not in payload and 'liquidar_saldo' not in payload


def test_las_respuestas_crudas_del_arbol_quedan_en_la_bitacora(client, db, lead, equipo,
                                                              auth_headers):
    """El arbol recoge mas datos de los que tienen columna: simplificar es dejar de mostrar, no de
    guardar."""
    r = client.post(url(lead, '/resultado'),
                    json={'resultado': 'no_show', 'respuestas': {'motivo': 'no contesto',
                                                                 'angulo': 'urgencia'}},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 200
    guardado = LeadEventLog.query.filter_by(action_type='reporte_arbol').one()
    assert 'no contesto' in guardado.description and 'urgencia' in guardado.description


def test_un_bloque_de_respuestas_desconocido_no_hace_fallar_el_reporte(client, db, lead, equipo,
                                                                      auth_headers):
    r = client.post(url(lead, '/resultado'),
                    json={'resultado': 'asistio', 'respuestas': ['lo', 'que', 'sea'],
                          'campo_que_no_existe': 1},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 200
    assert lead.closer_result == 'Show up'
