"""Ticket promedio agrupado por cliente (`ticket_service`, 19/10/2026)."""
from datetime import datetime

import pytest

from app.services import ticket_service as ts
from app.services.ticket_service import CUOTA, SENA, VENTA, agrupar_ventas, claves_de_cliente, ticket_promedio

ANA = claves_de_cliente(email='ana@x.com')
BETO = claves_de_cliente(email='beto@x.com')


def _p(claves, fecha, monto, clase=VENTA):
    return claves, datetime.fromisoformat(fecha), monto, clase


def test_dos_pagos_del_mismo_cliente_en_el_mes_son_una_venta():
    pagos = [_p(ANA, '2026-10-03', 300), _p(ANA, '2026-10-20', 700)]
    assert ticket_promedio(pagos) == (1000, 1, 1000)


def test_dos_clientes_distintos_son_dos_ventas():
    pagos = [_p(ANA, '2026-10-03', 300), _p(BETO, '2026-10-04', 700)]
    assert ticket_promedio(pagos) == (1000, 2, 500)


def test_meses_distintos_fuera_de_la_ventana_son_dos_ventas():
    pagos = [_p(ANA, '2026-09-10', 300), _p(ANA, '2026-10-20', 700)]
    assert ticket_promedio(pagos) == (1000, 2, 500)


def test_borde_de_mes_dentro_de_la_ventana_es_una_venta():
    pagos = [_p(ANA, '2026-09-29', 300), _p(ANA, '2026-10-02', 700)]
    assert ticket_promedio(pagos)[1] == 1


def test_mismo_cliente_por_ficha_y_por_mail():
    con_ficha = claves_de_cliente(client_id=7, email='ana@x.com')
    pagos = [_p(con_ficha, '2026-10-03', 300), _p(claves_de_cliente(email='ANA@x.com '), '2026-10-05', 700)]
    assert ticket_promedio(pagos)[1] == 1


def test_sin_identidad_cada_pago_es_una_venta():
    pagos = [_p((), '2026-10-03', 300), _p((), '2026-10-05', 700)]
    assert ticket_promedio(pagos)[1] == 2


def test_la_primera_cuota_a_menos_de_un_mes_suma_a_la_venta():
    pagos = [_p(ANA, '2026-09-29', 50), _p(ANA, '2026-10-27', 200, CUOTA), _p(ANA, '2026-10-28', 300, CUOTA)]
    assert ticket_promedio(pagos) == (250, 1, 250)


def test_la_cuota_al_mes_o_despues_no_suma():
    pagos = [_p(ANA, '2026-09-05', 300), _p(ANA, '2026-10-05', 400, CUOTA)]
    assert ticket_promedio(pagos) == (300, 1, 300)


def test_la_cuota_de_otro_cliente_no_suma():
    pagos = [_p(ANA, '2026-10-01', 300), _p(BETO, '2026-10-05', 400, CUOTA)]
    assert ticket_promedio(pagos) == (300, 1, 300)


def test_la_sena_queda_fuera_por_defecto():
    pagos = [_p(ANA, '2026-10-01', 100, SENA), _p(ANA, '2026-10-03', 500)]
    assert ticket_promedio(pagos) == (500, 1, 500)


def test_solo_cuotas_no_es_una_venta():
    assert ticket_promedio([_p(ANA, '2026-10-10', 200, CUOTA)]) == (0, 0, None)


@pytest.mark.parametrize('senas,cuota,esperado', [(False, False, 500), (True, False, 600), (False, True, 700),
                                                  (True, True, 800)])
def test_las_constantes(monkeypatch, senas, cuota, esperado):
    monkeypatch.setattr(ts, 'SUMAR_SENAS', senas)
    monkeypatch.setattr(ts, 'SUMAR_PRIMERA_CUOTA', cuota)
    pagos = [_p(ANA, '2026-10-01', 100, SENA), _p(ANA, '2026-10-03', 500), _p(ANA, '2026-10-10', 200, CUOTA)]
    assert agrupar_ventas(pagos) == [esperado]


def _fila(cliente, fecha, monto, tipo='parcial'):
    return {'client_id': None, 'email': f'{cliente}@x.com', 'ig': '', 'cliente': cliente, 'fecha': fecha,
            'monto': monto, 'monto_neto': monto, 'tipo_pago': {'key': tipo},
            'es_venta': tipo in ('completo', 'parcial')}


def test_totales_ventas_agrupa_el_ticket_pero_no_la_cantidad_ni_el_cash(db):
    from app.models import FinancialSale
    from app.services.comercial_service import ComercialService
    # La cuota de beto la cargó otro closer y cae después del período: igual es de su venta
    db.session.add(FinancialSale(mail_cliente='beto@x.com', tipo_pago='RR - Cuota', monto=200,
                                 date=datetime(2026, 11, 2), estado='Completada'))
    db.session.commit()
    filas = [_fila('ana', '2026-10-03T10:00:00', 300), _fila('ana', '2026-10-20T10:00:00', 700),
             _fila('beto', '2026-10-05T10:00:00', 500, 'completo'),
             _fila('ana', '2026-10-25T10:00:00', 999, 'cuota')]
    tot = ComercialService.totales_ventas(filas)
    assert tot['ventas'] == 3
    assert tot['cash'] == 2499
    # ana 1000 (su cuota del período no está en la base: no se cuenta dos veces), beto 500 + 200
    assert tot['ticket'] == 850
