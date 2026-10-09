"""Comisiones variables de la nómina: Finanzas (`get_commissions_calculated`) y Payroll
(`/public/financial-sales/payroll`) cubren a los dos setters (Elias y Paula, 8%), a los dos closers
(Jean Carlo y Facundo, 10%) y a Marlon como Director de Ventas (5% de lo que venden los closers,
sin renovaciones). Desde el 08/10/2026 las dos hacen la misma cuenta (`nomina_service`).
"""
from datetime import datetime

import pytest

from app.api.public.finance import comision_de_miembro, get_commissions_calculated
from app.models import FinancialSale
from app.models.financial import TeamMember


@pytest.fixture()
def ventas_del_mes(db, make_user):
    make_user(role='closer', username='Facundo', email='facundo@test.local')

    def venta(monto, setter=None, closer=None, tipo='Bootcamp - Pago completo', excluida=False):
        db.session.add(FinancialSale(monto=monto, metodo_pago='zelle', tipo_pago=tipo, estado='Completada',
                                     setter=setter, email_vendedor=closer, date=datetime(2026, 10, 3),
                                     is_excluded_from_payroll=excluida))

    venta(1000.0, setter='Elias', closer='jeancarlo@thelearnation.com')
    venta(500.0, setter='Paula', closer='facundo@test.local')
    venta(300.0, setter='Paula', closer='facundo@test.local', tipo='Bootcamp - Renovación')
    venta(200.0, closer='jeancarlo@thelearnation.com', excluida=True)
    db.session.commit()


def test_finanzas_calcula_la_comision_de_las_cinco_personas(ventas_del_mes):
    comisiones = get_commissions_calculated('2026-10')

    # Ninguna de estas ventas trae programa (AL/RR/SI): Fulfillment no cobra sobre ellas.
    assert set(comisiones.pop('fulfillment').values()) == {0.0}
    assert comisiones == {
        'elias': 80.0,       # 8% de 1000
        'paula': 64.0,       # 8% de 500 + 300
        'jeancarlo': 100.0,  # 10% de 1000: la de 200 se sacó de la nómina
        'facundo': 80.0,     # 10% de 500 + 300
        'nerina': 0.0,
        'gabriel': 0.0,
        'marlon': 75.0,      # 5% de 1000 + 500: la renovación de Facundo no cuenta
    }


def test_finanzas_y_payroll_dicen_lo_mismo(client, make_user, auth_headers, ventas_del_mes):
    """Una sola cuenta (08/10/2026): antes Finanzas sumaba las ventas sacadas de la nómina y
    Payroll no, y el mismo mes daba dos comisiones distintas."""
    admin = make_user(role='admin', can_view_finance=True)
    payroll = client.get('/api/public/financial-sales/payroll?start_date=2026-10-01&end_date=2026-10-31',
                         headers=auth_headers(admin)).get_json()
    finanzas = get_commissions_calculated('2026-10')

    for clave, comision in finanzas.pop('fulfillment').items():
        assert payroll[clave]['comision_total'] == comision
    for clave, comision in finanzas.items():
        assert payroll[clave]['comision_total'] == comision


@pytest.mark.parametrize('nombre,clave', [
    ('Elias', 'elias'), ('Paula', 'paula'), ('Jean Carlos', 'jeancarlo'), ('Facundo', 'facundo'),
    ('Nerina', 'nerina'), ('Gabriel', 'gabriel'), ('Marlon', 'marlon'),
])
def test_cada_integrante_variable_toma_su_comision(nombre, clave):
    comisiones = {'elias': 1.0, 'paula': 2.0, 'jeancarlo': 3.0, 'facundo': 4.0, 'nerina': 6.0,
                  'gabriel': 7.0, 'marlon': 5.0}
    miembro = TeamMember(name=nombre, role='x', salary_type='variable')

    assert comision_de_miembro(miembro, comisiones) == comisiones[clave]


def test_un_sueldo_fijo_no_toma_comision():
    miembro = TeamMember(name='Paula', role='Setter', salary_type='fijo')

    assert comision_de_miembro(miembro, {'paula': 64.0}) == 0.0


def test_la_nomina_muestra_a_paula_y_facundo(client, make_user, auth_headers, ventas_del_mes):
    admin = make_user(role='admin', can_view_finance=True)

    r = client.get('/api/public/financial-sales/payroll?start_date=2026-10-01&end_date=2026-10-31',
                   headers=auth_headers(admin))

    assert r.status_code == 200
    datos = r.get_json()
    # El cash del período: todas las ventas completadas, también la excluida de la nómina.
    assert datos.pop('totales') == {'cash_neto': 2000.0, 'cash_bruto': 2000.0, 'ventas': 4}
    resumen = {clave: (d['porcentaje_comision'], d['comision_total'], d['total_ventas'], len(d['sales']))
               for clave, d in datos.items()}
    # Ninguna de estas ventas trae programa (AL/RR/SI): Fulfillment aparece, pero vacío.
    for clave in ('andy', 'dari', 'santi', 'belu', 'pedro'):
        assert resumen.pop(clave) == (None, 0.0, 0, 0)
    assert resumen == {
        'elias': (8.0, 80.0, 1, 1),
        'paula': (8.0, 64.0, 2, 2),
        'jeancarlo': (10.0, 100.0, 1, 2),  # la venta excluida se lista pero no suma
        'facundo': (10.0, 80.0, 2, 2),
        'nerina': (10.0, 0.0, 0, 0),
        'gabriel': (10.0, 0.0, 0, 0),
        'marlon': (None, 75.0, 2, 3),   # dos partidas (propias y director): cada una con su %
    }


