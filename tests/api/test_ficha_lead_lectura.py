"""`GET /api/ficha/lead` — la lectura unica del lead, para los cinco roles que lo trabajan.

El bug que arregla: hoy la direccion comercial recibe 403 en todo `/api/closer/*`, asi que el modal
del closer y el de la direccion son dos pantallas distintas del mismo lead y ninguna muestra el
recorrido completo. Esta ruta es la superficie compartida.

Lo que estos tests cuidan: que el mismo lead lo abran el closer, la direccion, el setter y triage;
que fuera de alcance sea 404 y no 403 (un 403 confirmaria que el recurso existe); que `permisos`
cambie por rol; y que `estado.pestana_por_defecto` salga bien en los escenarios de la tabla del
contrato, que es lo que decide en que pestana se abre el modal.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models import (
    Appointment, Client, ClientComment, Enrollment, FinancialSale, InstallmentPlan, Payment, Program,
)

URL = '/api/ficha/lead'


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'otro_closer': make_user(role='closer', username='ajeno', email='ajeno@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
        'triage': make_user(role='triage', username='triaje', email='triaje@neuro.com'),
        'operador': make_user(role='operator', username='ops', email='ops@neuro.com'),
    }


@pytest.fixture()
def lead(db, equipo):
    """Un lead con la llamada manana, a medio confirmar."""
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g', phone='+59171234567',
                     grupo='grupo 2', form_data={'examen': 'ENARM', 'profesion': 'Medicina',
                                                 'fuente_form': 'Elias'})
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id,
                       client_id=cliente.id, start_time=datetime.utcnow() + timedelta(days=1),
                       origin='vsl', examen='ENARM', result='conversando',
                       closer_result='Pendiente', confirmation_stage='horario',
                       confirmation_contact_status='espera_respuesta',
                       confirmation_pain_points='ansiedad,se_distrae',
                       closer_notes='Trabaja de guardia')
    db.session.add(appt)
    db.session.commit()
    return appt


def abrir(client, auth_headers, usuario, **params):
    query = '&'.join(f'{k}={v}' for k, v in params.items())
    return client.get(f'{URL}?{query}', headers=auth_headers(usuario))


# --- Quien puede abrir la ficha ---------------------------------------------------------------

@pytest.mark.parametrize('rol', ['director', 'closer', 'otro_closer', 'setter', 'triage'])
def test_los_cinco_roles_abren_el_mismo_lead(client, db, lead, equipo, auth_headers, rol):
    """Que la direccion comercial abra este lead es el motivo de todo el trabajo: por
    `/api/closer/*` recibe 403."""
    r = abrir(client, auth_headers, equipo[rol], appointment_id=lead.id)

    assert r.status_code == 200, rol
    assert r.get_json()['identidad']['nombre'] == 'Ana Gomez'


def test_un_rol_de_fuera_del_circuito_comercial_no_entra(client, db, lead, equipo, auth_headers):
    assert abrir(client, auth_headers, equipo['operador'], appointment_id=lead.id).status_code == 403


def test_un_anonimo_no_entra(client, db, lead):
    assert client.get(f'{URL}?appointment_id={lead.id}').status_code in (401, 403)


def test_un_lead_que_no_existe_da_404_y_no_403(client, db, equipo, auth_headers):
    """404 y no 403 a proposito: un 403 confirmaria que el recurso existe."""
    assert abrir(client, auth_headers, equipo['director'], appointment_id=999999).status_code == 404
    assert abrir(client, auth_headers, equipo['director'], client_id=999999).status_code == 404


def test_sin_ninguna_clave_es_un_pedido_mal_hecho(client, db, equipo, auth_headers):
    assert client.get(URL, headers=auth_headers(equipo['director'])).status_code == 400


def test_una_clave_que_no_es_un_numero_no_rompe(client, db, equipo, auth_headers):
    assert abrir(client, auth_headers, equipo['director'], appointment_id='abc').status_code == 400


# --- Permisos ---------------------------------------------------------------------------------

def test_la_direccion_puede_todo_incluido_borrar(client, db, lead, equipo, auth_headers):
    permisos = abrir(client, auth_headers, equipo['director'], appointment_id=lead.id) \
        .get_json()['permisos']

    assert permisos == {'confirmar': True, 'reportar': True, 'cobrar': True, 'eliminar': True,
                        'reasignar': True, 'comentar': True}


def test_el_closer_puede_todo_menos_borrar(client, db, lead, equipo, auth_headers):
    permisos = abrir(client, auth_headers, equipo['closer'], appointment_id=lead.id) \
        .get_json()['permisos']

    assert permisos['reportar'] is True and permisos['cobrar'] is True
    assert permisos['eliminar'] is False


def test_triage_confirma_pero_no_reporta_ni_cobra(client, db, lead, equipo, auth_headers):
    permisos = abrir(client, auth_headers, equipo['triage'], appointment_id=lead.id) \
        .get_json()['permisos']

    assert permisos['confirmar'] is True
    assert (permisos['reportar'], permisos['cobrar'], permisos['reasignar']) == (False, False, False)


def test_el_setter_confirma_solo_la_agenda_que_genero(client, db, lead, equipo, auth_headers,
                                                     make_user):
    """Mismo criterio que `_puede_corregir` del dashboard comercial: nadie toca las filas de otro."""
    propia = abrir(client, auth_headers, equipo['setter'], appointment_id=lead.id).get_json()
    assert propia['permisos']['confirmar'] is True

    lead.setter_id = None
    db.session.commit()
    ajena = abrir(client, auth_headers, equipo['setter'], appointment_id=lead.id).get_json()

    assert ajena['permisos']['confirmar'] is False
    assert ajena['permisos']['comentar'] is True


# --- La forma de la respuesta -----------------------------------------------------------------

def test_la_ficha_trae_todos_los_bloques_del_contrato(client, db, lead, equipo, auth_headers):
    datos = abrir(client, auth_headers, equipo['director'], appointment_id=lead.id).get_json()

    assert set(datos) == {'identidad', 'estado', 'confirmacion', 'resultado', 'cobro', 'historial',
                          'formulario', 'comunicacion', 'permisos', 'vocabulario'}


def test_lo_que_falta_viaja_en_null_y_no_ausente(client, db, equipo, auth_headers):
    """El frontend no tiene que preguntar si la clave existe."""
    cliente = Client(full_name='Solo nombre')
    db.session.add(cliente)
    db.session.commit()

    datos = abrir(client, auth_headers, equipo['director'], client_id=cliente.id).get_json()

    identidad = datos['identidad']
    assert identidad['appointment_id'] is None
    assert identidad['email'] is None and identidad['programa'] is None
    assert identidad['llamada'] == {'iso': None, 'fecha': None, 'hora': None}
    assert datos['cobro']['proxima_cuota'] is None
    assert datos['resultado']['venta'] is None


def test_la_cabecera_trae_la_llamada_ya_formateada(client, db, lead, equipo, auth_headers):
    lead.start_time = datetime(2026, 9, 25, 18, 30)
    db.session.commit()

    llamada = abrir(client, auth_headers, equipo['director'], appointment_id=lead.id) \
        .get_json()['identidad']['llamada']

    assert llamada == {'iso': '2026-09-25T18:30:00', 'fecha': '25 sep 2026', 'hora': '18:30'}


def test_la_confirmacion_traduce_los_slugs_a_etiquetas(client, db, lead, equipo, auth_headers):
    """Los vocabularios vivian solo en el JS: sin esto la direccion veria `se_distrae` crudo."""
    conf = abrir(client, auth_headers, equipo['director'], appointment_id=lead.id) \
        .get_json()['confirmacion']

    assert conf['etapa'] == 'horario'
    assert conf['cerrada'] is False
    assert conf['como_viene'] == {'clave': 'espera_respuesta', 'label': 'A la espera de respuesta'}
    assert [d['label'] for d in conf['dolores']] == ['Ansiedad', 'Se distrae']
    assert conf['nota'] == 'Trabaja de guardia'


def test_el_formulario_de_origen_sale_con_sus_preguntas_legibles(client, db, lead, equipo,
                                                                auth_headers):
    formulario = abrir(client, auth_headers, equipo['director'], appointment_id=lead.id) \
        .get_json()['formulario']

    assert formulario['fuente_form'] == 'Elias'
    assert {r['pregunta'] for r in formulario['respuestas']} == \
        {'Examen / Dolor principal', 'Profesión'}


def test_un_campo_nuevo_del_formulario_no_se_pierde(client, db, lead, equipo, auth_headers):
    """Si n8n empieza a mandar una respuesta nueva, se muestra igual: perderla seria perder el dato."""
    lead.client.form_data = {'examen': 'ENARM', 'pregunta_nueva': 'una respuesta'}
    db.session.commit()

    respuestas = abrir(client, auth_headers, equipo['director'], appointment_id=lead.id) \
        .get_json()['formulario']['respuestas']

    assert {'clave': 'pregunta_nueva', 'pregunta': 'pregunta_nueva',
            'respuesta': 'una respuesta'} in respuestas


def test_el_hilo_de_notas_junta_las_tres_tablas_donde_viven(client, db, lead, equipo, auth_headers):
    db.session.add(ClientComment(client_id=lead.client_id, author_id=equipo['closer'].id,
                                 text='hablé con la esposa'))
    db.session.commit()

    comunicacion = abrir(client, auth_headers, equipo['director'], appointment_id=lead.id) \
        .get_json()['comunicacion']

    assert [n['texto'] for n in comunicacion['notas']] == ['hablé con la esposa']
    assert comunicacion['notas'][0]['rol'] == 'closer'
    assert {m['nombre'] for m in comunicacion['equipo']} >= {'vendedor', 'captador', 'triaje'}


def test_el_vocabulario_viaja_con_la_ficha(client, db, lead, equipo, auth_headers):
    vocabulario = abrir(client, auth_headers, equipo['director'], appointment_id=lead.id) \
        .get_json()['vocabulario']

    assert [e['clave'] for e in vocabulario['etapas_confirmacion']][0] == 'por_contactar'
    assert vocabulario['como_viene'][-1]['titulo'] == 'Otros'
    assert 'vendedor' in {c['nombre'] for c in vocabulario['closers']}


# --- La pestana por defecto en cada escenario del contrato ------------------------------------

def test_un_lead_sin_agenda_se_abre_en_confirmacion(client, db, equipo, auth_headers):
    cliente = Client(full_name='Recien llegado', email='nuevo@x.com')
    db.session.add(cliente)
    db.session.commit()

    estado = abrir(client, auth_headers, equipo['director'], client_id=cliente.id).get_json()['estado']

    assert (estado['clave'], estado['pestana_por_defecto']) == ('sin_agenda', 'conf')


def test_una_agenda_futura_a_medio_confirmar_se_abre_en_confirmacion(client, db, lead, equipo,
                                                                    auth_headers):
    estado = abrir(client, auth_headers, equipo['closer'], appointment_id=lead.id).get_json()['estado']

    assert (estado['clave'], estado['pestana_por_defecto']) == ('confirmando', 'conf')


def test_una_agenda_vencida_sin_reportar_se_abre_en_resultado(client, db, lead, equipo, auth_headers):
    lead.start_time = datetime.utcnow() - timedelta(days=3)
    db.session.commit()

    estado = abrir(client, auth_headers, equipo['closer'], appointment_id=lead.id).get_json()['estado']

    assert (estado['clave'], estado['pestana_por_defecto']) == ('sin_reportar', 'resultado')


def test_reportada_sin_resultado_se_abre_en_resultado(client, db, lead, equipo, auth_headers):
    lead.start_time = datetime.utcnow() - timedelta(days=3)
    lead.closer_processed = True
    db.session.commit()

    estado = abrir(client, auth_headers, equipo['closer'], appointment_id=lead.id).get_json()['estado']

    assert estado['clave'] == 'reportada_sin_resultado'
    assert estado['pestana_por_defecto'] == 'resultado'


@pytest.fixture()
def comprador(db, equipo):
    """Un cliente que compró un parcial de $400 sobre $1.000: debe $600 y tiene cronograma."""
    programa = Program(name='Residency Roadmap', price=1000.0)
    db.session.add(programa)
    cliente = Client(full_name='Luis Paz', email='luis@x.com', total_amount=1000.0)
    db.session.add(cliente)
    db.session.commit()
    db.session.add(FinancialSale(mail_cliente='luis@x.com', nombre_cliente='Luis Paz',
                                 tipo_pago='RR - Parcial', monto=400.0, metodo_pago='Stripe',
                                 estado='Completada', date=datetime(2026, 8, 1),
                                 email_vendedor='vendedor@neuro.com'))
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id,
                             closer_id=equipo['closer'].id, enrollment_date=date(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=400.0, date=date(2026, 8, 1),
                           payment_type='first_payment', status='completed'))
    db.session.add(InstallmentPlan(client_id=cliente.id, appointment_id=1, programa_code='RR',
                                   numero_cuota=1, monto=600.0,
                                   fecha_vencimiento=date.today() + timedelta(days=10)))
    appt = Appointment(closer_id=equipo['closer'].id, client_id=cliente.id,
                       start_time=datetime.utcnow() - timedelta(days=20),
                       closer_result='Show up', closer_processed=True, seguimiento_realizado=True)
    db.session.add(appt)
    db.session.commit()
    return cliente


def test_una_venta_con_deuda_se_abre_en_acciones(client, db, comprador, equipo, auth_headers):
    datos = abrir(client, auth_headers, equipo['director'], client_id=comprador.id).get_json()

    assert datos['estado']['clave'] == 'venta_con_deuda'
    assert datos['estado']['pestana_por_defecto'] == 'acciones'
    assert 'acciones' in datos['estado']['pestanas']


def test_el_cobro_reusa_la_deuda_y_la_etapa_que_ya_calcula_el_closer(client, db, comprador, equipo,
                                                                    auth_headers):
    """Si la ficha recalculara la deuda, mostraria otro numero que la cola de cobro del closer."""
    cobro = abrir(client, auth_headers, equipo['director'], client_id=comprador.id).get_json()['cobro']

    assert cobro['deuda'] == 600.0
    assert cobro['pagado'] == 400.0
    assert cobro['programa_nombre'] == 'Residency Roadmap'
    assert cobro['etapa']['clave'] == 'cuota_proxima'
    assert [c['monto'] for c in cobro['cuotas']] == [600.0]
    assert cobro['pagos'] == [{'fecha': '2026-08-01T00:00:00', 'medio': 'Stripe',
                               'monto': 400.0, 'tipo': 'parcial'}]
    assert cobro['ultimo_pago'] == '2026-08-01T00:00:00'
    assert cobro['estado_pagos']['balance_remaining'] == 600.0


def test_una_venta_al_dia_se_abre_en_historial(client, db, comprador, equipo, auth_headers):
    comprador.total_amount = 400.0
    db.session.commit()

    datos = abrir(client, auth_headers, equipo['director'], client_id=comprador.id).get_json()

    assert datos['estado']['clave'] == 'venta_al_dia'
    assert datos['estado']['pestana_por_defecto'] == 'hist'


def test_un_lead_descartado_se_abre_en_historial(client, db, lead, equipo, auth_headers):
    lead.start_time = datetime.utcnow() - timedelta(days=5)
    lead.closer_result = 'No Lead'
    lead.closer_processed = True
    db.session.commit()

    estado = abrir(client, auth_headers, equipo['closer'], appointment_id=lead.id).get_json()['estado']

    assert (estado['clave'], estado['pestana_por_defecto']) == ('descartado', 'hist')


def test_el_stepper_del_resultado_trae_los_cinco_hitos(client, db, comprador, equipo, auth_headers):
    resultado = abrir(client, auth_headers, equipo['director'], client_id=comprador.id) \
        .get_json()['resultado']

    hitos = {h['clave']: h for h in resultado['hitos']}
    assert list(hitos) == ['confirmado', 'resultado', 'cierre', 'deuda', 'upsell']
    assert hitos['resultado']['sub'] == 'Venta'
    assert hitos['cierre'] == {'clave': 'cierre', 'label': 'Cierre', 'sub': 'Venta cerrada',
                               'estado': 'hecho'}
    # Un hito alcanzado pero malo va en ambar, no en gris: la deuda se ve de un golpe.
    assert hitos['deuda'] == {'clave': 'deuda', 'label': 'Deuda', 'sub': 'Con deuda',
                              'estado': 'alerta'}


def test_el_historial_trae_las_agendas_del_cliente_con_su_chip(client, db, lead, equipo, auth_headers):
    vieja = Appointment(closer_id=equipo['closer'].id, client_id=lead.client_id,
                        start_time=datetime.utcnow() - timedelta(days=10),
                        closer_result='No Show', closer_processed=True)
    db.session.add(vieja)
    db.session.commit()

    historial = abrir(client, auth_headers, equipo['director'], appointment_id=lead.id) \
        .get_json()['historial']

    chips = {a['id']: a['chip']['label'] for a in historial['agendas']}
    assert chips == {lead.id: 'Próxima', vieja.id: 'No show'}


def test_la_bitacora_del_lead_viaja_en_el_historial(client, db, lead, equipo, auth_headers):
    from app.services.booking_service import BookingService
    BookingService.log_lead_event(lead.id, equipo['closer'].id, 'confirmed', 'confirmó la cita')

    eventos = abrir(client, auth_headers, equipo['director'], appointment_id=lead.id) \
        .get_json()['historial']['eventos']

    assert [e['action_type'] for e in eventos] == ['confirmed']


def test_abrir_por_client_id_elige_la_agenda_mas_reciente(client, db, lead, equipo, auth_headers):
    reciente = Appointment(closer_id=equipo['closer'].id, client_id=lead.client_id,
                           start_time=lead.start_time + timedelta(days=5))
    db.session.add(reciente)
    db.session.commit()

    datos = abrir(client, auth_headers, equipo['director'], client_id=lead.client_id).get_json()

    assert datos['identidad']['appointment_id'] == reciente.id


def test_el_vocabulario_solo_tambien_se_puede_pedir(client, db, equipo, auth_headers):
    r = client.get('/api/ficha/vocabulario', headers=auth_headers(equipo['setter']))

    assert r.status_code == 200
    assert 'motivos_descarte' in r.get_json()
