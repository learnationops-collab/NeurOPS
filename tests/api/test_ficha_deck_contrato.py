"""Contrato actual de `POST /api/closer/deck/<appt_id>` — la red antes de moverlo de lugar.

Esta ruta es el UNICO write del wizard de confirmacion y del reporte de llamada del closer, y
lleva adentro dos reglas que se escribieron a mano por dos bugs reales de produccion:

  · la de `closer_processed` (un reagendado que vuelve a "Pendiente" NO puede quedar procesado, y
    el autoguardado del wizard de confirmacion tampoco puede sacar la cita del mazo);
  · la de los logs `show_up_reported` / `confirmed`, que solo se escriben cuando el campo cambio
    DE VERDAD en ese guardado — si no, "Cerrar el dia" contaba como trabajo de hoy una cita que
    ya estaba en ese estado y se toco por otro motivo.

La ficha unificada necesita compartir esa logica con `/api/ficha`, asi que hay que extraerla a un
servicio. Estos tests fijan el comportamiento observable de la ruta ANTES de moverla: si la
extraccion cambia cualquiera de estas ramas, fallan. No se tocan al refactorizar.
"""
from datetime import datetime

import pytest

from app.models import Appointment, Client, Comment, LeadEventLog


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='cerrador', email='cerrador@neuro.com')


@pytest.fixture()
def cita(db, closer):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id,
                       start_time=datetime(2026, 9, 25, 18, 0),
                       result='conversando', closer_result='Pendiente', closer_processed=False)
    db.session.add(appt)
    db.session.commit()
    return appt


def guardar(client, auth_headers, usuario, appt, **payload):
    return client.post(f'/api/closer/deck/{appt.id}', json=payload, headers=auth_headers(usuario))


def acciones(appt_id):
    return [e.action_type for e in LeadEventLog.query.filter_by(appointment_id=appt_id).all()]


# --- Quien puede escribir ---------------------------------------------------------------------

def test_un_director_comercial_no_puede_escribir_en_el_mazo(client, db, cita, auth_headers, make_user):
    """El 403 inline de este blueprint es el motivo de que exista `/api/ficha`: la direccion
    comercial no puede usar la unica ruta que reporta una llamada."""
    director = make_user(role='director_comercial', username='direccion', email='dir@neuro.com')

    r = guardar(client, auth_headers, director, cita, result='Show up')

    assert r.status_code == 403


def test_un_anonimo_no_puede_escribir_en_el_mazo(client, db, cita):
    assert client.post(f'/api/closer/deck/{cita.id}', json={'result': 'Show up'}).status_code in (401, 403)


# --- La regla de `closer_processed`, rama por rama --------------------------------------------

def test_reportar_un_resultado_marca_la_cita_como_procesada(client, db, cita, auth_headers, closer):
    r = guardar(client, auth_headers, closer, cita, result='Show up')

    assert r.status_code == 200
    assert cita.closer_processed is True
    assert cita.closer_result == 'Show up'


def test_asistio_se_guarda_como_show_up(client, db, cita, auth_headers, closer):
    """El frontend manda la etiqueta que ve el closer; la base guarda el vocabulario canonico."""
    guardar(client, auth_headers, closer, cita, result='Asistió')

    assert cita.closer_result == 'Show up'


def test_volver_a_pendiente_desprocesa_la_cita_aunque_vengan_otras_claves(client, db, cita,
                                                                         auth_headers, closer):
    """Bug real (08/sep/2026): reagendar mandaba `result: 'Pendiente'` junto con
    `seguimiento_realizado`/`closer_notes`, caia en el caso general y marcaba la cita como ya
    reportada en su fecha nueva sin haberse reportado nunca."""
    cita.closer_processed = True
    db.session.commit()

    guardar(client, auth_headers, closer, cita,
            result='Pendiente', closer_notes='se reagenda', seguimiento_realizado=False)

    assert cita.closer_processed is False


def test_pendiente_con_espacios_y_mayusculas_tambien_desprocesa(client, db, cita, auth_headers, closer):
    cita.closer_processed = True
    db.session.commit()

    guardar(client, auth_headers, closer, cita, result='  PENDIENTE ')

    assert cita.closer_processed is False


def test_el_autoguardado_del_wizard_de_confirmacion_no_saca_la_cita_del_mazo(client, db, cita,
                                                                            auth_headers, closer):
    """Tocar una etapa mientras el lead sigue conversando no resuelve nada: la cita no puede
    salir del mazo antes de llegar a Testimonio."""
    guardar(client, auth_headers, closer, cita,
            confirm_status='conversando', confirmation_stage='horario',
            confirmation_contact_status='espera_respuesta', confirmation_pain_points=['ansiedad'],
            closer_notes='llamar despues de las 20', pre_call_reminder_at=None)

    assert cita.closer_processed is False
    assert cita.confirmation_stage == 'horario'


def test_el_autoguardado_tampoco_reabre_una_cita_ya_procesada(client, db, cita, auth_headers, closer):
    """La rama del subconjunto NO toca el campo: ni lo pone en True ni lo pone en False."""
    cita.closer_processed = True
    db.session.commit()

    guardar(client, auth_headers, closer, cita, confirm_status='conversando',
            confirmation_stage='videoask')

    assert cita.closer_processed is True


