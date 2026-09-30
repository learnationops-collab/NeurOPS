"""El reporte SIN venta desde la pestaña «Resultado» de la ficha: `POST /ficha/<id>/resultado`.

Los pedidos no estan escritos a mano: son `frontend/src/components/ficha/__fixtures__/reportes.json`,
lo que arma el arbol de verdad (`construirPayload`) para cada camino. El front comprueba que lo
sigue armando igual (`arbolResultado.contrato.test.js`); aca se comprueba que el backend hace con
eso lo que hacia el mazo de main en cada rama. Hasta este cambio la ruta solo entendia la forma
plana y el arbol le mandaba otra: «No asistió» respondia «Resultado no admitido: no_asistio».
"""
import copy
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.models import Appointment, Client, ClientComment, LeadEventLog

CONTRATO = (Path(__file__).resolve().parents[2] / 'frontend' / 'src' / 'components' / 'ficha'
            / '__fixtures__' / 'reportes.json')
REPORTES = json.loads(CONTRATO.read_text(encoding='utf-8'))


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
        'triage': make_user(role='triage', username='triaje', email='triaje@neuro.com'),
    }


LLAMADA = datetime.utcnow().replace(microsecond=0) - timedelta(hours=2)


@pytest.fixture()
def lead(db, equipo):
    """Una llamada que ya paso y esta sin reportar."""
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g', phone='+59171234567')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id,
                       client_id=cliente.id, start_time=LLAMADA, origin='vsl',
                       result='Confirmado', closer_result='Pendiente', closer_processed=False)
    db.session.add(appt)
    db.session.commit()
    return appt


@pytest.fixture()
def en_seguimiento(db, lead):
    """La misma agenda, ya reportada con decisor y en la cadencia de seguimiento."""
    lead.closer_result = 'Show up'
    lead.closer_processed = True
    lead.with_decision_maker = True
    lead.offer_presented = True
    lead.seguimiento_tipo = 'no_tomada'
    lead.seguimiento_intento = 2
    lead.seguimiento_realizado = False
    lead.fecha_seguimiento = '2026-09-29'
    db.session.commit()
    return lead


@pytest.fixture()
def en_cobro(db, lead):
    """Un cliente que ya compro, en el seguimiento de cobro de lo que debe."""
    lead.closer_result = 'Show up'
    lead.closer_processed = True
    lead.seguimiento_tipo = 'cerrada'
    lead.seguimiento_sub = 'Seguimiento de cobro'
    lead.seguimiento_intento = 1
    lead.seguimiento_realizado = False
    lead.fecha_seguimiento = '2026-09-29'
    lead.fecha_seguimiento_cobro = '2026-09-29'
    db.session.commit()
    return lead


def reportar(client, auth_headers, usuario, appt, caso, **cambios):
    pedido = copy.deepcopy(REPORTES[caso])
    assert pedido['accion'] == 'reportar_resultado'
    pedido['datos'].update(cambios)
    return client.post(f'/api/ficha/{appt.id}/resultado', json=pedido['datos'],
                       headers=auth_headers(usuario))


def instante(caso):
    iso = REPORTES[caso]['datos']['reagenda']['start_time']
    return datetime.fromisoformat(iso.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)


def acciones(appt):
    return [e.action_type for e in LeadEventLog.query.filter_by(appointment_id=appt.id).all()]


def comentarios(appt):
    return [c.text for c in ClientComment.query.filter_by(client_id=appt.client_id).all()]


# --- Todos los caminos del arbol pasan ---------------------------------------------------------

CASOS_DE_LA_LLAMADA = [c for c in REPORTES if not c.startswith(('cadencia_', 'cobro_'))]
CASOS_DE_LA_CADENCIA = [c for c in REPORTES if c.startswith('cadencia_')]
CASOS_DEL_COBRO = [c for c in REPORTES if c.startswith('cobro_')]


@pytest.mark.parametrize('caso', CASOS_DE_LA_LLAMADA)
def test_cada_camino_de_la_llamada_se_guarda(client, db, lead, equipo, auth_headers, caso):
    r = reportar(client, auth_headers, equipo['closer'], lead, caso)

    assert r.status_code == 200, r.get_json()
    assert 'reporte_arbol' in acciones(lead)


@pytest.mark.parametrize('caso', CASOS_DE_LA_CADENCIA)
def test_cada_camino_de_la_cadencia_se_guarda(client, db, en_seguimiento, equipo, auth_headers,
                                              caso):
    r = reportar(client, auth_headers, equipo['closer'], en_seguimiento, caso)

    assert r.status_code == 200, r.get_json()


