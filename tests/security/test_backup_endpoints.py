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


def _bytes(contenido):
    import io
    return io.BytesIO(contenido)


def _restaurar(client, cabeceras, sql):
    return pedir(client, 'post', RUTAS[2][1], cabeceras=cabeceras, data={'file': (_bytes(sql), 'backup.sql')},
                 content_type='multipart/form-data')


# --- Exportar y restaurar (en SQLite; en Postgres se ejecuta el script entero) ----------------
# La restauracion en SQLite partia el script por ';' y descartaba todo trozo que empezara por '--': como
# el comentario '-- Table: x (3 records)' va pegado al primer INSERT, la PRIMERA fila de cada tabla no se
# restauraba, y un ';' dentro de un texto rompia la sentencia. Ahora acumula lineas hasta que SQLite dice
# que la sentencia esta completa.

def test_exportar_y_restaurar_devuelve_todos_los_datos(client, db, make_user, auth_headers, clave_configurada):
    admin = make_user(role='admin', username='dueno')
    make_user(role='closer', username='carla')
    make_user(role='setter', username='beto')
    cabeceras = auth_headers(admin)
    sql = pedir(client, 'get', RUTAS[1][1], cabeceras=cabeceras).get_data()
    User.query.filter(User.username != 'dueno').delete()
    db.session.commit()

    respuesta = _restaurar(client, cabeceras, sql)

    db.session.expire_all()
    assert respuesta.status_code == 200
    assert sorted(u.username for u in User.query.all()) == ['beto', 'carla', 'dueno']


def test_restaurar_conserva_la_primera_fila_de_cada_tabla(client, db, make_user, auth_headers, clave_configurada):
    from app.models import Client
    cabeceras = auth_headers(make_user(role='admin', username='dueno'))
    db.session.add_all([Client(full_name=f'Cliente {n}', email=f'c{n}@x.com') for n in (1, 2, 3)])
    db.session.commit()
    sql = pedir(client, 'get', RUTAS[1][1], cabeceras=cabeceras).get_data()

    _restaurar(client, cabeceras, sql)

    db.session.expire_all()
    assert sorted(c.email for c in Client.query.all()) == ['c1@x.com', 'c2@x.com', 'c3@x.com']


def test_restaurar_conserva_textos_con_punto_y_coma_comillas_y_saltos_de_linea(
        client, db, make_user, auth_headers, clave_configurada):
    from app.models import Client
    cabeceras = auth_headers(make_user(role='admin', username='dueno'))
    observacion = ("linea 1\nlinea 2; con 'comillas' y -- guiones\nuna linea que termina en punto y coma;\n"
                   "-- Table: falsa (9 records)\nBEGIN; COMMIT;")
    db.session.add(Client(full_name='Ana; Gomez', email='ana@x.com', observaciones=observacion))
    db.session.commit()
    sql = pedir(client, 'get', RUTAS[1][1], cabeceras=cabeceras).get_data()
    Client.query.delete()
    db.session.commit()

    respuesta = _restaurar(client, cabeceras, sql)

    db.session.expire_all()
    ana = Client.query.one()
    assert respuesta.status_code == 200
    assert (ana.full_name, ana.email, ana.observaciones) == ('Ana; Gomez', 'ana@x.com', observacion)


def test_restaurar_un_archivo_con_marca_bom(client, db, make_user, auth_headers, clave_configurada):
    # Un editor de Windows puede guardar el .sql con BOM: no debe romper la primera sentencia.
    cabeceras = auth_headers(make_user(role='admin', username='dueno'))
    make_user(role='closer', username='carla')
    sql = pedir(client, 'get', RUTAS[1][1], cabeceras=cabeceras).get_data()

    respuesta = _restaurar(client, cabeceras, b'\xef\xbb\xbf' + sql)

    db.session.expire_all()
    assert respuesta.status_code == 200
    assert sorted(u.username for u in User.query.all()) == ['carla', 'dueno']


def test_restaurar_un_archivo_con_un_error_deja_la_base_como_estaba(client, db, make_user, auth_headers,
                                                                    clave_configurada):
    cabeceras = auth_headers(make_user(role='admin', username='dueno'))
    make_user(role='closer', username='carla')
    roto = b"-- backup roto\nBEGIN;\nINSERT INTO tabla_que_no_existe (a) VALUES (1);\nCOMMIT;\n"

    respuesta = _restaurar(client, cabeceras, roto)

    db.session.expire_all()
    assert respuesta.status_code == 500
    assert 'Statement #1 failed' in respuesta.get_json()['message']
    assert sorted(u.username for u in User.query.all()) == ['carla', 'dueno']  # nada se borro


def test_restaurar_un_archivo_truncado_avisa_y_deja_la_base_como_estaba(client, db, make_user, auth_headers,
                                                                        clave_configurada):
    cabeceras = auth_headers(make_user(role='admin', username='dueno'))
    make_user(role='closer', username='carla')
    sql = pedir(client, 'get', RUTAS[1][1], cabeceras=cabeceras).get_data()
    truncado = sql[:sql.index(b'INSERT INTO users') + 60]  # corta a mitad de una sentencia

    respuesta = _restaurar(client, cabeceras, truncado)

    db.session.expire_all()
    assert respuesta.status_code == 500
    assert 'truncado' in respuesta.get_json()['message']
    assert sorted(u.username for u in User.query.all()) == ['carla', 'dueno']


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