def test_una_clave_de_fuera_del_subconjunto_junto_al_confirm_status_si_procesa(client, db, cita,
                                                                              auth_headers, closer):
    guardar(client, auth_headers, closer, cita, confirm_status='confirmado',
            fecha_seguimiento='2026-10-01')

    assert cita.closer_processed is True


def test_un_guardado_sin_confirm_status_ni_result_procesa_la_cita(client, db, cita, auth_headers, closer):
    guardar(client, auth_headers, closer, cita, closer_notes='nota suelta')

    assert cita.closer_processed is True


# --- Los logs condicionales -------------------------------------------------------------------

def test_todo_guardado_deja_el_log_generico_de_closer_notes(client, db, cita, auth_headers, closer):
    guardar(client, auth_headers, closer, cita, keyword='algo')

    assert acciones(cita.id) == ['closer_notes']


def test_el_show_up_se_loguea_solo_la_primera_vez(client, db, cita, auth_headers, closer):
    """Bug real (08/sep/2026): volver a tocar una cita que ya estaba en Show up por otro motivo
    la contaba otra vez como llamada reportada hoy."""
    guardar(client, auth_headers, closer, cita, result='Show up')
    assert acciones(cita.id).count('show_up_reported') == 1

    guardar(client, auth_headers, closer, cita, result='Show up', closer_notes='nota')

    assert acciones(cita.id).count('show_up_reported') == 1


def test_sin_la_clave_result_no_hay_log_de_show_up(client, db, cita, auth_headers, closer):
    cita.closer_result = 'Show up'
    db.session.commit()

    guardar(client, auth_headers, closer, cita, closer_notes='nota')

    assert 'show_up_reported' not in acciones(cita.id)


def test_confirmar_se_loguea_solo_cuando_el_estado_cambia_a_confirmado(client, db, cita,
                                                                      auth_headers, closer):
    guardar(client, auth_headers, closer, cita, confirm_status='confirmado')
    assert acciones(cita.id).count('confirmed') == 1

    guardar(client, auth_headers, closer, cita, confirm_status='confirmado')

    assert acciones(cita.id).count('confirmed') == 1


def test_un_confirm_status_que_no_es_confirmado_no_deja_log_de_confirmacion(client, db, cita,
                                                                           auth_headers, closer):
    guardar(client, auth_headers, closer, cita, confirm_status='por_confirmar')

    assert 'confirmed' not in acciones(cita.id)


# --- El comentario que nace de `closer_notes` -------------------------------------------------

def test_la_nota_del_closer_queda_como_comentario_del_cliente(client, db, cita, auth_headers, closer):
    """El hilo del cliente es donde el equipo lee lo que paso; la nota de la agenda se espeja ahi."""
    guardar(client, auth_headers, closer, cita, closer_notes='  pidio hablar con la esposa  ')

    comentarios = Comment.query.filter_by(comment_type='client', associated_id=cita.client_id).all()
    assert [c.text for c in comentarios] == ['pidio hablar con la esposa']
    assert comentarios[0].author_id == closer.id
    assert cita.closer_notes == 'pidio hablar con la esposa'


def test_una_nota_vacia_no_crea_comentario(client, db, cita, auth_headers, closer):
    guardar(client, auth_headers, closer, cita, closer_notes='   ')

    assert Comment.query.filter_by(comment_type='client').count() == 0
    assert cita.closer_notes == ''


# --- Campos sueltos con reglas propias --------------------------------------------------------

def test_los_dolores_viajan_como_lista_y_se_guardan_separados_por_coma(client, db, cita,
                                                                      auth_headers, closer):
    guardar(client, auth_headers, closer, cita,
            confirmation_pain_points=['procrastinacion', '', 'ansiedad'])

    assert cita.confirmation_pain_points == 'procrastinacion,ansiedad'


def test_una_lista_vacia_de_dolores_deja_el_campo_en_null(client, db, cita, auth_headers, closer):
    cita.confirmation_pain_points = 'ansiedad'
    db.session.commit()

    guardar(client, auth_headers, closer, cita, confirmation_pain_points=[])

    assert cita.confirmation_pain_points is None


def test_cerrar_el_seguimiento_apaga_su_aviso(client, db, cita, auth_headers, closer):
    cita.followup_reminder_enabled = True
    cita.followup_reminder_time = '09:00'
    cita.fecha_seguimiento = '2026-10-01'
    db.session.commit()

    guardar(client, auth_headers, closer, cita, fecha_seguimiento=None)

    assert cita.fecha_seguimiento is None
    assert cita.followup_reminder_enabled is False
    assert cita.followup_reminder_time is None


def test_el_tri_estado_del_decisor_acepta_null_true_y_false(client, db, cita, auth_headers, closer):
    guardar(client, auth_headers, closer, cita, with_decision_maker=True, offer_presented=False)
    assert (cita.with_decision_maker, cita.offer_presented) == (True, False)

    guardar(client, auth_headers, closer, cita, with_decision_maker=None)
    assert cita.with_decision_maker is None


def test_el_resultado_del_contacto_sella_la_fecha(client, db, cita, auth_headers, closer):
    guardar(client, auth_headers, closer, cita, contact_result='contesto')

    assert cita.last_contact_outcome == 'contesto'
    assert cita.last_contact_at is not None
