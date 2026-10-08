"""Gestión de equipo con varios roles por persona: `roles` (todos) y `role` (el principal, con el que
entra). Lo viejo (solo `role`) sigue andando y no le borra los roles extra a nadie."""

import pytest

from app.models import GoogleCalendarToken, User


@pytest.fixture()
def admin_h(make_user, auth_headers):
    admin = make_user(role='admin', username='jefa')
    return admin, auth_headers(admin)


def test_crear_con_varios_roles(client, admin_h):
    _, h = admin_h
    r = client.post('/api/admin/users', headers=h, json={
        'username': 'ana', 'email': 'ana@x.com', 'password': 'secreto1', 'roles': ['closer', 'director_comercial'],
        'role': 'director_comercial',
    })
    assert r.status_code == 201
    ana = User.query.filter_by(username='ana').one()
    assert ana.roles == ['director_comercial', 'closer']


def test_editar_roles_y_principal(client, admin_h, make_user):
    _, h = admin_h
    beto = make_user(role='closer', username='beto')
    r = client.put(f'/api/admin/users/{beto.id}', headers=h, json={'roles': ['setter', 'closer'], 'role': 'closer'})
    assert r.status_code == 200 and User.query.get(beto.id).roles == ['closer', 'setter']


def test_lo_viejo_no_borra_los_roles_extra(client, admin_h, make_user):
    _, h = admin_h
    beto = make_user(role='closer', username='beto')
    beto.roles_extra = 'setter'
    client.put(f'/api/admin/users/{beto.id}', headers=h, json={'username': 'beto2'})
    assert User.query.get(beto.id).roles == ['closer', 'setter']


@pytest.mark.parametrize('cuerpo', [{'roles': []}, {'roles': ['rey']}, {'role': 'rey'}])
def test_roles_invalidos(client, admin_h, make_user, cuerpo):
    _, h = admin_h
    beto = make_user(role='closer', username='beto')
    assert client.put(f'/api/admin/users/{beto.id}', headers=h, json=cuerpo).status_code == 400
    assert User.query.get(beto.id).roles == ['closer']


def test_no_se_saca_admin_a_si_mismo(client, admin_h):
    admin, h = admin_h
    r = client.put(f'/api/admin/users/{admin.id}', headers=h, json={'roles': ['closer']})
    assert r.status_code == 400 and User.query.get(admin.id).role == 'admin'


def test_la_lista_trae_roles_y_calendar(client, admin_h, make_user, db):
    _, h = admin_h
    beto = make_user(role='closer', username='beto')
    beto.roles_extra = 'setter'
    db.session.add(GoogleCalendarToken(user_id=beto.id, token_json='{}'))
    db.session.commit()
    fila = next(u for u in client.get('/api/admin/users', headers=h).get_json() if u['id'] == beto.id)
    assert fila['role'] == 'closer' and fila['roles'] == ['closer', 'setter'] and fila['calendar'] is True
