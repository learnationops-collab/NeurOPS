"""La tabla Clientes del dashboard comercial: el dado de baja viaja marcado, sin deuda.

La fila no se borra de la respuesta —lo que pagó es de la cartera y la tabla tiene un filtro
"Dados de baja"—; es el listado por defecto el que la deja afuera (`tablasDef.js`). Para eso la
fila tiene que decir que es una baja y no pasar por "Al día", que es otra cosa: no terminó de pagar.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models import Appointment, Client, Enrollment, FinancialSale, InstallmentPlan, Payment, Program
from app.services import baja_service
from app.services.comercial_service import ComercialService


@pytest.fixture()
def vendedor(make_user):
    return make_user(role='closer', username='vendedor', email='vendedor@neuro.com')


@pytest.fixture()
def programa(db):
    p = Program(name='RR', price=1000.0)
    db.session.add(p)
    db.session.commit()
    return p


def _cliente(db, vendedor, programa, nombre, pagado):
    email = f"{nombre.split()[0].lower()}@x.com"
    c = Client(full_name=nombre, email=email, total_amount=1000.0)
    db.session.add(c)
    db.session.commit()
    db.session.add(FinancialSale(mail_cliente=email, tipo_pago='RR - Parcial', monto=pagado,
                                 estado='Completada', date=datetime(2026, 8, 1),
                                 email_vendedor='vendedor@neuro.com'))
    inscripcion = Enrollment(client_id=c.id, program_id=programa.id, closer_id=vendedor.id,
                             enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    appt = Appointment(closer_id=vendedor.id, client_id=c.id, start_time=datetime(2026, 8, 1, 15, 0),
                       closer_result='Show up', closer_processed=True)
    db.session.add_all([Payment(enrollment_id=inscripcion.id, amount=pagado, status='completed',
                                date=datetime(2026, 8, 1)), appt])
    db.session.commit()
    db.session.add(InstallmentPlan(appointment_id=appt.id, client_id=c.id, programa_code='RR',
                                   numero_cuota=1, monto=300.0,
                                   fecha_vencimiento=date.today() - timedelta(days=3)))
    db.session.commit()
    return c


@pytest.fixture()
def cartera(db, vendedor, programa):
    ana = _cliente(db, vendedor, programa, 'Ana Gomez', 400.0)
    beto = _cliente(db, vendedor, programa, 'Beto Diaz', 100.0)
    baja_service.dar_de_baja(ana, 'No puede pagar', vendedor, cuando=datetime(2026, 9, 12, 10, 0))
    db.session.commit()
    return ana, beto


def _filas(closer_id=None):
    return {f['client_id']: f for f in ComercialService.clientes(closer_id=closer_id)}


def test_la_fila_del_dado_de_baja_dice_que_es_una_baja(db, vendedor, cartera):
    ana, _beto = cartera

    fila = _filas(vendedor.id)[ana.id]

    assert fila['estado'] == {'key': 'baja', 'label': 'Dado de baja', 'tone': 'idle'}
    assert fila['baja']['fecha_legible'] == '12 sep 2026'
    assert fila['baja']['motivo'] == 'No puede pagar'


def test_no_debe_ni_tiene_cuota_pero_lo_pagado_sigue(db, vendedor, cartera):
    ana, _beto = cartera

    fila = _filas()[ana.id]

    assert fila['deuda'] == 0.0
    assert fila['cuota_monto'] is None and fila['cuota_vencida'] is False
    assert fila['pagado'] == 400.0


def test_los_que_siguen_activos_no_cambian(db, vendedor, cartera):
    _ana, beto = cartera

    fila = _filas()[beto.id]

    assert fila['baja'] is None
    assert fila['estado']['key'] == 'vencida'
    assert fila['deuda'] == 900.0


def test_los_totales_cuentan_la_baja_aparte_y_su_pago_en_lo_cobrado(db, vendedor, cartera):
    totales = ComercialService.totales_clientes(ComercialService.clientes())

    assert totales['clientes'] == 2
    assert totales['bajas'] == 1
    assert totales['al_dia'] == 0          # la baja no terminó de pagar: no está "al día"
    assert totales['con_deuda'] == 1
    assert totales['deuda'] == 900.0
    assert totales['vencidas'] == 1
    assert totales['pagado'] == 500.0      # lo que pagó el dado de baja es plata cobrada


def test_el_detalle_del_cliente_lo_muestra_como_baja(db, vendedor, cartera):
    """El cronograma se sigue viendo tal cual: quedó como estaba por si se revierte."""
    ana, _beto = cartera

    detalle = ComercialService.cliente(ana.id)

    assert detalle['cliente']['etapa_cobro']['clave'] == 'baja'
    assert detalle['cliente']['deuda'] == 0.0
    assert len(detalle['cuotas']) == 1


def test_la_tabla_del_dashboard_la_devuelve_marcada(client, db, vendedor, cartera, make_user, auth_headers):
    ana, _beto = cartera
    director = make_user(role='director_comercial')

    r = client.get('/api/comercial/tabla?tabla=clientes', headers=auth_headers(director))

    assert r.status_code == 200
    datos = r.get_json()
    fila = next(f for f in datos['filas'] if f['client_id'] == ana.id)
    assert fila['estado']['label'] == 'Dado de baja'
    assert datos['totales']['bajas'] == 1
