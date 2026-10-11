"""«Editar en lote» las agendas desde Revisar (10/10/2026): `POST /api/comercial/agendas/lote`.

Reemplaza la edicion masiva del Tablero de Agendas de Operaciones, que se fue con sus tablas viejas.
Lo que se fija aca:

  · solo opera Operaciones (admin y operador): la direccion, el closer y el setter entran a Revisar
    pero reciben 403;
  · se editan las agendas de Revisar (`Appointment`), no el espejo de n8n;
  · cada agenda pasa por la misma logica que la ficha, asi que el espejo del Tablero queda igual
    que si se la hubiera corregido de a una;
  · el tope del lote, los ids que no existen y lo que no se aplica en lote (Canceló, Call Confirmer).
"""
from datetime import datetime, timedelta

import pytest

from app.models import Appointment, Client, FinancialAgenda, LeadEventLog

LOTE = '/api/comercial/agendas/lote'
OPCIONES = '/api/comercial/agendas/lote/opciones'


@pytest.fixture()
def equipo(make_user):
    return {
        'operador': make_user(role='operator', username='opera', email='opera@neuro.com'),
        'admin': make_user(role='admin', username='jefa', email='jefa@neuro.com'),
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'relevo': make_user(role='closer', username='Nerina', email='nerina@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
    }


def _agenda(db, equipo, nombre, email, *, hora=0, con_espejo=False, **campos):
    """Una agenda de mañana de un lead nuevo, `hora` horas más tarde; con `con_espejo`, también su
    fila en el Tablero. Cada una a su hora: dos llamadas sin resolver a la misma hora no se le
    pueden dar al mismo closer (ver el choque en `editar_agenda`)."""
    cliente = Client(full_name=nombre, email=email)
    db.session.add(cliente)
    db.session.commit()
    manana = (datetime.utcnow() + timedelta(days=1)).replace(minute=0, second=0, microsecond=0)
    datos = dict(closer_id=equipo['closer'].id, client_id=cliente.id,
                 start_time=manana + timedelta(hours=hora),
                 origin='vsl', result='Pendiente', closer_result='Pendiente')
    datos.update(campos)
    appt = Appointment(**datos)
    db.session.add(appt)
    db.session.commit()
    if con_espejo:
        db.session.add(FinancialAgenda(nombre=appt.origin, lead=nombre, closer='vendedor', mail=email,
                                       instagram='N/A', whatsapp='N/A', estado='Pendiente',
                                       date=appt.start_time, fecha_meet=appt.start_time.isoformat()))
        db.session.commit()
    return appt


def _espejo(appt):
    return FinancialAgenda.query.filter_by(mail=appt.client.email).one()


@pytest.fixture()
def agendas(db, equipo):
    return [_agenda(db, equipo, 'Ana Gomez', 'ana@x.com'),
            _agenda(db, equipo, 'Beto Ruiz', 'beto@x.com', hora=1),
            _agenda(db, equipo, 'Caro Paz', 'caro@x.com', hora=2)]


def _lote(client, auth_headers, usuario, ids, **cambios):
    return client.post(LOTE, json={'ids': ids, 'cambios': cambios}, headers=auth_headers(usuario))


# --- Quién opera ------------------------------------------------------------------------------

@pytest.mark.parametrize('rol', ['operador', 'admin'])
def test_operaciones_edita_en_lote(client, equipo, agendas, auth_headers, rol):
    r = _lote(client, auth_headers, equipo[rol], [agendas[0].id], closer_id=equipo['relevo'].id)

    assert r.status_code == 200, r.get_json()
    assert agendas[0].closer_id == equipo['relevo'].id


@pytest.mark.parametrize('rol', ['director', 'closer', 'setter'])
def test_quien_ve_revisar_pero_no_opera_recibe_403(client, equipo, agendas, auth_headers, rol):
    """El `before_request` del tablero los deja entrar: la ruta los frena ella misma."""
    r = _lote(client, auth_headers, equipo[rol], [a.id for a in agendas],
              closer_id=equipo['relevo'].id, fuente='workshop', pre_call='confirmada')

    assert r.status_code == 403
    assert {(a.closer_id, a.origin, a.result) for a in agendas} == \
        {(equipo['closer'].id, 'vsl', 'Pendiente')}
    assert client.get(OPCIONES, headers=auth_headers(equipo[rol])).status_code == 403


def test_un_rol_ajeno_al_tablero_tampoco_entra(client, make_user, agendas, auth_headers):
    r = _lote(client, auth_headers, make_user(role='hiring'), [agendas[0].id], fuente='workshop')

    assert r.status_code == 403
    assert agendas[0].origin == 'vsl'


def test_sin_sesion_no_responde(client, agendas):
    assert client.post(LOTE, json={'ids': [agendas[0].id], 'cambios': {'fuente': 'workshop'}}) \
        .status_code in (401, 403)
    assert agendas[0].origin == 'vsl'


# --- Qué cambia -------------------------------------------------------------------------------

def test_aplica_los_tres_campos_a_las_agendas_de_revisar(client, equipo, agendas, auth_headers,
                                                       make_user):
    paula = make_user(role='setter', username='Paula', email='paula@neuro.com')
    ids = [agendas[0].id, agendas[2].id]

    r = _lote(client, auth_headers, equipo['operador'], ids,
              fuente='Paula', closer_id=equipo['relevo'].id, pre_call='confirmada')

    assert r.status_code == 200, r.get_json()
    cuerpo = r.get_json()
    assert (cuerpo['pedidas'], cuerpo['cambiadas'], cuerpo['sin_cambios'], cuerpo['errores']) == \
        (2, 2, 0, [])
    assert cuerpo['campos'] == ['fuente', 'closer_id', 'pre_call']
    for a in (agendas[0], agendas[2]):
        # Una fuente que es un setter le atribuye la agenda, como desde la ficha.
        assert (a.origin, a.setter_id, a.closer_id, a.result) == \
            ('Paula', paula.id, equipo['relevo'].id, 'Confirmado')
    # La que no se tildó queda como estaba.
    assert (agendas[1].origin, agendas[1].closer_id, agendas[1].result) == \
        ('vsl', equipo['closer'].id, 'Pendiente')


def test_cuenta_las_que_ya_tenian_ese_valor_y_no_las_toca(client, db, equipo, agendas, auth_headers):
    agendas[1].closer_id = equipo['relevo'].id
    db.session.commit()

    r = _lote(client, auth_headers, equipo['operador'], [a.id for a in agendas],
              closer_id=equipo['relevo'].id)

    cuerpo = r.get_json()
    assert (cuerpo['cambiadas'], cuerpo['sin_cambios']) == (2, 1)
    assert cuerpo['message'] == '2 agendas actualizadas · 1 ya lo tenía'
    # La que ya lo tenía no suma una corrección a su bitácora.
    assert LeadEventLog.query.filter_by(appointment_id=agendas[1].id).count() == 0


def test_sin_confirmar_no_pisa_la_etapa_en_la_que_iba_el_closer(client, db, equipo, agendas,
                                                               auth_headers):
    """'conversando' ya se ve «Sin confirmar»: el lote no la vuelve 'Pendiente'."""
    agendas[0].result = 'conversando'
    agendas[1].result = 'Confirmado'
    db.session.commit()

    r = _lote(client, auth_headers, equipo['operador'], [agendas[0].id, agendas[1].id],
              pre_call='sin_confirmar')

    assert (r.get_json()['cambiadas'], r.get_json()['sin_cambios']) == (1, 1)
    assert (agendas[0].result, agendas[1].result) == ('conversando', 'Pendiente')


def test_cada_agenda_queda_en_su_bitacora_como_edicion_en_lote(client, equipo, agendas, auth_headers):
    _lote(client, auth_headers, equipo['operador'], [agendas[0].id],
          fuente='workshop', pre_call='confirmada')

    textos = [e.description for e in LeadEventLog.query.filter_by(appointment_id=agendas[0].id)]
    assert len(textos) == 2
    assert all('desde la edición en lote de Revisar' in t for t in textos)
    assert any('fuente vsl → workshop' in t for t in textos)


# --- El espejo del Tablero, igual que desde la ficha -----------------------------------------

def test_el_espejo_queda_igual_que_si_se_corrigiera_desde_la_ficha(client, db, equipo, auth_headers,
                                                                   make_user):
    """Dos agendas gemelas: una se corrige en lote y la otra desde la ficha, campo por campo. La cita
    y su fila del Tablero tienen que quedar igual en las dos."""
    make_user(role='setter', username='Paula', email='paula@neuro.com')
    en_lote = _agenda(db, equipo, 'Ana Gomez', 'ana@x.com', con_espejo=True)
    en_ficha = _agenda(db, equipo, 'Beto Ruiz', 'beto@x.com', hora=1, con_espejo=True)
    cambios = {'fuente': 'Paula', 'closer_id': equipo['relevo'].id}

    r = _lote(client, auth_headers, equipo['operador'], [en_lote.id], pre_call='confirmada', **cambios)
    assert r.status_code == 200, r.get_json()
    cabeceras = auth_headers(equipo['operador'])
    assert client.patch(f'/api/ficha/{en_ficha.id}/agenda', json=cambios,
                        headers=cabeceras).status_code == 200
    assert client.patch(f'/api/ficha/{en_ficha.id}/estado', json={'campo': 'pre_call', 'valor': 'confirmada'},
                        headers=cabeceras).status_code == 200

    def foto(appt):
        espejo = _espejo(appt)
        return (appt.origin, appt.setter_id, appt.closer_id, appt.result, appt.closer_processed,
                espejo.nombre, espejo.closer, espejo.estado, espejo.date == appt.start_time)

    assert foto(en_lote) == foto(en_ficha)
    assert _espejo(en_lote).nombre == 'Paula' and _espejo(en_lote).closer == 'Nerina'


def test_la_proxima_sincronizacion_del_tablero_no_deshace_el_lote(client, db, equipo, auth_headers):
    """El sync tablero -> citas le pisa a la cita la fuente y el closer de su fila: si el lote no
    moviera la fila, la corrección duraría hasta el próximo webhook de n8n."""
    from app.services.booking_service import BookingService

    appt = _agenda(db, equipo, 'Ana Gomez', 'ana@x.com', con_espejo=True)

    _lote(client, auth_headers, equipo['operador'], [appt.id],
          fuente='workshop', closer_id=equipo['relevo'].id)
    BookingService.sync_financial_agenda_to_appointment(_espejo(appt))

    assert Appointment.query.filter_by(client_id=appt.client_id).count() == 1
    assert (appt.origin, appt.closer_id) == ('workshop', equipo['relevo'].id)


def test_no_da_de_alta_filas_en_el_tablero(client, equipo, agendas, auth_headers):
    """Como la ficha: una cita sin fila no la pisa ningún sync, y corregirla no es crearle una."""
    _lote(client, auth_headers, equipo['operador'], [a.id for a in agendas], fuente='workshop')

    assert FinancialAgenda.query.count() == 0


# --- Límites y errores ------------------------------------------------------------------------

def test_los_ids_que_no_existen_van_a_errores_y_el_resto_se_aplica(client, equipo, agendas,
                                                                  auth_headers):
    r = _lote(client, auth_headers, equipo['operador'], [agendas[0].id, 999999], fuente='workshop')

    assert r.status_code == 200
    cuerpo = r.get_json()
    assert (cuerpo['cambiadas'], cuerpo['sin_cambios']) == (1, 0)
    assert [e['id'] for e in cuerpo['errores']] == [999999]
    assert agendas[0].origin == 'workshop'


def test_una_agenda_que_no_se_puede_mover_no_corta_el_lote_ni_queda_a_medias(client, db, equipo,
                                                                            agendas, auth_headers):
    """Nerina ya tiene una llamada sin resolver a la hora de la primera: esa no cambia nada (ni el
    pre call) y las otras dos sí."""
    otro = Client(full_name='Otro Lead', email='otro@x.com')
    db.session.add(otro)
    db.session.commit()
    db.session.add(Appointment(closer_id=equipo['relevo'].id, client_id=otro.id,
                               start_time=agendas[0].start_time, result='Pendiente',
                               closer_result='Pendiente'))
    db.session.commit()

    r = _lote(client, auth_headers, equipo['operador'], [a.id for a in agendas],
              closer_id=equipo['relevo'].id, pre_call='confirmada')

    cuerpo = r.get_json()
    assert cuerpo['cambiadas'] == 2
    assert [e['id'] for e in cuerpo['errores']] == [agendas[0].id]
    assert 'misma hora' in cuerpo['errores'][0]['message']
    assert (agendas[0].closer_id, agendas[0].result) == (equipo['closer'].id, 'Pendiente')
    assert {(a.closer_id, a.result) for a in agendas[1:]} == {(equipo['relevo'].id, 'Confirmado')}


def test_mas_del_limite_no_se_aplica(client, equipo, agendas, auth_headers):
    r = _lote(client, auth_headers, equipo['operador'], [agendas[0].id] + list(range(10_000, 15_000)),
              fuente='workshop')

    assert r.status_code == 400
    assert '5000' in r.get_json()['message']
    assert agendas[0].origin == 'vsl'


def test_el_limite_justo_se_acepta(client, equipo, agendas, auth_headers):
    r = _lote(client, auth_headers, equipo['operador'], [agendas[0].id] + list(range(10_000, 14_999)),
              fuente='workshop')

    assert r.status_code == 200
    assert r.get_json()['cambiadas'] == 1


# Junto a un cambio válido (la fuente): el lote se valida entero antes de tocar una sola agenda.
@pytest.mark.parametrize('cambios,motivo', [
    ({'fuente': 'workshop', 'pre_call': 'cancelo'}, 'Confirmada o Sin confirmar'),
    ({'fuente': 'workshop', 'encargado_triage': 'triaje'}, 'encargado_triage'),
    ({'fuente': 'workshop', 'closer_id': 'abc'}, 'closer'),
    ({'fuente': 'Instagram orgánico'}, 'catálogo'),
    ({'fuente': 'workshop_landing'}, 'catálogo'),
    ({}, 'ningún campo'),
    ({'fuente': '', 'closer_id': None}, 'ningún campo'),
])
def test_lo_que_no_se_aplica_en_lote_no_toca_ninguna_agenda(client, equipo, agendas, auth_headers,
                                                           cambios, motivo):
    r = _lote(client, auth_headers, equipo['operador'], [a.id for a in agendas], **cambios)

    assert r.status_code == 400
    assert motivo in r.get_json()['message']
    assert {(a.origin, a.closer_id, a.result) for a in agendas} == \
        {('vsl', equipo['closer'].id, 'Pendiente')}


def test_un_closer_que_no_es_closer_activo_no_pasa(client, equipo, agendas, auth_headers, make_user):
    ex = make_user(role='closer', username='ex', email='ex@neuro.com', is_active=False)

    for closer_id in (ex.id, equipo['setter'].id):
        r = _lote(client, auth_headers, equipo['operador'], [agendas[0].id], closer_id=closer_id)
        assert r.status_code == 400
    assert agendas[0].closer_id == equipo['closer'].id


@pytest.mark.parametrize('ids', [[], None, 'todas', [True], ['x']])
def test_un_pedido_sin_agendas_validas_no_pasa(client, equipo, auth_headers, ids):
    r = client.post(LOTE, json={'ids': ids, 'cambios': {'fuente': 'workshop'}},
                    headers=auth_headers(equipo['operador']))

    assert r.status_code == 400


# --- Opciones ---------------------------------------------------------------------------------

def test_las_opciones_son_las_de_la_ficha_sin_cancelo(client, equipo, auth_headers, make_user):
    make_user(role='closer', username='ex', email='ex@neuro.com', is_active=False)

    r = client.get(OPCIONES, headers=auth_headers(equipo['operador']))

    assert r.status_code == 200
    cuerpo = r.get_json()
    assert [e['key'] for e in cuerpo['pre_call']] == ['confirmada', 'sin_confirmar']
    assert [c['nombre'] for c in cuerpo['closers']] == ['Nerina', 'vendedor']
    claves = {o['clave'] for g in cuerpo['fuentes'] for o in g['opciones']}
    assert {'workshop', 'vsl', 'Paula'} <= claves and 'workshop_landing' not in claves
    assert cuerpo['limite'] == 5000
    assert 'encargado_triage' not in cuerpo['campos']
