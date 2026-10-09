"""A quién del equipo se le hizo un pago por transferencia (09/10/2026): la regla y la migración.

Las sumas de Finanzas, Payroll y la Nómina se prueban por sus rutas en
`tests/api/test_transferencias_nomina.py`; acá va lo que todas comparten.
"""
import importlib.util
from datetime import datetime
from pathlib import Path

import pytest
import sqlalchemy as sa

from app.models import FinancialSale
from app.services import transferencias_service as transf

MIGRACION = (Path(__file__).resolve().parents[2] / 'migrations' / 'versions'
             / '132b9589504a_financial_sales_transferido_a.py')


@pytest.mark.parametrize('medio', ['Transferencia', 'Transferencia Bancaria', 'transferencia bancaria',
                                   ' TRANSFERENCIA ', 'Transfer'])
def test_cuentan_como_transferencia_las_dos_de_la_lista_y_sus_variantes(medio):
    assert transf.es_transferencia(medio)


@pytest.mark.parametrize('medio', ['Stripe', 'Hotmart', 'Binance / USDT', 'Otro', '', None])
def test_los_otros_medios_no_son_transferencia(medio):
    assert not transf.es_transferencia(medio)


def test_con_transferencia_se_guarda_la_clave_elegida():
    assert transf.para_guardar('jean_carlo', 'Transferencia Bancaria') == 'jean_carlo'
    assert transf.para_guardar(' pedro ', 'Transferencia') == 'pedro'


def test_un_alta_con_transferencia_pide_a_quien():
    with pytest.raises(ValueError, match='¿A quién se le hizo la transferencia'):
        transf.para_guardar(None, 'Transferencia', obligatorio=True)
    # Sin pedirlo (la corrección de un pago viejo) queda «sin marcar».
    assert transf.para_guardar('', 'Transferencia') is None


def test_una_opcion_que_no_es_de_la_lista_no_se_guarda():
    with pytest.raises(ValueError, match='no es una de las opciones'):
        transf.para_guardar('kerwin', 'Transferencia')


def test_con_otro_medio_no_se_guarda_nada_aunque_venga_una_persona():
    """«Si cambia el método a otro, se limpia»: la plata de un pago por Stripe no está en manos de nadie."""
    assert transf.para_guardar('jean_carlo', 'Stripe') is None
    assert transf.para_guardar('cualquiera', 'Stripe') is None


def test_finanzas_ve_el_ingreso_por_transferencia_dividido_por_destino(db):
    db.session.add_all([
        FinancialSale(monto=150.0, metodo_pago='Transferencia Bancaria', transferido_a='jean_carlo',
                      estado='Completada', date=datetime(2026, 9, 9)),
        FinancialSale(monto=300.0, metodo_pago='Transferencia', transferido_a='pedro',
                      estado='Completada', date=datetime(2026, 9, 12)),
        FinancialSale(monto=80.0, metodo_pago='Transferencia', transferido_a='otro',
                      estado='Completada', date=datetime(2026, 9, 13)),
        FinancialSale(monto=50.0, metodo_pago='Transferencia', estado='Completada',
                      date=datetime(2026, 9, 14)),
        # No cuentan: una cancelada, otro medio y otro mes.
        FinancialSale(monto=999.0, metodo_pago='Transferencia', transferido_a='pedro',
                      estado='Cancelada', date=datetime(2026, 9, 15)),
        FinancialSale(monto=999.0, metodo_pago='Stripe', estado='Completada', date=datetime(2026, 9, 15)),
        FinancialSale(monto=999.0, metodo_pago='Transferencia', transferido_a='pedro',
                      estado='Completada', date=datetime(2026, 10, 1)),
    ])
    db.session.commit()

    resumen = transf.resumen_del_periodo(datetime(2026, 9, 1).date(), datetime(2026, 9, 30).date())

    assert (resumen['total'], resumen['ventas']) == (580.0, 4)
    assert [(d['clave'], d['total'], d['ventas'], d['descuenta']) for d in resumen['destinos']] == [
        ('pedro', 300.0, 1, True), ('jean_carlo', 150.0, 1, True), ('otro', 80.0, 1, False)]
    assert resumen['sin_marcar'] == {'total': 50.0, 'ventas': 1}


# --- La migración ---------------------------------------------------------------------------------

def _migrar(conexion):
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    spec = importlib.util.spec_from_file_location('migracion_transferido_a', MIGRACION)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    assert (modulo.revision, modulo.down_revision) == ('132b9589504a', 'ee63a37b67f3')
    with Operations.context(MigrationContext.configure(conexion)):
        modulo.upgrade()


def test_la_migracion_agrega_la_columna_vacia_y_es_idempotente():
    motor = sa.create_engine('sqlite://')
    with motor.begin() as conexion:
        conexion.execute(sa.text('CREATE TABLE financial_sales (id INTEGER PRIMARY KEY, monto FLOAT, '
                                 'metodo_pago VARCHAR(255))'))
        conexion.execute(sa.text("INSERT INTO financial_sales (monto, metodo_pago) VALUES "
                                 "(150, 'Transferencia Bancaria'), (300, 'Stripe')"))
        _migrar(conexion)
        _migrar(conexion)   # la segunda no hace nada: la columna ya está

        filas = conexion.execute(sa.text('SELECT monto, transferido_a FROM financial_sales ORDER BY id')).all()

    # Los pagos de antes quedan «sin marcar».
    assert [tuple(f) for f in filas] == [(150.0, None), (300.0, None)]
