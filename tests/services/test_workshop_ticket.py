"""Ticket promedio de un workshop: lo cobrado en ventas nuevas dividido por esas ventas.

Era `cash_collected / sales`. El cash del taller incluye las señas —a proposito: es plata que el
taller trajo y el ROAS la usa— y `sales` cuenta PERSONAS, incluso a quien la hoja marca como cerrada
sin la venta cargada, asi que el ticket salia inflado. Regla del 02/10/2026, la misma del dashboard
comercial y del de closers: suma del monto de las ventas nuevas (pago completo y split pay) / cuantas
filas son. Cuotas, señas, renovaciones y upsells nunca entran.
"""
from datetime import date, datetime

import pytest

from app.models import FinancialAgenda, FinancialSale, WorkshopEvent
from app.services.workshop_metrics_service import calcular_prefill

DIA = date(2026, 9, 19)
SIGUIENTE = date(2026, 9, 26)          # cierra la ventana del taller del 19: del 19 al 25
AGENDADA = datetime(2026, 9, 20, 15, 0)
COBRADA = datetime(2026, 9, 22, 15, 0)


def talleres(db):
    for dia in (DIA, SIGUIENTE):
        db.session.add(WorkshopEvent(date=dia, name=f'WEBINAR {dia}'))
    db.session.commit()
    return WorkshopEvent.query.filter_by(date=DIA).one().id


def agenda(db, ig, *, nombre='Workshop', estado='Show Up'):
    db.session.add(FinancialAgenda(nombre=nombre, lead=f'Persona {ig}', instagram=ig, mail=f'{ig}@test.local',
                                   estado=estado, closer='Marlon', created_at=AGENDADA, date=AGENDADA))
    db.session.commit()


def pago(db, ig, tipo, monto):
    db.session.add(FinancialSale(instagram=ig, mail_cliente=f'{ig}@test.local', tipo_pago=tipo,
                                 monto=monto, date=COBRADA, created_at=COBRADA, estado='Completada'))
    db.session.commit()


def test_el_ticket_es_la_venta_nueva_sin_la_sena_ni_la_cuota(db):
    talleres(db)
    agenda(db, 'ana')
    pago(db, 'ana', 'RR - Parcial', 250.0)
    pago(db, 'ana', 'RR - Seña', 100.0)
    pago(db, 'ana', 'RR - Cuota', 250.0)

    data = calcular_prefill(DIA)

    assert data['cash_ventas'] == 250.0
    assert data['ventas_cobradas'] == 1
    # El cash del taller sigue trayendo la seña (y la cuota sigue sin entrar)
    assert data['cash_collected'] == 350.0
    assert data['sales'] == 1


def test_quien_la_hoja_da_por_cerrado_sin_venta_cargada_no_baja_el_ticket(db):
    talleres(db)
    agenda(db, 'ana')
    pago(db, 'ana', 'AL - Completo', 1000.0)
    agenda(db, 'beto', estado='Cierre')

    data = calcular_prefill(DIA)

    assert data['sales'] == 2                 # compradores: personas, para el close rate
    assert data['ventas_cobradas'] == 1       # ventas: filas cargadas, para el ticket
    assert data['cash_ventas'] == 1000.0


def test_vivo_y_grabacion_llevan_cada_uno_su_base_y_el_total_las_suma(db):
    talleres(db)
    agenda(db, 'ana')
    pago(db, 'ana', 'RR - Parcial', 250.0)
    agenda(db, 'carla', nombre='Workshop Landing')
    pago(db, 'carla', 'AL - Completo', 1000.0)
    pago(db, 'carla', 'AL - Upsell', 300.0)

    data = calcular_prefill(DIA)

    vivo, landing = data['desglose']['vivo'], data['desglose']['landing']
    assert (vivo['cash_ventas'], vivo['ventas_cobradas']) == (250.0, 1)
    assert (landing['cash_ventas'], landing['ventas_cobradas']) == (1000.0, 1)
    assert (data['cash_ventas'], data['ventas_cobradas']) == (1250.0, 2)


def test_la_sena_de_alguien_del_vivo_que_vuelve_por_la_grabacion_no_se_cuenta_dos_veces(db):
    talleres(db)
    agenda(db, 'ana')
    agenda(db, 'ana', nombre='Workshop Landing')
    pago(db, 'ana', 'RR - Seña', 100.0)

    data = calcular_prefill(DIA)

    assert data['cash_collected'] == 100.0
    assert (data['cash_ventas'], data['ventas_cobradas']) == (0.0, 0)