@pytest.mark.parametrize('caso', CASOS_DEL_COBRO)
def test_cada_camino_del_cobro_se_guarda(client, db, en_cobro, equipo, auth_headers, caso):
    r = reportar(client, auth_headers, equipo['closer'], en_cobro, caso)

    assert r.status_code == 200, r.get_json()
    assert 'reporte_arbol' in acciones(en_cobro)


def test_el_contrato_cubre_todas_las_ramas_sin_venta():
    """Un camino nuevo del arbol tiene que entrar al contrato, o nadie comprueba que se guarde."""
    assert set(REPORTES) == {
        'asistio_sin_cierre_seguimiento', 'asistio_sin_cierre_perdido',
        'asistio_sin_oferta_segunda_llamada', 'asistio_sin_oferta_descartar',
        'no_asistio_seguimiento', 'no_asistio_descartar',
        'cancelo_reagendar_con_fecha', 'cancelo_seguimiento', 'cancelo_no_lead',
        'reagenda_con_fecha', 'reagenda_sin_fecha',
        'cadencia_no_respondio', 'cadencia_se_cierra', 'cadencia_contesto_y_agendo',
        'cobro_no_respondio', 'cobro_conversando', 'cobro_no_va_a_pagar',
    }


# --- Asistió -----------------------------------------------------------------------------------

def test_asistio_sin_cierre_queda_en_seguimiento_con_su_aviso(client, db, lead, equipo,
                                                               auth_headers):
    r = reportar(client, auth_headers, equipo['closer'], lead, 'asistio_sin_cierre_seguimiento')

    assert r.status_code == 200
    assert (lead.closer_result, lead.closer_processed) == ('Show up', True)
    assert (lead.with_decision_maker, lead.offer_presented) == (True, True)
    assert (str(lead.fecha_seguimiento), lead.seguimiento_tipo, lead.seguimiento_intento,
            lead.seguimiento_realizado) == ('2026-10-06', 'tomada', 1, False)
    assert lead.seguimiento_sub == 'Decisión pendiente · con decisor'
    assert lead.followup_reminder_enabled is True
    # «Cerrar el día» cuenta la llamada como reportada hoy.
    assert 'show_up_reported' in acciones(lead)


def test_los_referidos_con_contacto_entran_y_los_sin_contacto_quedan_en_la_nota(client, db, lead,
                                                                               equipo,
                                                                               auth_headers):
    r = reportar(client, auth_headers, equipo['closer'], lead, 'asistio_sin_cierre_seguimiento')

    assert r.get_json()['referidos'] == 1
    nuevas = Appointment.query.filter(Appointment.id != lead.id).all()
    assert [(a.client.full_name, a.origin) for a in nuevas] == [('Beto Ruiz', 'Referido de Ana Gomez')]
    assert 'Referido(s) sin datos: Caro' in lead.closer_notes


@pytest.mark.parametrize('caso', ['asistio_sin_cierre_perdido', 'asistio_sin_oferta_descartar'])
def test_asistio_y_se_descarta_como_lead_perdido_con_el_motivo(client, db, lead, equipo,
                                                               auth_headers, caso):
    r = reportar(client, auth_headers, equipo['closer'], lead, caso)

    assert r.status_code == 200
    assert (lead.closer_result, lead.closer_processed, lead.seguimiento_realizado) == (
        'Lead Perdido', True, True)
    motivo = REPORTES[caso]['datos']['process']['note']
    assert any(f'Marcado como Lead Perdido por vendedor: {motivo}' in c for c in comentarios(lead))
    # El decisor y la oferta tambien quedan: son lo que miden las metricas de conversion.
    assert lead.with_decision_maker is (caso == 'asistio_sin_cierre_perdido')


def test_la_segunda_llamada_mueve_la_misma_agenda_y_vuelve_a_confirmaciones(client, db, lead,
                                                                           equipo, auth_headers):
    r = reportar(client, auth_headers, equipo['closer'], lead, 'asistio_sin_oferta_segunda_llamada')

    assert r.status_code == 200
    assert lead.start_time == instante('asistio_sin_oferta_segunda_llamada')
    assert (lead.result, lead.closer_result, lead.closer_processed) == (
        'por_confirmar', 'Pendiente', False)
    assert Appointment.query.count() == 1
    assert 'reschedule' in acciones(lead)
    assert lead.closer_notes.startswith('Faltó el decisor')


# --- No asistió --------------------------------------------------------------------------------

def test_no_asistio_queda_como_no_show_en_seguimiento_de_recuperacion(client, db, lead, equipo,
                                                                      auth_headers):
    """El caso que se vio en el navegador: respondía «Resultado no admitido: no_asistio»."""
    r = reportar(client, auth_headers, equipo['closer'], lead, 'no_asistio_seguimiento')

    assert r.status_code == 200
    assert (lead.closer_result, lead.closer_processed) == ('No Show', True)
    assert (lead.seguimiento_tipo, lead.seguimiento_sub) == ('no_tomada', 'No show: Confundió la fecha')
    assert str(lead.fecha_seguimiento) == '2026-10-02'
    assert lead.closer_notes == 'Pensó que era mañana'


