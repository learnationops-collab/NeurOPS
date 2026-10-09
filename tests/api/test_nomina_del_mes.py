"""La nómina de Finanzas (08/10/2026): la comisión guardada vale solo si se escribió a mano.

Antes la pestaña Nómina mandaba la fila ENTERA ante cualquier cambio (el sueldo, el tilde de
pagado) y la comisión calculada en ese momento quedaba guardada para siempre: un % editado después
en Payroll no se veía nunca (caso real en staging: la fila de septiembre de Darian se guardó antes
de que cambiaran los % de Fulfillment). Ahora el POST es parcial y la comisión que vale es la
calculada en vivo, salvo que alguien la escriba (`commissions_manual`).
"""
import importlib.util
from datetime import datetime
from pathlib import Path

import pytest
import sqlalchemy as sa

from app.models import FinancialSale
from app.models.financial import MonthlyPayroll, TeamMember
from app.services import comision_tasas_service as tasas

MES = '2026-09'
MIGRACION = Path(__file__).resolve().parents[2] / 'migrations' / 'versions' / '6897f61b3985_nomina_comision_manual.py'


@pytest.fixture()
def finanzas(make_user, auth_headers):
    return auth_headers(make_user(role='admin', can_view_finance=True))


@pytest.fixture()
def elias(db):
    """Elias, setter variable, con una venta de 1000 en septiembre: 8% de fábrica = 80."""
    miembro = TeamMember(name='Elias', role='Setter', salary_type='variable', base_salary=0.0,
                         payment_method='AirTM', is_active=True)
    db.session.add(miembro)
    db.session.add(FinancialSale(monto=1000.0, metodo_pago='zelle', tipo_pago='Bootcamp - Pago completo',
                                 estado='Completada', setter='Elias', date=datetime(2026, 9, 10)))
    db.session.commit()
    return miembro


def _nomina(client, cabeceras):
    return client.get(f'/api/public/finance/payroll?month={MES}', headers=cabeceras).get_json()


def _de(nomina, miembro):
    return next(f for f in nomina if f['member_id'] == miembro.id)


def test_sin_fila_guardada_vale_la_calculada(client, finanzas, elias):
    fila = _de(_nomina(client, finanzas), elias)

    assert fila['id'] is None
    assert (fila['commissions'], fila['commissions_auto'], fila['commissions_manual']) == (80.0, 80.0, False)
    assert (fila['base_salary'], fila['bonuses'], fila['payment_method']) == (0.0, 0.0, 'AirTM')


def test_tildar_pagado_no_congela_la_comision(client, finanzas, elias):
    r = client.post('/api/public/finance/payroll', headers=finanzas,
                    json={'member_id': elias.id, 'month': MES, 'is_paid': True})
    assert r.status_code == 200
    assert (r.get_json()['commissions'], r.get_json()['commissions_manual'], r.get_json()['is_paid']) == (80.0, False, True)

    # El % cambia DESPUÉS de guardar la fila: Finanzas lo ve.
    tasas.guardar(MES, {'setters': {'elias': 10}})
    fila = _de(_nomina(client, finanzas), elias)

    assert fila['id'] is not None and fila['is_paid'] is True
    assert (fila['commissions'], fila['commissions_auto']) == (100.0, 100.0)


def test_una_venta_sacada_de_la_nomina_tambien_baja_en_finanzas(client, db, finanzas, elias):
    client.post('/api/public/finance/payroll', headers=finanzas,
                json={'member_id': elias.id, 'month': MES, 'base_salary': 50})
    FinancialSale.query.one().is_excluded_from_payroll = True
    db.session.commit()

    assert _de(_nomina(client, finanzas), elias)['commissions'] == 0.0


