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
    Appointment, Client, ClientComment, Comment, FinancialSale, InstallmentPlan, LeadEventLog,
    Notification,
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
                     json={'confirmation_stage': 'videoask',
                           'confirmation_contact_status': 'confirmo_asiste',
                           'confirmation_pain_points': ['ansiedad'],
                           'closer_notes': 'llamar después de las 20'},
                     headers=auth_headers(equipo['director']))

    assert r.status_code == 200
    assert lead.confirmation_stage == 'videoask'
    assert lead.confirmation_pain_points == 'ansiedad'
    # La regla del mazo vale igual por esta puerta: el autoguardado no saca la cita del mazo.
    assert lead.closer_processed is False


def test_confirmar_no_puede_reportar_de_contrabando(client, db, lead, equipo, auth_headers):
    """Aceptar `result` acá seria reportar la llamada desde el paso de confirmacion."""
    r = client.patch(url(lead, '/confirmacion'),
                     json={'result': 'Show up', 'confirmation_stage': 'horario'},
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

def test_solo_la_direccion_elimina_una_agenda(client, db, lead, equipo, auth_headers):
    """Corregir un estado y borrar la fila no son la misma responsabilidad."""
    assert client.delete(url(lead), headers=auth_headers(equipo['closer'])).status_code == 403
    assert client.delete(url(lead), headers=auth_headers(equipo['setter'])).status_code == 403

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
