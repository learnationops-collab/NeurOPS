"""Fase 4: la suscripción de Work, empujada a la Academia al guardar (`subscription_sync`), y el aviso
de cada pago con el vencimiento de la suscripción (`academy_payment_sync`)."""
from datetime import date, datetime
from unittest.mock import patch

import pytest
from freezegun import freeze_time

from app.models import Client, FinancialSale
from app.services import subscription_sync
from app.services.academy_access_service import AcademyAccessService
from app.services.academy_payment_sync import build_payment_payload


class HiloInmediato:
    def __init__(self, target, args=(), **_):
        self.target, self.args = target, args

    def start(self):
        self.target(*self.args)


@pytest.fixture(autouse=True)
def _entorno(db):
    AcademyAccessService.set_product_mapping({'AL': 'ace-learners'})
    db.session.commit()
    with freeze_time('2026-10-20 12:00:00'):
        yield


@pytest.fixture()
def ana(db):
    c = Client(full_name='Ana', email='Ana@X.com', learnation_user_id=87)
    db.session.add(c)
    db.session.commit()
    return c


def cobro(db, client, tipo, fecha):
    v = FinancialSale(client_id=client.id, mail_cliente='ana@x.com', nombre_cliente='Ana', tipo_pago=tipo,
                      monto=500.0, date=fecha, estado='Completada')
    db.session.add(v)
    db.session.commit()
    return v


def test_apagado_no_manda_nada(db, ana, monkeypatch):
    monkeypatch.delenv('ACADEMY_SUBSCRIPTIONS_PUSH', raising=False)
    with patch('app.services.learnation_service.LearnationService.report_subscription') as enviar:
        cobro(db, ana, 'AL - Seña', datetime(2026, 10, 1))
    enviar.assert_not_called()


def test_encendido_manda_la_suscripcion_con_su_ultimo_cambio(db, ana, monkeypatch):
    monkeypatch.setenv('ACADEMY_SUBSCRIPTIONS_PUSH', 'true')
    with patch.object(subscription_sync.threading, 'Thread', HiloInmediato), \
            patch('app.services.learnation_service.LearnationService.report_subscription') as enviar:
        cobro(db, ana, 'AL - Seña', datetime(2026, 10, 1))
        cobro(db, ana, 'AL - Parcial', datetime(2026, 10, 5))

    primero, segundo = [c.args[0] for c in enviar.call_args_list]
    assert (primero['work_client_id'], primero['email'], primero['learnation_user_id']) == (ana.id, 'ana@x.com', 87)
    assert (primero['product_slug'], primero['expires_at'], primero['is_deposit']) == ('ace-learners', '2026-10-08', True)
    assert (segundo['expires_at'], segundo['is_deposit'], segundo['event']['kind']) == ('2027-02-05', False, 'conversion')


def test_un_rollback_no_manda_nada(db, ana, monkeypatch):
    monkeypatch.setenv('ACADEMY_SUBSCRIPTIONS_PUSH', 'true')
    with patch.object(subscription_sync.threading, 'Thread', HiloInmediato), \
            patch('app.services.learnation_service.LearnationService.report_subscription') as enviar:
        db.session.add(FinancialSale(client_id=ana.id, tipo_pago='AL - Seña', monto=50.0, date=datetime(2026, 10, 1),
                                     estado='Completada'))
        db.session.flush()
        db.session.rollback()
        db.session.commit()
    enviar.assert_not_called()


def test_el_aviso_del_pago_lleva_el_vencimiento_de_la_suscripcion(db, ana):
    cobro(db, ana, 'AL - Parcial', datetime(2026, 9, 1))
    cuota = cobro(db, ana, 'AL - Cuota', datetime(2026, 10, 1))
    # Antes la cuota compraba días (la próxima cuota + gracia o 4 meses desde ella): ahora manda la suscripción.
    assert build_payment_payload(cuota)['expires_at'] == date(2027, 1, 1).isoformat()


def test_al_registrarse_reenvia_la_que_dio_404(db, monkeypatch):
    """Luis Martínez Cabrera (29/10/2026): la venta salió antes de que tuviera cuenta, dio 404 y quedó
    por hecha. Al registrarse en la Academia le llega."""
    from app.models import Subscription

    monkeypatch.setenv('ACADEMY_SUBSCRIPTIONS_PUSH', 'true')
    luis = Client(full_name='Luis', email='luis@x.com')
    db.session.add(luis)
    db.session.commit()
    with patch('app.services.learnation_service.LearnationService.report_subscription'):
        cobro(db, luis, 'AL - Parcial', datetime(2026, 10, 1))
    sub = Subscription.query.filter_by(client_id=luis.id).one()
    sub.academy_synced_at = datetime(2026, 10, 20, 12, 0, 1)
    db.session.commit()

    with patch.object(subscription_sync.threading, 'Thread', HiloInmediato), \
            patch('app.services.learnation_service.LearnationService.report_subscription') as enviar:
        subscription_sync.al_registrarse(luis)
    enviado = enviar.call_args.args[0]
    assert (enviado['email'], enviado['product_slug']) == ('luis@x.com', 'ace-learners')
