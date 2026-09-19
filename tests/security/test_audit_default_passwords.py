"""scripts/auditar_contrasenas_por_defecto.py: que cuentas siguen con una clave por defecto conocida.

Es una herramienta para que el DUENO la corra contra la base real (solo lectura). Lo que importa: detecta
cada clave por defecto historica, no marca una clave propia, no escribe nada, y NUNCA imprime claves ni
hashes ni la URL de la base (que lleva la clave de la base).
"""
import importlib.util
import io
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from werkzeug.security import generate_password_hash

RAIZ = Path(__file__).resolve().parents[2]


def _cargar_script():
    ruta = RAIZ / 'scripts' / 'auditar_contrasenas_por_defecto.py'
    especificacion = importlib.util.spec_from_file_location('auditar_contrasenas_por_defecto', ruta)
    modulo = importlib.util.module_from_spec(especificacion)
    especificacion.loader.exec_module(modulo)
    return modulo


auditoria = _cargar_script()


def _hash(clave):
    return generate_password_hash(clave, method='pbkdf2:sha256:1')  # barato: no importa el metodo, check lo lee


def _fila(id_, username, clave, email=None, role='closer', is_active=True):
    return (id_, username, email or f'{username}@x.com', role, is_active, _hash(clave) if clave is not None else None)


# --- La busqueda ------------------------------------------------------------------------------

@pytest.mark.parametrize('clave', sorted(auditoria.CLAVES_POR_DEFECTO))
def test_detecta_cada_clave_por_defecto_con_su_origen(clave):
    afectadas, _, _ = auditoria.buscar_cuentas_con_clave_conocida([_fila(1, 'ana', clave)])

    assert [(c['username'], c['origen']) for c in afectadas] == [('ana', auditoria.CLAVES_POR_DEFECTO[clave])]


def test_las_claves_por_defecto_son_las_que_el_codigo_uso():
    # Las que llegaron a estar escritas en app/ o en los scripts de semilla (siguen en el historial de git).
    assert {'NeurOPS2025!', '12345678', 'admin123', 'closer123', 'temporal123', 'temp1234'} <= set(
        auditoria.CLAVES_POR_DEFECTO)


def test_una_clave_propia_no_se_marca():
    afectadas, sin_clave, _ = auditoria.buscar_cuentas_con_clave_conocida([
        _fila(1, 'ana', 'una-clave-larga-y-propia-de-ana'), _fila(2, 'beto', 'NeurOPS2025')])  # casi, pero no

    assert afectadas == [] and sin_clave == 0


def test_mezcla_de_cuentas_solo_marca_las_afectadas():
    afectadas, _, _ = auditoria.buscar_cuentas_con_clave_conocida([
        _fila(1, 'ana', 'propia-de-ana-1234'), _fila(2, 'beto', 'admin123'), _fila(3, 'caro', '12345678')])

    assert [c['username'] for c in afectadas] == ['beto', 'caro']


@pytest.mark.parametrize('hash_guardado', [None, ''])
def test_una_cuenta_sin_clave_guardada_se_cuenta_aparte(hash_guardado):
    fila = (1, 'ana', 'ana@x.com', 'closer', True, hash_guardado)

    afectadas, sin_clave, _ = auditoria.buscar_cuentas_con_clave_conocida([fila])

    assert afectadas == [] and sin_clave == 1


def test_una_cuenta_desactivada_con_clave_conocida_tambien_se_reporta():
    afectadas, _, _ = auditoria.buscar_cuentas_con_clave_conocida([_fila(1, 'ana', 'admin123', is_active=False)])

    assert len(afectadas) == 1 and afectadas[0]['is_active'] is False


def test_las_cuentas_de_fix_auth_se_avisan_aunque_la_clave_sea_otra():
    _, _, de_fix_auth = auditoria.buscar_cuentas_con_clave_conocida([
        _fila(1, 'admin', 'una-clave-larga-y-propia', email='admin@neurops.com', role='admin'),
        _fila(2, 'otra', 'propia-1234', email='otra@x.com')])

    assert [c['email'] for c in de_fix_auth] == ['admin@neurops.com']


# --- Contra una base real (SQLite en un archivo temporal) -------------------------------------

