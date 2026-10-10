"""Un setter abre la ficha de SUS leads y de ningún otro (10/10/2026).

Su Revisar lista sus agendas, sus ventas y sus leads, y cada fila abre la ficha. Hasta ese día
`GET /api/ficha/lead` y `GET /api/comercial/clientes/<id>` le abrían a un setter cualquier lead o
cliente del sistema, con sus pagos y su deuda. Ahora "suyo" es lo que sus listas le pueden mostrar
(ver `app/services/leads_del_setter.py`), y todo lo demás es un 404 como el de cualquier recurso
fuera de alcance. La dirección, los closers y triage siguen abriendo cualquier lead.
"""
from datetime import datetime, timedelta

import pytest

from app.models import Appointment, Client, FinancialAgenda, FinancialSale

FICHA = '/api/ficha/lead'
COBRO = '/api/comercial/clientes'


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion'),
        'closer': make_user(role='closer', username='Marlon', email='marlon@neuro.com'),
        'triage': make_user(role='triage', username='triaje'),
        'elias': make_user(role='setter', username='Elias'),
        'paula': make_user(role='setter', username='Paula'),
    }


def persona(db, nombre, **contacto):
    cliente = Client(full_name=nombre, email=contacto.pop('email', f'{nombre.lower()}@x.com'), **contacto)
    db.session.add(cliente)
    db.session.commit()
    return cliente


def agenda(db, equipo, cliente, **campos):
    appt = Appointment(closer_id=equipo['closer'].id, client_id=cliente.id,
                       start_time=datetime(2026, 9, 20, 15), closer_result='Pendiente', **campos)
    db.session.add(appt)
    db.session.commit()
    return appt


def venta(db, **campos):
    db.session.add(FinancialSale(tipo_pago='RR - Completo', monto=1000.0, estado='Completada',
                                 email_vendedor='marlon@neuro.com', date=datetime(2026, 9, 21, 12), **campos))
    db.session.commit()


def abrir(client, auth_headers, usuario, **params):
    return client.get(FICHA, headers=auth_headers(usuario), query_string=params)


# --- Lo suyo -------------------------------------------------------------------------------------

def test_abre_la_agenda_que_genero_por_la_agenda_y_por_el_cliente(client, db, equipo, auth_headers):
    cliente = persona(db, 'Ana')
    appt = agenda(db, equipo, cliente, setter_id=equipo['elias'].id, origin='Elias')

    assert abrir(client, auth_headers, equipo['elias'], appointment_id=appt.id).status_code == 200
    assert abrir(client, auth_headers, equipo['elias'], client_id=cliente.id).status_code == 200


def test_abre_una_agenda_con_su_fuente_aunque_no_tenga_setter_id(client, db, equipo, auth_headers):
    """Las agendas de junio-julio de 2026 quedaron con la fuente del setter y sin `setter_id`. La
    fuente se compara normalizada: 'elías' es Elias."""
    appt = agenda(db, equipo, persona(db, 'Beto'), origin='elías')

    assert abrir(client, auth_headers, equipo['elias'], appointment_id=appt.id).status_code == 200
    assert abrir(client, auth_headers, equipo['paula'], appointment_id=appt.id).status_code == 404


def test_abre_al_cliente_de_una_venta_de_su_fuente(client, db, equipo, auth_headers):
    """La fila del Tablero con su nombre y el Instagram de quien pagó: es la agenda con la que la
    atribución le da la venta, aunque el cliente nunca haya tenido una cita a su nombre."""
    cliente = persona(db, 'Caro', instagram='@caro.ok')
    db.session.add(FinancialAgenda(nombre='Elias', instagram='caro.ok', date=datetime(2026, 9, 1)))
    venta(db, instagram='caro.ok', client_id=cliente.id)

    assert abrir(client, auth_headers, equipo['elias'], client_id=cliente.id).status_code == 200
    assert abrir(client, auth_headers, equipo['paula'], client_id=cliente.id).status_code == 404


