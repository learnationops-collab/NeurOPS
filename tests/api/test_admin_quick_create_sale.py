"""POST /api/admin/sales/quick-create: registrar una venta (cliente, inscripcion y primer pago) desde un lead.

La vista usaba `Lead` sin importarlo: el NameError caia en su `except Exception` y TODA llamada, valida
o no, terminaba en un 500 con el mensaje "name 'Lead' is not defined". Nadie lo noto porque el
frontend no la invoca.
"""
from types import SimpleNamespace

import pytest

from app.models import Client, Enrollment, Lead, Payment, PaymentMethod, Program

URL = '/api/admin/sales/quick-create'


@pytest.fixture()
def catalogo(db):
    lead = Lead(manychat_id='mc-1', name='Ana Gomez', email='ana@x.com', instagram_username='ana.g')
    programa = Program(name='AL', price=1000.0)
    metodo = PaymentMethod(name='Zelle')
    db.session.add_all([lead, programa, metodo])
    db.session.commit()
    return SimpleNamespace(lead=lead, programa=programa, metodo=metodo)


@pytest.fixture()
def admin(make_user):
    return make_user(role='admin')


def cuerpo(catalogo, **cambios):
    base = {'lead_id': catalogo.lead.id, 'program_id': catalogo.programa.id,
            'payment_method_id': catalogo.metodo.id, 'payment_amount': 500, 'payment_type': 'split'}
    return {**base, **cambios}


def vender(client, usuario, auth_headers, catalogo, **cambios):
    return client.post(URL, headers=auth_headers(usuario), json=cuerpo(catalogo, **cambios))


# --- Venta correcta ---------------------------------------------------------------------------

def test_registra_cliente_inscripcion_y_pago(client, db, admin, auth_headers, catalogo):
    respuesta = vender(client, admin, auth_headers, catalogo)

    assert respuesta.status_code == 201
    cuerpo_ = respuesta.get_json()
    assert cuerpo_['message'] == 'Venta registrada exitosamente'

    cliente = Client.query.one()
    assert (cliente.full_name, cliente.email, cliente.instagram, cliente.phone) == ('Ana Gomez', 'ana@x.com', 'ana.g', None)

    inscripcion = Enrollment.query.one()
    assert cuerpo_['enrollment_id'] == inscripcion.id
    assert (inscripcion.client_id, inscripcion.program_id) == (cliente.id, catalogo.programa.id)
    assert inscripcion.closer_id == admin.id  # el admin que registra la venta queda como closer

    pago = Payment.query.one()
    assert (pago.enrollment_id, pago.payment_method_id) == (inscripcion.id, catalogo.metodo.id)
    assert (pago.amount, pago.payment_type, pago.status) == (500.0, 'split', 'completed')


def test_el_estado_del_pago_se_puede_indicar(client, admin, auth_headers, catalogo):
    vender(client, admin, auth_headers, catalogo, status='pending')

    assert Payment.query.one().status == 'pending'


def test_el_monto_puede_llegar_como_texto(client, admin, auth_headers, catalogo):
    respuesta = vender(client, admin, auth_headers, catalogo, payment_amount='250.5')

    assert respuesta.status_code == 201
    assert Payment.query.one().amount == 250.5


def test_si_ya_existe_un_cliente_con_ese_email_se_reutiliza(client, db, admin, auth_headers, catalogo):
    existente = Client(full_name='Ana G. (ya cargada)', email='ana@x.com')
    db.session.add(existente)
    db.session.commit()

    respuesta = vender(client, admin, auth_headers, catalogo)

    assert respuesta.status_code == 201
    assert Client.query.count() == 1
    assert Enrollment.query.one().client_id == existente.id
    db.session.refresh(existente)
    assert existente.full_name == 'Ana G. (ya cargada)'  # no se pisan sus datos con los del lead


