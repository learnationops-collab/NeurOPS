"""Infraestructura de tests de NeurOPS.

Tres reglas que este archivo garantiza para TODA la suite:

  1. Ningun test lee el `.env` real (trae DATABASE_PRODUCTION/STAGING, WHATCHIMP_API_KEY y tokens).
  2. Ningun test toca una base real: siempre SQLite en memoria.
  3. Ningun test sale a la red: el scheduler de WhatsApp queda apagado y los sockets bloqueados.

El bloque de aislamiento corre al IMPORTAR este archivo, antes de que nadie importe `config` o
`app`: `config.py` llama a load_dotenv() al importarse y `create_app()` arranca el scheduler que
manda WhatsApp reales. Por eso no puede vivir dentro de un fixture.
"""
import itertools
import os
import socket

import dotenv
import pytest
from flask import g, has_app_context
from flask.testing import FlaskClient

# --- 1) Aislamiento del entorno ---------------------------------------------------------------

# load_dotenv() sin efecto: el .env del desarrollador nunca entra a los tests.
dotenv.load_dotenv = lambda *args, **kwargs: False

# Variables que el codigo lee (os.environ / os.getenv). Se vacian para que el resultado de un test
# no dependa del shell de quien lo corre, ni pueda hablar con un servicio real.
VARIABLES_A_LIMPIAR = (
    'ACADEMY_API_TOKEN', 'ACADEMY_INBOUND_API_TOKEN', 'DEV_PLATFORM_INBOUND_API_TOKEN',
    'BACKUP_SECRET_KEY', 'MANYCHAT_WEBHOOK_TOKEN', 'INGEST_API_TOKEN', 'INTEGRATIONS_AUTH_MODE',
    'AGENDAS_SOURCE_TZ', 'CRON_SECRET', 'CLIENT_ID', 'CLIENT_SECRET',
    'REDIRECT_URI_PROD', 'REDIRECT_URI_DEV', 'FRONTEND_URL',
    'DISCORD_ALERTS_WEBHOOK', 'DISCORD_REPORTS_WEBHOOK', 'DISCORD_WINS_WEBHOOK',
    'DISCORD_ONBOARDING_WEBHOOK', 'N8N_WEBHOOK_URL', 'VENTAS_WEBHOOK', 'META_PIXEL_ID',
    'WHATCHIMP_API_KEY', 'DATABASE_PRODUCTION', 'DATABASE_STAGING',
    'RAILWAY_ENVIRONMENT', 'WERKZEUG_RUN_MAIN',
)
for _nombre in VARIABLES_A_LIMPIAR:
    os.environ.pop(_nombre, None)

ENTORNO_DE_TEST = {
    'DATABASE_URL': 'sqlite://',
    'SECRET_KEY': 'test-secret-key-solo-para-tests',
    'FLASK_ENV': 'testing',
    'ENV': 'testing',
    'DISABLE_REMINDER_SCHEDULER': 'true',
    'FOLLOWUP_REMINDERS_ENABLED': 'false',
}
os.environ.update(ENTORNO_DE_TEST)


# --- 2) Red bloqueada -------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def _sin_red(monkeypatch):
    """Cualquier intento de abrir un socket real falla con un mensaje claro."""
    def _bloqueado(*args, **kwargs):
        raise RuntimeError(
            'Este test intento abrir una conexion de red real. '
            'Mockea la llamada (requests, httplib2, ...) en vez de salir a internet.'
        )

    monkeypatch.setattr(socket.socket, 'connect', _bloqueado)
    monkeypatch.setattr(socket.socket, 'connect_ex', _bloqueado)


# --- 3) App y base de datos -------------------------------------------------------------------

