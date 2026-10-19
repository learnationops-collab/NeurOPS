"""El avance del alumno en la foto de la Academia (pedido del 19/10/2026).

Un masivo de la Academia (`/students/progress`) trae el avance de todos los alumnos en proceso y se
guarda en la foto de cada cliente: la cartera del closer muestra dónde está cada uno y si va al día.
"""
from datetime import datetime
from unittest.mock import patch

import pytest

from app.models import AcademySnapshot, Client
from app.services import academy_snapshot_service
from app.services.learnation_service import LearnationAPIError, LearnationService


def _fila(**extra):
    return {'user_id': 87, 'work_id': None, 'email': 'ana@x.com', 'stage': 'Scale Session', 'stage_kind': 'session',
            'stage_days': 9, 'sessions_done': 1, 'sessions_total': 5, 'next_session': 'Scale Session',
            'next_state_label': 'Sin agenda', 'late_days': 4, 'days_without_lessons': 12,
            'over_process_days': True, **extra}


@pytest.fixture(autouse=True)
def _token(monkeypatch):
    monkeypatch.setenv('ACADEMY_API_TOKEN', 'token-de-salida')


@pytest.fixture()
def ana(db):
    c = Client(full_name='Ana Gomez', email='Ana@x.com')
    db.session.add(c)
    db.session.commit()
    return c


def test_guarda_el_avance_cruzando_por_correo(db, ana):
    with patch.object(LearnationService, 'get_students_progress',
                      return_value={'data': [_fila()], 'has_more': False}) as pedido:
        r = academy_snapshot_service.sincronizar_avance()

    pedido.assert_called_once()
    assert r['cruzados'] == 1 and r['sin_cliente'] == 0
    foto = AcademySnapshot.query.filter_by(client_id=ana.id).one()
    assert foto.learnation_user_id == 87
    av = academy_snapshot_service.avance_de(foto)
    assert av['etapa'] == 'Scale Session'
    assert av['proxima_estado'] == 'Sin agenda'
    assert av['atraso'] == 4
    assert av['sesiones_hechas'] == 1 and av['sesiones_total'] == 5
    assert av['fuera_de_plazo'] is True


def test_cruza_primero_por_el_work_id_de_la_academia(db, ana):
    otro = Client(full_name='Otra', email='otra@x.com')
    db.session.add(otro)
    db.session.commit()

    with patch.object(LearnationService, 'get_students_progress',
                      return_value={'data': [_fila(work_id=otro.id)], 'has_more': False}):
        academy_snapshot_service.sincronizar_avance()

    assert AcademySnapshot.query.filter_by(client_id=otro.id).one().avance_etapa == 'Scale Session'
    assert AcademySnapshot.query.filter_by(client_id=ana.id).first() is None


def test_a_quien_ya_no_esta_en_proceso_se_le_borra_el_avance(db, ana):
    db.session.add(AcademySnapshot(client_id=ana.id, avance_etapa='Scale Session', avance_tipo='session',
                                   atraso_dias=3, avance_at=datetime(2026, 10, 1)))
    db.session.commit()

    with patch.object(LearnationService, 'get_students_progress', return_value={'data': [], 'has_more': False}):
        r = academy_snapshot_service.sincronizar_avance()

    assert r['limpiados'] == 1
    foto = AcademySnapshot.query.filter_by(client_id=ana.id).one()
    assert academy_snapshot_service.avance_de(foto) is None


def test_el_bloque_de_la_tabla_trae_el_avance(db, ana):
    with patch.object(LearnationService, 'get_students_progress',
                      return_value={'data': [_fila()], 'has_more': False}):
        academy_snapshot_service.sincronizar_avance()

    bloque = academy_snapshot_service.bloques_por_cliente([ana.id])[ana.id]
    assert bloque['avance']['etapa'] == 'Scale Session'


def test_si_la_academia_falla_no_toca_nada(db, ana):
    with patch.object(LearnationService, 'get_students_progress',
                      side_effect=LearnationAPIError('caída', status_code=500)):
        r = academy_snapshot_service.sincronizar_avance()

    assert r['error']
    assert AcademySnapshot.query.count() == 0


def test_sin_token_no_pide_nada(db, ana, monkeypatch):
    monkeypatch.delenv('ACADEMY_API_TOKEN', raising=False)

    with patch.object(LearnationService, 'get_students_progress') as pedido:
        r = academy_snapshot_service.sincronizar_avance()

    assert r['error'] == 'sin_token'
    pedido.assert_not_called()
