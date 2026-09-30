"""«Dar de baja» y «Revertir baja» desde la ficha: la baja deja de ser solo un seguimiento cerrado.

Antes la acción cerraba el seguimiento y dejaba un comentario; el cliente seguía debiendo y seguía
en la cola de cobro. Ahora además lo marca de baja, y revertirla le devuelve la deuda exacta.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models import (
    Appointment, Client, ClientComment, Enrollment, FinancialSale, InstallmentPlan, LeadEventLog,
    Payment, Program,
)
from app.services.closer_followup_service import CloserFollowUpService


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
    }


@pytest.fixture()
def cliente(db, equipo):
    """Compró RR por 1000, pagó 400 y tiene una cuota vencida de 300."""
    c = Client(full_name='Ana Gomez', email='ana@x.com', total_amount=1000.0)
    programa = Program(name='RR', price=1000.0)
    db.session.add_all([c, programa])
    db.session.commit()
    db.session.add(FinancialSale(mail_cliente='ana@x.com', tipo_pago='RR - Parcial', monto=400.0,
                                 estado='Completada', date=datetime(2026, 8, 1),
                                 email_vendedor='vendedor@neuro.com'))
    inscripcion = Enrollment(client_id=c.id, program_id=programa.id, closer_id=equipo['closer'].id,
                             enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, client_id=c.id,
                       start_time=datetime(2026, 8, 1, 15, 0),
                       closer_result='Show up', closer_processed=True)
    db.session.add_all([Payment(enrollment_id=inscripcion.id, amount=400.0, status='completed',
                                date=datetime(2026, 8, 1)), appt])
    db.session.commit()
    db.session.add(InstallmentPlan(appointment_id=appt.id, client_id=c.id, programa_code='RR',
                                   numero_cuota=1, monto=300.0,
                                   fecha_vencimiento=date.today() - timedelta(days=3)))
    db.session.commit()
    return c


def _agenda(cliente):
    return Appointment.query.filter_by(client_id=cliente.id).first()


def _dar_de_baja(client, cliente, usuario, auth_headers, **extra):
    return client.post(f'/api/ficha/{_agenda(cliente).id}/baja',
                       json={'motivo': 'No puede pagar', **extra}, headers=auth_headers(usuario))


def test_la_baja_marca_al_cliente_y_la_deuda_pasa_a_cero(client, db, cliente, equipo, auth_headers):
    r = _dar_de_baja(client, cliente, equipo['closer'], auth_headers)

    assert r.status_code == 200
    assert r.get_json()['baja']['motivo'] == 'No puede pagar'
    c = db.session.get(Client, cliente.id)
    assert c.baja_at is not None and c.baja_por_id == equipo['closer'].id
    assert CloserFollowUpService._client_debt(cliente.id) == 0.0
    # Lo que ya hacía la acción sigue igual: el seguimiento cerrado y el comentario.
    assert _agenda(cliente).seguimiento_sub == 'Baja: No puede pagar'
    assert ClientComment.query.filter(ClientComment.text.like('Cliente dado de baja%')).count() == 1


def test_lo_cobrado_no_se_toca(client, db, cliente, equipo, auth_headers):
    _dar_de_baja(client, cliente, equipo['closer'], auth_headers)

    assert FinancialSale.query.count() == 1
    assert Payment.query.filter_by(status='completed').count() == 1
    assert InstallmentPlan.query.filter_by(client_id=cliente.id).count() == 1


def test_sale_de_la_cola_de_cobro(client, db, cliente, equipo, auth_headers):
    assert [i['client_id'] for i in CloserFollowUpService.get_pool(equipo['closer'].id, tipo='cerrada')] \
        == [cliente.id]

    _dar_de_baja(client, cliente, equipo['closer'], auth_headers)

    assert CloserFollowUpService.get_pool(equipo['closer'].id, tipo='cerrada') == []


def test_el_seguimiento_que_se_agenda_al_dar_la_baja_llega_en_su_dia(client, db, cliente, equipo,
                                                                     auth_headers):
    """«¿Agendás un seguimiento a futuro?»: es el único suyo que sigue en las listas."""
    hoy = date.today().isoformat()
    _dar_de_baja(client, cliente, equipo['closer'], auth_headers, fecha_seguimiento=hoy)

    fila, = CloserFollowUpService.get_today_grouped(equipo['closer'].id, hoy)['cerrada']

    assert fila['client_id'] == cliente.id
    assert fila['etapa_cobro']['clave'] == 'baja'


def test_revertir_la_baja_devuelve_la_deuda_y_la_cola(client, db, cliente, equipo, auth_headers):
    _dar_de_baja(client, cliente, equipo['closer'], auth_headers)

    r = client.post(f'/api/ficha/{_agenda(cliente).id}/revertir-baja', json={},
                    headers=auth_headers(equipo['director']))

    assert r.status_code == 200
    assert r.get_json()['deuda'] == 600.0
    assert r.get_json()['baja_anterior']['motivo'] == 'No puede pagar'
    assert db.session.get(Client, cliente.id).baja_at is None
    assert CloserFollowUpService._proxima_cuota(cliente.id, 600.0)['monto'] == 300.0
    assert [i['client_id'] for i in CloserFollowUpService.get_pool(equipo['closer'].id, tipo='cerrada')] \
        == [cliente.id]
    # Queda escrito dónde el equipo lo lee.
    assert ClientComment.query.filter(ClientComment.text.like('%revirtió la baja%')).count() == 1
    assert LeadEventLog.query.filter_by(action_type='baja_revertida').count() == 1


def test_no_se_revierte_una_baja_que_no_existe(client, db, cliente, equipo, auth_headers):
    r = client.post(f'/api/ficha/{_agenda(cliente).id}/revertir-baja', json={},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 400
    assert 'no está dado de baja' in r.get_json()['message']


def test_un_setter_no_revierte_una_baja(client, db, cliente, equipo, auth_headers):
    _dar_de_baja(client, cliente, equipo['closer'], auth_headers)

    r = client.post(f'/api/ficha/{_agenda(cliente).id}/revertir-baja', json={},
                    headers=auth_headers(equipo['setter']))

    assert r.status_code == 403
    assert db.session.get(Client, cliente.id).baja_at is not None
