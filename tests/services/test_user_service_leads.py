"""UserService.get_leads_list / get_leads_kpis: la pantalla de "Base de Datos > Leads" (solo admin).

Filtra clientes por búsqueda, programa, rango de fechas y closer, y calcula ingreso, cobrado en caja,
deuda y conteo por programa. `program` y `closer` pueden venir juntos con varios valores separados por
coma en `program`.
"""
from datetime import datetime

import pytest

from app.models import Client, Enrollment, Payment, PaymentMethod, Program
from app.services.user_service import UserService


@pytest.fixture()
def catalogo(db):
    al = Program(name='AL', price=1000.0)
    rr = Program(name='RR', price=1500.0)
    zelle = PaymentMethod(name='Zelle', commission_percent=5.0, commission_fixed=0.0)
    db.session.add_all([al, rr, zelle])
    db.session.commit()
    return {'AL': al, 'RR': rr, 'zelle': zelle}


def inscribir(db, cliente, programa, closer, monto_pagado, metodo, tipo='parcial', estado='completed'):
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id, closer_id=closer.id if closer else None)
    db.session.add(inscripcion)
    db.session.commit()
    if monto_pagado:
        db.session.add(Payment(enrollment_id=inscripcion.id, payment_method_id=metodo.id, amount=monto_pagado,
                               payment_type=tipo, status=estado))
        db.session.commit()
    return inscripcion


# --- get_leads_list -----------------------------------------------------------------------------

def test_lista_vacia_sin_clientes(db):
    pagina = UserService.get_leads_list({})

    assert (pagina.total, pagina.items) == (0, [])


def test_ordena_por_fecha_de_alta_mas_reciente_primero_por_defecto(db):
    viejo = Client(full_name='Viejo', email='viejo@x.com', created_at=datetime(2026, 1, 1))
    nuevo = Client(full_name='Nuevo', email='nuevo@x.com', created_at=datetime(2026, 6, 1))
    db.session.add_all([viejo, nuevo])
    db.session.commit()

    pagina = UserService.get_leads_list({})

    assert [c.full_name for c in pagina.items] == ['Nuevo', 'Viejo']


@pytest.mark.parametrize('sort_by,esperado', [
    ('oldest', ['Viejo', 'Ana', 'Nuevo']),
    ('a-z', ['Ana', 'Nuevo', 'Viejo']),
    ('z-a', ['Viejo', 'Nuevo', 'Ana']),
])
def test_los_cuatro_ordenes_disponibles(db, sort_by, esperado):
    db.session.add_all([
        Client(full_name='Viejo', email='v@x.com', created_at=datetime(2026, 1, 1)),
        Client(full_name='Nuevo', email='n@x.com', created_at=datetime(2026, 6, 1)),
        Client(full_name='Ana', email='a@x.com', created_at=datetime(2026, 3, 1)),
    ])
    db.session.commit()

    pagina = UserService.get_leads_list({'sort_by': sort_by})

    assert [c.full_name for c in pagina.items] == esperado


def test_busca_por_nombre_o_email_sin_distinguir_mayusculas(db):
    db.session.add_all([
        Client(full_name='Ana Gomez', email='ana@x.com'),
        Client(full_name='Beto Ruiz', email='beto@ANA.com'),
        Client(full_name='Otra Persona', email='otra@x.com'),
    ])
    db.session.commit()

    pagina = UserService.get_leads_list({'search': 'ana'})

    assert sorted(c.full_name for c in pagina.items) == ['Ana Gomez', 'Beto Ruiz']


def test_filtra_por_rango_de_fechas_inclusive_en_el_dia_final(db):
    db.session.add_all([
        Client(full_name='Antes', email='a@x.com', created_at=datetime(2026, 5, 31, 23, 0)),
        Client(full_name='Dentro', email='b@x.com', created_at=datetime(2026, 6, 15, 12, 0)),
        Client(full_name='En_el_limite', email='c@x.com', created_at=datetime(2026, 6, 30, 23, 59)),
        Client(full_name='Despues', email='d@x.com', created_at=datetime(2026, 7, 1, 0, 0)),
    ])
    db.session.commit()

    pagina = UserService.get_leads_list({'start_date': '2026-06-01', 'end_date': '2026-06-30'})

    assert sorted(c.full_name for c in pagina.items) == ['Dentro', 'En_el_limite']


