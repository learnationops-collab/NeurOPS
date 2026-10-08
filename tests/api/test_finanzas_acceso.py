"""Quién entra a Finanzas y Payroll (secciones del dashboard comercial desde el 08/10/2026), y los
gastos de software, que tienen rutas propias dentro de Finanzas."""
from datetime import datetime

import pytest

from app.models import Expense


@pytest.mark.parametrize('rol,permiso,entra', [
    ('admin', True, True), ('director_comercial', True, True),
    ('admin', False, False), ('director_comercial', False, False), ('operator', True, False),
])
def test_finanzas_y_payroll_piden_rol_y_permiso(client, db, make_user, auth_headers, rol, permiso, entra):
    cabeceras = auth_headers(make_user(role=rol, can_view_finance=permiso))

    resumen = client.get('/api/public/finance/summary?month=2026-09', headers=cabeceras)
    nomina = client.get('/api/public/financial-sales/payroll?start_date=2026-09-01&end_date=2026-09-30',
                        headers=cabeceras)

    assert (resumen.status_code == 200, nomina.status_code == 200) == (entra, entra)


def test_la_direccion_con_permiso_lleva_el_software_del_mes(client, db, make_user, auth_headers):
    cabeceras = auth_headers(make_user(role='director_comercial', can_view_finance=True))
    db.session.add_all([
        Expense(description='Zoom', amount=20.0, date=datetime(2026, 9, 3), category='Software'),
        Expense(description='Otro mes', amount=9.0, date=datetime(2026, 8, 30), category='software'),
        Expense(description='No es software', amount=50.0, date=datetime(2026, 9, 4), category='variable'),
    ])
    db.session.commit()

    creado = client.post('/api/public/finance/software', headers=cabeceras,
                         json={'description': 'Notion', 'amount': '10.5', 'date': '2026-09-10'})
    lista = client.get('/api/public/finance/software?month=2026-09', headers=cabeceras).get_json()

    assert creado.status_code == 201
    assert [(g['description'], g['amount']) for g in lista] == [('Zoom', 20.0), ('Notion', 10.5)]
    # El resumen suma lo mismo que lista la pestaña.
    resumen = client.get('/api/public/finance/summary?month=2026-09', headers=cabeceras).get_json()
    assert resumen['expenses_breakdown']['software'] == 30.5

    otro = Expense.query.filter_by(description='No es software').one()
    assert client.delete(f'/api/public/finance/software/{otro.id}', headers=cabeceras).status_code == 400
    assert client.delete(f"/api/public/finance/software/{creado.get_json()['id']}", headers=cabeceras).status_code == 200
    assert len(client.get('/api/public/finance/software?month=2026-09', headers=cabeceras).get_json()) == 1


def test_el_gasto_de_software_pide_fecha_monto_y_descripcion(client, db, make_user, auth_headers):
    cabeceras = auth_headers(make_user(role='admin', can_view_finance=True))

    for cuerpo in ({'description': 'X', 'amount': 'a', 'date': '2026-09-01'},
                   {'description': 'X', 'amount': 1, 'date': '01/09/2026'},
                   {'description': ' ', 'amount': 1, 'date': '2026-09-01'}):
        assert client.post('/api/public/finance/software', headers=cabeceras, json=cuerpo).status_code == 400
