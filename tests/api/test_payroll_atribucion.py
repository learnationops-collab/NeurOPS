"""Cambiar el setter o el closer de una venta desde Payroll (08/10/2026): quién puede, qué toca y que
la nómina del período que se está mirando cambie con eso (`atribucion_venta_service`)."""
from datetime import datetime

import pytest

from app.models import FinancialAgenda, FinancialSale

OCTUBRE = 'start_date=2026-10-01&end_date=2026-10-31'


@pytest.fixture()
def equipo(db, make_user):
    return {
        'jeancarlo': make_user(role='closer', username='Jean Carlo', email='jeancarlo@thelearnation.com'),
        'facundo': make_user(role='closer', username='Facundo', email='facundo@test.local'),
        'elias': make_user(role='setter', username='Elias', email='elias@test.local'),
        'paula': make_user(role='setter', username='Paula', email='paula@test.local'),
    }


@pytest.fixture()
def finanzas(make_user, auth_headers):
    return auth_headers(make_user(role='director_comercial', can_view_finance=True))


def venta(db, monto=1000.0, setter='Elias', closer='jeancarlo@thelearnation.com', instagram=None,
          tipo='Bootcamp - Pago completo', fecha=datetime(2026, 10, 3), **campos):
    nueva = FinancialSale(monto=monto, metodo_pago='zelle', tipo_pago=tipo, estado='Completada', setter=setter,
                          email_vendedor=closer, instagram=instagram, date=fecha, **campos)
    db.session.add(nueva)
    db.session.commit()
    return nueva


def agenda(db, nombre, instagram, fecha):
    nueva = FinancialAgenda(nombre=nombre, instagram=instagram, date=fecha, created_at=fecha)
    db.session.add(nueva)
    db.session.commit()
    return nueva


def comisiones(client, cabeceras, *claves, rango=OCTUBRE):
    nomina = client.get(f'/api/public/financial-sales/payroll?{rango}', headers=cabeceras).get_json()
    return [nomina[c]['comision_total'] for c in claves]


# --- Quién puede ---------------------------------------------------------------------------------

@pytest.mark.parametrize('rol,permiso,codigo', [
    ('admin', True, 200), ('director_comercial', True, 200),
    ('admin', False, 403), ('director_comercial', False, 403),
    ('closer', True, 403), ('setter', True, 403), ('operator', True, 403),
])
def test_cambiar_la_atribucion_es_de_quien_ve_finanzas(client, db, make_user, auth_headers, equipo,
                                                        rol, permiso, codigo):
    cabeceras = auth_headers(make_user(role=rol, can_view_finance=permiso))
    v = venta(db)

    cambio = client.put(f'/api/public/finance/ventas/{v.id}/atribucion', headers=cabeceras,
                        json={'closer_id': equipo['facundo'].id})
    personas = client.get('/api/public/finance/atribucion/personas', headers=cabeceras)

    assert (cambio.status_code, personas.status_code) == (codigo, codigo)
    esperado = 'facundo@test.local' if codigo == 200 else 'jeancarlo@thelearnation.com'
    assert db.session.get(FinancialSale, v.id).email_vendedor == esperado


def test_un_anonimo_no_cambia_nada(client, db, equipo):
    v = venta(db)

    assert client.put(f'/api/public/finance/ventas/{v.id}/atribucion',
                      json={'closer_id': equipo['facundo'].id}).status_code == 401
    assert client.get('/api/public/finance/atribucion/personas').status_code == 401


# --- Qué toca --------------------------------------------------------------------------------------

def test_cambiar_el_closer_pasa_la_comision_al_otro(client, db, finanzas, equipo):
    v = venta(db)
    assert comisiones(client, finanzas, 'jeancarlo', 'facundo') == [100.0, 0.0]

    r = client.put(f'/api/public/finance/ventas/{v.id}/atribucion', headers=finanzas,
                   json={'closer_id': equipo['facundo'].id})

    assert r.status_code == 200
    assert r.get_json() == {'id': v.id, 'closer': 'Facundo', 'setter': 'Elias', 'agendas': []}
    # El correo del usuario, como lo escribe la ficha: es lo que leen la nómina y el espacio del closer.
    assert db.session.get(FinancialSale, v.id).email_vendedor == 'facundo@test.local'
    assert comisiones(client, finanzas, 'jeancarlo', 'facundo') == [0.0, 100.0]


def test_cambiar_el_setter_cambia_tambien_la_agenda_que_lo_decide(client, db, finanzas, equipo):
    origen = agenda(db, 'Elias', 'lead_uno', datetime(2026, 10, 1))
    v = venta(db, instagram='lead_uno')
    assert comisiones(client, finanzas, 'elias', 'paula') == [80.0, 0.0]

    r = client.put(f'/api/public/finance/ventas/{v.id}/atribucion', headers=finanzas,
                   json={'setter_id': equipo['paula'].id})

    assert r.status_code == 200 and r.get_json()['agendas'] == [origen.id]
    assert db.session.get(FinancialAgenda, origen.id).nombre == 'Paula'
    assert db.session.get(FinancialSale, v.id).setter == 'Paula'
    assert comisiones(client, finanzas, 'elias', 'paula') == [0.0, 80.0]


