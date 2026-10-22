"""Las ventas en la sección Pagos de la ficha (20/10/2026): la lectura dice de qué venta es cada
pago, «Agregar pago» deja elegir la venta (o la ubica sola) y corregir un pago lo puede mover."""
from datetime import datetime, timedelta

import pytest

from app.models import Appointment, Client, FinancialSale, Sale


@pytest.fixture()
def equipo(make_user):
    return {
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
    }


@pytest.fixture()
def lead(db, equipo):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id, client_id=cliente.id,
                       start_time=datetime.utcnow() + timedelta(days=1), origin='vsl', examen='ENARM',
                       result='conversando', closer_result='Pendiente')
    db.session.add(appt)
    db.session.commit()
    return appt


def _cobro(lead, tipo, fecha):
    from app import db
    v = FinancialSale(client_id=lead.client_id, mail_cliente='ana@x.com', nombre_cliente='Ana Gomez',
                      tipo_pago=tipo, monto=500.0, metodo_pago='Stripe', date=fecha, estado='Completada',
                      email_vendedor='vendedor@neuro.com')
    db.session.add(v)
    db.session.commit()
    return v


PAGO = {'fecha': '2026-09-09', 'monto': 150, 'metodo_pago': 'Stripe', 'programa_code': 'RR', 'tipo': 'cuota'}


def test_la_ficha_manda_las_ventas_y_la_de_cada_pago(client, db, lead, equipo, auth_headers):
    alta = _cobro(lead, 'RR - Parcial', datetime(2026, 3, 1))
    renovacion = _cobro(lead, 'RR - Renovación', datetime(2026, 8, 1))

    ficha = client.get(f'/api/ficha/lead?appointment_id={lead.id}', headers=auth_headers(equipo['closer'])).get_json()

    ventas = ficha['cobro']['ventas']
    assert [(v['id'], v['kind'], v['program_code']) for v in ventas] == [
        (alta.sale_id, 'new', 'RR'), (renovacion.sale_id, 'renewal', 'RR')]
    assert [p['sale_id'] for p in ficha['cobro']['pagos']] == [alta.sale_id, renovacion.sale_id]


def test_agregar_un_pago_sin_elegir_lo_ubica_solo(client, db, lead, equipo, auth_headers):
    alta = _cobro(lead, 'RR - Parcial', datetime(2026, 8, 1))

    r = client.post(f'/api/ficha/{lead.id}/pago', json=PAGO, headers=auth_headers(equipo['closer']))

    assert r.status_code == 201, r.get_json()
    assert db.session.get(FinancialSale, r.get_json()['id']).sale_id == alta.sale_id


def test_agregar_un_pago_a_la_venta_elegida(client, db, lead, equipo, auth_headers):
    alta = _cobro(lead, 'RR - Parcial', datetime(2026, 3, 1))
    _cobro(lead, 'RR - Renovación', datetime(2026, 8, 1))

    r = client.post(f'/api/ficha/{lead.id}/pago', json={**PAGO, 'sale_id': alta.sale_id},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 201, r.get_json()
    assert db.session.get(FinancialSale, r.get_json()['id']).sale_id == alta.sale_id


def test_no_se_elige_una_venta_de_otro_programa_ni_de_otro_cliente(client, db, lead, equipo, auth_headers):
    al = _cobro(lead, 'AL - Parcial', datetime(2026, 3, 1))
    otra = Sale(client_id=None, program_code='RR', kind='new', sold_at=datetime(2026, 3, 1))
    db.session.add(otra)
    db.session.commit()

    for sale_id in (al.sale_id, otra.id):
        r = client.post(f'/api/ficha/{lead.id}/pago', json={**PAGO, 'sale_id': sale_id},
                        headers=auth_headers(equipo['closer']))
        assert r.status_code == 400
        assert r.get_json()['campo'] == 'sale_id'
    assert FinancialSale.query.count() == 1


def test_corregir_un_pago_lo_mueve_de_venta_y_queda_en_la_bitacora(client, db, lead, equipo, auth_headers):
    alta = _cobro(lead, 'RR - Parcial', datetime(2026, 3, 1))
    _cobro(lead, 'RR - Renovación', datetime(2026, 8, 1))
    cuota = _cobro(lead, 'RR - Cuota', datetime(2026, 9, 1))  # cae en la renovación
    assert cuota.sale_id != alta.sale_id

    r = client.patch(f'/api/ficha/{lead.id}/pago/{cuota.id}', json={'sale_id': alta.sale_id},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['cambios'] == ['sale_id']
    assert db.session.get(FinancialSale, cuota.id).sale_id == alta.sale_id
