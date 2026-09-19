"""Reglas de aislamiento de conftest.py. Si alguna falla, NINGUN otro test es confiable:
la suite podria estar leyendo el .env real, tocando una base real o mandando WhatsApp."""
import os
import socket

import pytest
import requests

from tests.conftest import ENTORNO_DE_TEST, VARIABLES_A_LIMPIAR


def test_el_env_real_no_se_carga():
    import config

    # config.py hizo `from dotenv import load_dotenv`; conftest la reemplazo antes de importarlo.
    assert config.load_dotenv() is False


def test_variables_sensibles_estan_vacias():
    presentes = [nombre for nombre in VARIABLES_A_LIMPIAR if os.environ.get(nombre)]
    assert presentes == []


@pytest.mark.parametrize('nombre,valor', sorted(ENTORNO_DE_TEST.items()))
def test_entorno_de_test_aplicado(nombre, valor):
    assert os.environ[nombre] == valor


def test_la_base_es_sqlite_en_memoria(app, db):
    assert str(db.engine.url) == 'sqlite://'
    assert app.config['SQLALCHEMY_DATABASE_URI'] == 'sqlite://'


def test_el_scheduler_de_whatsapp_no_arranca(app):
    from app.services import reminder_scheduler

    assert reminder_scheduler._scheduler is None


def test_los_sockets_estan_bloqueados():
    with socket.socket() as s:
        with pytest.raises(RuntimeError, match='conexion de red real'):
            s.connect(('127.0.0.1', 9))


def test_requests_no_puede_salir_a_internet(monkeypatch):
    # Se simula que el DNS resolvio para llegar hasta el connect y comprobar que ahi se corta.
    monkeypatch.setattr(
        socket, 'getaddrinfo',
        lambda *args, **kwargs: [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('93.184.216.34', 80))],
    )
    with pytest.raises(RuntimeError, match='conexion de red real'):
        requests.get('http://example.com', timeout=1)