def test_una_agenda_que_no_cuenta_como_fuente_no_se_toca(client, db, finanzas, equipo):
    """Una entrevista no es de un setter: ahí ya manda el campo de la venta, y la agenda queda."""
    entrevista = agenda(db, 'Entrevista diagnóstica', 'lead_dos', datetime(2026, 10, 1))
    v = venta(db, instagram='lead_dos')

    r = client.put(f'/api/public/finance/ventas/{v.id}/atribucion', headers=finanzas,
                   json={'setter_id': equipo['paula'].id})

    assert r.get_json()['agendas'] == []
    assert db.session.get(FinancialAgenda, entrevista.id).nombre == 'Entrevista diagnóstica'
    assert comisiones(client, finanzas, 'elias', 'paula') == [0.0, 80.0]


def test_con_el_periodo_de_payroll_cambia_el_tile_que_se_esta_mirando(client, db, finanzas, equipo):
    """Un lead que volvió a agendar: con todas las ventas, la cuota de octubre es de la agenda de la
    seña (agosto, Elias); en la nómina de octubre, que atribuye con las ventas del rango, es de la
    agenda nueva (Paula). Sin el período se corregía solo la primera y el tile no cambiaba."""
    primera = agenda(db, 'Elias', 'lead_tres', datetime(2026, 8, 1))
    segunda = agenda(db, 'Paula', 'lead_tres', datetime(2026, 10, 1))
    venta(db, monto=200.0, instagram='lead_tres', tipo='RR - Seña', fecha=datetime(2026, 8, 10))
    cuota = venta(db, instagram='lead_tres', tipo='RR - Cuota', fecha=datetime(2026, 10, 20))
    assert comisiones(client, finanzas, 'elias', 'paula') == [0.0, 80.0]

    sin_periodo = client.put(f'/api/public/finance/ventas/{cuota.id}/atribucion', headers=finanzas,
                             json={'setter_id': equipo['elias'].id})
    assert sin_periodo.get_json()['agendas'] == [primera.id]
    assert comisiones(client, finanzas, 'elias', 'paula') == [0.0, 80.0]

    con_periodo = client.put(f'/api/public/finance/ventas/{cuota.id}/atribucion', headers=finanzas,
                             json={'setter_id': equipo['elias'].id, 'desde': '2026-10-01', 'hasta': '2026-10-31'})
    assert sorted(con_periodo.get_json()['agendas']) == sorted([primera.id, segunda.id])
    assert comisiones(client, finanzas, 'elias', 'paula') == [80.0, 0.0]


def test_una_persona_que_no_es_del_rol_no_deja_nada_a_medias(client, db, finanzas, equipo):
    v = venta(db)

    r = client.put(f'/api/public/finance/ventas/{v.id}/atribucion', headers=finanzas,
                   json={'closer_id': equipo['facundo'].id, 'setter_id': equipo['jeancarlo'].id})

    assert r.status_code == 400
    assert db.session.get(FinancialSale, v.id).email_vendedor == 'jeancarlo@thelearnation.com'
    assert client.put(f'/api/public/finance/ventas/{v.id}/atribucion', headers=finanzas,
                      json={}).status_code == 400
    assert client.put(f'/api/public/finance/ventas/{v.id}/atribucion', headers=finanzas,
                      json={'closer_id': 'x'}).status_code == 400
    assert client.put('/api/public/finance/ventas/999/atribucion', headers=finanzas,
                      json={'closer_id': equipo['facundo'].id}).status_code == 404


def test_la_hoja_de_ventas_se_entera_fuera_de_la_request(client, db, finanzas, equipo, monkeypatch):
    enviadas = []
    monkeypatch.setattr('app.api.public.financial_sales._propagar_lote_a_sheets',
                        lambda app, filas: enviadas.extend(filas))
    v = venta(db, marca_temporal='2026-10-03 10:00:00')

    client.put(f'/api/public/finance/ventas/{v.id}/atribucion', headers=finanzas,
               json={'closer_id': equipo['facundo'].id, 'setter_id': equipo['paula'].id})

    assert len(enviadas) == 1
    marca, fila = enviadas[0]
    assert (marca, fila['email_vendedor'], fila['setter']) == ('2026-10-03 10:00:00', 'facundo@test.local', 'Paula')


def test_las_personas_para_elegir(client, db, finanzas, make_user, equipo):
    """Las activas de cada rol y las inactivas que cobran en la nómina (Nerina): no las demás."""
    make_user(role='closer', username='Nerina', email='nerina@test.local', is_active=False)
    make_user(role='closer', username='Allan', email='allan@test.local', is_active=False)
    make_user(role='setter', username='Ivan', email='ivan@test.local', is_active=False)

    personas = client.get('/api/public/finance/atribucion/personas', headers=finanzas).get_json()

    assert [(p['nombre'], p['activo']) for p in personas['closers']] == [
        ('Facundo', True), ('Jean Carlo', True), ('Nerina', False)]
    assert [p['nombre'] for p in personas['setters']] == ['Elias', 'Paula']
    assert personas['setters'][0]['id'] == equipo['elias'].id
