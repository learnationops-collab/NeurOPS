"""`POST /api/ficha/<id>/recuperacion`: la llamada sin resultado, a seguimiento de recuperación.

Pedido de Kerwin (19/10/2026): Jean Carlo y Facundo tienen agendas que eran de Gabriel, que ya no
es closer, sin resultado. No pueden reportarlas (no estuvieron): las pasan a un seguimiento de
recuperación para contactar al lead y volver a agendarlo.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models import Appointment, Client, LeadEventLog
from app.services.closer_agendas_service import ARCHIVADA_SIN_REPORTE
from app.services.closer_followup_service import CloserFollowUpService

DIA = (date.today() + timedelta(days=1)).isoformat()


@pytest.fixture()
def equipo(make_user):
    return {
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'ajeno': make_user(role='closer', username='ajeno', email='ajeno@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
    }


def _agenda(db, equipo, horas=-48, **campos):
    cliente = Client(full_name='Helenn Piqueras', email='helenn@x.com', phone='+51 999 111 222')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, client_id=cliente.id,
                       start_time=datetime.utcnow() + timedelta(hours=horas), **campos)
    db.session.add(appt)
    db.session.commit()
    return appt


def pasar(client, auth_headers, usuario, appt, **datos):
    return client.post(f'/api/ficha/{appt.id}/recuperacion', json=datos, headers=auth_headers(usuario))


def test_archiva_la_llamada_y_agenda_la_recuperacion(client, db, auth_headers, equipo):
    appt = _agenda(db, equipo, closer_result='Pendiente')

    r = pasar(client, auth_headers, equipo['closer'], appt, fecha=DIA, nota='Era de Gabriel')

    assert r.status_code == 200, r.get_json()
    db.session.expire_all()
    appt = db.session.get(Appointment, appt.id)
    assert appt.closer_result == ARCHIVADA_SIN_REPORTE
    assert appt.closer_processed is True
    assert (appt.seguimiento_tipo, appt.fecha_seguimiento, appt.seguimiento_sub) == ('no_tomada', DIA, 'Era de Gabriel')
    assert appt.seguimiento_realizado is False
    assert LeadEventLog.query.filter_by(appointment_id=appt.id, action_type='seguimiento_recuperacion').count() == 1


def test_aparece_en_los_seguimientos_del_closer(client, db, auth_headers, equipo):
    appt = _agenda(db, equipo)
    pasar(client, auth_headers, equipo['closer'], appt, fecha=date.today().isoformat())

    grupos = CloserFollowUpService.get_today_grouped(equipo['closer'].id, date.today().isoformat())
    assert appt.id in {item['id'] for item in grupos['no_tomada']}


def test_sin_nota_lleva_el_motivo(client, db, auth_headers, equipo):
    appt = _agenda(db, equipo)
    pasar(client, auth_headers, equipo['closer'], appt, fecha=DIA)
    db.session.expire_all()
    assert db.session.get(Appointment, appt.id).seguimiento_sub == 'Sin resultado de la llamada'


def test_una_llamada_con_resultado_no_se_pasa(client, db, auth_headers, equipo):
    appt = _agenda(db, equipo, closer_result='No show', closer_processed=True)
    r = pasar(client, auth_headers, equipo['closer'], appt, fecha=DIA)
    assert r.status_code == 400
    db.session.expire_all()
    assert db.session.get(Appointment, appt.id).closer_result == 'No show'


def test_una_llamada_que_no_ocurrio_no_se_pasa(client, db, auth_headers, equipo):
    appt = _agenda(db, equipo, horas=24)
    r = pasar(client, auth_headers, equipo['closer'], appt, fecha=DIA)
    assert r.status_code == 400
    db.session.expire_all()
    assert db.session.get(Appointment, appt.id).closer_processed in (False, None)


def test_pide_el_dia(client, db, auth_headers, equipo):
    appt = _agenda(db, equipo)
    assert pasar(client, auth_headers, equipo['closer'], appt).status_code == 400


def test_un_setter_no_puede(client, db, auth_headers, equipo):
    # Mismo permiso que reportar la llamada: cualquier closer y la dirección, nunca un setter.
    appt = _agenda(db, equipo)
    r = pasar(client, auth_headers, equipo['setter'], appt, fecha=DIA)
    assert r.status_code in (403, 404)
    db.session.expire_all()
    assert db.session.get(Appointment, appt.id).seguimiento_tipo is None
