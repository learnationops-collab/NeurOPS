"""`GET /ficha/<id>/estado-venta?programa=XX`: como viene pagando el cliente ese programa.

Es lo que el wizard de venta del mazo leia de `/closer/sales/client-state` para mostrar "Así viene
este cliente" y avisar cuando un tipo de pago no sigue la secuencia. Esa ruta es `/closer/*` y la
direccion comercial recibe 403; esta puerta usa el mismo servicio con el permiso de declarar.
"""
from datetime import datetime

import pytest

from app.models import Appointment, Client, FinancialSale


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
        'triage': make_user(role='triage', username='triaje', email='triaje@neuro.com'),
    }


@pytest.fixture()
def lead(db, equipo):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id,
                       client_id=cliente.id, start_time=datetime(2026, 9, 25, 18, 0))
    db.session.add(appt)
    db.session.commit()
    return appt


def leer(client, auth_headers, usuario, appt, programa):
    return client.get(f'/api/ficha/{appt.id}/estado-venta?programa={programa}',
                      headers=auth_headers(usuario))


def test_dice_cuanto_pago_y_que_tipos_siguen_la_secuencia(client, db, lead, equipo, auth_headers):
    db.session.add(FinancialSale(client_id=lead.client_id, nombre_cliente='Ana Gomez',
                                 mail_cliente='ana@x.com', tipo_pago='RR - Parcial', monto=500,
                                 estado='Completada', date=datetime(2026, 9, 1)))
    lead.client.total_amount = 1500
    db.session.commit()

    r = leer(client, auth_headers, equipo['closer'], lead, 'rr')

    assert r.status_code == 200
    estado = r.get_json()
    assert (estado['total_paid'], estado['balance_remaining'], estado['sales_count']) == (500, 1000, 1)
    assert estado['client_id'] == lead.client_id
    # Avisa, no bloquea: el tipo que rompe la secuencia viene con su motivo.
    assert estado['allowed_types']['cuota']['ok'] is True
    assert estado['allowed_types']['parcial']['ok'] is False
    assert 'Cuota' in estado['allowed_types']['parcial']['reason']


def test_un_cliente_sin_ventas_arranca_de_cero_con_el_precio_del_programa(client, db, lead, equipo,
                                                                          auth_headers):
    r = leer(client, auth_headers, equipo['closer'], lead, 'SI')

    estado = r.get_json()
    assert (estado['total_paid'], estado['sales_count'], estado['program_price']) == (0, 0, 2000)


def test_un_programa_desconocido_no_se_inventa(client, db, lead, equipo, auth_headers):
    r = leer(client, auth_headers, equipo['closer'], lead, 'XX')

    assert r.status_code == 400


def test_la_direccion_comercial_lo_consulta(client, db, lead, equipo, auth_headers):
    r = leer(client, auth_headers, equipo['director'], lead, 'AL')

    assert r.status_code == 200
    assert r.get_json()['program_price'] == 1000


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_quien_no_declara_ventas_no_lo_consulta(client, db, lead, equipo, auth_headers, rol):
    assert leer(client, auth_headers, equipo[rol], lead, 'RR').status_code == 403


def test_una_agenda_que_no_existe_da_404(client, db, lead, equipo, auth_headers):
    r = client.get('/api/ficha/987654/estado-venta?programa=RR',
                   headers=auth_headers(equipo['closer']))

    assert r.status_code == 404
