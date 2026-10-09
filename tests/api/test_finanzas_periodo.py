"""La nómina de un mes en un solo lugar (`nomina_del_mes`, 08/10/2026): la pestaña Nómina, el «por
pagar» de cada pasarela y los sueldos del resumen salen de la misma cuenta."""
import pytest

from app.api.public.finance import nomina_del_mes, total_de_item
from app.models.financial import MonthlyPayroll, TeamMember


@pytest.fixture()
def equipo(db):
    """Un fijo sin nada guardado, uno con la fila del mes guardada, un inactivo con nómina guardada
    y uno inactivo sin nada (que no cuenta)."""
    fijo = TeamMember(name='Kerwin', role='Operaciones', salary_type='fijo', base_salary=1000.0,
                      payment_method='AirTM', is_active=True)
    guardado = TeamMember(name='Santi', role='Fulfillment', salary_type='fijo', base_salary=500.0,
                          payment_method='Mercury', is_active=True)
    ex_con_nomina = TeamMember(name='Ex', role='Operaciones', salary_type='fijo', base_salary=80.0,
                               payment_method='Mercury', is_active=False)
    ex_sin_nomina = TeamMember(name='Otro ex', role='Operaciones', salary_type='fijo', base_salary=999.0,
                               payment_method='Mercury', is_active=False)
    db.session.add_all([fijo, guardado, ex_con_nomina, ex_sin_nomina])
    db.session.commit()
    db.session.add_all([
        MonthlyPayroll(member_id=guardado.id, month='2026-09', base_salary=450.0, commissions=0.0,
                       bonuses=25.0, payment_method='Mercury', is_paid=True),
        MonthlyPayroll(member_id=ex_con_nomina.id, month='2026-09', base_salary=80.0, commissions=0.0,
                       bonuses=0.0, payment_method='Stripe'),
    ])
    db.session.commit()
    return {'fijo': fijo, 'guardado': guardado, 'ex': ex_con_nomina}


def test_la_pestana_nomina_es_la_nomina_del_mes(client, make_user, auth_headers, equipo):
    admin = make_user(role='admin', can_view_finance=True)

    r = client.get('/api/public/finance/payroll?month=2026-09', headers=auth_headers(admin))

    assert r.status_code == 200
    # El GET siembra a los integrantes variables que falten: después de él, la cuenta es la misma.
    assert r.get_json() == nomina_del_mes('2026-09')
    por_nombre = {item['member_name']: item for item in r.get_json()}
    assert 'Otro ex' not in por_nombre
    assert por_nombre['Kerwin']['id'] is None and por_nombre['Kerwin']['base_salary'] == 1000.0
    assert (por_nombre['Santi']['base_salary'], por_nombre['Santi']['bonuses'], por_nombre['Santi']['is_paid']) \
        == (450.0, 25.0, True)


def test_el_resumen_y_los_saldos_suman_la_misma_nomina(client, make_user, auth_headers, equipo):
    cabeceras = auth_headers(make_user(role='admin', can_view_finance=True))

    resumen = client.get('/api/public/finance/summary?month=2026-09', headers=cabeceras).get_json()
    saldos = client.get('/api/public/finance/balances?month=2026-09', headers=cabeceras).get_json()

    total = sum(total_de_item(item) for item in nomina_del_mes('2026-09'))
    assert total == 1000.0 + 475.0 + 80.0
    assert resumen['expenses_breakdown']['sueldos'] == total
    # 'Stripe' ya no es una pasarela: la nómina lo muestra (y lo suma) como Mercury.
    assert {b['payment_method']: b['expected_amount'] for b in saldos['balances']} \
        == {'Mercury': 555.0, 'AirTM': 1000.0}
