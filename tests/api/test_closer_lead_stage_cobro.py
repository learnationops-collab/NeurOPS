"""GET /api/closer/leads/<client_id>/stage: qué pantalla abre el modal de un cliente.

El endpoint ya distinguía si el cliente estaba en confirmación, en llamada por reportar, en
seguimiento o ya cerrado. Lo que no distinguía era qué hacer con un cliente ya cerrado, que es
donde vive casi todo el trabajo del closer: cobrar. Estos tests verifican que la etapa de cobro
viaje en la respuesta y que sea la real, atravesando de punta a punta el cruce cliente↔venta y
el cálculo de deuda — que es justamente lo que el resolutor puro no puede probar por su cuenta.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models import (
    Appointment,
    Client,
    Enrollment,
    FinancialSale,
    InstallmentPlan,
    Payment,
    Program,
)


def url(client_id):
    return f'/api/closer/leads/{client_id}/stage'


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='cerrador', email='cerrador@neuro.com')


@pytest.fixture()
def comprador(db, closer):
    """Cliente que compró 1000, pagó 400 y tiene una cita ya reportada: debe 600."""
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g', total_amount=1000.0)
    programa = Program(name='RR', price=1000.0)
    db.session.add_all([cliente, programa])
    db.session.commit()

    db.session.add(FinancialSale(mail_cliente='ana@x.com', tipo_pago='RR - Parcial', monto=400.0,
                                 estado='Completada', date=date(2026, 8, 1)))
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id, closer_id=closer.id,
                             enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=400.0, status='completed',
                           date=datetime(2026, 8, 1)))
    db.session.add(Appointment(closer_id=closer.id, client_id=cliente.id,
                               start_time=datetime(2026, 8, 1, 15, 0),
                               closer_result='Show up', closer_processed=True))
    db.session.commit()
    return cliente


def cuota(db, cliente, vencimiento, monto=600.0, estado='pendiente'):
    appt = Appointment.query.filter_by(client_id=cliente.id).first()
    db.session.add(InstallmentPlan(appointment_id=appt.id, client_id=cliente.id, programa_code='RR',
                                   numero_cuota=1, monto=monto, fecha_vencimiento=vencimiento,
                                   estado=estado))
    db.session.commit()


def etapa_de(client, closer, auth_headers, cliente):
    respuesta = client.get(url(cliente.id), headers=auth_headers(closer))
    assert respuesta.status_code == 200
    assert respuesta.get_json()['stage'] == 'cerrada'
    return respuesta.get_json()['etapa_cobro']


# --- La etapa viaja y es la real -------------------------------------------------------------

def test_el_que_debe_sin_cuotas_armadas_llega_marcado_para_armar_el_plan(client, db, closer, auth_headers, comprador):
    etapa = etapa_de(client, closer, auth_headers, comprador)
    assert etapa['clave'] == 'sin_plan'
    assert etapa['accion_principal'] == 'armar_plan'
    assert etapa['deuda'] == 600.0


def test_la_cuota_atrasada_llega_como_lo_mas_urgente(client, db, closer, auth_headers, comprador):
    cuota(db, comprador, date.today() - timedelta(days=5))
    etapa = etapa_de(client, closer, auth_headers, comprador)
    assert etapa['clave'] == 'cuota_vencida'
    assert etapa['dias_atraso'] == 5
    assert etapa['tono'] == 'error'


def test_la_cuota_futura_no_se_reporta_como_vencida(client, db, closer, auth_headers, comprador):
    cuota(db, comprador, date.today() + timedelta(days=10))
    etapa = etapa_de(client, closer, auth_headers, comprador)
    assert etapa['clave'] == 'cuota_proxima'


def test_una_cuota_ya_pagada_no_cuenta_como_proxima_a_cobrar(client, db, closer, auth_headers, comprador):
    """Solo las cuotas en estado 'pendiente' son cobrables: si la pagada se colara, el closer
    vería una cuota vencida de algo que el cliente ya pagó."""
    cuota(db, comprador, date.today() - timedelta(days=30), estado='pagado')
    etapa = etapa_de(client, closer, auth_headers, comprador)
    assert etapa['clave'] == 'sin_plan'


def test_el_cliente_que_termino_de_pagar_pasa_a_acompanamiento(client, db, closer, auth_headers, comprador):
    inscripcion = Enrollment.query.filter_by(client_id=comprador.id).first()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=600.0, status='completed',
                           date=datetime(2026, 9, 1)))
    db.session.commit()
    etapa = etapa_de(client, closer, auth_headers, comprador)
    assert etapa['clave'] in ('permanencia', 'renovacion')
    assert etapa['deuda'] == 0.0


def test_un_pago_pendiente_de_acreditar_no_borra_la_deuda(client, db, closer, auth_headers, comprador):
    """`_client_debt` solo suma pagos 'completed': un pago cargado pero no acreditado no puede
    hacer desaparecer al cliente de la cola de cobro."""
    inscripcion = Enrollment.query.filter_by(client_id=comprador.id).first()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=600.0, status='pending',
                           date=datetime(2026, 9, 1)))
    db.session.commit()
    assert etapa_de(client, closer, auth_headers, comprador)['deuda'] == 600.0


# --- El resto del endpoint sigue igual --------------------------------------------------------

def test_un_lead_sin_venta_no_trae_etapa_de_cobro(client, db, closer, auth_headers):
    """La etapa de cobro solo tiene sentido para quien ya compró: en las demás etapas el modal
    abre el reporte de llamada o el seguimiento, no una pantalla de cobro."""
    lead = Client(full_name='Luis Paz', email='luis@x.com')
    db.session.add(lead)
    db.session.commit()
    db.session.add(Appointment(closer_id=closer.id, client_id=lead.id,
                               start_time=datetime.utcnow() + timedelta(days=2)))
    db.session.commit()

    cuerpo = client.get(url(lead.id), headers=auth_headers(closer)).get_json()
    assert cuerpo['stage'] == 'confirm'
    assert 'etapa_cobro' not in cuerpo


def test_un_cliente_que_no_existe_sigue_dando_404(client, db, closer, auth_headers):
    assert client.get(url(999999), headers=auth_headers(closer)).status_code == 404


def test_sin_sesion_no_se_puede_mirar_la_etapa_de_un_cliente(client, db, comprador):
    assert client.get(url(comprador.id)).status_code in (401, 403)
