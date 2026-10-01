"""Los totales de deuda no suman a los clientes dados de baja; el cash sí sigue contándolos.

Cada tablero que muestra "por cobrar" lo calcula por su cuenta —el dashboard del closer y el panel
Cash del comercial (`_pending_collections`), los KPIs del admin, los de la lista de leads y el
tablero público de clientes nuevos—, así que cada uno tiene que enterarse de la baja. El test de
cada uno parte de un cliente que debe, para que ninguno pase en vacío.
"""
from datetime import datetime

import pytest
from flask_login import login_user
from freezegun import freeze_time

from app.models import Appointment, Client, Enrollment, FinancialSale, Payment, Program
from app.services import baja_service
from app.services.closer_dashboard_service import CloserDashboardService
from app.services.comercial_analitica import por_cobrar_de
from app.services.closer_service import CloserService
from app.services.dashboard_service import DashboardService
from app.services.user_service import UserService

# Hora fija: un mediodía de mitad de mes. El rango del período sale de `date.today()` (la hora de
# la máquina) y `Client.created_at` se guarda en UTC: en producción da igual porque el servidor
# corre en UTC, pero en una máquina en UTC-4, de 20 a 24 h, "hoy" todavía es el día anterior
# mientras el cliente recién creado ya es de mañana. El último día del mes eso lo saca del mes y
# estos tests fallaban todas las noches de fin de mes (30/09/2026, 22 h). Congelar la hora no
# alcanza solo: el default de `created_at` es el `datetime.utcnow` real, guardado al importar el
# modelo, y freezegun no lo toca. Por eso los clientes llevan su `created_at` puesto a mano.
MEDIODIA = datetime(2026, 9, 15, 15, 0)
HOY = MEDIODIA.date()


@pytest.fixture(autouse=True)
def _hora_fija():
    with freeze_time(MEDIODIA):
        yield


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='vendedor', email='vendedor@neuro.com')


@pytest.fixture()
def programa(db):
    p = Program(name='RR', price=1000.0)
    db.session.add(p)
    db.session.commit()
    return p


def _cliente(db, closer, programa, nombre, pagado):
    email = f"{nombre.split()[0].lower()}@x.com"
    c = Client(full_name=nombre, email=email, instagram=nombre.split()[0].lower(), created_at=MEDIODIA)
    db.session.add(c)
    db.session.commit()
    db.session.add(FinancialSale(mail_cliente=email, instagram=c.instagram, tipo_pago='RR - Parcial',
                                 monto=pagado, estado='Completada', date=datetime.utcnow()))
    inscripcion = Enrollment(client_id=c.id, program_id=programa.id, closer_id=closer.id,
                             enrollment_date=datetime.utcnow())
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add_all([
        Payment(enrollment_id=inscripcion.id, amount=pagado, status='completed', date=datetime.utcnow()),
        Appointment(closer_id=closer.id, client_id=c.id, start_time=datetime(2026, 8, 1, 15, 0)),
    ])
    db.session.commit()
    return c


@pytest.fixture()
def cartera(db, closer, programa):
    """Dos clientes que deben: Ana 600 (se da de baja) y Beto 900."""
    ana = _cliente(db, closer, programa, 'Ana Gomez', 400.0)
    beto = _cliente(db, closer, programa, 'Beto Diaz', 100.0)
    return ana, beto


def _baja(db, cliente, closer):
    baja_service.dar_de_baja(cliente, 'No puede pagar', closer)
    db.session.commit()


def test_por_cobrar_del_dashboard_del_closer(db, closer, cartera):
    ana, beto = cartera
    assert CloserDashboardService._pending_collections(closer.id)[1]['total'] == 1500.0

    _baja(db, ana, closer)
    filas, totales = CloserDashboardService._pending_collections(closer.id)

    assert [f['client_id'] for f in filas] == [beto.id]
    assert totales['total'] == 900.0
    assert totales['count'] == 1


def test_por_cobrar_del_panel_cash_del_comercial(db, closer, cartera):
    ana, _beto = cartera
    _baja(db, ana, closer)

    assert por_cobrar_de(closer.id)['total'] == 900.0
    assert por_cobrar_de(None)['clientes'] == 1


def test_kpis_del_admin_pendiente_sin_la_baja_y_el_ingreso_entero(db, closer, cartera):
    ana, _beto = cartera
    rango = ('custom', (HOY.replace(day=1)).isoformat(), HOY.isoformat())
    antes = DashboardService.get_dashboard_kpis(*rango)['financials']

    _baja(db, ana, closer)
    despues = DashboardService.get_dashboard_kpis(*rango)['financials']

    assert antes['pending_revenue'] == 1500.0
    assert despues['pending_revenue'] == 900.0
    # Lo cobrado es plata recaudada: la baja no lo mueve.
    assert despues['income'] == antes['income'] == 500.0


def test_kpis_de_la_lista_de_leads(db, closer, cartera):
    ana, _beto = cartera
    assert UserService.get_leads_kpis({})['debt'] == 1500.0

    _baja(db, ana, closer)

    assert UserService.get_leads_kpis({})['debt'] == 900.0


def test_kpis_de_los_leads_del_closer(app, db, closer, cartera):
    ana, _beto = cartera
    _baja(db, ana, closer)

    with app.test_request_context():
        login_user(closer)
        kpis = CloserService.get_leads_kpis(closer.id, {})

    assert kpis['debt'] == 900.0


def test_tablero_publico_de_clientes_nuevos(client, db, closer, cartera, make_user, auth_headers):
    ana, _beto = cartera
    _baja(db, ana, closer)
    director = make_user(role='director_comercial')

    r = client.get('/api/public/new-clients?filter_type=all', headers=auth_headers(director))

    assert r.status_code == 200
    filas = {f['client_id']: f for f in r.get_json()}
    assert filas[ana.id]['deuda'] == 0.0
    assert filas[ana.id]['dado_de_baja'] is True
    assert filas[ana.id]['total_pagado'] == 400.0
    assert filas[_beto.id]['dado_de_baja'] is False
