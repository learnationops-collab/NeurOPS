"""La politica de acceso registrada en la app, de extremo a extremo (con las vistas reales).

Antes cualquiera en internet podia leer, crear, editar y BORRAR ventas y agendas, e inyectar ventas falsas
por la ingesta de n8n. Aca se prueba con las vistas de verdad que: un anonimo o un rol sin permiso no
ejecuta la vista (no borra ni crea nada), el rol correcto la ejecuta, el secreto de ingesta solo abre las
rutas de ingesta, las paginas publicas de reservas siguen abiertas y el modo de migracion deja pasar y
avisa. La guarda en si (tabla, roles, secreto) se prueba en test_access_policy.
"""
import logging

import pytest

from app.models import FinancialAgenda, FinancialSale

TOKEN = 'secreto-de-ingesta-de-prueba-con-mas-de-veinte-caracteres'
VENTA_NUEVA = {'monto': 500, 'setter': 'Ana', 'nombre_cliente': 'Cliente Uno', 'instagram': 'cliente_uno'}
AGENDA_NUEVA = {'nombre': 'Lead Uno', 'setter': 'Ana', 'mail': 'lead1@x.com'}


@pytest.fixture()
def venta(db):
    existente = FinancialSale(setter='Ana', monto=100.0, nombre_cliente='Existente', instagram='existente')
    db.session.add(existente)
    db.session.commit()
    return existente


@pytest.fixture()
def ingesta(monkeypatch):
    monkeypatch.setenv('INGEST_API_TOKEN', TOKEN)


def ventas():
    return FinancialSale.query.count()


# --- Borrar: la vista no se ejecuta sin permiso --------------------------------------------------

def test_un_anonimo_no_puede_borrar_una_venta(client, db, venta):
    respuesta = client.delete(f'/api/public/financial-sales/{venta.id}')

    assert respuesta.status_code == 401
    assert respuesta.get_json() == {'message': 'Unauthorized'}
    assert ventas() == 1


def test_un_closer_no_puede_borrar_una_venta(client, db, venta, make_user, auth_headers):
    respuesta = client.delete(f'/api/public/financial-sales/{venta.id}', headers=auth_headers(make_user(role='closer')))

    assert respuesta.status_code == 403
    assert ventas() == 1


@pytest.mark.parametrize('rol', ['operator', 'director_comercial', 'admin'])
def test_los_roles_permitidos_si_ejecutan_la_vista(client, db, venta, make_user, auth_headers, rol):
    respuesta = client.delete(f'/api/public/financial-sales/{venta.id}', headers=auth_headers(make_user(role=rol)))

    assert respuesta.status_code == 200
    assert ventas() == 0


def test_los_roles_permitidos_llegan_a_la_vista_incluso_cuando_el_recurso_no_existe(
        client, db, make_user, auth_headers):
    # 404 de la vista (no hay venta 999), no un 401/403 de la guarda: la vista si corrio.
    respuesta = client.delete('/api/public/financial-sales/999', headers=auth_headers(make_user(role='operator')))

    assert respuesta.status_code == 404


def test_un_anonimo_no_puede_leer_la_nomina(client, db):
    assert client.get('/api/public/financial-sales/payroll').status_code == 401


def test_un_operator_no_puede_leer_la_nomina_pero_admin_si(client, db, make_user, auth_headers):
    assert client.get('/api/public/financial-sales/payroll', headers=auth_headers(make_user(role='operator'))
                      ).status_code == 403
    assert client.get('/api/public/financial-sales/payroll', headers=auth_headers(make_user(role='admin'))
                      ).status_code == 200


def test_un_setter_no_puede_borrar_todos_los_registros_de_interaccion(client, db, make_user, auth_headers):
    respuesta = client.delete('/api/conversational/records/clear', headers=auth_headers(make_user(role='setter')))

    assert respuesta.status_code == 403


# --- La ingesta de n8n y Apps Script ------------------------------------------------------------

def test_un_anonimo_no_puede_inyectar_ventas(client, db, ingesta):
    respuesta = client.post('/api/public/financial-sales', json=VENTA_NUEVA)

    assert respuesta.status_code == 401
    assert ventas() == 0


def test_un_anonimo_no_puede_inyectar_agendas(client, db, ingesta):
    respuesta = client.post('/api/public/financial-agendas', json=AGENDA_NUEVA)

    assert respuesta.status_code == 401
    assert FinancialAgenda.query.count() == 0


