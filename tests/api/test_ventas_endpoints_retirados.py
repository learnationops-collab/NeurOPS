"""Endpoints de ventas que se retiraron el 10/10/2026 porque ninguna pantalla ni sistema los usaba.

- POST /api/public/financial-sales/new: el alta manual del Registro de Ventas. Su modal no lo abría
  nada y no es una ruta de ingesta (n8n y Apps Script mandan las ventas a POST
  /api/public/financial-sales, que sigue).
"""
import pytest

from app.access_policy import POLITICA


def _reglas(app):
    return {(metodo, regla.rule) for regla in app.url_map.iter_rules() for metodo in regla.methods}


@pytest.mark.parametrize('metodo,ruta', [
    ('POST', '/api/public/financial-sales/new'),
])
def test_ya_no_existen_ni_tienen_politica(app, metodo, ruta):
    assert (metodo, ruta) not in _reglas(app)
    assert (metodo, ruta) not in POLITICA


@pytest.mark.parametrize('metodo,ruta', [
    ('POST', '/api/public/financial-sales'),            # la ingesta de Apps Script
    ('PUT', '/api/public/financial-sales/<int:sale_id>'),  # la edición del Registro de Ventas
    ('GET', '/api/public/financial-sales/transferido-a'),
])
def test_lo_que_se_usa_sigue(app, metodo, ruta):
    assert (metodo, ruta) in _reglas(app)
