"""API publica de Agendas 2.0: lo que puede hacer un visitante anonimo desde el link del evento.

El servidor no confia en el navegador: revalida las respuestas contra la version PUBLICADA, elige
el closer el mismo y, antes de insertar, comprueba que siga libre. Ademas nunca expone al equipo.
Fecha fija: lunes 5 de octubre de 2026, 08:00 en La Paz (12:00 UTC).
"""

import calendar
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.agendas_v2 import api_publico, servicio
from app.agendas_v2.modelos import SchedReserva
from app.agendas_v2.nucleo.eventos import config_de

LV9a12 = {str(d): [['09:00', '12:00']] for d in range(1, 6)}
URL = '/api/agendas-v2/publico'
LUNES_9 = '2026-10-05T13:00:00.000Z'  # 09:00 en La Paz


@pytest.fixture(autouse=True)
def _reloj_y_limites():
    api_publico._pedidos.clear()
    with freeze_time('2026-10-05 12:00:00'):
        yield
    api_publico._pedidos.clear()


def _publicar(evento_id):
    d = servicio.colecciones()
    e = next(x for x in d['eventos'] if x['id'] == evento_id)
    fo = next((x for x in d['formularios'] if x['id'] == e['formulario']), None)
    servicio.guardar_doc('eventos', evento_id, {'publicado': config_de(e, fo)}, parcial=True)


@pytest.fixture()
def armado(db):
    g = servicio.guardar_doc
    g('roles', 'rc', {'nombre': 'Closer', 'atiende': True})
    g(
        'personas',
        'ana',
        {
            'nombre': 'Ana Paz',
            'email': 'ana@equipo.com',
            'rol': 'rc',
            'tz': 'America/La_Paz',
            'horario': LV9a12,
            'orden': 1,
        },
    )
    g('personas', 'beto', {'nombre': 'Beto Ruiz', 'rol': 'rc', 'tz': 'America/La_Paz', 'horario': LV9a12, 'orden': 2})
    g('personas', 'juan', {'nombre': 'Juan Setter', 'rol': 'setter'})
    g('grupos', 'top', {'nombre': 'Ultra', 'estrategia': 'llenar', 'miembros': ['ana', 'beto'], 'orden': 1})
    g(
        'formularios',
        'fo',
        {
            'nombre': 'Calificación',
            'contacto': {'nombre': True, 'telefono': True, 'email': True, 'instagram': False},  # como lo crea Thalamus
            'preguntas': [
                {
                    'id': 'q1',
                    'tipo': 'opciones',
                    'titulo': '¿Cuánto?',
                    'peso': 1,
                    'opciones': [
                        {'id': 'a', 'texto': 'Mucho', 'puntos': 10},
                        {'id': 'x', 'texto': 'Nada', 'descalifica': True},
                    ],
                }
            ],
            'reglas': [],
            'resto': 'top',
        },
    )
    g('funnels', 'fu', {'nombre': 'Workshop', 'slug': 'workshop', 'origenes': [{'id': 'o1', 'setter': 'juan'}]})
    g(
        'eventos',
        'ev',
        {
            'nombre': 'Llamada',
            'slug': 'llamada',
            'funnel': 'fu',
            'formulario': 'fo',
            'duracion': 45,
            'antel': {'n': 0, 'u': 'h'},
            'paso': {'n': 60, 'u': 'min'},
        },
    )
    _publicar('ev')


def _resp(**extra):
    base = {'c-nombre': 'Lucía Fernández', 'c-telefono': '7123 4567', 'c-email': 'lucia@correo.com', 'q1': 'a'}
    base.update(extra)
    return base


def _reservar(client, inicio=LUNES_9, **extra):
    return client.post(
        URL + '/reservas',
        json={
            'evento_id': 'ev',
            'resp': _resp(**extra),
            'pais': 'BO',
            'tz': 'America/La_Paz',
            'inicio': inicio,
            'origen': 'juan-setter',
        },
    )


def test_el_link_devuelve_la_version_publicada_sin_datos_del_equipo(client, armado):
    r = client.get(URL + '/eventos/workshop/llamada')
    assert r.status_code == 200
    cuerpo = r.get_json()
    assert cuerpo['evento']['id'] == 'ev' and cuerpo['form']['preguntas'][0]['id'] == 'q1'
    assert cuerpo['funnel'] == {'nombre': 'Workshop', 'slug': 'workshop'}
    texto = r.get_data(as_text=True)
    assert 'Ana' not in texto and 'ana@equipo.com' not in texto and 'horario' not in texto