class ClienteDeTests(FlaskClient):
    """Cada peticion arranca con `g` limpio, como en produccion (un app context por peticion).

    Flask-Login guarda `current_user` en `g`. Los fixtures abren un app context que dura todo el
    test, asi que sin esto el usuario de la PRIMERA peticion se queda pegado en todas las siguientes
    y un test no puede simular dos identidades (ni comprobar que un rol es rechazado despues de que
    otro fue aceptado). Lo mismo pasa con `g.token_claims` (estado de suplantacion).
    """

    def open(self, *args, **kwargs):
        if has_app_context():
            g.__dict__.clear()
        return super().open(*args, **kwargs)


@pytest.fixture(scope='session')
def app():
    """Una sola app por sesion: crearla cuesta ~2 s (importa los 26 blueprints)."""
    from app import create_app, db
    from config import Config

    class TestConfig(Config):
        # Se fija todo lo sensible a mano: si algo importo `config` ANTES que este archivo (p. ej.
        # `--cov=app.modulo` importa `app` al arrancar), los atributos heredados de `Config` ya se
        # calcularon con el .env real y no se puede confiar en ellos.
        TESTING = True
        WTF_CSRF_ENABLED = False
        SECRET_KEY = ENTORNO_DE_TEST['SECRET_KEY']
        SQLALCHEMY_DATABASE_URI = 'sqlite://'
        SQLALCHEMY_ENGINE_OPTIONS = {}
        VENTAS_WEBHOOK = None
        META_PIXEL_ID = None
        SESSION_COOKIE_SECURE = False
        REMEMBER_COOKIE_SECURE = False

    flask_app = create_app(TestConfig)
    flask_app.test_client_class = ClienteDeTests
    with flask_app.app_context():
        url = str(db.engine.url)
    if url != 'sqlite://':
        pytest.exit(f'ABORTADO: la base de los tests NO es SQLite en memoria ({url}).', returncode=2)
    return flask_app


@pytest.fixture()
def db(app):
    """Base limpia por test: con SQLite en memoria crear las ~80 tablas cuesta ~50 ms."""
    from app import db as _db

    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app, db):
    return app.test_client()


@pytest.fixture()
def csrf_enabled(app):
    """Activa la proteccion CSRF (en los tests esta apagada) solo durante el test."""
    app.config['WTF_CSRF_ENABLED'] = True
    yield
    app.config['WTF_CSRF_ENABLED'] = False


# --- 4) Fabricas ------------------------------------------------------------------------------

@pytest.fixture()
def make_user(db):
    """make_user(role='closer', **campos) -> User ya guardado, con clave 'secret123'."""
    from werkzeug.security import generate_password_hash

    from app.models import User

    contador = itertools.count(1)

    def _crear(role='closer', password='secret123', **campos):
        n = next(contador)
        user = User(
            username=campos.pop('username', f'{role}_{n}'),
            email=campos.pop('email', f'{role}_{n}@test.local'),
            role=role,
            **campos,
        )
        # Hash barato: el scrypt por defecto tarda ~0.1 s por usuario y triplicaba la suite.
        # check_password lee el metodo del propio hash, asi que verifica igual.
        user.password_hash = generate_password_hash(password, method='pbkdf2:sha256:1')
        db.session.add(user)
        db.session.commit()
        return user

    return _crear


@pytest.fixture()
def hashes_baratos(monkeypatch):
    """Las claves que el CODIGO guarda (User.set_password) usan pbkdf2 de 1 iteracion y no scrypt.

    Para los tests que hacen que el codigo cree cuentas o compruebe muchas claves: cada scrypt tarda
    ~0.1 s y son decenas. check_password lee el metodo del propio hash, asi que verifica igual."""
    from werkzeug.security import generate_password_hash

    monkeypatch.setattr('app.models.user.generate_password_hash',
                        lambda password: generate_password_hash(password, method='pbkdf2:sha256:1'))


@pytest.fixture()
def auth_headers():
    """auth_headers(user) -> cabecera Bearer con el JWT del usuario."""
    def _cabeceras(user, **claims):
        return {'Authorization': f'Bearer {user.get_auth_token(**claims)}'}

    return _cabeceras
