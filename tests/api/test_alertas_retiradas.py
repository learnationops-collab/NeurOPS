"""Alertas se retiró el 10/10/2026 (junto con la vista Administración): la pantalla, su API y el motor.

El motor corría al final del cron de Sheets: evaluaba las reglas activas, guardaba una alerta por cada
una que se cumplía y avisaba a Discord. Que no vuelva a correr por la puerta de atrás es lo que fija
este archivo.
"""
import pytest

from app.models import Alert, AlertRule
from app.services.sheets_service import SheetsService

SECRETO = 'secreto-de-prueba-con-mas-de-veinte-caracteres'


@pytest.fixture()
def sin_sheets(monkeypatch):
    monkeypatch.setattr(SheetsService, 'sync_from_sheets', staticmethod(lambda tabla, force=False: {'status': 'success'}))


def test_el_cron_de_sheets_ya_no_evalua_reglas_ni_avisa_a_discord(client, db, sin_sheets, monkeypatch):
    # Una regla activa que se cumple siempre (0 ventas > -1) y que avisa a Discord: antes del 10/10
    # cada corrida del cron dejaba una alerta guardada y un mensaje en el canal.
    db.session.add(AlertRule(name='Siempre', metric='ventas', condition='>', value=-1, period='7_days',
                             scope_type='all', severity='critical', is_active=True, notify_discord=True))
    db.session.commit()
    monkeypatch.setenv('CRON_SECRET', SECRETO)
    monkeypatch.setenv('DISCORD_ALERTS_WEBHOOK', 'https://discord.example/alertas')
    enviados = []
    monkeypatch.setattr('requests.post', lambda *args, **kwargs: enviados.append(args))

    respuesta = client.get('/api/sheets/cron-sync', headers={'Authorization': f'Bearer {SECRETO}'})

    assert respuesta.status_code == 200
    assert 'alerts_triggered' not in respuesta.get_json()
    assert Alert.query.count() == 0
    assert enviados == []


def test_ya_no_hay_rutas_de_alertas(app):
    # Reglas, historial, resolver, forzar evaluación, prueba a Discord y su configuración.
    assert 'alerts' not in app.blueprints
    assert [r.rule for r in app.url_map.iter_rules() if r.rule.startswith('/api/alerts')] == []


def test_las_tablas_de_alertas_se_conservan_con_el_modelo(db):
    # Sin el modelo, `flask db migrate` propondría borrarlas: los datos se quedan a propósito.
    assert {'alert_rules', 'alerts'} <= set(db.metadata.tables)
