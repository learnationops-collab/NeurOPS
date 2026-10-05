"""API de gestion de Agendas 2.0 (/api/agendas-v2): quien entra y que se guarda.

Thalamus es la herramienta del director comercial: un closer o un setter no tienen nada que hacer
aca, y todo documento que entra se normaliza con el mismo esquema que el frontend (lo que no
cumple se corrige, nunca se guarda tal cual).
"""

import pytest

from app.agendas_v2 import servicio
from app.agendas_v2.modelos import SchedPersona, SchedReserva


@pytest.fixture()
def gente(make_user):
    return {
        'director': make_user(role='director_comercial', email='dir@neuro.com'),
        'admin': make_user(role='admin', email='admin@neuro.com'),
        'closer': make_user(role='closer', email='ana@neuro.com'),
        'setter': make_user(role='setter'),
    }


@pytest.fixture()
def dir_h(gente, auth_headers):
    return auth_headers(gente['director'])


def test_sin_sesion_responde_401(client):
    assert client.get('/api/agendas-v2/estado').status_code == 401


@pytest.mark.parametrize('rol', ['closer', 'setter'])
def test_closer_y_setter_no_entran(client, gente, auth_headers, rol):
    assert client.get('/api/agendas-v2/estado', headers=auth_headers(gente[rol])).status_code == 403
    assert (
        client.put('/api/agendas-v2/funnels/f1', json={'nombre': 'X'}, headers=auth_headers(gente[rol])).status_code
        == 403
    )


@pytest.mark.parametrize('rol', ['director', 'admin'])
def test_la_direccion_y_admin_leen_el_estado(client, gente, auth_headers, rol):
    r = client.get('/api/agendas-v2/estado', headers=auth_headers(gente[rol]))
    assert r.status_code == 200
    cuerpo = r.get_json()
    assert set(cuerpo['cols']) == {'funnels', 'formularios', 'personas', 'grupos', 'eventos', 'roles'}
    assert cuerpo['reservas'] == [] and cuerpo['version'] == 0
    assert cuerpo['integ']['gcal']['activo'] is False


def test_put_normaliza_el_documento(client, dir_h):
    r = client.put(
        '/api/agendas-v2/formularios/fo1',
        headers=dir_h,
        json={
            'nombre': 'Calificación',
            'basura': 'no va',
            'preguntas': [
                {
                    'id': 'q1',
                    'tipo': 'opciones',
                    'titulo': 'x' * 400,
                    'peso': 99,
                    'opciones': [{'id': 'a', 'texto': 'A', 'puntos': 50}],
                }
            ],
        },
    )
    assert r.status_code == 200
    doc = r.get_json()['doc']
    assert doc['id'] == 'fo1' and 'basura' not in doc
    q = doc['preguntas'][0]
    assert len(q['titulo']) == 300 and q['peso'] == 5 and q['opciones'][0]['puntos'] == 10
    assert doc['fin']['titulo']  # los campos que faltan toman su valor por defecto


def test_patch_mezcla_campos_y_404_si_no_existe(client, dir_h):
    client.put('/api/agendas-v2/funnels/f1', headers=dir_h, json={'nombre': 'Workshop', 'color': 'rosa'})
    r = client.patch('/api/agendas-v2/funnels/f1', headers=dir_h, json={'activo': False})
    assert r.get_json()['doc']['color'] == 'rosa' and r.get_json()['doc']['activo'] is False
    assert client.patch('/api/agendas-v2/funnels/nada', headers=dir_h, json={'activo': False}).status_code == 404


def test_coleccion_o_id_invalidos_dan_404(client, dir_h):
    assert client.put('/api/agendas-v2/usuarios/u1', headers=dir_h, json={}).status_code == 404
    assert client.put('/api/agendas-v2/funnels/ñ!', headers=dir_h, json={}).status_code == 404


def test_cada_escritura_sube_la_version(client, dir_h):
    v0 = client.get('/api/agendas-v2/version', headers=dir_h).get_json()['version']
    v1 = client.put('/api/agendas-v2/roles/r1', headers=dir_h, json={'nombre': 'Closer', 'atiende': True}).get_json()[
        'version'
    ]
    v2 = client.delete('/api/agendas-v2/roles/r1', headers=dir_h).get_json()['version']
    assert v0 < v1 < v2
    assert client.get('/api/agendas-v2/estado', headers=dir_h).get_json()['cols']['roles'] == []


def test_una_persona_se_une_a_su_cuenta_por_email(client, dir_h, gente):
    client.put('/api/agendas-v2/personas/p1', headers=dir_h, json={'nombre': 'Ana', 'email': 'ANA@neuro.com'})
    fila = SchedPersona.query.get('p1')
    assert fila.email == 'ana@neuro.com' and fila.user_id == gente['closer'].id


def test_el_perfil_es_de_cada_usuario(client, gente, auth_headers):
    client.put('/api/agendas-v2/perfil', headers=auth_headers(gente['director']), json={'nombre': 'Mario'})
    assert (
        client.get('/api/agendas-v2/estado', headers=auth_headers(gente['director'])).get_json()['perfil']['nombre']
        == 'Mario'
    )
    assert (
        client.get('/api/agendas-v2/estado', headers=auth_headers(gente['admin'])).get_json()['perfil']['nombre'] == ''
    )


def test_integraciones_solo_guardan_ids_numericos(client, dir_h):
    r = client.put(
        '/api/agendas-v2/integraciones', headers=dir_h, json={'pixel': {'activo': True, 'id': '12ab34<script>'}}
    )
    assert r.get_json()['integ']['pixel'] == {
        'activo': True,
        'id': '1234',
        'lead': True,
        'schedule': True,
        'nocalifica': False,
    }


def test_cancelar_una_reserva(client, db, dir_h):
    db.session.add(SchedReserva(id='rs1', evento_id='e1', estado='agendada', payload={'duracion_min': 45}))
    db.session.commit()
    r = client.post('/api/agendas-v2/reservas/rs1/cancelar', headers=dir_h)
    assert r.status_code == 200 and r.get_json()['reserva']['estado'] == 'cancelada'
    assert SchedReserva.query.get('rs1').cancelada_en is not None
    assert client.post('/api/agendas-v2/reservas/nada/cancelar', headers=dir_h).status_code == 404


def test_el_servicio_no_toca_la_operacion(client, db, dir_h):
    """Paso 2 del plan: nada de Agendas 2.0 escribe en las tablas de la operacion."""
    from app.models import Appointment, FinancialAgenda

    client.put('/api/agendas-v2/funnels/f1', headers=dir_h, json={'nombre': 'W'})
    servicio.guardar_integraciones({})
    assert Appointment.query.count() == 0 and FinancialAgenda.query.count() == 0


def test_usuarios_lista_closers_y_setters_activos(client, gente, dir_h, make_user):
    make_user(role='closer', email='baja@neuro.com', is_active=False)
    r = client.get('/api/agendas-v2/usuarios', headers=dir_h)
    assert r.status_code == 200
    usuarios = r.get_json()['usuarios']
    assert {u['rol'] for u in usuarios} == {'closer', 'setter'}
    assert 'baja@neuro.com' not in {u['email'] for u in usuarios}
    assert {'id', 'nombre', 'email', 'rol', 'tz'} <= set(usuarios[0])


def test_usuarios_es_solo_para_la_direccion(client, gente, auth_headers):
    assert client.get('/api/agendas-v2/usuarios').status_code == 401
    assert client.get('/api/agendas-v2/usuarios', headers=auth_headers(gente['closer'])).status_code == 403
