"""PUT /api/auth/me/mascota: el personaje del avatar del dock.

Lo que importa: solo uno de los 10 personajes, queda guardado en la cuenta y vuelve en /auth/me, hace
falta sesión, y simulando a otro no se le cambia el suyo.
"""
import importlib.util
from pathlib import Path

import pytest
import sqlalchemy as sa

from app.models import User
from app.models.user import MASCOTAS

MASCOTA = '/api/auth/me/mascota'
MIGRACION = Path(__file__).resolve().parents[2] / 'migrations' / 'versions' / 'ee63a37b67f3_users_mascota_en_main.py'


def test_elegir_un_personaje_lo_guarda_y_vuelve_en_me(client, db, make_user, auth_headers):
    ana = make_user(username='ana')
    h = auth_headers(ana)

    r = client.put(MASCOTA, json={'mascota': 'owl'}, headers=h)

    assert (r.status_code, r.get_json()) == (200, {'mascota': 'owl'})
    assert db.session.get(User, ana.id).mascota == 'owl'
    assert client.get('/api/auth/me', headers=h).get_json()['user']['mascota'] == 'owl'


def test_son_diez_personajes():
    assert len(MASCOTAS) == len(set(MASCOTAS)) == 10


@pytest.mark.parametrize('cuerpo', [{}, {'mascota': ''}, {'mascota': 'dragon'}, {'mascota': ['owl']},
                                    {'mascota': 7}, {'mascota': 'OWL'}])
def test_un_personaje_que_no_esta_es_400_y_no_cambia_nada(client, db, make_user, auth_headers, cuerpo):
    ana = make_user(username='ana')
    ana.mascota = 'fox'
    db.session.commit()

    assert client.put(MASCOTA, json=cuerpo, headers=auth_headers(ana)).status_code == 400
    assert db.session.get(User, ana.id).mascota == 'fox'


def test_sin_sesion_es_401(client):
    assert client.put(MASCOTA, json={'mascota': 'owl'}).status_code == 401


def test_simulando_no_se_le_cambia_el_personaje_a_la_persona_simulada(client, db, make_user, auth_headers):
    admin = make_user(role='admin', username='root')
    cata = make_user(role='closer', username='cata')
    token = client.post('/api/auth/impersonate', headers=auth_headers(admin),
                        json={'user_id': cata.id, 'isolated': True}).get_json()['token']

    r = client.put(MASCOTA, json={'mascota': 'owl'}, headers={'Authorization': f'Bearer {token}'})

    assert r.status_code == 403
    assert db.session.get(User, cata.id).mascota is None


# --- La migración de main ---------------------------------------------------------------------------

def _migrar(conexion):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    spec = importlib.util.spec_from_file_location('migracion_users_mascota_en_main', MIGRACION)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    with Operations.context(MigrationContext.configure(conexion)):
        modulo.upgrade()


def test_la_migracion_agrega_la_columna_y_en_una_base_que_ya_la_tiene_no_hace_nada():
    """Local y staging ya tienen `users.mascota` por develop (a4c8e2f6b913): ahí no tiene que fallar."""
    motor = sa.create_engine('sqlite://')
    with motor.begin() as conexion:
        conexion.execute(sa.text('CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(64))'))
        conexion.execute(sa.text("INSERT INTO users (username) VALUES ('ana')"))
        _migrar(conexion)
        conexion.execute(sa.text("UPDATE users SET mascota = 'owl'"))
        _migrar(conexion)   # la segunda no hace nada

        filas = conexion.execute(sa.text('SELECT username, mascota FROM users')).all()

    assert [tuple(f) for f in filas] == [('ana', 'owl')]
