"""UserService: alta/edición/borrado de usuarios y clientes, y el filtro por rol.

`update_user`/`delete_user` caen a `update_client`/`delete_client` cuando el id no es el de un
usuario: la pantalla legado de "Base de datos" mezcla usuarios y clientes en una sola lista y les
manda el mismo id de fila, de ahí la caída. Se prueba tal cual está, sin cambiar ese diseño.
"""
import pytest

from app.models import Client, User
from app.services.user_service import UserService

pytestmark = pytest.mark.usefixtures('hashes_baratos')


# --- get_users_by_role -------------------------------------------------------------------------

def test_get_users_by_role_filtra_por_los_roles_pedidos(db, make_user):
    make_user(role='closer', username='carla')
    make_user(role='setter', username='beto')
    make_user(role='admin', username='root')

    resultado = UserService.get_users_by_role(['closer', 'setter'])

    assert sorted(u.username for u in resultado) == ['beto', 'carla']


def test_get_users_by_role_sin_coincidencias_da_vacio(db, make_user):
    make_user(role='closer')

    assert UserService.get_users_by_role(['triage']) == []


# --- create_client -------------------------------------------------------------------------------

def test_create_client_crea_y_devuelve_el_cliente(db):
    respuesta, codigo = UserService.create_client({
        'full_name': 'Ana Gomez', 'email': 'ana@x.com', 'phone': '111', 'instagram': 'ana.g',
    })

    assert codigo == 200 and respuesta['success'] is True
    cliente = Client.query.one()
    assert (cliente.full_name, cliente.email, cliente.phone, cliente.instagram) == (
        'Ana Gomez', 'ana@x.com', '111', 'ana.g')
    assert respuesta['data']['client'] is cliente


def test_create_client_con_email_repetido_es_un_error_y_no_crea_nada(db):
    UserService.create_client({'full_name': 'Ana', 'email': 'ana@x.com'})

    respuesta, codigo = UserService.create_client({'full_name': 'Otra Ana', 'email': 'ana@x.com'})

    assert codigo == 400
    assert 'ya existe' in respuesta['message']
    assert Client.query.count() == 1


@pytest.mark.parametrize('email_nuevo', [None, '', '   '])
def test_dos_clientes_sin_email_no_chocan_entre_si(db, email_nuevo):
    # Antes: filter_by(email=None) es `email IS NULL` y empataba con CUALQUIER cliente sin email,
    # bloqueando el alta de un segundo lead sin correo en cuanto ya existiera uno.
    UserService.create_client({'full_name': 'Primero'})

    respuesta, codigo = UserService.create_client({'full_name': 'Segundo', 'email': email_nuevo})

    assert codigo == 200
    assert Client.query.count() == 2
    assert {c.email for c in Client.query.all()} == {None}  # el email vacio se guarda como NULL


# --- update_user / update_client ------------------------------------------------------------------

def test_update_user_actualiza_los_campos_enviados(db, make_user):
    usuario = make_user(role='closer', username='ana', email='ana@x.com')

    respuesta, codigo = UserService.update_user(usuario.id, {'username': 'ana2', 'role': 'setter',
                                                             'timezone': 'America/Caracas'})

    assert codigo == 200
    db.session.refresh(usuario)
    assert (usuario.username, usuario.role, usuario.timezone) == ('ana2', 'setter', 'America/Caracas')
    assert usuario.email == 'ana@x.com'  # lo que no se manda no se toca


def test_update_user_con_password_la_cambia(db, make_user):
    usuario = make_user(username='ana', password='clave-original')

    UserService.update_user(usuario.id, {'password': 'clave-nueva'})

    db.session.refresh(usuario)
    assert usuario.check_password('clave-nueva')
    assert not usuario.check_password('clave-original')


def test_update_user_sin_password_no_la_toca(db, make_user):
    usuario = make_user(username='ana', password='clave-original')
    hash_antes = usuario.password_hash

    UserService.update_user(usuario.id, {'username': 'ana2'})

    db.session.refresh(usuario)
    assert usuario.password_hash == hash_antes


def test_update_user_con_un_id_que_no_es_de_usuario_cae_a_update_client(db):
    cliente = Client(full_name='Original', email='cliente@x.com')
    db.session.add(cliente)
    db.session.commit()

    respuesta, codigo = UserService.update_user(cliente.id, {'full_name': 'Editado'})

    assert codigo == 200
    db.session.refresh(cliente)
    assert cliente.full_name == 'Editado'


def test_update_client_actualiza_los_campos_enviados(db):
    cliente = Client(full_name='Ana', email='ana@x.com', phone='111', instagram='ana.g')
    db.session.add(cliente)
    db.session.commit()

    respuesta, codigo = UserService.update_client(cliente.id, {'phone': '222'})

    assert codigo == 200
    db.session.refresh(cliente)
    assert (cliente.full_name, cliente.phone, cliente.instagram) == ('Ana', '222', 'ana.g')


def test_update_client_con_un_id_inexistente_es_404(db):
    respuesta, codigo = UserService.update_client(9999, {'full_name': 'x'})

    assert codigo == 404
    assert 'no encontrado' in respuesta['message'].lower()


def test_update_user_con_un_id_que_no_es_de_nadie_es_404(db):
    respuesta, codigo = UserService.update_user(9999, {'full_name': 'x'})

    assert codigo == 404


# --- delete_user / borrado de cliente ---------------------------------------------------------

def test_delete_user_no_deja_borrarse_a_si_mismo(db, make_user):
    usuario = make_user(role='admin')

    respuesta, codigo = UserService.delete_user(usuario.id, current_user_id=usuario.id)

    assert codigo == 400
    assert 'propio usuario' in respuesta['message']
    assert User.query.count() == 1


def test_delete_user_borra_a_otro_usuario_y_devuelve_su_rol(db, make_user):
    admin = make_user(role='admin')
    closer = make_user(role='closer', username='carla')

    respuesta, codigo = UserService.delete_user(closer.id, current_user_id=admin.id)

    assert codigo == 200
    assert respuesta['data']['role'] == 'closer'
    assert User.query.count() == 1


def test_delete_user_con_un_id_que_no_es_de_usuario_borra_al_cliente(db, make_user):
    admin = make_user(role='admin')
    # Clients y Users son autoincrement independientes: sin este relleno el primer Client creado
    # coincidiria por casualidad con el id del admin y dispararia el guard de "no te borres a ti
    # mismo" en vez del camino que este test quiere probar.
    db.session.add_all([Client(full_name='Relleno', email='relleno@x.com')])
    cliente = Client(full_name='Ana', email='ana@x.com')
    db.session.add(cliente)
    db.session.commit()
    assert cliente.id != admin.id

    respuesta, codigo = UserService.delete_user(cliente.id, current_user_id=admin.id)

    assert codigo == 200
    assert Client.query.filter_by(id=cliente.id).count() == 0
    assert Client.query.count() == 1  # el relleno sigue ahi: solo se borro el cliente pedido


def test_delete_user_con_un_id_que_no_es_de_nadie_es_404(db, make_user):
    admin = make_user(role='admin')

    respuesta, codigo = UserService.delete_user(9999, current_user_id=admin.id)

    assert codigo == 404
