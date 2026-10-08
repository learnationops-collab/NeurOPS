"""PUT /api/auth/me/mascota: el personaje del avatar del dock.

Lo que importa: solo uno de los 10 personajes, queda guardado en la cuenta y vuelve en /auth/me, hace
falta sesión, y simulando a otro no se le cambia el suyo.
"""
import pytest

from app.models import User
from app.models.user import MASCOTAS

MASCOTA = '/api/auth/me/mascota'


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
