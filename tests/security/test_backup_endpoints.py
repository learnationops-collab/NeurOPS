"""/api/backup/*: previsualizar la base y exportarla con pg_dump.

Exportar vuelca TODA la base (hashes de clave y datos personales incluidos). Antes estaba protegida
solo por una clave escrita en el codigo (y en el bundle publico de la web) y `/api/backup/fix-auth`
reseteaba la clave de un admin sin autenticacion. Ahora exige un admin u operador logueado (el operador
desde el 10/10/2026, cuando el respaldo paso a Operaciones) Y la clave de BACKUP_SECRET_KEY en el header
X-Backup-Key (desde el 26/10/2026; antes iba en la ruta y quedaba en los logs), y sin esa variable queda
apagada (503). El 26/10/2026 la exportacion paso a pg_dump y se retiro la restauracion desde la web (el
SQL armado a mano no escapaba comillas en los JSON y se ejecutaba entero al restaurar). Aca la clave es
una de prueba: la real no se usa nunca.
"""
import io

import pytest

from app.api import backup as modulo_backup
from app.models import User

CLAVE = 'clave-de-prueba-de-mas-de-veinte-caracteres'
RUTAS = [
    ('get', '/api/backup/preview'),
    ('get', '/api/backup/export'),
]


@pytest.fixture()
def clave_configurada(monkeypatch):
    monkeypatch.setenv('BACKUP_SECRET_KEY', CLAVE)


@pytest.fixture()
def admin(make_user):
    return make_user(role='admin', username='dueno')


@pytest.fixture()
def sin_spa(app, tmp_path, monkeypatch):
    """Carpeta estatica vacia: lo que no es una ruta real da 404 en vez de servir index.html."""
    monkeypatch.setattr(app, 'static_folder', str(tmp_path))


def pedir(client, metodo, ruta, clave=CLAVE, cabeceras=None, **extra):
    cabeceras = dict(cabeceras or {})
    if clave is not None:
        cabeceras['X-Backup-Key'] = clave
    return getattr(client, metodo)(ruta, headers=cabeceras, **extra)


# --- Quien puede entrar -----------------------------------------------------------------------

@pytest.mark.parametrize('metodo,ruta', RUTAS)
def test_sin_sesion_es_401_aunque_la_clave_sea_la_correcta(client, clave_configurada, metodo, ruta):
    assert pedir(client, metodo, ruta).status_code == 401


@pytest.mark.parametrize('metodo,ruta', RUTAS)
@pytest.mark.parametrize('rol', ['closer', 'setter', 'triage', 'hiring', 'director_comercial'])
def test_solo_admin_u_operador_pueden_usarlas_aunque_tengan_la_clave(
        client, make_user, auth_headers, clave_configurada, metodo, ruta, rol):
    cabeceras = auth_headers(make_user(role=rol))

    assert pedir(client, metodo, ruta, cabeceras=cabeceras).status_code == 403


def test_el_operador_entra_con_la_clave_porque_el_respaldo_esta_en_operaciones(
        client, make_user, auth_headers, clave_configurada):
    respuesta = pedir(client, 'get', RUTAS[0][1], cabeceras=auth_headers(make_user(role='operator')))

    assert respuesta.status_code == 200


# --- La clave --------------------------------------------------------------------------------

@pytest.mark.parametrize('metodo,ruta', RUTAS)
def test_sin_la_variable_de_entorno_la_funcion_queda_apagada(client, admin, auth_headers, metodo, ruta):
    respuesta = pedir(client, metodo, ruta, cabeceras=auth_headers(admin))

    assert respuesta.status_code == 503
    assert 'BACKUP_SECRET_KEY' in respuesta.get_json()['message']


@pytest.mark.parametrize('metodo,ruta', RUTAS)
def test_una_clave_demasiado_corta_no_abre_la_puerta(client, admin, auth_headers, monkeypatch, metodo, ruta):
    monkeypatch.setenv('BACKUP_SECRET_KEY', 'corta')

    respuesta = pedir(client, metodo, ruta, clave='corta', cabeceras=auth_headers(admin))

    assert respuesta.status_code == 503


