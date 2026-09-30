"""`GET/POST /api/closer/deck/daily-report`: el closer reporta hoy o AYER, nada más.

Pedido del usuario: "que me pueda permitir reportar el día de ayer". Antes el endpoint aceptaba
cualquier fecha pasada (capada a hoy) y el frontend la fijaba en hoy; ahora la ventana es hoy o
ayer en la zona del CLOSER, y cualquier otra fecha es un 400 explícito en vez de un "hoy"
silencioso.

Todas las horas se congelan en UTC (el servidor corre en UTC) y se barren alrededor de la
medianoche LOCAL del closer: La Paz es UTC-4, así que su medianoche es las 04:00 UTC.
"""
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, CloserDailyReport

URL = '/api/closer/deck/daily-report'

# 30/09 a las 11:00 en La Paz.
MEDIODIA = '2026-09-30 15:00:00'


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='cerrador', email='cerrador@neuro.com',
                     timezone='America/La_Paz')


def agenda(db, closer, cuando, **campos):
    cliente = Client(full_name='Ana Gomez', email=f'ana{cuando:%d%H%M}@x.com')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=cuando, **campos)
    db.session.add(appt)
    db.session.commit()
    return appt


def estado(client, auth_headers, usuario, **params):
    return client.get(URL, query_string=params, headers=auth_headers(usuario))


def enviar(client, auth_headers, usuario, **payload):
    payload.setdefault('slots', 5)
    return client.post(URL, json=payload, headers=auth_headers(usuario))


# --- Qué día se puede pedir -------------------------------------------------------------------

@freeze_time(MEDIODIA)
def test_sin_fecha_es_hoy_del_closer_y_dice_cual_es_ayer(client, db, closer, auth_headers):
    r = estado(client, auth_headers, closer)

    assert r.status_code == 200
    body = r.get_json()
    assert body['date'] == '2026-09-30'
    assert body['today'] == '2026-09-30'
    assert body['yesterday']['date'] == '2026-09-29'
    assert body['sent'] is False


@freeze_time(MEDIODIA)
def test_ayer_se_puede_consultar(client, db, closer, auth_headers):
    r = estado(client, auth_headers, closer, date='2026-09-29')

    assert r.status_code == 200
    assert r.get_json()['date'] == '2026-09-29'
    assert r.get_json()['today'] == '2026-09-30'


@freeze_time(MEDIODIA)
@pytest.mark.parametrize('fecha,motivo', [
    ('2026-09-28', 'Solo se puede reportar hoy o ayer.'),
    ('2026-09-01', 'Solo se puede reportar hoy o ayer.'),
    ('2026-10-01', 'Ese día todavía no llegó'),
    ('2027-01-01', 'Ese día todavía no llegó'),
    ('30/09/2026', 'Fecha inválida'),
    ('ayer', 'Fecha inválida'),
])
def test_cualquier_otro_dia_es_un_400_en_la_consulta_y_en_el_envio(client, db, closer,
                                                                   auth_headers, fecha, motivo):
    for r in (estado(client, auth_headers, closer, date=fecha),
              enviar(client, auth_headers, closer, date=fecha)):
        assert r.status_code == 400
        body = r.get_json()
        assert motivo in body['error']
        # Lo que el frontend necesita para volver a la ventana válida.
        assert (body['today'], body['yesterday']) == ('2026-09-30', '2026-09-29')

    assert CloserDailyReport.query.count() == 0


@pytest.mark.parametrize('instante,hoy,ayer,anteayer,manana', [
    # 23:59:59 del 30/09 en La Paz: todavía es 30.
    ('2026-10-01 03:59:59', '2026-09-30', '2026-09-29', '2026-09-28', '2026-10-01'),
    # 00:00:00 del 01/10 en La Paz: ya es 01, y el 30 pasó a ser "ayer".
    ('2026-10-01 04:00:00', '2026-10-01', '2026-09-30', '2026-09-29', '2026-10-02'),
    # 00:30 del 01/10 en La Paz.
    ('2026-10-01 04:30:00', '2026-10-01', '2026-09-30', '2026-09-29', '2026-10-02'),
    # 20:00 del 30/09 en La Paz: en UTC ya es 01/10, pero para el closer sigue siendo 30.
    ('2026-10-01 00:00:00', '2026-09-30', '2026-09-29', '2026-09-28', '2026-10-01'),
])
def test_la_ventana_cruza_la_medianoche_en_la_zona_del_closer(client, db, closer, auth_headers,
                                                             instante, hoy, ayer, anteayer, manana):
    with freeze_time(instante):
        assert estado(client, auth_headers, closer).get_json()['date'] == hoy
        assert estado(client, auth_headers, closer, date=hoy).status_code == 200
        assert estado(client, auth_headers, closer, date=ayer).status_code == 200
        assert estado(client, auth_headers, closer, date=anteayer).status_code == 400
        assert estado(client, auth_headers, closer, date=manana).status_code == 400


def test_la_ventana_es_la_del_closer_no_la_del_servidor(client, db, make_user, auth_headers):
    """El mismo instante es 30/09 en La Paz y ya 01/10 en Madrid."""
    madrid = make_user(role='closer', username='madrid', timezone='Europe/Madrid')
    la_paz = make_user(role='closer', username='lapaz', timezone='America/La_Paz')

    with freeze_time('2026-09-30 23:00:00'):
        assert estado(client, auth_headers, madrid).get_json()['today'] == '2026-10-01'
        assert estado(client, auth_headers, la_paz).get_json()['today'] == '2026-09-30'
        assert estado(client, auth_headers, madrid, date='2026-09-29').status_code == 400
        assert estado(client, auth_headers, la_paz, date='2026-09-29').status_code == 200


