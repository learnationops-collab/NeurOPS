"""La baja también le quita el acceso a la Academia (pedido del 30/09/2026).

Venga de «Dar de baja» o de «No va a pagar», al que se da de baja se le hace vencer HOY el producto
que pagó (la Academia no permite borrar un acceso). Es una llamada a otro sistema y corre después
de que la baja quedó guardada: si la Academia falla, la baja queda igual y la respuesta lo dice.
"""
import copy
import json
from datetime import date, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app import db as _db
from app.models import (
    Appointment, Client, ClientComment, Enrollment, FinancialSale, Integration, Payment, Program,
)
from app.services import baja_service, ficha_academia, ficha_fulfillment_service
from app.services.closer_followup_service import CloserFollowUpService
from app.services.learnation_service import LearnationAPIError
from app.services.user_time_service import hoy_del_usuario

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
        mail_cliente='ana@x.com', tipo_pago='RR - Parcial', monto=400.0, estado='Completada',
        date=datetime(2026, 8, 1), email_vendedor='vendedor@neuro.com')])
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
def academia():
    with patch.object(ficha_academia, 'LearnationService') as escribe, \
            patch.object(ficha_fulfillment_service, 'LearnationService') as busca:
        busca.check_user.return_value = {'exists': False}
        yield SimpleNamespace(escribe=escribe, busca=busca)


def _baja(client, auth_headers, closer, appt, motivo='Se mudó'):
    return client.post(f'/api/ficha/{appt.id}/baja', json={'motivo': motivo}, headers=auth_headers(closer))


def _no_va_a_pagar(client, auth_headers, closer, appt):
    return client.post(f'/api/ficha/{appt.id}/resultado',
                       json=copy.deepcopy(REPORTES['cobro_no_va_a_pagar'])['datos'],
                       headers=auth_headers(closer))


def test_dar_de_baja_hace_vencer_hoy_el_acceso(client, db, alumno, closer, auth_headers, academia):
    hoy = hoy_del_usuario(closer).isoformat()

    r = _baja(client, auth_headers, closer, alumno)

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['acceso_academia']['estado'] == 'quitado'
    academia.escribe.assign_product.assert_called_once_with(87, 'residency-roadmap', expires_at=hoy)
    c = db.session.get(Client, alumno.client_id)
    assert c.academy_expires_at.date().isoformat() == hoy
    assert ClientComment.query.filter(ClientComment.text.like('Se le quitó el acceso a la Academia%')).count() == 1


def test_no_va_a_pagar_tambien_corta_el_acceso(client, db, alumno, closer, auth_headers, academia):
    r = _no_va_a_pagar(client, auth_headers, closer, alumno)

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['acceso_academia']['estado'] == 'quitado'
    academia.escribe.assign_product.assert_called_once()


def test_si_la_academia_falla_la_baja_queda_igual_y_se_avisa(client, db, alumno, closer, auth_headers,
                                                             academia):
    academia.escribe.assign_product.side_effect = LearnationAPIError('Too Many Requests', status_code=429)

    r = _baja(client, auth_headers, closer, alumno)

    assert r.status_code == 200, r.get_json()
    acceso = r.get_json()['acceso_academia']
    assert acceso['estado'] == 'no_quitado'
    assert 'La Academia no aceptó el cambio' in acceso['motivo']
    c = db.session.get(Client, alumno.client_id)
    assert c.baja_at is not None
    assert CloserFollowUpService._client_debt(c.id) == 0.0
    assert c.academy_expires_at is None


def test_a_quien_nunca_tuvo_cuenta_no_hay_nada_que_cortar(client, db, alumno, closer, auth_headers,
                                                          academia):
    db.session.get(Client, alumno.client_id).learnation_user_id = None
    db.session.commit()

    r = _baja(client, auth_headers, closer, alumno)

    assert r.get_json()['acceso_academia'] == {'estado': 'sin_cuenta', 'motivo': None}
    academia.escribe.assign_product.assert_not_called()


def test_una_accion_que_no_da_de_baja_no_toca_la_academia(client, db, alumno, closer, auth_headers,
                                                          academia):
    r = client.post(f'/api/ficha/{alumno.id}/nota', json={'texto': 'Hablé con ella'},
                    headers=auth_headers(closer))

    assert r.status_code in (200, 201), r.get_json()
    assert 'acceso_academia' not in r.get_json()
    academia.busca.check_user.assert_not_called()
    academia.escribe.assign_product.assert_not_called()


def test_un_cliente_que_ya_estaba_de_baja_no_vuelve_a_cortar(client, db, alumno, closer, auth_headers,
                                                             academia):
    baja_service.dar_de_baja(db.session.get(Client, alumno.client_id), 'Antes', closer)
    db.session.commit()
    baja_service.bajas_sin_quitar_academia()  # lo que anotó esa baja vieja no es de este pedido

    r = _no_va_a_pagar(client, auth_headers, closer, alumno)

    assert 'acceso_academia' not in r.get_json()
    academia.escribe.assign_product.assert_not_called()


def test_una_baja_anotada_que_despues_se_deshizo_no_corta_nada(db, alumno, closer, academia):
    cliente = db.session.get(Client, alumno.client_id)
    baja_service.dar_de_baja(cliente, 'Se mudó', closer)
    _db.session.rollback()  # la acción falló después de marcarla: la baja no existe

    assert ficha_academia.quitar_accesos_de_bajas(closer) is None
    academia.escribe.assign_product.assert_not_called()


def test_el_guardado_viejo_del_mazo_tambien_corta_el_acceso(client, db, alumno, closer, auth_headers,
                                                             academia):
    r = client.post(f'/api/closer/deck/{alumno.id}', json={'contact_result': 'no_paga'},
                    headers=auth_headers(closer))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['acceso_academia']['estado'] == 'quitado'
    academia.escribe.assign_product.assert_called_once()
