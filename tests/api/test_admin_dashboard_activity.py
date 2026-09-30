"""/api/admin/dashboard/activity y /api/admin/dashboard: mayores deudores y actividad reciente.

`DashboardService.get_dashboard_activity` calculaba los deudores y la actividad pero no devolvía
nada: la ruta de actividad respondía 200 con `null` y la de dashboard (que la lee) daba 500 al
hacer `None['recent_activity']`. Ninguna pantalla actual las llama —el /admin de hoy lee
`/analytics/*`—, así que nadie lo veía; estos tests fijan que respondan lo que prometen.
"""
from datetime import date

import pytest

from app.models import Client, Enrollment, Payment, Program


@pytest.fixture()
def admin(make_user):
    return make_user(role='admin', username='admin_dash', email='admin_dash@neuro.com')


@pytest.fixture()
def deudores(db, make_user):
    """Dos clientes de este mes con un programa de $1.000: uno pagó $300 (debe $700), el otro se
    dio de baja debiendo $900 y no tiene que figurar."""
    closer = make_user(role='closer', username='vendedor', email='vendedor@neuro.com')
    programa = Program(name='Residency Roadmap', price=1000.0)
    debe = Client(full_name='Ana Deuda', email='ana@x.com')
    de_baja = Client(full_name='Beto Baja', email='beto@x.com')
    db.session.add_all([programa, debe, de_baja])
    db.session.commit()
    for cliente, pagado in ((debe, 300.0), (de_baja, 100.0)):
        inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id, closer_id=closer.id,
                                 enrollment_date=date.today())
        db.session.add(inscripcion)
        db.session.commit()
        db.session.add(Payment(enrollment_id=inscripcion.id, amount=pagado, date=date.today(),
                               payment_type='first_payment', status='completed'))
    from datetime import datetime
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
