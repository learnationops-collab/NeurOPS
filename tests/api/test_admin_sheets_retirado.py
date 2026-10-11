"""«Importaciones Sheets» (/admin/sheets) se retiró el 10/10/2026, y con ella los endpoints que solo
usaba esa pantalla.

- GET /api/public/reports/sales-attribution: el reporte de su pestaña «Ventas DB (Atribución)».
- GET /api/sheets/sync: la sincronización manual que esa pestaña pedía antes de cargar. Con Ventas_DB
  respondía 500 «disabled» (la sincronización destructiva está apagada), así que fallaba siempre.

Se quedan los que usa otra cosa: el cron (/api/sheets/cron-sync, con CRON_SECRET), el alta de ventas
hacia la hoja (/api/sheets/push) y la atribución manual de «Sin Anuncio» (UnattributedLeadsPage).
"""
import pytest


def _reglas(app):
    return {(metodo, regla.rule) for regla in app.url_map.iter_rules() for metodo in regla.methods}


@pytest.mark.parametrize('metodo,ruta', [
    ('GET', '/api/public/reports/sales-attribution'),
    ('GET', '/api/sheets/sync'),
])
def test_los_endpoints_de_la_pantalla_ya_no_existen(app, metodo, ruta):
    assert (metodo, ruta) not in _reglas(app)


@pytest.mark.parametrize('metodo,ruta', [
    ('GET', '/api/sheets/cron-sync'),
    ('POST', '/api/sheets/push'),
    ('POST', '/api/public/marketing/manual-attribution'),
    ('POST', '/api/public/marketing/manual-attribution-agenda'),
    ('GET', '/api/public/marketing/unattributed-leads'),
])
def test_lo_que_usa_otra_cosa_sigue(app, metodo, ruta):
    assert (metodo, ruta) in _reglas(app)