# --- El modelo ---------------------------------------------------------------------------------

def test_el_modelo_divide_lo_cobrado_en_ventas_nuevas_por_cuantas_son():
    ev = WorkshopEvent(date=DIA, name='X', sales=3, cash_collected=900.0, cash_ventas=500.0, ventas_cobradas=2)

    assert ev.ticket_promedio == 250.0
    assert ev.to_dict()['ticket_promedio'] == 250.0


def test_sin_ventas_nuevas_el_ticket_es_cero():
    ev = WorkshopEvent(date=DIA, name='X', sales=1, cash_collected=100.0, cash_ventas=0.0, ventas_cobradas=0)

    assert ev.ticket_promedio == 0.0


def test_un_taller_sin_la_base_calculada_no_vuelve_a_la_cuenta_vieja():
    ev = WorkshopEvent(date=DIA, name='X', sales=2, cash_collected=600.0)

    assert ev.ticket_promedio is None
    assert ev.to_dict()['ticket_promedio'] is None


# --- Donde se escribe el snapshot ----------------------------------------------------------------

def test_la_sincronizacion_en_vivo_guarda_la_base_del_ticket(db):
    taller = talleres(db)
    agenda(db, 'ana')
    pago(db, 'ana', 'RR - Seña', 100.0)
    pago(db, 'ana', 'RR - Parcial', 250.0)

    db.session.expire_all()
    ev = db.session.get(WorkshopEvent, taller)
    assert (ev.cash_ventas, ev.ventas_cobradas) == (250.0, 1)
    assert ev.cash_collected == 350.0
    assert ev.ticket_promedio == 250.0


@pytest.fixture()
def director(make_user, auth_headers):
    return auth_headers(make_user(role='admin'))


def _sin_base(db):
    """Deja el taller como quedaron los viejos tras la migracion, sin pasar por el gancho."""
    WorkshopEvent.query.update({'cash_ventas': None, 'ventas_cobradas': None})
    db.session.commit()


def test_el_listado_completa_la_base_de_los_talleres_viejos(client, db, director):
    taller = talleres(db)
    agenda(db, 'ana')
    pago(db, 'ana', 'RR - Seña', 100.0)
    pago(db, 'ana', 'RR - Parcial', 250.0)
    _sin_base(db)
    # Un numero que el listado no tiene que pisar: solo completa las dos columnas nuevas
    WorkshopEvent.query.filter_by(id=taller).update({'sales': 7})
    db.session.commit()

    respuesta = client.get('/api/workshop/events', headers=director)

    assert respuesta.status_code == 200
    fila = next(e for e in respuesta.get_json() if e['id'] == taller)
    assert (fila['cash_ventas'], fila['ventas_cobradas'], fila['ticket_promedio']) == (250.0, 1, 250.0)
    assert fila['sales'] == 7
    db.session.expire_all()
    assert db.session.get(WorkshopEvent, taller).ventas_cobradas == 1


def test_si_completar_un_taller_falla_el_listado_responde_igual(client, db, director, monkeypatch):
    taller = talleres(db)
    _sin_base(db)

    def _rompe(*args, **kwargs):
        raise RuntimeError('boom')

    monkeypatch.setattr('app.services.workshop_metrics_service.calcular_prefill', _rompe)

    respuesta = client.get('/api/workshop/events', headers=director)

    assert respuesta.status_code == 200
    fila = next(e for e in respuesta.get_json() if e['id'] == taller)
    assert fila['ticket_promedio'] is None


def test_crear_un_taller_con_el_prefill_guarda_la_base_del_ticket(client, db, director):
    respuesta = client.post('/api/workshop/events', headers=director, json={
        'date': '2026-09-19', 'name': 'WEBINAR', 'sales': 2, 'cash_collected': 600.0,
        'cash_ventas': 500.0, 'ventas_cobradas': 2})

    assert respuesta.status_code == 201
    assert respuesta.get_json()['ticket_promedio'] == 250.0


def test_editar_el_taller_actualiza_la_base_del_ticket(client, db, director):
    taller = talleres(db)

    respuesta = client.put(f'/api/workshop/events/{taller}', headers=director, json={
        'cash_ventas': 900.0, 'ventas_cobradas': 3})

    assert respuesta.status_code == 200
    assert respuesta.get_json()['ticket_promedio'] == 300.0