def test_nerina_y_gabriel_cobran_como_closers(client, db, make_user, auth_headers):
    """Cerraron ventas en septiembre de 2026 y no aparecían (08/10/2026). Nerina ya no está activa
    y se la reconoce igual; «Gabriel» es Gabriel Hernandez, no el Gabriel histórico de abril."""
    make_user(role='closer', username='Nerina', email='ainerinanietoc@gmail.com', is_active=False)
    make_user(role='closer', username='Gabriel Hernandez', email='gehernandezgp@gmail.com')
    make_user(role='closer', username='Gabriel Cardozo', email='gabrielcardozo@gmail.com', is_active=False)
    for monto, correo, tipo in ((450.0, 'ainerinanietoc@gmail.com', 'RR - Completo'),
                                (1000.0, 'gehernandezgp@gmail.com', 'AL - Parcial'),
                                (200.0, 'gehernandezgp@gmail.com', 'AL - Renovación'),
                                (700.0, 'gabriel@thelearnation.com', 'AL - Completo')):
        db.session.add(FinancialSale(monto=monto, metodo_pago='zelle', tipo_pago=tipo, estado='Completada',
                                     email_vendedor=correo, date=datetime(2026, 9, 12)))
    db.session.commit()

    datos = client.get('/api/public/financial-sales/payroll?start_date=2026-09-01&end_date=2026-09-30',
                       headers=auth_headers(make_user(role='admin', can_view_finance=True))).get_json()

    assert (datos['nerina']['comision_total'], datos['nerina']['total_ventas']) == (45.0, 1)
    assert (datos['gabriel']['comision_total'], datos['gabriel']['total_ventas']) == (120.0, 2)
    # Marlon como director también cobra sobre ellos, sin la renovación: 5% de 450 + 1000.
    assert datos['marlon']['comision_total'] == 72.5


def test_marlon_cobra_sus_ventas_propias_y_su_parte_de_director(client, db, make_user, auth_headers):
    """Sus ventas propias (los dos correos) le pagan como a cualquier closer, con su % de closer; las
    de los otros closers, sin renovaciones, con su % de director. Las suyas no entran en esa parte."""
    from app.services import comision_tasas_service as tasas

    make_user(role='director_comercial', username='Marlon Garcia', email='marlongarcia27948@gmail.com')
    for monto, correo, tipo in ((1000.0, 'marlon@thelearnation.com', 'RR - Completo'),
                                (500.0, 'marlongarcia27948@gmail.com', 'AL - Renovación'),
                                (2000.0, 'jeancarlo@thelearnation.com', 'SI - Completo'),
                                (300.0, 'jeancarlo@thelearnation.com', 'SI - Renovación')):
        db.session.add(FinancialSale(monto=monto, metodo_pago='zelle', tipo_pago=tipo, estado='Completada',
                                     email_vendedor=correo, date=datetime(2026, 9, 12)))
    db.session.commit()
    admin = auth_headers(make_user(role='admin', can_view_finance=True))
    url = '/api/public/financial-sales/payroll?start_date=2026-09-01&end_date=2026-09-30'

    marlon = client.get(url, headers=admin).get_json()['marlon']

    assert marlon['comision_total'] == 250.0   # 10% de 1000 + 500, y 5% de 2000
    assert marlon['total_ventas'] == 3
    assert marlon['desglose'] == {
        'propia': {'porcentaje': 10, 'total_recaudado_neto': 1500.0, 'comision_total': 150.0, 'total_ventas': 2},
        'director': {'porcentaje': 5, 'total_recaudado_neto': 2000.0, 'comision_total': 100.0, 'total_ventas': 1},
    }
    assert sorted((v['concepto'], v['porcentaje'], v['comision']) for v in marlon['sales']) == [
        ('director', 5, 100.0), ('propia', 10, 50.0), ('propia', 10, 100.0)]

    # Su % de closer se edita aparte del de director.
    tasas.guardar('2026-09', {'closers': {'marlon': 20}})
    assert client.get(url, headers=admin).get_json()['marlon']['comision_total'] == 400.0

    # En Finanzas, el integrante Marlon cobra el total.
    marlon_equipo = TeamMember(name='Marlon', role='Director de Ventas', salary_type='variable')
    assert comision_de_miembro(marlon_equipo, get_commissions_calculated('2026-09')) == 400.0


def test_la_nomina_de_finanzas_suma_a_nerina_y_gabriel(client, db, make_user, auth_headers):
    admin = make_user(role='admin', can_view_finance=True)

    nomina = client.get('/api/public/finance/payroll?month=2026-09', headers=auth_headers(admin)).get_json()

    integrantes = {m.name: m for m in TeamMember.query.all()}
    for nombre in ('Nerina', 'Gabriel'):
        assert (integrantes[nombre].role, integrantes[nombre].salary_type, integrantes[nombre].payment_method) == (
            'Closer', 'variable', 'Mercury')
    assert {'Nerina', 'Gabriel'} <= {f['member_name'] for f in nomina}
