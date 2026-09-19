"""Rutas peligrosas que se eliminaron y no deben volver.

Cada una permitia tomar o crear una cuenta de administrador sin autenticacion:
  - GET /api/backup/fix-auth reseteaba la clave de admin@neurops.com a un valor escrito en el codigo.
  - /api/auth/emergency-create creaba usuarios administradores con un secreto escrito en el backend
    (eliminada en junio de 2026; su pagina del frontend siguio publica hasta ahora).
Se prueba que no exista NINGUNA regla con esos nombres, que pedirlas no responda con exito y que no dejen
usuarios ni cambien claves.
"""
import pytest

from app.models import User

RUTAS_ELIMINADAS = [
    ('get', '/api/backup/fix-auth'),
    ('post', '/api/backup/fix-auth'),
    ('get', '/api/auth/emergency-create'),
    ('post', '/api/auth/emergency-create'),
    ('get', '/auth/emergency-create'),
    ('post', '/auth/emergency-create'),
]
NOMBRES_PELIGROSOS = ('fix-auth', 'emergency-create')


@pytest.fixture()
def sin_spa(app, tmp_path, monkeypatch):
    """Carpeta estatica vacia: lo que no es una ruta real da 404 en vez de servir index.html."""
    monkeypatch.setattr(app, 'static_folder', str(tmp_path))


def test_ninguna_regla_lleva_un_nombre_de_ruta_peligrosa(app):
    reglas = [regla.rule for regla in app.url_map.iter_rules()]

    assert [r for r in reglas if any(nombre in r for nombre in NOMBRES_PELIGROSOS)] == []


@pytest.mark.parametrize('metodo,ruta', RUTAS_ELIMINADAS)
def test_pedirlas_no_responde_con_exito(client, sin_spa, metodo, ruta):
    respuesta = getattr(client, metodo)(ruta, json={'secret': 'x', 'username': 'intruso', 'password': 'clave-larga-1234',
                                                    'role': 'admin'})

    assert respuesta.status_code in (302, 401, 403, 404, 405)


@pytest.mark.parametrize('metodo,ruta', RUTAS_ELIMINADAS)
def test_pedirlas_no_crea_usuarios(client, db, sin_spa, metodo, ruta):
    getattr(client, metodo)(ruta, json={'secret': 'x', 'username': 'intruso', 'password': 'clave-larga-1234', 'role': 'admin'})

    assert User.query.count() == 0


@pytest.mark.parametrize('metodo,ruta', RUTAS_ELIMINADAS)
def test_pedirlas_no_cambia_la_clave_de_un_admin(client, db, make_user, sin_spa, metodo, ruta):
    admin = make_user(role='admin', username='dueno', email='admin@neurops.com', password='clave-original-1234')

    getattr(client, metodo)(ruta, json={'password': 'admin123'})

    db.session.refresh(admin)
    assert admin.check_password('clave-original-1234')
    assert User.query.count() == 1
