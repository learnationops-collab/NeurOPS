"""/api/backup/*: exportar la base, restaurarla y "arreglar" usuarios.

Son las rutas mas peligrosas del sistema: exportar vuelca TODA la base (hashes de clave y datos
personales incluidos), restaurar la BORRA y ejecuta el SQL subido, y fix-auth crea o resetea un
admin. Estan exentas de CSRF y no tienen sesion detras. Aca solo se prueba con claves equivocadas y
en la base de los tests: la clave real esta escrita en el codigo y nunca se usa en un test.
"""
import pytest

from app.models import User

CLAVES_EQUIVOCADAS = ['x', 'clave-equivocada', 'a' * 300]
RUTAS_CON_CLAVE = [
    ('get', '/api/backup/secret-backup-preview/{}'),
    ('get', '/api/backup/secret-backup-export/{}'),
    ('post', '/api/backup/secret-restore-import/{}'),
]
CORREO_ADMIN = 'admin@neurops.com'


@pytest.mark.parametrize('metodo,plantilla', RUTAS_CON_CLAVE)
@pytest.mark.parametrize('clave', CLAVES_EQUIVOCADAS)
def test_con_una_clave_equivocada_se_rechaza(client, metodo, plantilla, clave):
    respuesta = getattr(client, metodo)(plantilla.format(clave))

    assert respuesta.status_code == 403
    assert respuesta.get_json() == {'message': 'Invalid secret key. Access Denied.'}


def test_restaurar_con_clave_equivocada_no_toca_la_base(client, make_user):
    make_user(username='ana')
    archivo = (b'-- SQL de prueba', 'backup.sql')

    respuesta = client.post('/api/backup/secret-restore-import/clave-equivocada', data={'file': archivo},
                            content_type='multipart/form-data')

    assert respuesta.status_code == 403
    assert User.query.filter_by(username='ana').count() == 1


def test_una_clave_equivocada_no_filtra_estadisticas_de_la_base(client, make_user):
    make_user(username='ana')

    cuerpo = client.get('/api/backup/secret-backup-preview/clave-equivocada').get_data(as_text=True)

    assert 'tables' not in cuerpo and 'users' not in cuerpo


# --- fix-auth ---------------------------------------------------------------------------------

@pytest.mark.xfail(strict=True, reason=(
    "BUG CRITICO: GET /api/backup/fix-auth no tiene autenticacion y RESETEA la clave de "
    "admin@neurops.com a un valor fijo escrito en el codigo (y la de closer@neurops.com), la reactiva "
    "y devuelve las credenciales en la respuesta. Cualquiera en internet puede tomar esa cuenta admin. "
    "Solucion: eliminar la ruta (o protegerla con un secreto de entorno y dejarla apagada por defecto)."))
def test_fix_auth_no_resetea_la_clave_de_un_admin_a_un_anonimo(client, db, make_user):
    admin = make_user(role='admin', username='dueno', email=CORREO_ADMIN, password='clave-original')

    respuesta = client.get('/api/backup/fix-auth')

    db.session.refresh(admin)
    assert admin.check_password('clave-original')
    assert respuesta.status_code in (401, 403, 404)


@pytest.mark.xfail(strict=True, reason=(
    "BUG CRITICO: GET /api/backup/fix-auth crea un admin (y un closer) con credenciales fijas del "
    "codigo si no existen, sin autenticacion."))
def test_fix_auth_no_crea_usuarios_para_un_anonimo(client, db):
    client.get('/api/backup/fix-auth')

    assert User.query.count() == 0