def test_filtra_por_uno_o_varios_programas(db, catalogo):
    ana = Client(full_name='Ana', email='ana@x.com')
    beto = Client(full_name='Beto', email='beto@x.com')
    caro = Client(full_name='Caro', email='caro@x.com')
    db.session.add_all([ana, beto, caro])
    db.session.commit()
    inscribir(db, ana, catalogo['AL'], None, 0, catalogo['zelle'])
    inscribir(db, beto, catalogo['RR'], None, 0, catalogo['zelle'])
    # caro no esta inscrita en nada

    solo_al = UserService.get_leads_list({'program': 'AL'})
    al_o_rr = UserService.get_leads_list({'program': 'AL,RR'})

    assert [c.full_name for c in solo_al.items] == ['Ana']
    assert sorted(c.full_name for c in al_o_rr.items) == ['Ana', 'Beto']


def test_filtra_por_closer_via_inscripcion_o_via_cita(db, catalogo, make_user):
    from app.models import Appointment

    closer = make_user(role='closer')
    otro = make_user(role='closer', username='otro')
    por_inscripcion = Client(full_name='PorInscripcion', email='i@x.com')
    por_cita = Client(full_name='PorCita', email='c@x.com')
    ajeno = Client(full_name='Ajeno', email='j@x.com')
    db.session.add_all([por_inscripcion, por_cita, ajeno])
    db.session.commit()
    inscribir(db, por_inscripcion, catalogo['AL'], closer, 0, catalogo['zelle'])
    inscribir(db, ajeno, catalogo['AL'], otro, 0, catalogo['zelle'])
    db.session.add(Appointment(closer_id=closer.id, client_id=por_cita.id, start_time=datetime(2026, 6, 1)))
    db.session.commit()

    pagina = UserService.get_leads_list({'closer_id': closer.id})

    assert sorted(c.full_name for c in pagina.items) == ['PorCita', 'PorInscripcion']


def test_pagina_y_cuenta_el_total_real_no_solo_la_pagina(db):
    for n in range(5):
        db.session.add(Client(full_name=f'Cliente {n}', email=f'c{n}@x.com', created_at=datetime(2026, 1, n + 1)))
    db.session.commit()

    pagina = UserService.get_leads_list({}, page=1, per_page=2)

    assert pagina.total == 5
    assert len(pagina.items) == 2
    assert pagina.pages == 3


# --- get_leads_kpis -------------------------------------------------------------------------------

@pytest.fixture()
def dos_ventas(db, catalogo, make_user):
    """Ana (AL, 400 de 1000 pagados) y Beto (RR, 1500 de 1500): closer1 y closer2 respectivamente."""
    closer1 = make_user(role='closer', username='closer1')
    closer2 = make_user(role='closer', username='closer2')
    ana = Client(full_name='Ana Gomez', email='ana@x.com', created_at=datetime(2026, 1, 10))
    beto = Client(full_name='Beto Ruiz', email='beto@x.com', created_at=datetime(2026, 2, 10))
    db.session.add_all([ana, beto])
    db.session.commit()
    inscribir(db, ana, catalogo['AL'], closer1, 400.0, catalogo['zelle'])
    inscribir(db, beto, catalogo['RR'], closer2, 1500.0, catalogo['zelle'])
    return {'ana': ana, 'beto': beto, 'closer1': closer1, 'closer2': closer2}


def test_sin_filtros_suma_todo(db, dos_ventas):
    kpis = UserService.get_leads_kpis({})

    assert kpis['total'] == 2
    assert kpis['programs'] == {'AL': 1, 'RR': 1}
    assert kpis['revenue'] == 1900.0  # 400 + 1500
    # comision: 5% de cada pago (metodo Zelle) => 20 + 75 = 95; cash_collected = 1900 - 95
    assert kpis['cash_collected'] == 1805.0
    assert kpis['debt'] == 600.0  # a Ana le faltan 600 de su AL; Beto ya pago completo
    assert kpis['projected_revenue'] == kpis['cash_collected'] + kpis['debt']


def test_el_programa_de_un_cliente_sin_inscripcion_nunca_es_null_en_conteos(db):
    # Un cliente sin ninguna inscripcion no aparece en "programs" (join interno con Enrollment/Program).
    db.session.add(Client(full_name='Sin Programa', email='sp@x.com'))
    db.session.commit()

    kpis = UserService.get_leads_kpis({})

    assert kpis['total'] == 1
    assert kpis['programs'] == {}
    assert (kpis['revenue'], kpis['debt']) == (0.0, 0.0)


