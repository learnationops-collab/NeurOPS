"""El reporte corto de una Momentum en la ficha (app/services/ficha_momentum_service.py).

¿Asistió? → si asistió, ¿continúa? → motivo. Se guarda como cualquier reporte y vuelve a la Academia
(momentum_academia.traducir) con `motivo`.
"""
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.models import Appointment, Client, LeadEventLog
from app.services import momentum_academia

LLAMADA = datetime.utcnow().replace(microsecond=0) - timedelta(hours=2)


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='allan', email='allan@neuro.com')


def _agenda(db, closer, tipo='sena', origen='Momentum', email='ana@x.com'):
    cliente = Client(full_name='Ana Alumna', email=email)
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=LLAMADA, origin=origen,
                       closer_result='Pendiente', closer_processed=False,
                       agenda_payload={'academia': {'reserva_id': 501, 'sesion': 'Momentum Session', 'tipo': tipo}})
    db.session.add(appt)
    db.session.commit()
    return appt


def _reportar(client, auth_headers, closer, appt, **momentum):
    with patch.object(momentum_academia, 'avisar') as avisar:
        r = client.post(f'/api/ficha/{appt.id}/resultado', json={'momentum': momentum, 'respuestas': {'x': 1}},
                        headers=auth_headers(closer))
    return r, avisar


def test_asistio_y_pago_queda_reportada_y_avisa_a_la_academia(client, db, closer, auth_headers):
    appt = _agenda(db, closer)
    r, avisar = _reportar(client, auth_headers, closer, appt, asistencia='asistio', resultado='pago')
    assert r.status_code == 200, r.get_json()
    db.session.refresh(appt)
    assert appt.closer_result == 'Show up' and appt.closer_processed
    assert appt.closer_notes == 'Momentum (seña): Asistió · Pagó, sigue'
    assert appt.agenda_payload['momentum_reporte']['resultado'] == 'pago'
    assert appt.agenda_payload['academia']['reserva_id'] == 501
    log = LeadEventLog.query.filter_by(appointment_id=appt.id, action_type='reporte_arbol').one()
    assert '"momentum"' in log.description and '"pago"' in log.description
    assert avisar.call_args.args[1] == 'resultado'


def test_lo_esta_pensando_o_no_sigue_piden_el_motivo(client, db, closer, auth_headers):
    appt = _agenda(db, closer, tipo='cierre')
    r, _ = _reportar(client, auth_headers, closer, appt, asistencia='asistio', resultado='pensando')
    assert r.status_code == 400 and r.get_json()['campo'] == 'motivo'
    r, _ = _reportar(client, auth_headers, closer, appt, asistencia='asistio', resultado='no_sigue', motivo='Sin plata')
    assert r.status_code == 200
    db.session.refresh(appt)
    assert appt.closer_notes == 'Momentum (cierre): Asistió · No por ahora. Motivo: Sin plata'


def test_no_asistio_y_cancelo_piden_el_motivo(client, db, closer, auth_headers):
    appt = _agenda(db, closer)
    r, _ = _reportar(client, auth_headers, closer, appt, asistencia='no_asistio')
    assert r.status_code == 400 and r.get_json()['campo'] == 'motivo'
    r, _ = _reportar(client, auth_headers, closer, appt, asistencia='cancelo', motivo='Viaje')
    assert r.status_code == 200
    db.session.refresh(appt)
    assert appt.closer_result == 'Cancelado'
    r, _ = _reportar(client, auth_headers, closer, appt, asistencia='asistio')
    assert r.status_code == 400 and r.get_json()['campo'] == 'resultado'


def test_reagenda_mueve_la_llamada_y_vuelve_a_confirmaciones(client, db, closer, auth_headers):
    appt = _agenda(db, closer)
    nueva = (LLAMADA + timedelta(days=2)).replace(minute=0, second=0)
    r, _ = _reportar(client, auth_headers, closer, appt, asistencia='reagenda', inicio=nueva.isoformat() + 'Z')
    assert r.status_code == 200, r.get_json()
    db.session.refresh(appt)
    assert appt.start_time == nueva and not appt.closer_processed
    r, _ = _reportar(client, auth_headers, closer, appt, asistencia='reagenda')
    assert r.status_code == 400


def test_una_agenda_que_no_es_momentum_no_usa_el_arbol_corto(client, db, closer, auth_headers):
    appt = _agenda(db, closer, origen='vsl')
    r, _ = _reportar(client, auth_headers, closer, appt, asistencia='asistio', resultado='pago')
    assert r.status_code == 400


def test_la_ficha_dice_que_es_una_momentum_y_de_que_tipo(client, db, closer, auth_headers):
    appt = _agenda(db, closer, tipo='cierre')
    r = client.get(f'/api/ficha/lead?appointment_id={appt.id}', headers=auth_headers(closer))
    assert r.get_json()['resultado']['momentum'] == {'tipo': 'cierre', 'sesion': 'Momentum Session', 'reporte': None}
    otra = _agenda(db, closer, origen='vsl', email='beto@x.com')
    r = client.get(f'/api/ficha/lead?appointment_id={otra.id}', headers=auth_headers(closer))
    assert r.get_json()['resultado']['momentum'] is None


def test_la_academia_recibe_asistencia_resultado_y_motivo(app):
    from app.services.momentum_academia import traducir

    with app.app_context():
        m = {'momentum': {'asistencia': 'asistio', 'resultado': 'pensando', 'motivo': 'Lo habla con la pareja'}}
        assert traducir('resultado', m) == {'asistencia': 'asistio', 'resultado': 'pensando',
                                            'motivo': 'Lo habla con la pareja'}
        m = {'momentum': {'asistencia': 'reagenda', 'inicio': '2026-10-08T15:00:00Z', 'motivo': None}}
        assert traducir('resultado', m) == {'asistencia': 'reagenda', 'inicio': '2026-10-08T15:00:00Z'}
        assert traducir('resultado', {'momentum': {'asistencia': 'no_asistio', 'motivo': 'No contestó'}}) == {
            'asistencia': 'no_asistio', 'motivo': 'No contestó'}
        # El árbol de siempre y el mazo viejo también mandan el motivo, si lo hay.
        viejo = {'resultado': 'no_asistio', 'deck': {}, 'motivo': 'Se olvidó'}
        assert traducir('resultado', viejo) == {'asistencia': 'no_asistio', 'motivo': 'Se olvidó'}
        assert traducir('mazo', {'result': 'No Show', 'seguimiento_sub': 'No show: Se olvidó'}) == {
            'asistencia': 'no_asistio', 'motivo': 'No show: Se olvidó'}
