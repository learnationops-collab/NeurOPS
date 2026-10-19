"""El estado de pago que se le manda a la Academia (app/services/academy_payment_status.py).

Pedido del 19/10/2026: al equipo de la Academia le importa saber si el alumno paga. Work se lo empuja
cuando cambia (un pago, el plan de cuotas, una baja) y deja un masivo para la carga inicial. La
Academia también puede dar de baja (o reabrir) a un cliente desde su lado.
"""
from datetime import date, datetime
from unittest.mock import patch

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale, InstallmentPlan
from app.services import academy_payment_status, baja_service
from app.services.installment_service import InstallmentService

TOKEN = 'token-de-la-academia-para-tests-123'
H = {'Authorization': f'Bearer {TOKEN}'}


@pytest.fixture(autouse=True)
def _entorno(monkeypatch):
    monkeypatch.setenv('ACADEMY_INBOUND_API_TOKEN', TOKEN)
    with freeze_time('2026-10-19 12:00:00'):
        yield


@pytest.fixture()
def cliente(db, make_user):
    """Compró RR en cuotas: dejó 400 de 1000 y le quedan 3 cuotas de 200 (una vencida, una pagada)."""
    c = Client(full_name='Ana Gomez', email='Ana@X.com', total_amount=1000.0, learnation_user_id=87)
    db.session.add(c)
    db.session.commit()
    closer = make_user(role='closer', username='vendedor', email='vendedor@neuro.com')
    appt = Appointment(closer_id=closer.id, client_id=c.id, start_time=datetime(2026, 8, 1, 15))
    db.session.add_all([appt, FinancialSale(
        client_id=c.id, mail_cliente='ana@x.com', tipo_pago='RR - Parcial', monto=400.0,
        estado='Completada', date=datetime(2026, 8, 1))])
    db.session.commit()
    db.session.add_all([
        InstallmentPlan(client_id=c.id, appointment_id=appt.id, programa_code='RR', numero_cuota=1,
                        monto=200.0, fecha_vencimiento=date(2026, 9, 1), estado='pagado'),
        InstallmentPlan(client_id=c.id, appointment_id=appt.id, programa_code='RR', numero_cuota=2,
                        monto=200.0, fecha_vencimiento=date(2026, 10, 1), estado='pendiente'),
        InstallmentPlan(client_id=c.id, appointment_id=appt.id, programa_code='RR', numero_cuota=3,
                        monto=200.0, fecha_vencimiento=date(2026, 11, 1), estado='pendiente'),
    ])
    db.session.commit()
    return c


def test_el_estado_dice_cuantas_cuotas_van_y_cual_vencio(db, cliente):
    e = academy_payment_status.estado(cliente)

    assert e['work_client_id'] == cliente.id
    assert e['email'] == 'ana@x.com'
    assert e['learnation_user_id'] == 87
    assert e['tipo'] == 'cuotas'
    assert e['cuotas']['total'] == 3
    assert e['cuotas']['pagadas'] == 1
    assert e['cuotas']['vencidas'] == 1
    assert e['cuotas']['vencido_monto'] == 200.0
    assert e['cuotas']['vencida_desde'] == '2026-10-01'
    assert e['cuotas']['proxima'] == {'numero': 3, 'monto': 200.0, 'vence': '2026-11-01'}
    assert [p['vence'] for p in e['cuotas']['pendientes']] == ['2026-10-01', '2026-11-01']
    assert e['pagado'] == 400.0
    assert e['ultimo_pago']['fecha'] == '2026-08-01'
    assert e['baja'] is None


def test_la_baja_viaja_en_el_estado(db, cliente):
    baja_service.dar_de_baja(cliente, 'Se mudó', None)
    db.session.commit()

    e = academy_payment_status.estado(cliente)

    assert e['baja']['motivo'] == 'Se mudó'
    assert e['saldo'] == 0.0


def test_un_cambio_del_plan_se_le_avisa_a_la_academia(db, cliente):
    cuota = InstallmentPlan.query.filter_by(client_id=cliente.id, numero_cuota=2).first()

    with patch.object(academy_payment_status, 'avisar') as avisar:
        InstallmentService.update_cuota(cuota, estado='pagado')

    avisar.assert_called_once_with([cliente.id])


def test_sin_token_de_salida_no_se_avisa_nada(db, cliente, monkeypatch):
    monkeypatch.delenv('ACADEMY_API_TOKEN', raising=False)

    with patch('app.services.academy_payment_status.threading') as hilo:
        academy_payment_status.avisar([cliente.id])

    hilo.Thread.assert_not_called()


def test_con_token_el_aviso_va_en_un_hilo(db, cliente, monkeypatch):
    monkeypatch.setenv('ACADEMY_API_TOKEN', 'token-de-salida')

    with patch('app.services.academy_payment_status.threading') as hilo:
        academy_payment_status.avisar([cliente.id, cliente.id])

    hilo.Thread.assert_called_once()


def test_el_masivo_trae_a_los_clientes_con_venta_plan_o_baja(client, db, cliente):
    db.session.add(Client(full_name='Sin nada', email='nada@x.com'))
    db.session.commit()

    r = client.get('/api/external/academy/payment-status', headers=H)

    assert r.status_code == 200, r.get_json()
    body = r.get_json()
    assert body['total'] == 1
    assert body['data'][0]['work_client_id'] == cliente.id
    assert body['has_more'] is False


def test_el_masivo_pide_token(client, db, cliente):
    assert client.get('/api/external/academy/payment-status').status_code == 401


def test_la_academia_da_de_baja_y_no_se_le_devuelve_el_aviso(client, db, cliente, monkeypatch):
    monkeypatch.setenv('ACADEMY_API_TOKEN', 'token-de-salida')

    with patch.object(academy_payment_status, '_enviar') as enviar:
        r = client.post('/api/external/academy/clients/baja', headers=H,
                        json={'email': 'ANA@x.com', 'motivo': 'Abandonó'})

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['changed'] is True
    c = db.session.get(Client, cliente.id)
    assert c.baja_motivo == 'Academia: Abandonó'
    enviar.assert_not_called()


def test_la_academia_revierte_la_baja(client, db, cliente):
    baja_service.dar_de_baja(cliente, 'Academia: Abandonó', None)
    db.session.commit()

    r = client.post('/api/external/academy/clients/baja', headers=H,
                    json={'work_client_id': cliente.id, 'revertir': True})

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['baja'] is None
    assert db.session.get(Client, cliente.id).baja_at is None


def test_la_baja_de_un_cliente_que_no_existe_da_404(client, db):
    r = client.post('/api/external/academy/clients/baja', headers=H, json={'email': 'nadie@x.com'})

    assert r.status_code == 404
