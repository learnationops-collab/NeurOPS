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


def test_la_prorroga_pide_motivo_cliente_y_suscripcion(client, db, ana):
    assert client.post('/api/external/academy/subscriptions/prorroga', headers=H,
                       json={'email': 'ana@x.com', 'dias': 5}).status_code == 422
    assert client.post('/api/external/academy/subscriptions/prorroga', headers=H,
                       json={'email': 'nadie@x.com', 'dias': 5, 'motivo': 'x'}).status_code == 404
    assert client.post('/api/external/academy/subscriptions/prorroga', headers=H,
                       json={'email': 'ana@x.com', 'dias': 5, 'motivo': 'x'}).status_code == 404
    assert client.post('/api/external/academy/subscriptions/prorroga',
                       json={'email': 'ana@x.com', 'dias': 5, 'motivo': 'x'}).status_code in (401, 403)


def test_la_prorroga_puede_ser_de_cualquier_cantidad_de_dias(client, db, ana):
    cobro(db, ana, 'AL - Completo', datetime(2026, 10, 1))
    vence = suscripcion(ana).expires_at
    r = client.post('/api/external/academy/subscriptions/prorroga', headers=H,
                    json={'email': 'ana@x.com', 'dias': 10, 'motivo': 'Viaje', 'actor_email': 'belu@academia.com'})
    assert r.status_code == 200
    sub = suscripcion(ana)
    assert (sub.expires_at - vence).days == 10
    ultimo = sub.events.all()[-1]
    assert (ultimo.kind, ultimo.reason, ultimo.source) == ('prorroga', 'Prórroga de 10 días: Viaje', 'academia')


def test_la_prorroga_libre_va_de_1_a_365_dias(client, db, ana):
    cobro(db, ana, 'AL - Completo', datetime(2026, 10, 1))
    for dias in (0, 366, 'diez'):
        r = client.post('/api/external/academy/subscriptions/prorroga', headers=H,
                        json={'email': 'ana@x.com', 'dias': dias, 'motivo': 'x'})
        assert r.status_code == 422


def test_la_academia_lee_las_suscripciones_y_las_duraciones_recomendadas(client, db, ana):
    cobro(db, ana, 'AL - Completo', datetime(2026, 10, 1))
    r = client.get('/api/external/academy/subscriptions?email=ana@x.com', headers=H)
    assert r.status_code == 200
    assert r.json['subscriptions'][0]['product_slug'] == 'ace-learners'
    assert {'semana', 'cortesia'} <= {t['value'] for t in r.json['tipos']}
    assert client.get('/api/external/academy/subscriptions?email=nadie@x.com', headers=H).status_code == 404
