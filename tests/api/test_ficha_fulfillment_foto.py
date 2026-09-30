"""`GET /api/ficha/<appt>/fulfillment` deja guardada la foto de la Academia del cliente.

La pestana ya paga las peticiones a la Academia para mostrar al alumno: guardar lo que trajo es la
forma mas barata de que las tablas Clientes y Ventas tengan datos. Lo que se fija aca es que se
guarde, que la respuesta de la pestana no cambie por eso, y que un problema al guardar no le rompa
la pestana al closer. La Academia siempre es un doble.
"""
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from app.models import AcademySnapshot, Appointment, Client
from app.services import academy_snapshot_service
from app.services import ficha_fulfillment_service as ful
from app.services.learnation_service import LearnationAPIError

RESUMEN = {
    'student': {'id': 87, 'name': 'Ana Gomez', 'email': 'ana@x.com', 'phone': '+591 7123 4567',
                'role': 'student', 'active_product': {'id': 1, 'name': 'Residency Roadmap'}},
    'performance': {'streak_days': 2, 'total_study_hours': 9, 'submitted_executions': 14,
                    'completed_lessons': 5, 'total_lessons': 12, 'progress_percentage': 40},
}


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='vendedor', email='vendedor@neuro.com')


@pytest.fixture()
def lead(db, closer):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', phone='+59171234567')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id,
                       start_time=datetime.utcnow() - timedelta(days=3))
    db.session.add(appt)
    db.session.commit()
    return appt


@pytest.fixture()
def academia():
    with patch.object(ful, 'LearnationService') as doble:
        doble.check_user.return_value = {'exists': True, 'user': {'id': 87}}
        doble.get_student_summary.return_value = RESUMEN
        doble.get_student_products.return_value = {'products': []}
        yield doble


def pedir(client, auth_headers, closer, lead):
    return client.get(f'/api/ficha/{lead.id}/fulfillment', headers=auth_headers(closer))


def test_abrir_la_pestana_guarda_la_foto_del_cliente(client, db, closer, lead, academia, auth_headers):
    r = pedir(client, auth_headers, closer, lead)

    assert r.status_code == 200
    foto = AcademySnapshot.query.filter_by(client_id=lead.client_id).one()
    assert (foto.resultado, foto.ejecuciones, foto.horas_estudio, foto.racha_dias) == (
        'vinculado', 14, 9, 2)
    # Se lo encontro con su propio correo: el id queda en el cliente y la proxima vez no se busca.
    assert db.session.get(Client, lead.client_id).learnation_user_id == 87


def test_la_respuesta_de_la_pestana_no_cambia_por_guardar_la_foto(client, db, closer, lead, academia,
                                                                  auth_headers):
    con_foto = pedir(client, auth_headers, closer, lead).get_json()
    with patch.object(academy_snapshot_service, 'guardar_desde_fulfillment'):
        db.session.get(Client, lead.client_id).learnation_user_id = None
        db.session.commit()
        sin_foto = pedir(client, auth_headers, closer, lead).get_json()

    assert con_foto == sin_foto


def test_un_error_de_la_academia_queda_anotado_en_la_foto(client, db, closer, lead, academia,
                                                          auth_headers):
    academia.check_user.side_effect = LearnationAPIError('Too Many Requests', status_code=429)

    r = pedir(client, auth_headers, closer, lead)

    assert r.get_json()['error']['codigo'] == 429
    foto = AcademySnapshot.query.filter_by(client_id=lead.client_id).one()
    assert (foto.resultado, foto.error_codigo, foto.synced_at) == ('error', 429, None)


def test_si_guardar_la_foto_falla_la_pestana_responde_igual(client, db, closer, lead, academia,
                                                            auth_headers, monkeypatch):
    def explota(*_a, **_k):
        raise RuntimeError('la base se cayo')

    monkeypatch.setattr(academy_snapshot_service, '_foto_de', explota)

    r = pedir(client, auth_headers, closer, lead)

    assert r.status_code == 200
    assert r.get_json()['vinculado'] is True
    assert AcademySnapshot.query.count() == 0