def test_el_descarte_por_no_show_guarda_el_motivo_delante_del_comentario(client, db, lead, equipo,
                                                                        auth_headers):
    r = reportar(client, auth_headers, equipo['closer'], lead, 'no_asistio_descartar')

    assert r.status_code == 200
    assert lead.closer_result == 'Lead Perdido'
    assert any('Bloqueó / desapareció. No responde hace dos semanas' in c for c in comentarios(lead))


# --- Canceló y reagenda ------------------------------------------------------------------------

@pytest.mark.parametrize('caso', ['cancelo_reagendar_con_fecha', 'reagenda_con_fecha'])
def test_con_fecha_nueva_la_llamada_se_mueve_y_vuelve_a_confirmaciones(client, db, lead, equipo,
                                                                        auth_headers, caso):
    r = reportar(client, auth_headers, equipo['closer'], lead, caso)

    assert r.status_code == 200
    assert lead.start_time == instante(caso)
    assert (lead.result, lead.closer_result, lead.closer_processed) == (
        'por_confirmar', 'Pendiente', False)
    evento = LeadEventLog.query.filter_by(appointment_id=lead.id, action_type='reschedule').one()
    assert LLAMADA.strftime('%d/%m/%Y %H:%M') in evento.description


def test_una_reagenda_sin_nota_dice_por_que_se_reagendo(client, db, lead, equipo, auth_headers):
    reportar(client, auth_headers, equipo['closer'], lead, 'reagenda_con_fecha')

    assert lead.closer_notes == 'Reagendado por: Imprevisto del lead'


@pytest.mark.parametrize('caso,sub', [
    ('cancelo_seguimiento', 'Cancelación: Problema económico'),
    ('reagenda_sin_fecha', 'Reprogramó sin fecha'),
])
def test_sin_fecha_nueva_va_a_seguimiento(client, db, lead, equipo, auth_headers, caso, sub):
    r = reportar(client, auth_headers, equipo['closer'], lead, caso)

    assert r.status_code == 200
    assert lead.start_time == LLAMADA
    assert (lead.closer_result, lead.seguimiento_tipo, lead.seguimiento_sub) == (
        'No Show', 'no_tomada', sub)


def test_cancelo_y_no_califica_queda_como_no_lead(client, db, lead, equipo, auth_headers):
    r = reportar(client, auth_headers, equipo['closer'], lead, 'cancelo_no_lead')

    assert r.status_code == 200
    assert (lead.closer_result, lead.seguimiento_realizado) == ('No Lead', True)
    assert any('Marcado como No Lead por vendedor: No rinde examen' in c for c in comentarios(lead))


# --- La cadencia de seguimiento ----------------------------------------------------------------

def test_no_respondio_suma_un_intento_y_no_borra_el_decisor_de_la_llamada(client, db,
                                                                          en_seguimiento, equipo,
                                                                          auth_headers):
    lead = en_seguimiento
    r = reportar(client, auth_headers, equipo['closer'], lead, 'cadencia_no_respondio')

    assert r.status_code == 200
    assert (lead.seguimiento_intento, lead.seguimiento_realizado, str(lead.fecha_seguimiento)) == (
        3, False, '2026-10-06')
    assert lead.last_contact_outcome == 'no_resp'
    # La cadencia no vuelve a preguntar por el decisor: su `null` no pisa lo reportado en la llamada.
    assert (lead.with_decision_maker, lead.offer_presented) == (True, True)
    assert lead.closer_result == 'Show up'
    assert lead.closer_notes.startswith('[Modalidad: Mensaje, Llamada]')


def test_cerrar_la_cadencia_da_el_seguimiento_por_hecho(client, db, en_seguimiento, equipo,
                                                        auth_headers):
    lead = en_seguimiento
    r = reportar(client, auth_headers, equipo['closer'], lead, 'cadencia_se_cierra')

    assert r.status_code == 200
    assert (lead.seguimiento_realizado, lead.fecha_seguimiento) == (True, None)
    assert 'Motivo de cierre: Pidió que no lo contacten' in lead.closer_notes


def test_contesto_y_agendo_mueve_la_llamada_y_la_devuelve_a_confirmaciones(client, db,
                                                                           en_seguimiento,
                                                                           equipo, auth_headers):
    lead = en_seguimiento
    r = reportar(client, auth_headers, equipo['closer'], lead, 'cadencia_contesto_y_agendo')

    assert r.status_code == 200
    assert lead.start_time == instante('cadencia_contesto_y_agendo')
    assert (lead.result, lead.closer_result, lead.closer_processed) == (
        'por_confirmar', 'Pendiente', False)
    assert (lead.seguimiento_realizado, lead.fecha_seguimiento) == (True, None)
    assert r.get_json()['referidos'] == 1
    referido = Appointment.query.filter(Appointment.id != lead.id).one()
    assert 'Referido durante el seguimiento de Ana Gomez.' in referido.closer_notes


