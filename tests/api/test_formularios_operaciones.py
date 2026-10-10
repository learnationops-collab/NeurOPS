"""Formularios en Operaciones (10/10/2026): la pantalla de formularios de cualificación era del panel de
«Administración», que se retiró, y pasó al espacio de Operaciones. El operador tiene que poder listarlos,
corregirles la fecha, buscar el cliente destino y fusionar; los demás roles siguen como estaban."""
import pytest


@pytest.mark.parametrize('rol,entra', [
    ('operator', True), ('admin', True), ('triage', True),
    ('closer', False), ('setter', False), ('director_comercial', False),
])
def test_quien_trabaja_los_formularios(client, db, make_user, auth_headers, rol, entra):
    cabeceras = auth_headers(make_user(role=rol))

    lista = client.get('/api/triage/qualified-forms', headers=cabeceras)
    fecha = client.put('/api/triage/qualified-forms/999999', headers=cabeceras, json={})
    fusion = client.post('/api/triage/merge-clients', headers=cabeceras, json={})

    assert (lista.status_code == 200) is entra
    # Sin datos válidos responden con su propio error, pero nunca 403 a quien entra.
    assert (fecha.status_code != 403) is entra
    assert (fusion.status_code != 403) is entra


@pytest.mark.parametrize('rol,entra', [('operator', True), ('closer', True), ('director_comercial', False)])
def test_el_operador_busca_el_cliente_destino(client, db, make_user, auth_headers, rol, entra):
    respuesta = client.get('/api/closer/leads/search?q=ana', headers=auth_headers(make_user(role=rol)))

    assert (respuesta.status_code == 200) is entra