@pytest.mark.parametrize('metodo,ruta', RUTAS)
@pytest.mark.parametrize('clave', [None, '', 'x', 'clave-equivocada', 'a' * 300, CLAVE.upper(), CLAVE[:-1],
                                   CLAVE + 'x', 'clavé'])
def test_una_clave_equivocada_es_403_y_nunca_un_500(client, admin, auth_headers, clave_configurada,
                                                    metodo, ruta, clave):
    respuesta = pedir(client, metodo, ruta, clave=clave, cabeceras=auth_headers(admin))

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


def test_exportar_con_sqlite_avisa_que_solo_funciona_con_postgres(client, admin, auth_headers, clave_configurada):
    respuesta = pedir(client, 'get', RUTAS[1][1], cabeceras=auth_headers(admin))

    assert respuesta.status_code == 503
    assert 'PostgreSQL' in respuesta.get_json()['message']


class _PgDumpFalso:
    """Popen de mentira: devuelve `salida` por stdout y termina con `codigo`."""
    llamadas = []

    def __init__(self, salida, codigo):
        self.salida, self.codigo = salida, codigo

    def __call__(self, args, env=None, **_):
        _PgDumpFalso.llamadas.append((args, env))
        self.stdout = io.BufferedReader(io.BytesIO(self.salida))
        return self

    def poll(self):
        return self.codigo

    def wait(self):
        return self.codigo

    def kill(self):
        pass


@pytest.fixture()
def con_postgres(app, monkeypatch):
    monkeypatch.setitem(app.config, 'SQLALCHEMY_DATABASE_URI', 'postgresql://usuario:clave-db@base:5432/neurops')
    monkeypatch.setattr(modulo_backup.shutil, 'which', lambda _: '/usr/bin/pg_dump')
    _PgDumpFalso.llamadas = []


def test_exportar_descarga_el_pg_dump_sin_la_contrasena_en_los_argumentos(
        client, admin, auth_headers, clave_configurada, con_postgres, monkeypatch):
    volcado = b'PGDMP' + b'x' * 200000
    monkeypatch.setattr(modulo_backup.subprocess, 'Popen', _PgDumpFalso(volcado, 0))

    respuesta = pedir(client, 'get', RUTAS[1][1], cabeceras=auth_headers(admin))

    args, env = _PgDumpFalso.llamadas[0]
    assert respuesta.status_code == 200
    assert respuesta.mimetype == 'application/octet-stream'
    assert respuesta.headers['Content-Disposition'].endswith('.dump')
    assert respuesta.get_data() == volcado
    assert '--format=custom' in args and not any('clave-db' in a for a in args)
    assert (env['PGHOST'], env['PGUSER'], env['PGPASSWORD'], env['PGDATABASE']) == (
        'base', 'usuario', 'clave-db', 'neurops')


def test_si_pg_dump_falla_antes_de_escribir_es_un_500_sin_secretos(
        client, admin, auth_headers, clave_configurada, con_postgres, monkeypatch):
    monkeypatch.setattr(modulo_backup.subprocess, 'Popen', _PgDumpFalso(b'', 1))

    respuesta = pedir(client, 'get', RUTAS[1][1], cabeceras=auth_headers(admin))

    assert respuesta.status_code == 500
    assert respuesta.get_json() == {'message': 'Backup failed'}


# --- Rutas viejas: la clave en la ruta y la restauracion desde la web ---------------------------

@pytest.mark.parametrize('metodo,ruta', [
    ('get', f'/api/backup/secret-backup-preview/{CLAVE}'),
    ('get', f'/api/backup/secret-backup-export/{CLAVE}'),
    ('post', f'/api/backup/secret-restore-import/{CLAVE}'),
])
def test_las_rutas_viejas_ya_no_existen(client, admin, auth_headers, clave_configurada, sin_spa, metodo, ruta):
    assert getattr(client, metodo)(ruta, headers=auth_headers(admin)).status_code in (404, 405)


# --- fix-auth: la ruta ya no existe -----------------------------------------------------------

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
