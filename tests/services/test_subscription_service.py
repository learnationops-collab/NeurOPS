"""La suscripción en Work (`subscription_service`): la abre la venta, la extienden los pagos y las
renovaciones, Fulfillment la cambia a mano y la Academia da prórrogas. Cada cambio queda anotado."""
from datetime import date, datetime

import pytest
from freezegun import freeze_time

from app.models import Client, FinancialSale, Subscription
from app.services import subscription_service as subs
from app.services.academy_access_service import AcademyAccessService

TOKEN = 'token-de-la-academia-para-tests-123'
H = {'Authorization': f'Bearer {TOKEN}'}


@pytest.fixture(autouse=True)
def _entorno(db, monkeypatch):
    monkeypatch.setenv('ACADEMY_INBOUND_API_TOKEN', TOKEN)
    AcademyAccessService.set_product_mapping({'AL': 'ace-learners', 'RR': 'residency-roadmap'})
    db.session.commit()
    with freeze_time('2026-10-20 12:00:00'):
        yield


@pytest.fixture()
def ana(db):
    c = Client(full_name='Ana', email='ana@x.com')
    db.session.add(c)
    db.session.commit()
    return c


def cobro(db, client, tipo, fecha):
    v = FinancialSale(client_id=client.id, mail_cliente=client.email, nombre_cliente=client.full_name,
                      tipo_pago=tipo, monto=500.0, date=fecha, estado='Completada')
    db.session.add(v)
    db.session.commit()
    return v


def suscripcion(client, slug='ace-learners'):
    return Subscription.query.filter_by(client_id=client.id, product_slug=slug).one()


def eventos(sub):
    return [(e.kind, e.from_date, e.to_date) for e in sub.events]


def test_la_sena_da_7_dias_y_el_saldo_la_pasa_a_completo(db, ana):
    cobro(db, ana, 'AL - Seña', datetime(2026, 10, 1))
    sub = suscripcion(ana)
    assert (sub.expires_at, sub.is_deposit) == (date(2026, 10, 8), True)

    cobro(db, ana, 'AL - Cuota', datetime(2026, 10, 5))
    assert (sub.expires_at, sub.is_deposit) == (date(2027, 2, 5), False)
    assert eventos(sub) == [('alta', None, date(2026, 10, 8)), ('conversion', date(2026, 10, 8), date(2027, 2, 5))]


def test_la_venta_da_4_meses_y_las_cuotas_no_mueven_la_fecha(db, ana):
    cobro(db, ana, 'AL - Parcial', datetime(2026, 9, 1))
    cobro(db, ana, 'AL - Cuota', datetime(2026, 10, 1))
    sub = suscripcion(ana)
    assert sub.expires_at == date(2027, 1, 1)
    assert [e.kind for e in sub.events] == ['alta']


def test_la_renovacion_extiende_desde_donde_vencia(db, ana):
    cobro(db, ana, 'AL - Completo', datetime(2026, 7, 1))
    cobro(db, ana, 'AL - Renovación', datetime(2026, 10, 15))
    sub = suscripcion(ana)
    assert sub.expires_at == date(2027, 3, 1)  # vencía el 1/11: 4 meses desde ahí
    assert eventos(sub)[-1] == ('renovacion', date(2026, 11, 1), date(2027, 3, 1))


def test_sin_producto_vinculado_no_hay_suscripcion(db, ana):
    cobro(db, ana, 'SI - Completo', datetime(2026, 10, 1))
    assert Subscription.query.count() == 0


def test_el_cambio_a_mano_puede_acortarla_y_queda_quien(db, ana, make_user):
    closer = make_user(role='closer', username='Marlon', email='marlon@x.com')
    cobro(db, ana, 'AL - Completo', datetime(2026, 10, 1))
    subs.cambiar(ana, 'AL', date(2026, 12, 1), 'Acordado con el alumno', closer)
    db.session.commit()

    sub = suscripcion(ana)
    assert sub.expires_at == date(2026, 12, 1)
    ultimo = sub.events.all()[-1]
    assert (ultimo.kind, ultimo.actor.username, ultimo.reason) == ('correccion', 'Marlon', 'Acordado con el alumno')


def test_la_prorroga_de_la_academia_solo_extiende(client, db, ana):
    cobro(db, ana, 'AL - Completo', datetime(2026, 10, 1))

    r = client.post('/api/external/academy/subscriptions/prorroga', headers=H,
                    json={'email': 'ANA@x.com', 'dias': 15, 'motivo': 'Viaje', 'actor_email': 'gestor@academia.com'})
    assert r.status_code == 200, r.get_json()
    assert r.get_json()['subscription']['expires_at'] == '2027-02-16'
    ultimo = r.get_json()['subscription']['events'][-1]
    assert (ultimo['kind'], ultimo['source'], ultimo['actor'], ultimo['reason']) == (
        'prorroga', 'academia', 'gestor@academia.com', 'Prórroga: Viaje')

    corta = client.post('/api/external/academy/subscriptions/prorroga', headers=H,
                        json={'work_client_id': ana.id, 'expires_at': '2026-11-01', 'motivo': 'x'})
    assert corta.status_code == 422
    assert suscripcion(ana).expires_at == date(2027, 2, 16)


def test_la_prorroga_pide_motivo_cliente_y_suscripcion(client, db, ana):
    assert client.post('/api/external/academy/subscriptions/prorroga', headers=H,
                       json={'email': 'ana@x.com', 'dias': 5}).status_code == 422
    assert client.post('/api/external/academy/subscriptions/prorroga', headers=H,
                       json={'email': 'nadie@x.com', 'dias': 5, 'motivo': 'x'}).status_code == 404
    assert client.post('/api/external/academy/subscriptions/prorroga', headers=H,
                       json={'email': 'ana@x.com', 'dias': 5, 'motivo': 'x'}).status_code == 404
    assert client.post('/api/external/academy/subscriptions/prorroga',
                       json={'email': 'ana@x.com', 'dias': 5, 'motivo': 'x'}).status_code in (401, 403)


def test_el_backfill_carga_el_ultimo_acceso_dado_desde_work(db, ana):
    from scripts import backfill_subscriptions as script

    ana.academy_product_slug = 'residency-roadmap'
    ana.academy_expires_at = datetime(2026, 12, 31)
    db.session.commit()

    assert script.ejecutar(apply=False)['creadas'] == 1 and Subscription.query.count() == 0
    script.ejecutar(apply=True)
    sub = suscripcion(ana, 'residency-roadmap')
    assert (sub.expires_at, sub.program_code, sub.events.one().kind) == (date(2026, 12, 31), 'RR', 'alta')
    assert script.ejecutar(apply=True)['ya_tenian'] == 1
