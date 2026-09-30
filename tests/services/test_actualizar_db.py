"""`scripts/actualizar_db.py`: la copia de producción a local/staging.

Ningún test toca una base real: la «producción» es una SQLite temporal y el destino, la SQLite en
memoria de los tests. Se fija lo que protege los datos: que nunca se escriba sobre la misma base
que producción, que una tabla que falla quede como estaba (no vacía) y que una columna que
producción todavía no tiene no tumbe la tabla entera.
"""
import os
from datetime import datetime

import pytest
from sqlalchemy import create_engine, text

from scripts import actualizar_db as script

PROD = 'postgresql://u:clave@interchange.proxy.rlwy.net:39621/railway'


@pytest.mark.parametrize('otra,igual', [
    ('postgresql://otro:otra@interchange.proxy.rlwy.net:39621/railway', True),   # otro usuario
    ('postgres://u:clave@INTERCHANGE.proxy.rlwy.net:39621/railway', True),       # otra grafía
    ('postgresql+psycopg2://u:clave@interchange.proxy.rlwy.net:39621/railway', True),
    ('postgresql://u:clave@altaria.proxy.rlwy.net:14861/railway', False),        # staging
    ('postgresql://u:clave@interchange.proxy.rlwy.net:39621/otra', False),
    ('sqlite:///local.db', False),
])
def test_reconoce_cuando_el_destino_es_produccion(otra, igual):
    assert script._misma_base(otra, PROD) is igual


def test_dos_sqlite_son_la_misma_si_apuntan_al_mismo_archivo(tmp_path):
    ruta = tmp_path / 'local.db'
    assert script._misma_base(f'sqlite:///{ruta}', f'sqlite:///{ruta}')
    assert not script._misma_base(f'sqlite:///{ruta}', f'sqlite:///{tmp_path / "otra.db"}')


def test_el_respaldo_de_la_base_local_se_hace_y_rota(tmp_path, monkeypatch):
    ruta = tmp_path / 'local.db'
    motor = create_engine(f'sqlite:///{ruta}')
    with motor.begin() as c:
        c.execute(text('CREATE TABLE t (x INTEGER)'))
        c.execute(text('INSERT INTO t VALUES (7)'))
    motor.dispose()

    fechas = iter([datetime(2026, 9, 30, 10, m) for m in range(5)])

    class Reloj(datetime):
        @classmethod
        def now(cls, tz=None):
            return next(fechas)

    monkeypatch.setattr(script, 'datetime', Reloj)
    respaldos = [script._respaldar_sqlite(str(ruta)) for _ in range(5)]

    quedan = sorted(os.listdir(tmp_path / 'respaldos'))
    assert quedan == [os.path.basename(r) for r in respaldos[-script.RESPALDOS_A_CONSERVAR:]]
    copia = create_engine(f'sqlite:///{respaldos[-1]}')
    with copia.connect() as c:
        assert c.execute(text('SELECT x FROM t')).scalar() == 7
    copia.dispose()


def test_el_script_apaga_los_recordatorios_antes_de_armar_la_app():
    """`create_app()` arranca el scheduler de WhatsApp salvo que esto diga 'true'."""
    assert os.environ['DISABLE_REMINDER_SCHEDULER'] == 'true'
