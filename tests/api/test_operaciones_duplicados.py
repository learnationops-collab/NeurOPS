"""Duplicados desde Revisar (10/10/2026): la herramienta de Operaciones que reemplaza al panel de
agendas repetidas del libro viejo (`FinancialAgendasPage`).

Revisar muestra `Appointment` y el motor de duplicados trabaja sobre `FinancialAgenda` (el espejo de
n8n/Calendly). Se decidió reusar el motor y no reimplementarlo: es reversible y ya cancela la cita de
la agenda que se descarta. Lo que estos tests fijan es justamente ese cruce, por las rutas que usa
el panel nuevo:

  · los grupos se piden con el período de Revisar (fecha de la reunión);
  · resolver con «cancelar citas» cancela la cita de la descartada —y solo esa—, así que sale de las
    vigentes de Revisar;
  · restaurar devuelve la cita a como estaba.
"""
from datetime import datetime

import pytest

from app.models import Appointment, Client, FinancialAgenda

DUPLICADOS = '/api/public/financial-agendas/duplicados'
RESOLVER = f'{DUPLICADOS}/resolver'
RESTAURAR = f'{DUPLICADOS}/restaurar'
DESCARTADAS = f'{DUPLICADOS}/descartadas'
SEPTIEMBRE = {'start_date': '2026-09-01', 'end_date': '2026-09-30', 'date_filter_by': 'meet'}


@pytest.fixture()
def operador(make_user):
    return make_user(role='operator')


@pytest.fixture()
def nerina(make_user):
    return make_user(role='closer', username='Nerina')


def _agenda(db, cuando, alta, lead='Ana Gomez', mail='ana@test.local', estado='Pendiente'):
    a = FinancialAgenda(lead=lead, mail=mail, closer='Nerina', nombre='Meta Ads', estado=estado,
                        date=cuando, created_at=alta, registro=alta.isoformat())
    db.session.add(a)
    db.session.commit()
    return a


def _cita(db, closer, cliente, cuando):
    c = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=cuando, result='Confirmado',
                    closer_result='Pendiente', origin='Meta Ads', created_at=cuando)
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture()
def reprogramo(db, nerina):
    """Ana agendó para el 10/09 y, antes de esa llamada, reservó de nuevo para el 12/09: dos agendas y
    dos citas. La que vale es la del 12 (la sugerida); la del 10 sobra."""
    ana = Client(full_name='Ana Gomez', email='ana@test.local')
    db.session.add(ana)
    db.session.commit()
    vieja = _agenda(db, datetime(2026, 9, 10, 15, 0), datetime(2026, 9, 5, 12, 0))
    nueva = _agenda(db, datetime(2026, 9, 12, 15, 0), datetime(2026, 9, 8, 12, 0))
    return {
        'vieja': vieja, 'nueva': nueva,
        'cita_vieja': _cita(db, nerina, ana, vieja.date),
        'cita_nueva': _cita(db, nerina, ana, nueva.date),
    }


def _resolver(client, cabeceras, conservada, descartar, cancelar_citas=True):
    return client.post(RESOLVER, headers=cabeceras, json={
        'conservada_id': conservada.id, 'descartar_ids': [a.id for a in descartar],
        'cancelar_citas': cancelar_citas})


def test_los_grupos_se_piden_con_el_periodo_de_revisar(client, db, operador, auth_headers, reprogramo):
    # Un par de noviembre: fuera del período, no aparece.
    _agenda(db, datetime(2026, 11, 3, 15, 0), datetime(2026, 11, 1, 12, 0), lead='Beto Diaz', mail='beto@test.local')
    _agenda(db, datetime(2026, 11, 4, 15, 0), datetime(2026, 11, 2, 12, 0), lead='Beto Diaz', mail='beto@test.local')

    r = client.get(DUPLICADOS, headers=auth_headers(operador), query_string=SEPTIEMBRE)

    assert r.status_code == 200
    grupos = r.get_json()['grupos']
    assert len(grupos) == 1
    grupo = grupos[0]
    assert sorted(a['id'] for a in grupo['agendas']) == sorted([reprogramo['vieja'].id, reprogramo['nueva'].id])
    assert grupo['conservar_sugerida_id'] == reprogramo['nueva'].id
    assert grupo['motivo'] == 'reprogramacion'
    # Cada fila trae lo que el panel muestra: fecha, closer, fuente, estado y su cita.
    fila = next(a for a in grupo['agendas'] if a['id'] == reprogramo['vieja'].id)
    assert (fila['closer'], fila['fuente'], fila['estado']) == ('Nerina', 'Meta Ads', 'Pendiente')
    assert fila['appointment_id'] == reprogramo['cita_vieja'].id


def test_resolver_cancela_solo_la_cita_de_la_descartada_y_restaurar_la_devuelve(
        client, db, operador, auth_headers, reprogramo):
    cabeceras = auth_headers(operador)
    vieja, nueva = reprogramo['vieja'], reprogramo['nueva']
    cita_vieja, cita_nueva = reprogramo['cita_vieja'], reprogramo['cita_nueva']

    assert _resolver(client, cabeceras, nueva, [vieja]).status_code == 200

    assert db.session.get(FinancialAgenda, vieja.id).duplicada_de_id == nueva.id
    assert db.session.get(Appointment, cita_vieja.id).result == 'Cancelado'
    assert db.session.get(Appointment, cita_nueva.id).result == 'Confirmado'
    # En Revisar, la cita cancelada sale de las vigentes (queda en «Descartadas»).
    tabla = client.get('/api/comercial/tabla', headers=cabeceras, query_string={
        'tabla': 'agendas', 'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30'})
    descartada = {f['id']: f['descartada'] for f in tabla.get_json()['filas']}
    assert descartada == {cita_vieja.id: True, cita_nueva.id: False}
    # Y la descartada aparece en la pestaña para deshacerla.
    assert [a['id'] for a in client.get(DESCARTADAS, headers=cabeceras).get_json()] == [vieja.id]

    assert client.post(RESTAURAR, headers=cabeceras, json={'agenda_ids': [vieja.id]}).status_code == 200

    assert db.session.get(FinancialAgenda, vieja.id).duplicada_de_id is None
    cita = db.session.get(Appointment, cita_vieja.id)
    assert (cita.result, cita.closer_result) == ('Confirmado', 'Pendiente')
    assert client.get(DESCARTADAS, headers=cabeceras).get_json() == []


def test_sin_cancelar_citas_la_cita_no_se_toca(client, db, operador, auth_headers, reprogramo):
    r = _resolver(client, auth_headers(operador), reprogramo['nueva'], [reprogramo['vieja']], cancelar_citas=False)

    assert r.status_code == 200
    assert db.session.get(FinancialAgenda, reprogramo['vieja'].id).duplicada_de_id == reprogramo['nueva'].id
    assert db.session.get(Appointment, reprogramo['cita_vieja'].id).result == 'Confirmado'


@pytest.mark.parametrize('rol', ['director_comercial', 'closer', 'setter'])
def test_resolver_duplicados_es_de_quien_opera(client, make_user, auth_headers, reprogramo, rol):
    cabeceras = auth_headers(make_user(role=rol))

    assert client.get(DUPLICADOS, headers=cabeceras, query_string=SEPTIEMBRE).status_code == 403
    assert _resolver(client, cabeceras, reprogramo['nueva'], [reprogramo['vieja']]).status_code == 403
    assert client.post(RESTAURAR, headers=cabeceras, json={'agenda_ids': [reprogramo['vieja'].id]}).status_code == 403
