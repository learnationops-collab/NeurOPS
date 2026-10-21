"""El evento Momentum de cada closer (app/agendas_v2/momentum.py) y los avisos de la Academia.

Mismo escenario que test_api_academia: lunes 5 de octubre de 2026, 12:00 UTC (09:00 en Buenos Aires), un
closer con Google conectado y horario de ventas de 10 a 12.
"""
# ruff: noqa: F811  (los fixtures se importan de test_api_academia)

from datetime import datetime

from app.agendas_v2 import servicio
from app.agendas_v2.modelos import SchedEvento
from app.models import Appointment, User
from tests.agendas_v2.test_api_academia import (  # noqa: F401  (fixtures)
    BASE,
    LUNES_10,
    H,
    _del_lunes,
    _entorno,
    _horarios,
    _momentum,
    closer,
    google,
    whatsapp,
)

HORA = 3600000
LUNES_14_A_16 = {'1': [['14:00', '16:00']]}


def _persona(email='allan@thelearnation.com'):
    servicio.guardar_doc('personas', 'p-allan', {'nombre': 'Allan', 'email': email, 'rol': 'closer',
                                                 'tz': 'America/Argentina/Buenos_Aires'})


def _funnel(fid='fu-m', tipo='momentum', activo=True):
    servicio.guardar_doc('funnels', fid, {'nombre': 'Momentum ' + fid, 'tipo': tipo, 'activo': activo})


def _evento(eid='ev-m', funnel='fu-m', **campos):
    datos = {'nombre': 'Momentum Allan', 'persona': 'p-allan', 'funnel': funnel, 'duracion': 30, 'margen': 15,
             'reservas': {'modo': 'dias', 'n': 5}, 'antel': {'n': 0, 'u': 'min'}, 'paso': {'n': 15, 'u': 'min'},
             'horario': LUNES_14_A_16, **campos}
    servicio.guardar_doc('eventos', eid, datos)


def test_sin_evento_momentum_todo_sigue_como_antes(client, db, closer):
    _persona()
    _funnel(tipo='setting')
    _evento(funnel='fu-m')  # su funnel no es Momentum: no cuenta
    r = _horarios(client, email='allan@thelearnation.com', ventas=True)
    assert _del_lunes(r) == [LUNES_10, LUNES_10 + HORA] and r.json['evento_momentum'] is None


def test_con_evento_momentum_manda_su_sesion_su_margen_y_su_horario(client, db, closer):
    _persona()
    _funnel()
    _evento()
    r = _horarios(client, email='allan@thelearnation.com', ventas=True, dias=21)
    # 30 min + 15 de margen, de 14 a 16 (horario del evento, no el de ventas de 10 a 12).
    lunes_14 = LUNES_10 + 4 * HORA
    assert _del_lunes(r) == [lunes_14, lunes_14 + 45 * 60000, lunes_14 + 90 * 60000]
    ev = r.json['evento_momentum']
    assert ev == {'id': 'ev-m', 'nombre': 'Momentum Allan', 'duracion': 30, 'margen': 15, 'dias': 5,
                  'antel_min': 0, 'paso_min': 15, 'horario_propio': True}
    # Nunca más días que los que pidió la Academia.
    assert _horarios(client, email='allan@thelearnation.com', ventas=True, dias=2).json['evento_momentum']['dias'] == 2


def test_sin_horario_propio_usa_el_de_ventas_y_un_funnel_pausado_no_cuenta(client, db, closer):
    _persona()
    _funnel()
    _evento(horario={})
    r = _horarios(client, email='allan@thelearnation.com', ventas=True)
    assert _del_lunes(r) == [LUNES_10, LUNES_10 + 45 * 60000, LUNES_10 + 90 * 60000]
    assert r.json['evento_momentum']['horario_propio'] is False
    _funnel(activo=False)
    assert _horarios(client, email='allan@thelearnation.com', ventas=True).json['evento_momentum'] is None


def test_con_varios_eventos_momentum_vale_el_ultimo_editado(client, db, closer):
    _persona()
    _funnel()
    _evento('ev-a', duracion=20)
    _evento('ev-b', duracion=40)
    db.session.get(SchedEvento, 'ev-a').actualizado_en = datetime(2026, 10, 5, 11)
    db.session.get(SchedEvento, 'ev-b').actualizado_en = datetime(2026, 10, 1)
    db.session.commit()
    r = _horarios(client, email='allan@thelearnation.com', ventas=True)
    assert r.json['evento_momentum']['id'] == 'ev-a'