@pytest.mark.parametrize('cabeceras', [{'X-Api-Token': TOKEN}, {'Authorization': f'Bearer {TOKEN}'}])
def test_apps_script_con_el_secreto_crea_ventas(client, db, ingesta, cabeceras):
    respuesta = client.post('/api/public/financial-sales', json=VENTA_NUEVA, headers=cabeceras)

    assert respuesta.status_code in (200, 201)
    assert ventas() == 1
    assert FinancialSale.query.one().nombre_cliente == 'Cliente Uno'


def test_n8n_con_el_secreto_crea_agendas(client, db, ingesta):
    respuesta = client.post('/api/public/financial-agendas', json=AGENDA_NUEVA, headers={'X-Api-Token': TOKEN})

    assert respuesta.status_code in (200, 201)
    assert FinancialAgenda.query.count() == 1


def test_un_secreto_equivocado_no_crea_nada(client, db, ingesta):
    respuesta = client.post('/api/public/financial-sales', json=VENTA_NUEVA, headers={'X-Api-Token': 'mal'})

    assert respuesta.status_code == 401
    assert ventas() == 0


def test_sin_INGEST_API_TOKEN_configurado_ni_el_valor_de_otra_variable_abre(client, db, monkeypatch):
    # No hay valor por defecto, ni se reutiliza el de otra integracion.
    monkeypatch.setenv('CRON_SECRET', TOKEN)

    respuesta = client.post('/api/public/financial-sales', json=VENTA_NUEVA, headers={'X-Api-Token': TOKEN})

    assert respuesta.status_code == 401
    assert ventas() == 0


def test_el_secreto_de_ingesta_no_permite_borrar_ni_editar_ventas(client, db, ingesta, venta):
    cabeceras = {'X-Api-Token': TOKEN}

    borrar = client.delete(f'/api/public/financial-sales/{venta.id}', headers=cabeceras)
    editar = client.put(f'/api/public/financial-sales/{venta.id}', json={'monto': 1}, headers=cabeceras)
    nomina = client.get('/api/public/financial-sales/payroll', headers=cabeceras)

    assert (borrar.status_code, editar.status_code, nomina.status_code) == (401, 401, 401)
    assert ventas() == 1


def test_un_operator_tambien_puede_crear_ventas_desde_la_app_sin_el_secreto(client, db, make_user, auth_headers):
    respuesta = client.post('/api/public/financial-sales', json=VENTA_NUEVA,
                            headers=auth_headers(make_user(role='operator')))

    assert respuesta.status_code in (200, 201)
    assert ventas() == 1


# --- Lo publico sigue publico -------------------------------------------------------------------

def test_las_paginas_publicas_de_reservas_siguen_abiertas_a_un_anonimo(client, db):
    funnel = client.get('/api/public/funnel/un-evento-que-no-existe')
    comprobar = client.post('/api/public/clients/check', json={})
    contador = client.get('/api/public/workshop-lead/stats')

    assert funnel.status_code not in (401, 403)
    assert comprobar.status_code == 400  # la vista corrio y pide email o instagram
    assert contador.status_code == 200
    assert set(contador.get_json()) == {'total', 'ultimas_24h'}  # solo totales


def test_el_preflight_de_cors_a_una_ruta_protegida_no_recibe_401(client, db):
    respuesta = client.options('/api/public/financial-sales', headers={
        'Origin': 'https://work.thelearnation.com', 'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type'})

    assert respuesta.status_code in (200, 204)


# --- Modo de migracion --------------------------------------------------------------------------

def test_en_migracion_un_anonimo_ejecuta_la_vista_y_queda_registrado(client, db, ingesta, monkeypatch, caplog):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', 'log_only')

    with caplog.at_level(logging.WARNING):
        respuesta = client.post('/api/public/financial-sales', json=VENTA_NUEVA)

    assert respuesta.status_code in (200, 201)
    assert ventas() == 1
    avisos = [r.getMessage() for r in caplog.records if 'MIGRACION DE SECRETOS' in r.getMessage()]
    assert len(avisos) == 1 and 'POST /api/public/financial-sales' in avisos[0]


def test_en_migracion_lo_autorizado_no_genera_avisos(client, db, ingesta, monkeypatch, caplog):
    monkeypatch.setenv('INTEGRATIONS_AUTH_MODE', 'log_only')

    with caplog.at_level(logging.WARNING):
        client.post('/api/public/financial-sales', json=VENTA_NUEVA, headers={'X-Api-Token': TOKEN})

    assert not [r for r in caplog.records if 'MIGRACION DE SECRETOS' in r.getMessage()]
