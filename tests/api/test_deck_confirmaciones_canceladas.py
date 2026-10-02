"""GET /closer/deck?step=confirmations: una agenda cancelada no se confirma más.

Reportado por el usuario (02/10/2026): las agendas canceladas o reagendadas desde Confirmación
(`result`) seguían en la columna "Por confirmar" del mazo. Llamadas ya las sacaba; Confirmación no.
"""
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='Marlon', email='marlon@thelearnation.com')


def agenda(db, closer, nombre, result):
    cli = Client(full_name=nombre, email=f'{nombre.lower()}@test.local')
    db.session.add(cli)
    db.session.flush()
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=datetime(2026, 9, 20, 15, 0),
                    result=result, closer_result='Pendiente', closer_processed=False)
    db.session.add(a)
    db.session.commit()
    return a


@freeze_time('2026-09-17 12:00:00')
@pytest.mark.parametrize('result', ['Cancelado', 'Cancelada', 'Reagendado'])
def test_una_agenda_cancelada_sale_de_por_confirmar(client, db, closer, auth_headers, result):
    viva = agenda(db, closer, 'Viva', 'Pendiente')
    cancelada = agenda(db, closer, 'Cancelada', result)

    respuesta = client.get('/api/closer/deck?step=confirmations&selected_date=2026-09-17',
                           headers=auth_headers(closer))

    assert respuesta.status_code == 200
    ids = {a['id'] for a in respuesta.get_json()}
    assert viva.id in ids
    assert cancelada.id not in ids