def test_la_reserva_toma_la_sesion_del_evento_y_guarda_el_margen(client, db, closer, google, whatsapp):
    _persona()
    _funnel()
    _evento()
    r = _momentum(client, duracion=60)
    assert r.status_code == 200 and r.json['duracion'] == 30 and r.json['margen'] == 15
    assert r.json['evento_momentum']['id'] == 'ev-m'
    appt = db.session.get(Appointment, r.json['appointment_id'])
    assert appt.agenda_payload['duracion_min'] == 30 and appt.agenda_payload['margen_min'] == 15
    assert servicio._bloque_min(appt) == 45
    assert (google['crear'][0]['fin'] - google['crear'][0]['inicio']).seconds == 30 * 60


def test_sin_evento_el_margen_de_la_academia_queda_en_la_agenda(client, db, closer):
    r = _momentum(client, margen=10)
    appt = db.session.get(Appointment, r.json['appointment_id'])
    assert appt.agenda_payload['margen_min'] == 10 and r.json['evento_momentum'] is None


def test_mover_una_momentum_le_avisa_al_closer(client, db, closer, whatsapp):
    _momentum(client)
    whatsapp.clear()
    cuerpo = {'email': 'allan@thelearnation.com', 'inicio': LUNES_10 + HORA, 'duracion': 45, 'ventas': True}
    r = client.patch(f'{BASE}/reservas/evt1', json=cuerpo, headers=H)
    assert r.status_code == 200 and r.json['aviso'] is True
    assert whatsapp[0]['numero'] == '5491100001111' and whatsapp[0]['fuente'] == 'Momentum Session · MOVIDA'
    assert whatsapp[0]['lead'] == 'Ana' and whatsapp[0]['hora'] == '11:00 am'


def test_aviso_de_una_momentum_agendada_por_fuera(client, db, closer, whatsapp):
    alumno = {'nombre': 'Ana', 'email': 'ana@mail.com', 'telefono': '+549111'}
    cuerpo = {'email': 'Allan@TheLearnation.com', 'alumno': alumno,
              'sesion': 'Momentum de cierre', 'inicio': '2026-10-06T13:00:00Z', 'tipo': 'cancelada'}
    r = client.post(f'{BASE}/avisos', json=cuerpo, headers=H)
    assert r.status_code == 200 and r.json == {'enviado': True}
    assert whatsapp[0]['fuente'] == 'Momentum de cierre · CANCELADA' and whatsapp[0]['telefono'] == '+549111'
    assert whatsapp[0]['dia'] == 'martes 6' and whatsapp[0]['hora'] == '10:00 am'
    assert client.post(f'{BASE}/avisos', json={**cuerpo, 'tipo': 'otra'}, headers=H).status_code == 400
    assert client.post(f'{BASE}/avisos', json={**cuerpo, 'inicio': 'ayer'}, headers=H).status_code == 400
    assert client.post(f'{BASE}/avisos', json={**cuerpo, 'email': 'nadie@x.com'}, headers=H).status_code == 404
    assert client.post(f'{BASE}/avisos', json=cuerpo).status_code == 401
    closer.two_chat_number = None
    db.session.commit()
    r = client.post(f'{BASE}/avisos', json={**cuerpo, 'inicio': LUNES_10}, headers=H)
    assert r.json == {'enviado': False, 'error': 'sin_numero'}


def test_un_funnel_momentum_no_tiene_pagina_publica(db):
    _persona()
    _funnel()
    _evento()
    e = servicio.buscar(servicio.colecciones(), 'eventos', 'ev-m')
    servicio.guardar_doc('eventos', 'ev-m', {**e, 'publicado': servicio.config_de(e, None)})
    d = servicio.colecciones()
    assert servicio.evento_publico(d, 'ev-m') is None
    assert servicio.evento_disponible(d, 'momentum-fu-m', e['slug']) is None
    # El mismo evento en un funnel de setting sí se sirve.
    _funnel(tipo='setting')
    assert servicio.evento_publico(servicio.colecciones(), 'ev-m') is not None


def test_el_closer_asocia_su_evento_solo_a_un_funnel_momentum(db, closer):
    _persona()
    _funnel()
    _funnel('fu-s', tipo='setting')
    u = db.session.get(User, closer.id)
    e = servicio.guardar_evento_de_closer(u, 'ev-1', {'nombre': 'Sesión', 'funnel': 'fu-s', 'horario': LUNES_14_A_16})
    assert e['funnel'] == '' and e['horario'] is None
    e = servicio.guardar_evento_de_closer(u, 'ev-1', {'funnel': 'fu-m', 'horario': LUNES_14_A_16})
    assert e['funnel'] == 'fu-m' and e['horario'][1] == [['14:00', '16:00']]
    # Editar otro campo no le saca el funnel.
    e = servicio.guardar_evento_de_closer(u, 'ev-1', {'margen': 15})
    assert e['funnel'] == 'fu-m' and e['margen'] == 15 and '"horario"' in e['publicado']
    listado = servicio.eventos_de_closer(u)
    assert listado['funnels_momentum'] == [{'id': 'fu-m', 'nombre': 'Momentum fu-m', 'activo': True}]
