"""Medios de pago de /admin/finance: el «por pagar» de cada pasarela suma la nómina completa."""
from app.models.financial import MonthlyPayroll, TeamMember


def test_el_por_pagar_suma_a_quien_tiene_un_medio_viejo(client, db, make_user, auth_headers):
    admin = make_user(role='admin', can_view_finance=True)
    db.session.add_all([
        TeamMember(name='Kerwin', role='Operaciones', salary_type='fijo', base_salary=275.0,
                   payment_method='AirTM', is_active=True),
        # 'Stripe' ya no es una pasarela de pago: la tabla de nómina lo muestra como Mercury.
        TeamMember(name='Santiago', role='Operaciones', salary_type='fijo', base_salary=900.0,
                   payment_method='Stripe', is_active=True),
    ])
    inactivo = TeamMember(name='Ex', role='Operaciones', salary_type='fijo', base_salary=50.0,
                          payment_method='Mercury', is_active=False)
    db.session.add(inactivo)
    db.session.commit()
    # Inactivo pero con la nómina del mes guardada: la nómina lo suma, el «por pagar» también.
    db.session.add(MonthlyPayroll(member_id=inactivo.id, month='2026-08', base_salary=50.0, commissions=0.0,
                                  bonuses=0.0, payment_method='Mercury'))
    db.session.commit()

    r = client.get('/api/public/finance/balances?month=2026-08', headers=auth_headers(admin))

    assert r.status_code == 200
    por_pagar = {b['payment_method']: b['expected_amount'] for b in r.get_json()['balances']}
    assert por_pagar == {'Mercury': 950.0, 'AirTM': 275.0}
