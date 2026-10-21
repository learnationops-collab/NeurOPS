"""La regla del estado de pago que Work le manda a la Academia (`academy_payment_status.regla_estado`)."""
from datetime import date, timedelta
from types import SimpleNamespace

from app.services.academy_payment_status import (
    AL_DIA, BAJA, PAGADO, POR_VENCER, POR_VENCER_DIAS, SENA, VENCIDA, regla_estado,
)

HOY = date(2026, 10, 21)


def cuota(dias):
    return SimpleNamespace(fecha_vencimiento=HOY + timedelta(days=dias))


def test_la_baja_gana_a_todo():
    assert regla_estado('cuotas', [cuota(-30)], {'motivo': 'x'}, HOY) == BAJA


def test_una_cuota_con_la_fecha_pasada_es_vencida():
    assert regla_estado('cuotas', [cuota(-1), cuota(20)], None, HOY) == VENCIDA


def test_la_proxima_dentro_de_los_dias_esta_por_vencer():
    assert regla_estado('cuotas', [cuota(POR_VENCER_DIAS)], None, HOY) == POR_VENCER
    assert regla_estado('cuotas', [cuota(0)], None, HOY) == POR_VENCER


def test_la_proxima_mas_adelante_esta_al_dia():
    assert regla_estado('cuotas', [cuota(POR_VENCER_DIAS + 1)], None, HOY) == AL_DIA


def test_sin_pendientes_es_pagado_salvo_que_solo_haya_sena():
    assert regla_estado('completo', [], None, HOY) == PAGADO
    assert regla_estado('cuotas', [], None, HOY) == PAGADO
    assert regla_estado('seña', [], None, HOY) == SENA


def test_una_cuota_sin_fecha_no_cuenta():
    assert regla_estado('cuotas', [SimpleNamespace(fecha_vencimiento=None)], None, HOY) == PAGADO
