"""Superficie sin autenticar: que rutas contestan a un visitante anonimo.

`anonymous_surface.py` es el inventario. Este test vuelve a pedir CADA ruta con CADA metodo, sin
cookie ni token (con un cliente nuevo por peticion, en una base vacia y con la red bloqueada), y
exige que el resultado coincida exactamente con el inventario: una ruta nueva sin autenticacion
rompe el test, y proteger una existente obliga a quitarla del inventario.
"""
import re
from collections import Counter

import pytest

from tests.security.anonymous_surface import EXPUESTAS_SIN_AUTENTICACION, PUBLICAS_POR_DISENO

CON_CUERPO = {'POST', 'PUT', 'PATCH', 'DELETE'}
CERRADAS = (401, 403, 302, 308)


def _rellenar(regla):
    """/api/x/<int:id>/<string:k> -> /api/x/1/x"""
    return re.sub(r'<([^>:]+:)?[^>]+>', lambda m: '1' if (m.group(1) or '').startswith('int') else 'x', regla)


def _rutas_abiertas_a_anonimos(app):
    abiertas = set()
    for regla in app.url_map.iter_rules():
        if regla.endpoint in ('static', 'serve_react'):  # la SPA es publica por definicion
            continue
        url = _rellenar(regla.rule)
        for metodo in sorted((regla.methods or set()) - {'HEAD', 'OPTIONS'}):
            respuesta = app.test_client().open(url, method=metodo, json={} if metodo in CON_CUERPO else None)
            if respuesta.status_code not in CERRADAS:
                abiertas.add((metodo, regla.rule))
    return abiertas


def _formato(rutas):
    return '\n'.join(f'  {metodo:6s} {regla}' for metodo, regla in sorted(rutas, key=lambda t: (t[1], t[0])))


def test_las_rutas_abiertas_a_anonimos_son_exactamente_las_inventariadas(app, db, monkeypatch):
    # Con estos tokens configurados, /api/external/* contesta 401 (sin ellos contestaria 500: cerrada).
    monkeypatch.setenv('ACADEMY_INBOUND_API_TOKEN', 'token-de-prueba')
    monkeypatch.setenv('DEV_PLATFORM_INBOUND_API_TOKEN', 'token-de-prueba')

    abiertas = _rutas_abiertas_a_anonimos(app)

    conocidas = PUBLICAS_POR_DISENO | EXPUESTAS_SIN_AUTENTICACION
    nuevas = abiertas - conocidas
    ya_cerradas = conocidas - abiertas
    assert not nuevas, (
        f'Rutas NUEVAS que responden sin autenticacion (protegerlas o inventariarlas):\n{_formato(nuevas)}')
    assert not ya_cerradas, f'Ya exigen autenticacion; quitarlas del inventario:\n{_formato(ya_cerradas)}'


def test_lo_publico_por_diseno_solo_lee_o_recibe_formularios():
    metodos = {metodo for metodo, _ in PUBLICAS_POR_DISENO}

    assert metodos <= {'GET', 'POST'}  # nunca un PUT ni un DELETE


def test_el_inventario_no_se_pisa_a_si_mismo():
    assert PUBLICAS_POR_DISENO.isdisjoint(EXPUESTAS_SIN_AUTENTICACION)


@pytest.mark.xfail(strict=True, reason=(
    "BUG DE SEGURIDAD: todo el blueprint `public` (y varios mas) responde a cualquiera en internet, sin "
    "sesion ni token: lecturas de ventas, nomina y clientes; altas, ediciones y BORRADOS de agendas, "
    "ventas, campanas y reportes; mantenimiento (repair-db, cleanup-*, migrate, records/clear); y la "
    "ingesta de n8n, que permite inyectar ventas falsas. Ver EXPUESTAS_SIN_AUTENTICACION."))
def test_ninguna_ruta_de_la_herramienta_interna_responde_a_anonimos():
    por_metodo = dict(sorted(Counter(m for m, _ in EXPUESTAS_SIN_AUTENTICACION).items()))

    assert not EXPUESTAS_SIN_AUTENTICACION, (
        f'{len(EXPUESTAS_SIN_AUTENTICACION)} rutas sin autenticacion: {por_metodo}')
