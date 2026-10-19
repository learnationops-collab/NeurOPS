"""La baja se le avisa a la Academia, y ya no le corta el acceso (pedido del 19/10/2026).

Antes (pedido del 30/09/2026) la baja le hacía vencer HOY el producto que pagó. Ahora, venga de
«Dar de baja», de «No va a pagar» o de su reversión, se le manda a la Academia el estado de pago del
cliente (`academy_payment_status`) con la baja adentro: allá se cierra (o se reabre) el proceso del
alumno, y el acceso sigue hasta su vencimiento. Es una llamada a otro sistema y corre después de que
la baja quedó guardada: si la Academia falla, la baja queda igual y la respuesta lo dice.
"""
import copy
import json
from datetime import date, datetime
from pathlib import Path
from unittest.mock import patch

import pytest

from app.models import Appointment, Client, Enrollment, FinancialSale, Integration, Payment, Program
from app.services import baja_service
from app.services.closer_followup_service import CloserFollowUpService
from app.services.learnation_service import LearnationAPIError, LearnationService

CONTRATO = (Path(__file__).resolve().parents[2] / 'frontend' / 'src' / 'components' / 'ficha'
            / '__fixtures__' / 'reportes.json')
REPORTES = json.loads(CONTRATO.read_text(encoding='utf-8'))


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='vendedor', email='vendedor@neuro.com')


@pytest.fixture()
def alumno(db, closer):
    """Compró RR (parcial, debe 600), es alumno en la Academia con el id 87 y está en cobro."""
    programa = Program(name='RR', price=1000.0)
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', total_amount=1000.0, learnation_user_id=87)
    db.session.add_all([programa, cliente, Integration(
        key='learnation_academy', name='Academia',
        payload_config={'product_mapping': {'RR': 'residency-roadmap'}})])
    db.session.commit()
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id, closer_id=closer.id,
                             enrollment_date=datetime(2026, 8, 1))
    db.session.add_all([inscripcion, FinancialSale(
        client_id=cliente.id, mail_cliente='ana@x.com', tipo_pago='RR - Parcial', monto=400.0,
        estado='Completada', date=datetime(2026, 8, 1), email_vendedor='vendedor@neuro.com')])
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=datetime(2026, 8, 1, 15),
                       closer_result='Show up', closer_processed=True, seguimiento_tipo='cerrada',
                       seguimiento_sub='Seguimiento de cobro', seguimiento_intento=1,
                       seguimiento_realizado=False, fecha_seguimiento='2026-09-29')
    db.session.add_all([Payment(enrollment_id=inscripcion.id, amount=400.0, status='completed',
                                date=date(2026, 8, 1)), appt])
    db.session.commit()
    return appt


@pytest.fixture()
def academia(monkeypatch):
    """(aviso del estado, asignación de producto). La asignación no se tiene que llamar nunca."""
    monkeypatch.setenv('ACADEMY_API_TOKEN', 'token-de-salida')
    with patch.object(LearnationService, 'report_payment_status', return_value={'user_id': 87}) as estado, \
            patch.object(LearnationService, 'assign_product') as asigna:
        yield estado, asigna


def _baja(client, auth_headers, closer, appt, motivo='Se mudó'):
    return client.post(f'/api/ficha/{appt.id}/baja', json={'motivo': motivo}, headers=auth_headers(closer))


def _no_va_a_pagar(client, auth_headers, closer, appt):
    return client.post(f'/api/ficha/{appt.id}/resultado',
                       json=copy.deepcopy(REPORTES['cobro_no_va_a_pagar'])['datos'],
                       headers=auth_headers(closer))


def test_dar_de_baja_avisa_a_la_academia_y_no_corta_el_acceso(client, db, alumno, closer, auth_headers, academia):
    estado, asigna = academia

    r = _baja(client, auth_headers, closer, alumno)

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['acceso_academia'] == {'estado': 'avisado', 'motivo': None}
    payload = estado.call_args.args[0]
    assert payload['work_client_id'] == alumno.client_id
    assert payload['baja']['motivo'] == 'Se mudó'
    asigna.assert_not_called()
    assert db.session.get(Client, alumno.client_id).academy_expires_at is None


def test_no_va_a_pagar_tambien_avisa(client, db, alumno, closer, auth_headers, academia):
    r = _no_va_a_pagar(client, auth_headers, closer, alumno)

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['acceso_academia']['estado'] == 'avisado'
    academia[1].assert_not_called()


def test_revertir_la_baja_tambien_avisa(client, db, alumno, closer, auth_headers, academia):
    estado, _ = academia
    _baja(client, auth_headers, closer, alumno)
    estado.reset_mock()

    r = client.post(f'/api/ficha/{alumno.id}/revertir-baja', json={}, headers=auth_headers(closer))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['acceso_academia']['estado'] == 'avisado'
    assert estado.call_args.args[0]['baja'] is None


def test_si_la_academia_falla_la_baja_queda_igual_y_se_dice(client, db, alumno, closer, auth_headers, academia):
    academia[0].side_effect = LearnationAPIError('Too Many Requests', status_code=429)

    r = _baja(client, auth_headers, closer, alumno)

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['acceso_academia']['estado'] == 'no_avisado'
    c = db.session.get(Client, alumno.client_id)
    assert c.baja_at is not None
    assert CloserFollowUpService._client_debt(c.id) == 0.0


def test_si_no_es_alumno_de_la_academia_se_dice(client, db, alumno, closer, auth_headers, academia):
    academia[0].side_effect = LearnationAPIError('No existe', status_code=404)

    r = _baja(client, auth_headers, closer, alumno)

    assert r.get_json()['acceso_academia'] == {'estado': 'sin_cuenta', 'motivo': None}


def test_una_accion_que_no_da_de_baja_no_avisa(client, db, alumno, closer, auth_headers, academia):
    r = client.post(f'/api/ficha/{alumno.id}/nota', json={'texto': 'Hablé con ella'},
                    headers=auth_headers(closer))

    assert r.status_code in (200, 201), r.get_json()
    assert 'acceso_academia' not in r.get_json()
    academia[0].assert_not_called()


def test_un_cliente_que_ya_estaba_de_baja_no_vuelve_a_avisar(client, db, alumno, closer, auth_headers, academia):
    baja_service.dar_de_baja(db.session.get(Client, alumno.client_id), 'Antes', closer)
    db.session.commit()
    baja_service.bajas_sin_avisar_academia()  # lo que anotó esa baja vieja no es de este pedido

    r = _no_va_a_pagar(client, auth_headers, closer, alumno)

    assert 'acceso_academia' not in r.get_json()
    academia[0].assert_not_called()


def test_el_guardado_viejo_del_mazo_tambien_avisa(client, db, alumno, closer, auth_headers, academia):
    r = client.post(f'/api/closer/deck/{alumno.id}', json={'contact_result': 'no_paga'},
                    headers=auth_headers(closer))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['acceso_academia']['estado'] == 'avisado'
    academia[1].assert_not_called()


def test_sin_token_de_la_academia_la_baja_queda_y_se_dice(client, db, alumno, closer, auth_headers, monkeypatch):
    monkeypatch.delenv('ACADEMY_API_TOKEN', raising=False)

    r = _baja(client, auth_headers, closer, alumno)

    assert r.get_json()['acceso_academia']['estado'] == 'no_avisado'
    assert db.session.get(Client, alumno.client_id).baja_at is not None