# --- Enviar el reporte de ayer ----------------------------------------------------------------

@freeze_time(MEDIODIA)
def test_el_reporte_de_ayer_se_guarda_con_la_fecha_de_ayer(client, db, closer, auth_headers):
    r = enviar(client, auth_headers, closer, date='2026-09-29', slots=6,
               reflections={'victory': 'cerré a Ana', 'opportunity': 'confirmar antes'})

    assert r.status_code == 200
    body = r.get_json()
    assert body['date'] == '2026-09-29'
    assert body['late'] is True
    assert body['message'] == 'Reporte de ayer enviado con éxito'

    reporte = CloserDailyReport.query.one()
    assert reporte.date == datetime(2026, 9, 29).date()
    assert reporte.slots == 6
    assert reporte.reflection_victory == 'cerré a Ana'
    # Cuándo se mandó: hoy, no el día reportado.
    assert reporte.created_at == datetime(2026, 9, 30, 15, 0)


@freeze_time(MEDIODIA)
def test_sin_fecha_el_envio_sigue_siendo_de_hoy(client, db, closer, auth_headers):
    r = enviar(client, auth_headers, closer)

    assert r.status_code == 200
    assert r.get_json()['date'] == '2026-09-30'
    assert r.get_json()['late'] is False
    assert r.get_json()['message'] == 'Reporte del día enviado con éxito'
    assert CloserDailyReport.query.one().date == datetime(2026, 9, 30).date()


def test_reenviar_ayer_actualiza_el_mismo_reporte_y_su_hora_de_envio(client, db, closer, auth_headers):
    with freeze_time('2026-09-30 01:00:00'):  # 29/09 21:00 en La Paz: todavía era "hoy"
        assert enviar(client, auth_headers, closer, slots=4).status_code == 200
    with freeze_time(MEDIODIA):
        assert enviar(client, auth_headers, closer, date='2026-09-29', slots=7).status_code == 200

    reporte = CloserDailyReport.query.one()
    assert (reporte.date, reporte.slots) == (datetime(2026, 9, 29).date(), 7)
    assert reporte.created_at == datetime(2026, 9, 30, 15, 0)


@freeze_time(MEDIODIA)
def test_el_reporte_de_ayer_se_calcula_con_las_llamadas_de_ayer(client, db, closer, auth_headers):
    # 29/09 15:00 en La Paz (19:00 UTC): una llamada de ayer con su resultado.
    agenda(db, closer, datetime(2026, 9, 29, 19, 0), result='Confirmado', closer_result='Show up',
           closer_processed=True)
    # 30/09 10:00 en La Paz: una de hoy, que no es de ayer.
    agenda(db, closer, datetime(2026, 9, 30, 14, 0), result='Confirmado', closer_result='No show',
           closer_processed=True)

    enviar(client, auth_headers, closer, date='2026-09-29')

    reporte = CloserDailyReport.query.one()
    assert reporte.first_call_scheduled == 1
    assert reporte.first_call_attended == 1
    assert reporte.first_call_no_show == 0


# --- "Ayer quedó sin reportar" ----------------------------------------------------------------

@freeze_time(MEDIODIA)
def test_ayer_con_agendas_y_sin_reporte_queda_sin_reportar(client, db, closer, auth_headers):
    agenda(db, closer, datetime(2026, 9, 29, 19, 0), closer_result='Pendiente')

    ayer = estado(client, auth_headers, closer).get_json()['yesterday']

    assert ayer == {'date': '2026-09-29', 'sent': False, 'agendas': 1, 'unreported': True}


@freeze_time(MEDIODIA)
def test_mandar_el_de_ayer_apaga_el_aviso(client, db, closer, auth_headers):
    agenda(db, closer, datetime(2026, 9, 29, 19, 0), closer_result='Pendiente')

    enviar(client, auth_headers, closer, date='2026-09-29')

    hoy = estado(client, auth_headers, closer).get_json()
    assert hoy['yesterday']['sent'] is True
    assert hoy['yesterday']['unreported'] is False
    assert hoy['sent'] is False  # el de hoy sigue pendiente
    del_dia = estado(client, auth_headers, closer, date='2026-09-29').get_json()
    assert del_dia['sent'] is True
    assert del_dia['sent_at'].startswith('2026-09-30T15:00')


@freeze_time(MEDIODIA)
def test_ayer_sin_agendas_no_es_una_deuda(client, db, closer, auth_headers):
    """Un domingo sin agendas no se avisa: mismo criterio que la constancia de la dirección."""
    ayer = estado(client, auth_headers, closer).get_json()['yesterday']

    assert ayer['agendas'] == 0
    assert ayer['unreported'] is False


@freeze_time('2026-09-30 03:30:00')  # 29/09 23:30 en La Paz: para el closer, ayer es el 28
def test_ayer_se_mide_en_la_zona_del_closer(client, db, closer, auth_headers):
    # 28/09 19:00 en La Paz (28/09 23:00 UTC): ayer para el closer, anteayer para el servidor.
    agenda(db, closer, datetime(2026, 9, 28, 23, 0), closer_result='Pendiente')
    # 29/09 01:00 en La Paz (29/09 05:00 UTC): hoy para el closer, ayer para el servidor.
    agenda(db, closer, datetime(2026, 9, 29, 5, 0), closer_result='Pendiente')

    ayer = estado(client, auth_headers, closer).get_json()['yesterday']

    assert ayer['date'] == '2026-09-28'
    assert ayer['agendas'] == 1
    assert ayer['unreported'] is True