@pytest.mark.parametrize('email_del_lead', [None, ''])
def test_un_lead_sin_email_no_se_confunde_con_un_cliente_sin_email(client, db, admin, auth_headers, catalogo, email_del_lead):
    # filter_by(email=None) es `email IS NULL`: la venta se le colgaba al primer cliente que no tuviera
    # email (otra persona), y con '' se usaria un cliente con email vacio. Sin email no hay con quien cruzar.
    ajeno = Client(full_name='Otra Persona', email=None)
    db.session.add(ajeno)
    catalogo.lead.email = email_del_lead
    db.session.commit()

    respuesta = vender(client, admin, auth_headers, catalogo)

    assert respuesta.status_code == 201
    assert Client.query.count() == 2
    inscripcion = Enrollment.query.one()
    assert inscripcion.client_id != ajeno.id
    assert inscripcion.client.full_name == 'Ana Gomez'
    assert Enrollment.query.filter_by(client_id=ajeno.id).count() == 0


def test_dos_leads_sin_email_dan_dos_clientes_distintos(client, db, admin, auth_headers, catalogo):
    # Un email vacio se guarda como NULL: si se guardara '', el segundo lead sin email reutilizaria (o
    # chocaria con la restriccion de unicidad de) el cliente del primero.
    otro = Lead(manychat_id='mc-2', name='Beto Ruiz', email='   ')
    db.session.add(otro)
    catalogo.lead.email = None
    db.session.commit()

    vender(client, admin, auth_headers, catalogo)
    respuesta = vender(client, admin, auth_headers, catalogo, lead_id=otro.id)

    assert respuesta.status_code == 201
    assert sorted(c.full_name for c in Client.query.all()) == ['Ana Gomez', 'Beto Ruiz']
    assert {c.email for c in Client.query.all()} == {None}
    assert Enrollment.query.count() == 2


def test_dos_ventas_al_mismo_lead_comparten_el_cliente(client, admin, auth_headers, catalogo):
    vender(client, admin, auth_headers, catalogo, payment_amount=300)
    vender(client, admin, auth_headers, catalogo, payment_amount=700)

    assert Client.query.count() == 1
    assert Enrollment.query.count() == 2
    assert sorted(p.amount for p in Payment.query.all()) == [300.0, 700.0]


# --- Validaciones -----------------------------------------------------------------------------

@pytest.mark.parametrize('campo', ['lead_id', 'program_id', 'payment_method_id', 'payment_amount', 'payment_type'])
def test_falta_un_campo_obligatorio_es_400_y_no_crea_nada(client, admin, auth_headers, catalogo, campo):
    datos = cuerpo(catalogo)
    del datos[campo]

    respuesta = client.post(URL, headers=auth_headers(admin), json=datos)

    assert respuesta.status_code == 400
    assert respuesta.get_json() == {'error': f'Falta el campo {campo}'}
    assert (Client.query.count(), Enrollment.query.count(), Payment.query.count()) == (0, 0, 0)


def test_un_cuerpo_vacio_es_400(client, admin, auth_headers):
    assert client.post(URL, headers=auth_headers(admin), json={}).status_code == 400


@pytest.mark.parametrize('cambio', [{'lead_id': 9999}, {'program_id': 9999}, {'payment_method_id': 9999}])
def test_una_entidad_que_no_existe_es_404_y_no_crea_nada(client, admin, auth_headers, catalogo, cambio):
    respuesta = vender(client, admin, auth_headers, catalogo, **cambio)

    assert respuesta.status_code == 404
    assert 'no encontradas' in respuesta.get_json()['error']
    assert (Client.query.count(), Enrollment.query.count(), Payment.query.count()) == (0, 0, 0)


# --- Permisos ---------------------------------------------------------------------------------

def test_sin_sesion_es_401(client, catalogo):
    assert client.post(URL, json=cuerpo(catalogo)).status_code == 401
    assert Payment.query.count() == 0


@pytest.mark.parametrize('rol', ['closer', 'setter', 'triage', 'hiring', 'director_comercial', 'director_marketing'])
def test_un_rol_sin_privilegio_es_403_y_no_registra_nada(client, make_user, auth_headers, catalogo, rol):
    respuesta = vender(client, make_user(role=rol), auth_headers, catalogo)

    assert respuesta.status_code == 403
    assert (Client.query.count(), Enrollment.query.count(), Payment.query.count()) == (0, 0, 0)


def test_un_operator_tambien_puede_registrar_ventas(client, make_user, auth_headers, catalogo):
    assert vender(client, make_user(role='operator'), auth_headers, catalogo).status_code == 201
