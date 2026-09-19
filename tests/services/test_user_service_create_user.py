"""UserService.create_user: alta de un usuario con clave.

Sin contrasena, el usuario quedaba con una clave debil y fija escrita en el codigo ('12345678'): con ella
entraba cualquiera que la conociera. Ahora la contrasena es obligatoria y no existe un valor por defecto.
(Hoy nadie llama a este metodo: la pantalla de Equipo usa POST /api/admin/users, que ya la exigia.)
"""
import pytest

from app.models import User
from app.services.user_service import UserService

pytestmark = pytest.mark.usefixtures('hashes_baratos')


@pytest.mark.parametrize('clave', [None, ''])
def test_sin_contrasena_es_un_error_y_no_crea_nada(db, clave):
    respuesta, codigo = UserService.create_user({'username': 'ana', 'email': 'ana@x.com', 'password': clave})

    assert codigo == 400
    assert respuesta['success'] is False
    assert 'contraseña es obligatoria' in respuesta['message']
    assert User.query.count() == 0


def test_sin_la_clave_en_el_cuerpo_tampoco_hay_clave_por_defecto(db):
    respuesta, codigo = UserService.create_user({'username': 'ana', 'email': 'ana@x.com'})

    assert codigo == 400
    assert User.query.count() == 0


def test_con_contrasena_se_crea_y_esa_clave_funciona(db):
    respuesta, codigo = UserService.create_user({'username': 'ana', 'email': 'ana@x.com', 'password': 'la-clave-de-ana',
                                                 'role': 'setter', 'timezone': 'America/Caracas'})

    assert codigo == 200 and respuesta['success'] is True
    usuario = User.query.one()
    assert (usuario.username, usuario.email, usuario.role, usuario.timezone) == (
        'ana', 'ana@x.com', 'setter', 'America/Caracas')
    assert usuario.check_password('la-clave-de-ana')
    assert not usuario.check_password('12345678')


def test_el_rol_por_defecto_es_closer(db):
    UserService.create_user({'username': 'ana', 'email': 'ana@x.com', 'password': 'la-clave-de-ana'})

    assert User.query.one().role == 'closer'


@pytest.mark.parametrize('datos', [{'username': 'ana', 'email': 'otro@x.com'}, {'username': 'otra', 'email': 'ana@x.com'}])
def test_un_usuario_o_email_repetido_es_un_error(db, make_user, datos):
    make_user(username='ana', email='ana@x.com')

    respuesta, codigo = UserService.create_user({**datos, 'password': 'la-clave-de-otra'})

    assert codigo == 400
    assert 'ya existe' in respuesta['message']
    assert User.query.count() == 1