def test_lo_que_no_esta_publicado_no_existe(client, armado):
    servicio.guardar_doc('formularios', 'fo', {'nombre': 'Cambiado sin publicar'}, parcial=True)
    assert client.get(URL + '/eventos/workshop/llamada').get_json()['form']['nombre'] == 'Calificación'
    assert client.get(URL + '/eventos/otro/llamada').status_code == 404
    servicio.guardar_doc('funnels', 'fu', {'activo': False}, parcial=True)
    assert client.get(URL + '/eventos/workshop/llamada').status_code == 404


def test_evento_pausado_no_esta_disponible(client, armado):
    servicio.guardar_doc('eventos', 'ev', {'activo': False}, parcial=True)
    _publicar('ev')
    r = client.get(URL + '/eventos/workshop/llamada')
    assert r.status_code == 404 and r.get_json()['code'] == 'no_disponible'


def test_horarios_sin_closer(client, armado):
    r = client.post(URL + '/eventos/ev/horarios', json={'resp': _resp()})
    slots = r.get_json()['slots']
    assert slots[0] == calendar.timegm((2026, 10, 5, 13, 0, 0)) * 1000  # lunes 09:00 en La Paz
    assert all(isinstance(t, int) for t in slots)
    assert 'ana' not in r.get_data(as_text=True)


def test_reservar_elige_el_closer_en_el_servidor(client, armado):
    r = _reservar(client)
    assert r.status_code == 201
    fila = SchedReserva.query.one()
    assert fila.closer_id == 'ana' and fila.estado == 'agendada'  # "llenar en orden": la primera
    assert fila.inicio == datetime(2026, 10, 5, 13) and fila.fin == datetime(2026, 10, 5, 13, 45)
    assert fila.lead_telefono == '+59171234567' and fila.lead_email == 'lucia@correo.com'
    assert fila.origen == 'juan-setter' and fila.setter_id == 'juan'
    assert fila.payload['respuestas'][0]['respuesta'] == 'Mucho' and fila.nota == 10


def test_el_mismo_lead_dos_veces_no_duplica(client, armado):
    a, b = _reservar(client), _reservar(client)
    assert a.get_json()['reserva']['id'] == b.get_json()['reserva']['id']
    assert SchedReserva.query.count() == 1


def test_un_horario_tomado_da_409(client, armado):
    assert _reservar(client).status_code == 201
    r = _reservar(client, **{'c-email': 'otro@correo.com'})
    # Ana ya tiene las 09:00 y con "llenar en orden" el lead solo ve la agenda de Ana.
    assert r.status_code == 409 and r.get_json()['code'] == 'ocupado'


def test_un_horario_inventado_da_409(client, armado):
    assert _reservar(client, inicio='2026-10-05T03:00:00.000Z').status_code == 409


def test_dos_leads_a_la_vez_el_bloqueo_frena_al_segundo(client, armado, monkeypatch):
    """Simula la carrera: el segundo calcula su asignacion antes de que exista la primera reserva."""
    assert _reservar(client).status_code == 201
    monkeypatch.setattr(
        servicio, '_ocupacion', lambda ahora: {'ahora': ahora, 'ocupado': lambda *a: False, 'carga_de': lambda pid: 0}
    )
    r = _reservar(client, **{'c-email': 'otro@correo.com'})
    assert r.status_code == 409
    assert SchedReserva.query.count() == 1


def test_respuestas_invalidas_dan_400(client, armado):
    r = _reservar(client, **{'c-email': 'no-es-correo'})
    assert r.status_code == 400 and 'c-email' in r.get_json()['errores']
    r = _reservar(client, q1='opcion-que-no-existe')
    assert r.status_code == 400 and 'q1' in r.get_json()['errores']


def test_el_descalificado_queda_registrado_sin_horario(client, armado):
    r = _reservar(client, inicio=None, q1='x')
    assert r.status_code == 201 and r.get_json() == {'descalificada': True}
    fila = SchedReserva.query.one()
    assert fila.estado == 'descalificada' and fila.inicio is None and fila.closer_id is None


def test_un_descalificado_no_puede_forzar_un_horario(client, armado):
    _reservar(client, q1='x')
    assert SchedReserva.query.one().estado == 'descalificada'


def test_limite_por_ip(client, armado):
    for _ in range(10):
        _reservar(client, inicio=None, q1='x')
    r = _reservar(client, inicio=None, q1='x')
    assert r.status_code == 429 and r.get_json()['code'] == 'demasiados'


def test_no_toca_la_operacion(client, armado):
    from app.models import Appointment, FinancialAgenda

    _reservar(client)
    assert Appointment.query.count() == 0 and FinancialAgenda.query.count() == 0
