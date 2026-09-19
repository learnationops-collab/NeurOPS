"""/api/backup/*: exportar la base, previsualizarla y restaurarla.

Son las rutas mas peligrosas del sistema: exportar vuelca TODA la base (hashes de clave y datos
personales incluidos) y restaurar la BORRA y ejecuta el SQL subido. Antes estaban protegidas solo por
una clave escrita en el codigo (y en el bundle publico de la web) y `/api/backup/fix-auth` resetea la
clave de un admin sin autenticacion. Ahora exigen un admin logueado Y la clave de BACKUP_SECRET_KEY,
y sin esa variable quedan apagadas (503). Aca la clave es una de prueba: la real no se usa nunca.
"""
import pytest

from app.models import User

CLAVE = 'clave-de-prueba-de-mas-de-veinte-caracteres'
RUTAS = [
    ('get', '/api/backup/secret-backup-preview/{}'),
    ('get', '/api/backup/secret-backup-export/{}'),
    ('post', '/api/backup/secret-restore-import/{}'),
]


@pytest.fixture()
def clave_configurada(monkeypatch):
    monkeypatch.setenv('BACKUP_SECRET_KEY', CLAVE)


@pytest.fixture()
def admin(make_user):
    return make_user(role='admin', username='dueno')


def pedir(client, metodo, plantilla, clave=CLAVE, cabeceras=None, **extra):
    return getattr(client, metodo)(plantilla.format(clave), headers=cabeceras, **extra)


# --- Quien puede entrar -----------------------------------------------------------------------

@pytest.mark.parametrize('metodo,plantilla', RUTAS)
def test_sin_sesion_es_401_aunque_la_clave_sea_la_correcta(client, clave_configurada, metodo, plantilla):
    assert pedir(client, metodo, plantilla).status_code == 401


@pytest.mark.parametrize('metodo,plantilla', RUTAS)
@pytest.mark.parametrize('rol', ['operator', 'closer', 'setter', 'triage', 'hiring', 'director_comercial'])
def test_solo_un_admin_puede_usarlas_aunque_tenga_la_clave(
        client, make_user, auth_headers, clave_configurada, metodo, plantilla, rol):
    cabeceras = auth_headers(make_user(role=rol))

    assert pedir(client, metodo, plantilla, cabeceras=cabeceras).status_code == 403


# --- La clave --------------------------------------------------------------------------------

@pytest.mark.parametrize('metodo,plantilla', RUTAS)
def test_sin_la_variable_de_entorno_la_funcion_queda_apagada(client, admin, auth_headers, metodo, plantilla):
    respuesta = pedir(client, metodo, plantilla, cabeceras=auth_headers(admin))

    assert respuesta.status_code == 503
    assert 'BACKUP_SECRET_KEY' in respuesta.get_json()['message']


@pytest.mark.parametrize('metodo,plantilla', RUTAS)
def test_una_clave_demasiado_corta_no_abre_la_puerta(client, admin, auth_headers, monkeypatch, metodo, plantilla):
    monkeypatch.setenv('BACKUP_SECRET_KEY', 'corta')

    respuesta = pedir(client, metodo, plantilla, clave='corta', cabeceras=auth_headers(admin))

    assert respuesta.status_code == 503


@pytest.mark.parametrize('metodo,plantilla', RUTAS)
@pytest.mark.parametrize('clave', ['x', 'clave-equivocada', 'a' * 300, CLAVE.upper(), CLAVE[:-1], CLAVE + 'x', 'clavé'])
def test_una_clave_equivocada_es_403_y_nunca_un_500(client, admin, auth_headers, clave_configurada,
                                                    metodo, plantilla, clave):
    respuesta = pedir(client, metodo, plantilla, clave=clave, cabeceras=auth_headers(admin))

    assert respuesta.status_code == 403
    assert respuesta.get_json() == {'message': 'Invalid secret key. Access Denied.'}


def test_una_clave_equivocada_no_filtra_estadisticas_de_la_base(client, admin, auth_headers, clave_configurada):
    cuerpo = pedir(client, 'get', RUTAS[0][1], clave='equivocada', cabeceras=auth_headers(admin)).get_data(as_text=True)

    assert 'tables' not in cuerpo and 'users' not in cuerpo


# --- Con admin y clave correctos --------------------------------------------------------------

