"""GET /api/comercial/clientes/<id>: la ficha de cobro de un cliente, solo lectura.

El setter y la dirección comercial necesitan ver en qué momento del cobro está un cliente, pero
los endpoints que lo saben viven en el blueprint del closer, piden rol closer y además son los
que escriben. Esta ficha existe para que mirar no exija permisos de cobrar.

Lo que estos tests fijan, sobre todo, es el ALCANCE: a un closer solo se le deja abrir un
cliente al que él le vendió, con exactamente la misma regla de atribución que usa su tabla
Clientes. Si divergieran, un closer podría abrir la ficha de un cliente que su propia tabla no
le muestra — que es justo el tipo de fuga que ya se corrigió en Comparativas.
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

URL = '/api/comercial/clientes'


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'vendedor': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'otro_closer': make_user(role='closer', username='ajeno', email='ajeno@neuro.com'),
        'setter': make_user(role='setter', username='setter1', email='setter1@neuro.com'),
        'triage': make_user(role='triage', username='triage1', email='triage1@neuro.com'),
    }


@pytest.fixture()
def comprador(db, equipo):
    """Cliente que le compró a `vendedor`: 1000 negociados, 400 pagados, debe 600."""
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g', total_amount=1000.0)
    programa = Program(name='RR', price=1000.0)
    db.session.add_all([cliente, programa])
    db.session.commit()

    db.session.add(FinancialSale(mail_cliente='ana@x.com', tipo_pago='RR - Parcial', monto=400.0,
                                 estado='Completada', date=date(2026, 8, 1),
                                 email_vendedor='vendedor@neuro.com'))
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id,
                             closer_id=equipo['vendedor'].id, enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=400.0, status='completed',
                           date=datetime(2026, 8, 1)))
    appt = Appointment(closer_id=equipo['vendedor'].id, client_id=cliente.id,
                       start_time=datetime(2026, 8, 1, 15, 0),
                       closer_result='Show up', closer_processed=True)
    db.session.add(appt)
    db.session.commit()
    db.session.add(InstallmentPlan(appointment_id=appt.id, client_id=cliente.id, programa_code='RR',
                                   numero_cuota=1, monto=600.0,
                                   fecha_vencimiento=date.today() - timedelta(days=3)))
    db.session.commit()
    return cliente


def ficha(client, usuario, auth_headers, cliente):
    return client.get(f'{URL}/{cliente.id}', headers=auth_headers(usuario))


# --- Qué devuelve ------------------------------------------------------------------------------

def test_la_ficha_trae_la_etapa_de_cobro_la_deuda_y_el_plan(client, db, equipo, auth_headers, comprador):
    respuesta = ficha(client, equipo['director'], auth_headers, comprador)
    assert respuesta.status_code == 200
    cuerpo = respuesta.get_json()
    assert cuerpo['cliente']['deuda'] == 600.0
    assert cuerpo['cliente']['etapa_cobro']['clave'] == 'cuota_vencida'
    assert len(cuerpo['cuotas']) == 1
    assert cuerpo['cuotas'][0]['estado'] == 'vencido'


def test_la_ficha_trae_los_pagos_ya_cobrados(client, db, equipo, auth_headers, comprador):
    cuerpo = ficha(client, equipo['director'], auth_headers, comprador).get_json()
    assert [p['monto'] for p in cuerpo['cliente']['pagos']] == [400.0]


def test_un_cliente_sin_ninguna_venta_no_tiene_ficha_de_cobro(client, db, equipo, auth_headers):
    """La ficha es de quien ya compró: un lead suelto no tiene cobro que mirar."""
    lead = Client(full_name='Luis Paz', email='luis@x.com')
    db.session.add(lead)
    db.session.commit()
    assert ficha(client, equipo['director'], auth_headers, lead).status_code == 404


def test_un_cliente_que_no_existe_da_404(client, db, equipo, auth_headers):
    assert client.get(f'{URL}/999999', headers=auth_headers(equipo['director'])).status_code == 404


# --- Alcance: quién puede abrir a quién ---------------------------------------------------------

def test_el_closer_que_vendio_abre_a_su_cliente(client, db, equipo, auth_headers, comprador):
    assert ficha(client, equipo['vendedor'], auth_headers, comprador).status_code == 200


def test_un_closer_no_abre_un_cliente_que_no_vendio_el(client, db, equipo, auth_headers, comprador):
    """Misma regla que su tabla Clientes: si no aparece en su cartera, tampoco puede abrirlo.

    `otro_closer` no tiene ninguna venta a su nombre, que es además el caso que hacía caer el
    filtro en "toda la cartera del equipo" (ver test_comercial_cartera_alcance). Si la ficha no
    respetara el alcance de la tabla, el filtro de la tabla sería solo cosmético."""
    assert ficha(client, equipo['otro_closer'], auth_headers, comprador).status_code == 404


def test_el_setter_puede_mirar_para_saber_en_que_termino_el_lead(client, db, equipo, auth_headers, comprador):
    """La cartera se atribuye por quién VENDIÓ, así que acotarla a un setter daría siempre vacío:
    el setter mira la del equipo, igual que en la tabla."""
    assert ficha(client, equipo['setter'], auth_headers, comprador).status_code == 200


def test_un_rol_ajeno_al_area_comercial_no_entra(client, db, equipo, auth_headers, comprador):
    assert ficha(client, equipo['triage'], auth_headers, comprador).status_code == 403


def test_sin_sesion_no_se_puede_mirar_la_ficha(client, db, comprador):
    assert client.get(f'{URL}/{comprador.id}').status_code in (401, 403)


# --- Es solo lectura ----------------------------------------------------------------------------

@pytest.mark.parametrize('metodo', ['post', 'patch', 'put', 'delete'])
def test_la_ficha_no_acepta_escrituras(client, db, equipo, auth_headers, comprador, metodo):
    """Mirar no puede convertirse en modificar: la ruta existe solo para GET."""
    enviar = getattr(client, metodo)
    respuesta = enviar(f'{URL}/{comprador.id}', headers=auth_headers(equipo['director']), json={})
    assert respuesta.status_code == 405
