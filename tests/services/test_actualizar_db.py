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

from app.models import FeatureToggle
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


@pytest.fixture()
def produccion(tmp_path):
    """Una «producción» con `feature_toggles` SIN la columna `updated_by_id`: la de un modelo de
    develop que agregó una columna todavía no desplegada."""
    motor = create_engine(f'sqlite:///{tmp_path / "prod.db"}')
    with motor.begin() as c:
        c.execute(text('CREATE TABLE feature_toggles (id INTEGER PRIMARY KEY, key VARCHAR(64), '
                       'is_active BOOLEAN, updated_at DATETIME)'))
        c.execute(text("INSERT INTO feature_toggles VALUES "
                       "(1, 'cobros', 1, '2026-09-29 10:00:00'), (2, 'pool', 0, '2026-09-28 09:00:00')"))
    yield motor
    motor.dispose()


def test_copia_las_columnas_comunes_y_reemplaza_la_tabla(db, produccion):
    db.session.add(FeatureToggle(id=9, key='vieja', is_active=True))
    db.session.commit()
    tabla = FeatureToggle.__table__

    copiadas = script._copiar_a_sqlite(produccion, tabla, {'id', 'key', 'is_active', 'updated_at'})

    assert copiadas == 2
    filas = FeatureToggle.query.order_by(FeatureToggle.id).all()
    assert [(f.id, f.key, f.is_active, f.updated_by_id) for f in filas] == [
        (1, 'cobros', True, None), (2, 'pool', False, None)]
    assert filas[0].updated_at == datetime(2026, 9, 29, 10, 0)


def test_si_la_copia_falla_la_tabla_queda_como_estaba(db, produccion):
    """Antes se vaciaba todo al principio: una tabla que fallaba después quedaba vacía."""
    db.session.add(FeatureToggle(id=9, key='vieja', is_active=True))
    db.session.commit()
    with produccion.begin() as c:
        c.execute(text('DROP TABLE feature_toggles'))

    with pytest.raises(Exception):
        script._copiar_a_sqlite(produccion, FeatureToggle.__table__, {'id', 'key'})

    assert [f.key for f in FeatureToggle.query.all()] == ['vieja']


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


def test_el_script_apaga_los_recordatorios_antes_de_armar_la_app(monkeypatch):
    """`create_app()` arranca el scheduler de WhatsApp salvo que esto diga 'true'. El entorno de
    los tests ya lo trae puesto: se saca y se vuelve a cargar el script para ver que lo pone él."""
    import importlib

    monkeypatch.delenv('DISABLE_REMINDER_SCHEDULER', raising=False)
    importlib.reload(script)
    assert os.environ['DISABLE_REMINDER_SCHEDULER'] == 'true'


def test_copia_todas_las_tablas_de_la_app():
    """La lista era a mano y se le escapaban modelos nuevos: ahora sale de la metadata."""
    from app import db as _db

    nombres = {t.name for t in _db.metadata.sorted_tables}
    assert {'feature_toggles', 'event_closers', 'ficha_opciones', 'appointments'} <= nombres