def test_la_vista_previa_lista_las_tablas_con_su_conteo(client, admin, auth_headers, clave_configurada):
    respuesta = pedir(client, 'get', RUTAS[0][1], cabeceras=auth_headers(admin))

    tablas = {t['name']: t['count'] for t in respuesta.get_json()['tables']}
    assert respuesta.status_code == 200
    assert tablas['users'] == 1
    assert len(tablas) >= 80


def test_exportar_devuelve_un_script_sql_descargable(client, admin, auth_headers, clave_configurada):
    respuesta = pedir(client, 'get', RUTAS[1][1], cabeceras=auth_headers(admin))

    sql = respuesta.get_data(as_text=True)
    assert respuesta.status_code == 200
    assert respuesta.mimetype == 'text/plain'
    assert 'attachment' in respuesta.headers['Content-Disposition']
    assert sql.startswith('-- NeurOPS Database Backup') and 'BEGIN;' in sql and sql.rstrip().endswith('COMMIT;')
    assert 'INSERT INTO users' in sql


@pytest.mark.xfail(strict=True, reason=(
    "BUG (solo SQLite, es decir desarrollo local): restore parte el script por ';' y descarta todo "
    "trozo que empiece por '--', pero el comentario '-- Table: x' va pegado a su primer INSERT, asi que "
    "la PRIMERA fila de cada tabla no se restaura. En Postgres (produccion) se ejecuta el script entero."))
def test_exportar_y_restaurar_devuelve_todos_los_datos(client, db, make_user, auth_headers, clave_configurada):
    admin = make_user(role='admin', username='dueno')
    make_user(role='closer', username='carla')
    make_user(role='setter', username='beto')
    cabeceras = auth_headers(admin)
    sql = pedir(client, 'get', RUTAS[1][1], cabeceras=cabeceras).get_data()
    User.query.filter(User.username != 'dueno').delete()
    db.session.commit()

    respuesta = pedir(client, 'post', RUTAS[2][1], cabeceras=cabeceras, data={'file': (_bytes(sql), 'backup.sql')},
                      content_type='multipart/form-data')

    db.session.expire_all()
    assert respuesta.status_code == 200
    assert sorted(u.username for u in User.query.all()) == ['beto', 'carla', 'dueno']


def _bytes(contenido):
    import io
    return io.BytesIO(contenido)


def test_restaurar_pide_un_archivo(client, admin, auth_headers, clave_configurada):
    cabeceras = auth_headers(admin)

    sin_archivo = pedir(client, 'post', RUTAS[2][1], cabeceras=cabeceras)
    sin_nombre = pedir(client, 'post', RUTAS[2][1], cabeceras=cabeceras, data={'file': (_bytes(b'x'), '')},
                       content_type='multipart/form-data')

    assert sin_archivo.status_code == sin_nombre.status_code == 400


def test_restaurar_con_clave_equivocada_no_toca_la_base(client, admin, auth_headers, clave_configurada):
    respuesta = pedir(client, 'post', RUTAS[2][1], clave='equivocada', cabeceras=auth_headers(admin),
                      data={'file': (_bytes(b'-- sql'), 'backup.sql')}, content_type='multipart/form-data')

    assert respuesta.status_code == 403
    assert User.query.filter_by(username='dueno').count() == 1


# --- fix-auth: la ruta ya no existe -----------------------------------------------------------

@pytest.fixture()
def sin_spa(app, tmp_path, monkeypatch):
    """Carpeta estatica vacia: lo que no es una ruta real da 404 en vez de servir index.html."""
    monkeypatch.setattr(app, 'static_folder', str(tmp_path))


def test_fix_auth_ya_no_existe(client, sin_spa):
    assert client.get('/api/backup/fix-auth').status_code == 404


def test_fix_auth_no_crea_usuarios_para_un_anonimo(client, db, sin_spa):
    client.get('/api/backup/fix-auth')

    assert User.query.count() == 0


def test_fix_auth_no_resetea_la_clave_de_un_admin(client, db, make_user, sin_spa):
    admin = make_user(role='admin', username='dueno', email='admin@neurops.com', password='clave-original')

    respuesta = client.get('/api/backup/fix-auth')

    db.session.refresh(admin)
    assert admin.check_password('clave-original')
    assert 'credentials' not in respuesta.get_data(as_text=True)
