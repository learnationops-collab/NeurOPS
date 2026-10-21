"""La regla del estado de pago que Work le manda a la Academia (`academy_payment_status.regla_estado`)."""
from datetime import date, timedelta

from app.services.academy_payment_status import (
    AL_DIA, BAJA, PAGADO, POR_VENCER, POR_VENCER_DIAS, SENA, VENCIDA, regla_estado,
)

HOY = date(2026, 10, 21)


def en(dias):
    return HOY + timedelta(days=dias)


def test_la_baja_gana_a_todo():
    assert regla_estado({'motivo': 'x'}, 1, en(5), 'cuotas', HOY) == BAJA


def test_una_cuota_vencida_gana_a_la_proxima():
    assert regla_estado(None, 1, en(20), 'cuotas', HOY) == VENCIDA


def test_por_vencer_hasta_el_limite_y_hoy_cuenta_como_cero():
    assert regla_estado(None, 0, en(POR_VENCER_DIAS), 'cuotas', HOY) == POR_VENCER
    assert regla_estado(None, 0, en(0), 'cuotas', HOY) == POR_VENCER


def test_al_dia_si_la_proxima_vence_mas_adelante():
    assert regla_estado(None, 0, en(POR_VENCER_DIAS + 1), 'cuotas', HOY) == AL_DIA


def test_sin_cuotas_pendientes_es_pagado_o_sena():
    assert regla_estado(None, 0, None, 'completo', HOY) == PAGADO
    assert regla_estado(None, 0, None, 'cuotas', HOY) == PAGADO
    assert regla_estado(None, 0, None, 'seña', HOY) == SENA
