"""Ticket promedio de un workshop: lo cobrado en ventas nuevas dividido por esas ventas.

Era `cash_collected / sales`. El cash del taller incluye las señas —a proposito: es plata que el
taller trajo y el ROAS la usa— y `sales` cuenta PERSONAS, incluso a quien la hoja marca como cerrada
sin la venta cargada, asi que el ticket salia inflado. Regla del 02/10/2026, la misma del dashboard
comercial y del de closers: suma del monto de las ventas nuevas (pago completo y split pay) / cuantas
filas son. Señas, renovaciones y upsells nunca entran; desde el 19/10/2026 la primera cuota a menos
de un mes de la venta sí (`ticket_service`).
"""
from datetime import date, datetime

import pytest

from app.models import FinancialSale, WorkshopEvent

DIA = date(2026, 9, 19)
SIGUIENTE = date(2026, 9, 26)          # cierra la ventana del taller del 19: del 19 al 25
AGENDADA = datetime(2026, 9, 20, 15, 0)
COBRADA = datetime(2026, 9, 22, 15, 0)


def talleres(db):
    for dia in (DIA, SIGUIENTE):
        db.session.add(WorkshopEvent(date=dia, name=f'WEBINAR {dia}'))
    db.session.commit()
    return WorkshopEvent.query.filter_by(date=DIA).one().id


def pago(db, ig, tipo, monto):
    db.session.add(FinancialSale(instagram=ig, mail_cliente=f'{ig}@test.local', tipo_pago=tipo,
                                 monto=monto, date=COBRADA, created_at=COBRADA, estado='Completada'))
    db.session.commit()


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

@pytest.fixture()
def director(make_user, auth_headers):
    return auth_headers(make_user(role='admin'))


def _sin_base(db):
    """Deja el taller como quedaron los viejos tras la migracion, sin pasar por el gancho."""
    WorkshopEvent.query.update({'cash_ventas': None, 'ventas_cobradas': None})
    db.session.commit()


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