def test_abre_al_cliente_por_el_correo_de_un_pago_aunque_el_cliente_tenga_otro(client, db, equipo,
                                                                            auth_headers):
    """La atribución une agendas y pagos por el contacto DEL PAGO; el cliente puede haber quedado
    con otro correo. Se mira el de los dos."""
    cliente = persona(db, 'Dani', email='dani@nuevo.com', phone='+5491155550001')
    db.session.add(FinancialAgenda(nombre='Elias', mail='dani@viejo.com', date=datetime(2026, 9, 1)))
    venta(db, mail_cliente='dani@viejo.com', telefono='+5491155550001')

    assert abrir(client, auth_headers, equipo['elias'], client_id=cliente.id).status_code == 200


def test_abre_al_cliente_de_una_venta_con_su_nombre_como_setter(client, db, equipo, auth_headers):
    """Sin agenda que la origine, la fuente de la venta es el setter escrito en ella (la nómina
    también le paga así)."""
    cliente = persona(db, 'Eva')
    venta(db, mail_cliente='eva@x.com', setter='Elias')

    assert abrir(client, auth_headers, equipo['elias'], client_id=cliente.id).status_code == 200
    assert abrir(client, auth_headers, equipo['paula'], client_id=cliente.id).status_code == 404


# --- Lo ajeno ------------------------------------------------------------------------------------

def test_no_abre_el_lead_de_otro_setter_ni_uno_sin_setter(client, db, equipo, auth_headers):
    de_paula = agenda(db, equipo, persona(db, 'Fede'), setter_id=equipo['paula'].id, origin='Paula')
    del_taller = agenda(db, equipo, persona(db, 'Gabi'), origin='workshop')

    for appt in (de_paula, del_taller):
        assert abrir(client, auth_headers, equipo['elias'], appointment_id=appt.id).status_code == 404
        assert abrir(client, auth_headers, equipo['elias'], client_id=appt.client_id).status_code == 404


def test_un_setter_sin_ningun_lead_no_abre_nada(client, db, equipo, auth_headers, make_user):
    nuevo = make_user(role='setter', username='Nuevo')
    appt = agenda(db, equipo, persona(db, 'Hugo'), setter_id=equipo['elias'].id, origin='Elias')

    assert abrir(client, auth_headers, nuevo, appointment_id=appt.id).status_code == 404
    assert abrir(client, auth_headers, nuevo, client_id=appt.client_id).status_code == 404


def test_pedir_un_cliente_ajeno_no_le_ancla_una_agenda(client, db, equipo, auth_headers):
    """Abrir un cliente que compró y nunca tuvo cita le ancla una (`resolver_lead`). Un setter que
    pide uno ajeno no puede dejar esa escritura de rastro: se decide antes de armar la ficha."""
    cliente = persona(db, 'Iris')
    venta(db, mail_cliente='iris@x.com')

    assert abrir(client, auth_headers, equipo['elias'], client_id=cliente.id).status_code == 404
    assert Appointment.query.filter_by(client_id=cliente.id).count() == 0


def test_la_ficha_de_cobro_tambien_se_acota(client, db, equipo, auth_headers):
    """`GET /comercial/clientes/<id>` era el otro camino: le mostraba a un setter los pagos y la
    deuda de cualquier cliente."""
    suyo = persona(db, 'Juan')
    agenda(db, equipo, suyo, setter_id=equipo['elias'].id, origin='Elias')
    venta(db, mail_cliente='juan@x.com')

    assert client.get(f'{COBRO}/{suyo.id}', headers=auth_headers(equipo['elias'])).status_code == 200
    assert client.get(f'{COBRO}/{suyo.id}', headers=auth_headers(equipo['paula'])).status_code == 404


# --- Los demás roles no cambian ------------------------------------------------------------------

@pytest.mark.parametrize('quien', ['director', 'closer', 'triage'])
def test_la_direccion_los_closers_y_triage_abren_cualquier_lead(client, db, equipo, auth_headers, quien):
    appt = agenda(db, equipo, persona(db, 'Kai'), setter_id=equipo['paula'].id, origin='Paula',
                  created_at=datetime(2026, 9, 1) - timedelta(days=1))

    assert abrir(client, auth_headers, equipo[quien], appointment_id=appt.id).status_code == 200


def test_un_lead_que_no_existe_sigue_dando_404(client, db, equipo, auth_headers):
    assert abrir(client, auth_headers, equipo['elias'], appointment_id=999999).status_code == 404
    assert abrir(client, auth_headers, equipo['elias'], client_id=999999).status_code == 404