def test_filtrar_por_programa_limita_ingreso_y_deuda_a_ese_programa(db, dos_ventas, catalogo):
    # Ana tambien se inscribe en RR (pago parcial, con deuda): antes de la correccion, filtrar por "AL"
    # sumaba tambien la deuda de la inscripcion en RR de Ana.
    inscribir(db, dos_ventas['ana'], catalogo['RR'], dos_ventas['closer1'], 100.0, catalogo['zelle'])

    kpis = UserService.get_leads_kpis({'program': 'AL'})

    assert kpis['total'] == 1  # solo Ana tiene una inscripcion en AL
    assert kpis['programs'] == {'AL': 1}
    assert kpis['revenue'] == 400.0  # no el pago que hizo en RR
    assert kpis['debt'] == 600.0  # no la deuda de su inscripcion en RR (1400)


def test_filtrar_por_varios_programas_sepados_por_coma(db, dos_ventas):
    kpis = UserService.get_leads_kpis({'program': 'AL,RR'})

    assert kpis['total'] == 2
    assert kpis['revenue'] == 1900.0


def test_filtrar_por_closer_cuenta_solo_a_sus_leads(db, dos_ventas):
    kpis = UserService.get_leads_kpis({'closer_id': dos_ventas['closer1'].id})

    assert kpis['total'] == 1
    assert kpis['programs'] == {'AL': 1}
    assert kpis['revenue'] == 400.0


def test_filtrar_por_closer_hoy_arrastra_los_montos_de_otro_closer_si_comparten_cliente(
        db, dos_ventas, catalogo):
    # Documenta el comportamiento ACTUAL, no necesariamente el deseado: closer_id filtra CLIENTES (via
    # "tiene alguna cita o inscripcion con este closer"), y una vez que un cliente califica se suman
    # TODAS sus inscripciones, aunque sean de otro closer. Si esto cambia a proposito, actualizar este
    # test junto con el cambio.
    inscribir(db, dos_ventas['ana'], catalogo['RR'], dos_ventas['closer2'], 100.0, catalogo['zelle'])

    kpis = UserService.get_leads_kpis({'closer_id': dos_ventas['closer1'].id})

    assert kpis['programs'] == {'AL': 1, 'RR': 1}
    assert kpis['revenue'] == 500.0  # 400 (closer1, AL) + 100 (closer2, RR): arrastra el ajeno


def test_filtrar_por_busqueda_o_fechas_tambien_acota_los_kpis(db, dos_ventas):
    por_nombre = UserService.get_leads_kpis({'search': 'ana'})
    por_fecha = UserService.get_leads_kpis({'start_date': '2026-02-01', 'end_date': '2026-02-28'})

    assert (por_nombre['total'], por_nombre['revenue']) == (1, 400.0)
    assert (por_fecha['total'], por_fecha['revenue']) == (1, 1500.0)  # solo Beto (alta en febrero)


def test_solo_se_suma_la_deuda_positiva_no_un_credito_a_favor(db, catalogo, make_user):
    closer = make_user(role='closer')
    ana = Client(full_name='Ana', email='ana@x.com')
    db.session.add(ana)
    db.session.commit()
    # Pago de mas que el precio del programa: no debe restar de la deuda total (quedaria negativa).
    inscribir(db, ana, catalogo['AL'], closer, 1200.0, catalogo['zelle'])

    kpis = UserService.get_leads_kpis({})

    assert kpis['debt'] == 0.0


def test_un_pago_pendiente_no_cuenta_como_ingreso_ni_reduce_la_deuda(db, catalogo, make_user):
    closer = make_user(role='closer')
    ana = Client(full_name='Ana', email='ana@x.com')
    db.session.add(ana)
    db.session.commit()
    inscribir(db, ana, catalogo['AL'], closer, 400.0, catalogo['zelle'], estado='pending')

    kpis = UserService.get_leads_kpis({})

    assert (kpis['revenue'], kpis['cash_collected']) == (0.0, 0.0)
    assert kpis['debt'] == 1000.0  # el pago pendiente no cuenta como pagado