def test_escribir_la_comision_la_deja_a_mano_hasta_volver_al_calculo(client, finanzas, elias):
    r = client.post('/api/public/finance/payroll', headers=finanzas,
                    json={'member_id': elias.id, 'month': MES, 'commissions': 50})
    assert (r.get_json()['commissions'], r.get_json()['commissions_auto'], r.get_json()['commissions_manual']) == (50.0, 80.0, True)

    tasas.guardar(MES, {'setters': {'elias': 10}})
    fila = _de(_nomina(client, finanzas), elias)
    assert (fila['commissions'], fila['commissions_auto'], fila['commissions_manual']) == (50.0, 100.0, True)

    # Cambiar otra cosa no la toca.
    client.post('/api/public/finance/payroll', headers=finanzas,
                json={'member_id': elias.id, 'month': MES, 'bonuses': 10})
    assert _de(_nomina(client, finanzas), elias)['commissions'] == 50.0

    r = client.post('/api/public/finance/payroll', headers=finanzas,
                    json={'member_id': elias.id, 'month': MES, 'commissions_manual': False})
    assert (r.get_json()['commissions'], r.get_json()['commissions_manual'], r.get_json()['bonuses']) == (100.0, False, 10.0)


def test_al_crear_la_fila_lo_que_falta_sale_del_integrante(client, db, finanzas):
    kerwin = TeamMember(name='Kerwin', role='Operaciones', salary_type='fijo', base_salary=275.0,
                        payment_method='AirTM', is_active=True)
    db.session.add(kerwin)
    db.session.commit()

    r = client.post('/api/public/finance/payroll', headers=finanzas,
                    json={'member_id': kerwin.id, 'month': MES, 'bonuses': 20})

    datos = r.get_json()
    assert r.status_code == 200
    assert (datos['base_salary'], datos['payment_method'], datos['bonuses'], datos['is_paid']) == (275.0, 'AirTM', 20.0, False)
    guardada = MonthlyPayroll.query.one()
    assert (guardada.base_salary, guardada.bonuses, guardada.commissions_manual) == (275.0, 20.0, False)


@pytest.mark.parametrize('cuerpo', [{'member_id': None}, {'member_id': 999}, {'member_id': 'x'}])
def test_rechaza_un_integrante_que_no_existe(client, db, finanzas, cuerpo):
    assert client.post('/api/public/finance/payroll', headers=finanzas,
                       json={'month': MES, **cuerpo}).status_code == 400


def test_rechaza_un_monto_que_no_es_numero(client, finanzas, elias):
    r = client.post('/api/public/finance/payroll', headers=finanzas,
                    json={'member_id': elias.id, 'month': MES, 'base_salary': 'mucho'})

    assert r.status_code == 400
    assert MonthlyPayroll.query.count() == 0


def test_el_resumen_y_el_por_pagar_suman_lo_que_vale(client, finanzas, elias):
    client.post('/api/public/finance/payroll', headers=finanzas,
                json={'member_id': elias.id, 'month': MES, 'base_salary': 100})
    tasas.guardar(MES, {'setters': {'elias': 10}})

    resumen = client.get(f'/api/public/finance/summary?month={MES}', headers=finanzas).get_json()
    saldos = client.get(f'/api/public/finance/balances?month={MES}', headers=finanzas).get_json()

    assert resumen['expenses_breakdown']['sueldos'] == 200.0          # 100 de sueldo + 10% de 1000
    assert {b['payment_method']: b['expected_amount'] for b in saldos['balances']} == {'Mercury': 0.0, 'AirTM': 200.0}


# --- La migración ---------------------------------------------------------------------------------

def _migrar(conexion):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    spec = importlib.util.spec_from_file_location('migracion_nomina_comision_manual', MIGRACION)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    with Operations.context(MigrationContext.configure(conexion)):
        modulo.upgrade()


def test_la_migracion_deja_a_mano_lo_de_antes_de_septiembre_y_es_idempotente():
    motor = sa.create_engine('sqlite://')
    with motor.begin() as conexion:
        conexion.execute(sa.text('CREATE TABLE monthly_payroll (id INTEGER PRIMARY KEY, member_id INTEGER, '
                                 'month VARCHAR(7), commissions FLOAT)'))
        conexion.execute(sa.text("INSERT INTO monthly_payroll (member_id, month, commissions) VALUES "
                                 "(1, '2026-06', 300), (2, '2026-08', 10), (3, '2026-09', 31.74), (4, '2026-10', 0)"))
        _migrar(conexion)
        _migrar(conexion)   # la segunda no hace nada

        filas = conexion.execute(sa.text('SELECT month, commissions_manual FROM monthly_payroll ORDER BY month')).all()

    assert [(mes, bool(manual)) for mes, manual in filas] == [
        ('2026-06', True), ('2026-08', True), ('2026-09', False), ('2026-10', False)]
