"""«No va a pagar» en el seguimiento de cobro da de baja al cliente (pedido del 30/09/2026).

Antes solo cerraba el seguimiento y el cliente seguía debiendo: en la cartera «Con deuda» y en los
totales. El pedido que se manda es el de verdad: el caso `cobro_no_va_a_pagar` del contrato que
arma el árbol de Resultado (`frontend/src/components/ficha/__fixtures__/reportes.json`).
"""
import copy
import json
from datetime import date, datetime
from pathlib import Path

import pytest

from app.models import Appointment, Client, ClientComment, Enrollment, Payment, Program
from app.services import deck_escritura_service
from app.services.closer_followup_service import CloserFollowUpService

CONTRATO = (Path(__file__).resolve().parents[2] / 'frontend' / 'src' / 'components' / 'ficha'
            / '__fixtures__' / 'reportes.json')
REPORTES = json.loads(CONTRATO.read_text(encoding='utf-8'))


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='vendedor', email='vendedor@neuro.com')


@pytest.fixture()
def en_cobro(db, closer):
    """Compró RR por 1000, pagó 400 y está en el seguimiento de cobro de los 600 que debe."""
    programa = Program(name='RR', price=1000.0)
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', total_amount=1000.0)
    db.session.add_all([programa, cliente])
    db.session.commit()
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id, closer_id=closer.id,
                             enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=datetime(2026, 8, 1, 15),
                       closer_result='Show up', closer_processed=True, seguimiento_tipo='cerrada',
                       seguimiento_sub='Seguimiento de cobro', seguimiento_intento=1,
                       seguimiento_realizado=False, fecha_seguimiento='2026-09-29')
    db.session.add_all([Payment(enrollment_id=inscripcion.id, amount=400.0, status='completed',
                                date=date(2026, 8, 1)), appt])
    db.session.commit()
    return appt


def _reportar(client, auth_headers, usuario, appt, caso):
    pedido = copy.deepcopy(REPORTES[caso])
    return client.post(f'/api/ficha/{appt.id}/resultado', json=pedido['datos'],
                       headers=auth_headers(usuario))


def _comentarios_de_baja(cliente_id):
    return ClientComment.query.filter(ClientComment.client_id == cliente_id,
                                      ClientComment.text.like('Cliente dado de baja%')).count()


def test_no_va_a_pagar_da_de_baja_y_la_deuda_pasa_a_cero(client, db, en_cobro, closer, auth_headers):
    assert CloserFollowUpService._client_debt(en_cobro.client_id) == 600.0

    r = _reportar(client, auth_headers, closer, en_cobro, 'cobro_no_va_a_pagar')

    assert r.status_code == 200, r.get_json()
    c = db.session.get(Client, en_cobro.client_id)
    assert c.baja_at is not None
    assert (c.baja_motivo, c.baja_por_id) == ('No va a pagar', closer.id)
    assert CloserFollowUpService._client_debt(c.id) == 0.0
    assert _comentarios_de_baja(c.id) == 1


@pytest.mark.parametrize('caso', [c for c in REPORTES if c.startswith('cobro_') and c != 'cobro_no_va_a_pagar'])
def test_los_demas_resultados_del_cobro_no_dan_de_baja(client, db, en_cobro, closer, auth_headers, caso):
    r = _reportar(client, auth_headers, closer, en_cobro, caso)

    assert r.status_code == 200, r.get_json()
    assert db.session.get(Client, en_cobro.client_id).baja_at is None


def test_volver_a_guardar_la_agenda_despues_de_revertir_no_la_vuelve_a_dar(client, db, en_cobro,
                                                                           closer, auth_headers):
    _reportar(client, auth_headers, closer, en_cobro, 'cobro_no_va_a_pagar')
    r = client.post(f'/api/ficha/{en_cobro.id}/revertir-baja', json={}, headers=auth_headers(closer))
    assert r.status_code == 200, r.get_json()

    # La agenda sigue diciendo «No va a pagar»: guardarla otra vez (con ese resultado o con otra
    # cosa) no es un nuevo «no va a pagar».
    appt = db.session.get(Appointment, en_cobro.id)
    deck_escritura_service.aplicar_cambios(appt, {'closer_notes': 'Retomamos'}, closer)
    deck_escritura_service.aplicar_cambios(appt, {'contact_result': 'no_paga'}, closer)
    db.session.commit()

    assert db.session.get(Client, en_cobro.client_id).baja_at is None


def test_un_cliente_que_ya_estaba_de_baja_conserva_su_motivo(client, db, en_cobro, closer, auth_headers):
    from app.services import baja_service

    cliente = db.session.get(Client, en_cobro.client_id)
    baja_service.dar_de_baja(cliente, 'Se mudó', closer)
    db.session.commit()

    _reportar(client, auth_headers, closer, en_cobro, 'cobro_no_va_a_pagar')

    assert db.session.get(Client, cliente.id).baja_motivo == 'Se mudó'
    assert _comentarios_de_baja(cliente.id) == 0
