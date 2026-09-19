"""config.py: la clave secreta que firma los JWT y las cookies seguras segun el entorno.

Cada caso importa `config` en un PROCESO LIMPIO, sin .env y con solo las variables que define, para
no tocar el estado del proceso de tests ni depender de quien lo corra. SECRET_KEY firma todos los
JWT: si un despliegue arrancara sin ella con la clave de desarrollo (que esta en el repo), cualquiera
podria fabricar un token de admin.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
CODIGO = (
    "import dotenv, json; dotenv.load_dotenv = lambda *a, **k: False; import config; c = config.Config; "
    "print(json.dumps({'secret': c.SECRET_KEY, 'db': c.SQLALCHEMY_DATABASE_URI, "
    "'session_secure': c.SESSION_COOKIE_SECURE, 'remember_secure': c.REMEMBER_COOKIE_SECURE, "
    "'samesite': c.SESSION_COOKIE_SAMESITE, 'engine_options': getattr(c, 'SQLALCHEMY_ENGINE_OPTIONS', None)}))"
)


def importar_config(**entorno):
    """(codigo de salida, configuracion como dict o None, stderr) en un proceso sin .env."""
    base = {k: os.environ[k] for k in ('PATH', 'SYSTEMROOT', 'TEMP', 'TMP') if k in os.environ}
    proceso = subprocess.run([sys.executable, '-c', CODIGO], cwd=RAIZ, env={**base, **entorno},
                             capture_output=True, text=True, timeout=60)
    salida = json.loads(proceso.stdout) if proceso.returncode == 0 else None
    return proceso.returncode, salida, proceso.stderr


# --- SECRET_KEY -------------------------------------------------------------------------------

# Produccion = FLASK_ENV/ENV en 'production' o CUALQUIER despliegue de Railway (define siempre
# RAILWAY_ENVIRONMENT, con el nombre del entorno: production, staging, pr-123...). El guard solo
# miraba las dos primeras y, si Railway perdiera SECRET_KEY, la app arrancaria con la clave de
# desarrollo (que esta en el repositorio) y cualquiera podria firmar un JWT de admin.
ENTORNOS_DE_PRODUCCION = [
    {'FLASK_ENV': 'production'},
    {'ENV': 'production'},
    {'RAILWAY_ENVIRONMENT': 'production'},
    {'RAILWAY_ENVIRONMENT': 'staging'},
    {'RAILWAY_ENVIRONMENT': ''},  # definida pero vacia: cuenta igual que para las cookies seguras
]


@pytest.mark.parametrize('entorno', ENTORNOS_DE_PRODUCCION)
def test_en_produccion_sin_secret_key_no_arranca(entorno):
    codigo, _, error = importar_config(**entorno)

    assert codigo != 0
    assert 'SECRET_KEY' in error


@pytest.mark.parametrize('entorno', ENTORNOS_DE_PRODUCCION)
def test_en_produccion_con_secret_key_la_usa_tal_cual(entorno):
    codigo, config, _ = importar_config(SECRET_KEY='clave-real-de-produccion-1234567890', **entorno)

    assert codigo == 0
    assert config['secret'] == 'clave-real-de-produccion-1234567890'


def test_una_secret_key_vacia_en_produccion_tampoco_arranca():
    # Railway permite definir una variable sin valor: cuenta como no configurada.
    codigo, _, error = importar_config(FLASK_ENV='production', SECRET_KEY='')

    assert codigo != 0
    assert 'SECRET_KEY' in error


def test_fuera_de_produccion_sin_secret_key_usa_una_clave_de_desarrollo():
    codigo, config, _ = importar_config(FLASK_ENV='development')

    assert codigo == 0
    assert config['secret']


# --- Cookies seguras --------------------------------------------------------------------------

@pytest.mark.parametrize('entorno,seguras', [
    ({}, False),
    ({'FLASK_ENV': 'development'}, False),
    ({'FLASK_ENV': 'production', 'SECRET_KEY': 'x' * 32}, True),
    ({'ENV': 'production', 'SECRET_KEY': 'x' * 32}, True),
    ({'RAILWAY_ENVIRONMENT': 'production', 'SECRET_KEY': 'x' * 32}, True),
])
def test_las_cookies_son_seguras_solo_en_produccion_o_railway(entorno, seguras):
    codigo, config, _ = importar_config(**entorno)

    assert codigo == 0
    assert config['session_secure'] is seguras
    assert config['remember_secure'] is seguras


def test_samesite_es_lax():
    _, config, _ = importar_config()

    assert config['samesite'] == 'Lax'


# --- Base de datos ----------------------------------------------------------------------------

def test_sin_database_url_usa_sqlite_local():
    _, config, _ = importar_config()

    assert config['db'] == 'sqlite:///local.db'
    assert config['engine_options'] == {'connect_args': {'timeout': 30}}  # menos 'database is locked'


def test_con_postgres_no_aplica_las_opciones_de_sqlite():
    _, config, _ = importar_config(DATABASE_URL='postgresql://u:p@host:5432/db')

    assert config['db'] == 'postgresql://u:p@host:5432/db'
    assert config['engine_options'] is None
