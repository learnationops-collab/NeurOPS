"""Admin u operador le resetea la contraseña a alguien del equipo: una temporal que se muestra una vez."""


def test_admin_resetea_la_contrasena_con_una_temporal(client, make_user, auth_headers):
    admin = make_user(role='admin', username='mario', email='mario@equipo.com')
    ana = make_user(role='closer', username='ana', email='ana@equipo.com')
    r = client.post(f'/api/admin/users/{ana.id}/reset-password', headers=auth_headers(admin))
    assert r.status_code == 200
    nueva = r.get_json()['password']
    assert len(nueva) >= 10 and ana.check_password(nueva)
    assert client.post(f'/api/admin/users/{admin.id}/reset-password', headers=auth_headers(ana)).status_code == 403
