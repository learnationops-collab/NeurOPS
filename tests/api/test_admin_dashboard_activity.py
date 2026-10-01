"""/api/admin/dashboard/activity y /api/admin/dashboard: mayores deudores y actividad reciente.

`DashboardService.get_dashboard_activity` calculaba los deudores y la actividad pero no devolvía
nada: la ruta de actividad respondía 200 con `null` y la de dashboard (que la lee) daba 500 al
hacer `None['recent_activity']`. Ninguna pantalla actual las llama —el /admin de hoy lee
`/analytics/*`—, así que nadie lo veía; estos tests fijan que respondan lo que prometen.
"""
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import Client, Enrollment, Payment, Program

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
def admin(make_user):
    return make_user(role='admin', username='admin_dash', email='admin_dash@neuro.com')


@pytest.fixture()
def deudores(db, make_user):
    """Dos clientes de este mes con un programa de $1.000: uno pagó $300 (debe $700), el otro se
    dio de baja debiendo $900 y no tiene que figurar."""
    closer = make_user(role='closer', username='vendedor', email='vendedor@neuro.com')
    programa = Program(name='Residency Roadmap', price=1000.0)
    debe = Client(full_name='Ana Deuda', email='ana@x.com', created_at=MEDIODIA)
    de_baja = Client(full_name='Beto Baja', email='beto@x.com', created_at=MEDIODIA)
    db.session.add_all([programa, debe, de_baja])
    db.session.commit()
    for cliente, pagado in ((debe, 300.0), (de_baja, 100.0)):
        inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id, closer_id=closer.id,
                                 enrollment_date=HOY)
        db.session.add(inscripcion)
        db.session.commit()
        db.session.add(Payment(enrollment_id=inscripcion.id, amount=pagado, date=HOY,
                               payment_type='first_payment', status='completed'))
    de_baja.baja_at = datetime.utcnow()
    db.session.commit()
    return debe


def test_la_actividad_trae_los_mayores_deudores_y_lo_reciente(client, db, admin, auth_headers,
                                                              deudores):
    r = client.get('/api/admin/dashboard/activity?period=this_month', headers=auth_headers(admin))

    assert r.status_code == 200
    datos = r.get_json()
    assert datos is not None
    assert datos['top_debtors'] == [
        {'student': {'id': deudores.id, 'full_name': 'Ana Deuda', 'email': 'ana@x.com'},
         'debt': 700.0},
    ]
    tipos = [a['type'] for a in datos['recent_activity']]
    assert tipos.count('lead') == 2 and tipos.count('payment') == 2


def test_el_dashboard_viejo_arma_su_respuesta_sin_romper(client, db, admin, auth_headers, deudores):
    r = client.get('/api/admin/dashboard?period=this_month', headers=auth_headers(admin))

    assert r.status_code == 200
    datos = r.get_json()
    assert [d['student']['id'] for d in datos['cohort']['top_debtors']] == [deudores.id]
    assert len(datos['recent_activity']) == 4


def test_sin_datos_devuelve_listas_vacias_y_no_null(client, db, admin, auth_headers):
    datos = client.get('/api/admin/dashboard/activity', headers=auth_headers(admin)).get_json()

    assert datos == {'top_debtors': [], 'recent_activity': []}


def test_un_closer_no_entra(client, db, make_user, auth_headers):
    closer = make_user(role='closer', username='otro', email='otro@neuro.com')

    assert client.get('/api/admin/dashboard/activity', headers=auth_headers(closer)).status_code == 403