@pytest.fixture()
def base(tmp_path):
    """(url, ruta) de una base con la tabla users y un caso de cada tipo."""
    ruta = tmp_path / 'auditoria.db'
    url = f'sqlite:///{ruta.as_posix()}'
    motor = create_engine(url)
    with motor.begin() as conexion:
        conexion.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, role TEXT, '
                              'is_active BOOLEAN, password_hash TEXT)'))
        for fila in (_fila(1, 'ana', 'una-clave-larga-y-propia'), _fila(2, 'beto', 'NeurOPS2025!'),
                     _fila(3, 'admin', 'admin123', email='admin@neurops.com', role='admin'),
                     _fila(4, 'sin_clave', None)):
            conexion.execute(text('INSERT INTO users VALUES (:i, :u, :e, :r, :a, :h)'),
                             dict(zip('iuerah', fila)))
    motor.dispose()
    return url, ruta


def _correr(argv):
    salida = io.StringIO()
    codigo = auditoria.main(argv, salida=salida)
    return codigo, salida.getvalue()


def test_con_cuentas_afectadas_sale_1_y_las_lista(base):
    url, _ = base

    codigo, texto = _correr(['--url', url])

    assert codigo == 1
    assert 'Cuentas revisadas: 4' in texto
    assert 'usuario=beto' in texto and 'usuario=admin' in texto
    assert 'usuario=ana' not in texto  # la de clave propia no aparece
    assert 'importacion de agendas' in texto  # de donde salia la clave de beto
    assert 'existen cuentas con el email de las que creaba el endpoint fix-auth' in texto
    assert '1 cuenta(s) sin clave guardada' in texto


def test_nunca_imprime_claves_ni_hashes(base):
    url, _ = base

    _, texto = _correr(['--url', url])

    for clave in list(auditoria.CLAVES_POR_DEFECTO) + ['una-clave-larga-y-propia']:
        assert clave not in texto
    assert 'pbkdf2' not in texto and 'scrypt' not in texto


def test_sin_cuentas_afectadas_sale_0(tmp_path):
    ruta = tmp_path / 'limpia.db'
    motor = create_engine(f'sqlite:///{ruta.as_posix()}')
    with motor.begin() as conexion:
        conexion.execute(text('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, role TEXT, '
                              'is_active BOOLEAN, password_hash TEXT)'))
        conexion.execute(text('INSERT INTO users VALUES (1, :u, :e, :r, 1, :h)'),
                         {'u': 'ana', 'e': 'ana@x.com', 'r': 'closer', 'h': _hash('una-clave-larga-y-propia')})
    motor.dispose()

    codigo, texto = _correr(['--url', f'sqlite:///{ruta.as_posix()}'])

    assert codigo == 0
    assert 'Ninguna cuenta tiene una clave por defecto conocida' in texto


def test_no_modifica_la_base(base):
    url, ruta = base
    antes = ruta.read_bytes()

    _correr(['--url', url])

    assert ruta.read_bytes() == antes


def test_la_conexion_es_de_solo_lectura_aunque_se_intentara_escribir(base):
    url, _ = base
    conexion = auditoria.abrir_solo_lectura(url)
    try:
        with pytest.raises(OperationalError):
            conexion.execute(text("UPDATE users SET username = 'x'"))
    finally:
        conexion.close()


def test_en_postgres_lo_primero_es_declarar_la_transaccion_de_solo_lectura(monkeypatch):
    ejecutadas, urls = [], []

    class Conexion:
        def execute(self, consulta):
            ejecutadas.append(str(consulta))

    class Motor:
        dialect = type('Dialecto', (), {'name': 'postgresql'})()

        def connect(self):
            return Conexion()

    def falso_create_engine(url):
        urls.append(url)
        return Motor()

    monkeypatch.setattr(auditoria, 'create_engine', falso_create_engine)

    auditoria.abrir_solo_lectura('postgres://usuario:clave@host:5432/db')

    assert urls == ['postgresql://usuario:clave@host:5432/db']  # el esquema que entrega Railway se normaliza
    assert ejecutadas == ['SET TRANSACTION READ ONLY']


def test_sin_url_avisa_y_sale_2(monkeypatch):
    monkeypatch.delenv('DATABASE_URL', raising=False)

    codigo, texto = _correr([])

    assert codigo == 2
    assert 'DATABASE_URL' in texto


def test_toma_la_url_de_DATABASE_URL(base, monkeypatch):
    url, _ = base
    monkeypatch.setenv('DATABASE_URL', url)

    codigo, _ = _correr([])

    assert codigo == 1


def test_si_no_puede_leer_la_base_sale_2_y_no_imprime_la_url(tmp_path):
    url = f'sqlite:///{(tmp_path / "no-existe" / "x.db").as_posix()}?clave=SECRETO-DE-LA-BASE'

    codigo, texto = _correr(['--url', url])

    assert codigo == 2
    assert 'No se pudo leer la base' in texto
    assert 'SECRETO-DE-LA-BASE' not in texto and 'no-existe' not in texto