# --- El seguimiento de cobro -------------------------------------------------------------------

def test_si_no_respondio_el_cobro_sigue_con_la_fecha_nueva_y_su_aviso(client, db, en_cobro, equipo,
                                                                     auth_headers):
    """Lo que hacia el mazo de main: suma un intento, la fecha va tambien como fecha de cobro y el
    seguimiento sigue siendo de cobro (`cerrada`)."""
    lead = en_cobro
    r = reportar(client, auth_headers, equipo['closer'], lead, 'cobro_no_respondio')

    assert r.status_code == 200
    assert (lead.seguimiento_intento, lead.seguimiento_realizado) == (2, False)
    assert (str(lead.fecha_seguimiento), str(lead.fecha_seguimiento_cobro)) == ('2026-10-02', '2026-10-02')
    assert lead.seguimiento_tipo == 'cerrada'
    assert lead.last_contact_outcome == 'no_resp'
    assert (lead.followup_reminder_enabled, str(lead.followup_reminder_time)[:5]) == (True, '10:00')
    assert lead.closer_result == 'Show up'


def test_si_no_va_a_pagar_sale_de_la_cola_con_el_motivo(client, db, en_cobro, equipo, auth_headers):
    lead = en_cobro
    r = reportar(client, auth_headers, equipo['closer'], lead, 'cobro_no_va_a_pagar')

    assert r.status_code == 200
    assert (lead.seguimiento_realizado, lead.fecha_seguimiento) == (True, None)
    assert lead.last_contact_outcome == 'no_paga'
    assert lead.closer_notes.endswith('| Motivo de cierre: No va a pagar')


# --- Lo que no pasa ----------------------------------------------------------------------------

def test_un_resultado_inventado_no_escribe_nada(client, db, lead, equipo, auth_headers):
    r = reportar(client, auth_headers, equipo['closer'], lead, 'no_asistio_seguimiento',
                 resultado='se_fue_a_marte')

    assert r.status_code == 400
    assert (lead.closer_result, lead.fecha_seguimiento) == ('Pendiente', None)


def test_una_venta_no_se_reporta_como_resultado(client, db, en_seguimiento, equipo, auth_headers):
    """«Cerró la venta» va por la ruta de venta, que es la que la registra."""
    r = reportar(client, auth_headers, equipo['closer'], en_seguimiento, 'cadencia_no_respondio',
                 contacto_result='cerro')

    assert r.status_code == 400


def test_un_descarte_sin_motivo_no_se_guarda(client, db, lead, equipo, auth_headers):
    pedido = copy.deepcopy(REPORTES['asistio_sin_cierre_perdido']['datos'])
    pedido['process']['note'] = '   '

    r = client.post(f'/api/ficha/{lead.id}/resultado', json=pedido,
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'motivo_descarte'
    assert lead.closer_result == 'Pendiente'


def test_por_process_solo_se_descarta(client, db, lead, equipo, auth_headers):
    pedido = copy.deepcopy(REPORTES['asistio_sin_cierre_perdido']['datos'])
    pedido['process']['status'] = 'Show up'

    r = client.post(f'/api/ficha/{lead.id}/resultado', json=pedido,
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert lead.closer_result == 'Pendiente'


def test_una_fecha_nueva_sin_zona_no_mueve_nada(client, db, lead, equipo, auth_headers):
    """Se valida antes de escribir: el guardado del mazo comitea por su cuenta y quedaria a medias."""
    r = reportar(client, auth_headers, equipo['closer'], lead, 'reagenda_con_fecha',
                 reagenda={'start_time': '2026-10-07T17:15', 'modo': 'reagenda'})

    assert r.status_code == 400
    assert (lead.start_time, lead.closer_result, lead.result) == (LLAMADA, 'Pendiente', 'Confirmado')


def test_la_direccion_comercial_reporta_por_el_arbol(client, db, lead, equipo, auth_headers):
    r = reportar(client, auth_headers, equipo['director'], lead, 'no_asistio_seguimiento')

    assert r.status_code == 200
    assert lead.closer_result == 'No Show'


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_setter_y_triage_no_reportan_la_llamada(client, db, lead, equipo, auth_headers, rol):
    r = reportar(client, auth_headers, equipo[rol], lead, 'no_asistio_seguimiento')

    assert r.status_code == 403
    assert lead.closer_result == 'Pendiente'
