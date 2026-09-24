"""La sub-etapa de cobro decide qué pantalla abre el modal del cliente.

Antes el modal mostraba siempre la misma pantalla de cobro para cualquier cliente que ya
hubiera comprado, debiera o no debiera, tuviera plan de cuotas o no. Estos tests fijan las
cuatro situaciones que el closer trabaja distinto y, sobre todo, los bordes donde se confunden:
el que debe sin plan armado, el que tiene la cuota vencida, el que la tiene por vencer y el que
ya está al día. El día de vencimiento exacto se prueba aparte porque "vence hoy" no es lo mismo
que "está vencida" — cobrarlo hoy todavía llega a tiempo.

La función es pura: recibe la deuda y la próxima cuota ya calculadas, así que estos tests no
tocan la base ni dependen de cómo se resuelve el cruce cliente↔venta."""
from datetime import date

import pytest

from app.services.lead_cobro_service import (
    ACCION_ARMAR_PLAN,
    ACCION_PROGRAMAR_COBRO,
    ACCION_REGISTRAR_COBRO,
    ACCION_REGISTRAR_RENOVACION,
    DIAS_PERMANENCIA,
    clave_de_etapa,
    resolver_etapa,
)

HOY = date(2026, 9, 24)


def cuota(fecha, monto=250.0, sin_plan=False):
    return {'id': 7, 'numero_cuota': 2, 'monto': monto, 'fecha_vencimiento': fecha, 'vencida': False, 'sin_plan': sin_plan}


# --- Debe dinero ---

def test_el_que_debe_y_no_tiene_cuotas_va_a_armar_el_plan():
    etapa = resolver_etapa(deuda=900.0, proxima_cuota=None, hoy=HOY)
    assert etapa['clave'] == 'sin_plan'
    assert etapa['accion_principal'] == ACCION_ARMAR_PLAN


def test_el_pseudo_objeto_sin_plan_tambien_manda_a_armar_el_plan():
    """`_build_cartera_item` representa la deuda sin cronograma con un dict de cuota con
    `sin_plan: True` y sin fecha — no es una cuota que se pueda cobrar."""
    etapa = resolver_etapa(deuda=900.0, proxima_cuota=cuota(None, monto=900.0, sin_plan=True), hoy=HOY)
    assert etapa['clave'] == 'sin_plan'


def test_una_cuota_sin_fecha_de_vencimiento_cuenta_como_sin_plan():
    """Planes viejos cargados a mano pueden tener la fecha vacía: no hay nada que vencer, y
    mandarlo a la pantalla de cobro dejaría al closer sin ninguna fecha que decirle al cliente."""
    assert clave_de_etapa(900.0, cuota(None), hoy=HOY) == 'sin_plan'


def test_la_cuota_atrasada_es_lo_mas_urgente_y_dice_cuantos_dias():
    etapa = resolver_etapa(deuda=500.0, proxima_cuota=cuota('2026-09-14'), hoy=HOY)
    assert etapa['clave'] == 'cuota_vencida'
    assert etapa['dias_atraso'] == 10
    assert '10 días' in etapa['titulo']
    assert etapa['accion_principal'] == ACCION_REGISTRAR_COBRO


def test_un_solo_dia_de_atraso_se_escribe_en_singular():
    etapa = resolver_etapa(deuda=500.0, proxima_cuota=cuota('2026-09-23'), hoy=HOY)
    assert '1 día' in etapa['titulo'] and '1 días' not in etapa['titulo']


def test_la_cuota_que_vence_hoy_todavia_no_esta_vencida():
    etapa = resolver_etapa(deuda=500.0, proxima_cuota=cuota('2026-09-24'), hoy=HOY)
    assert etapa['clave'] == 'cuota_hoy'
    assert etapa['dias_atraso'] == 0


def test_la_cuota_futura_deja_programar_el_recordatorio():
    etapa = resolver_etapa(deuda=500.0, proxima_cuota=cuota('2026-10-01'), hoy=HOY)
    assert etapa['clave'] == 'cuota_proxima'
    assert etapa['dias_para_vencer'] == 7
    assert etapa['accion_principal'] == ACCION_PROGRAMAR_COBRO


def test_la_fecha_puede_llegar_como_date_y_no_solo_como_texto():
    """La cuota llega serializada desde la API, pero el mismo resolutor se usa contra el modelo
    en memoria, donde `fecha_vencimiento` es un `date`."""
    assert clave_de_etapa(500.0, cuota(date(2026, 9, 14)), hoy=HOY) == 'cuota_vencida'


# --- Al día ---

@pytest.mark.parametrize('deuda', [0, 0.0, None, 0.009])
def test_un_resto_de_centavos_no_es_una_deuda_que_cobrar(deuda):
    """Los montos salen de sumas de pagos parciales redondeados: un centavo colgado no debe
    mandar al closer a cobrarle nada a un cliente que ya pagó todo."""
    assert clave_de_etapa(deuda, None, enrollment_date='2026-09-20', hoy=HOY) == 'permanencia'


def test_el_cliente_nuevo_al_dia_va_a_permanencia():
    etapa = resolver_etapa(deuda=0.0, enrollment_date='2026-09-01', hoy=HOY)
    assert etapa['clave'] == 'permanencia'
    assert etapa['dias_en_programa'] == 23


def test_a_los_dos_meses_el_seguimiento_pasa_a_ser_de_renovacion():
    ingreso = date(HOY.year, HOY.month, HOY.day)
    justo = ingreso.toordinal() - DIAS_PERMANENCIA
    etapa = resolver_etapa(deuda=0.0, enrollment_date=date.fromordinal(justo), hoy=HOY)
    assert etapa['clave'] == 'renovacion'
    assert etapa['accion_principal'] == ACCION_REGISTRAR_RENOVACION


def test_el_dia_anterior_al_corte_todavia_es_permanencia():
    justo_antes = date.fromordinal(HOY.toordinal() - DIAS_PERMANENCIA + 1)
    assert clave_de_etapa(0.0, None, enrollment_date=justo_antes, hoy=HOY) == 'permanencia'


def test_sin_fecha_de_ingreso_no_se_inventa_ni_permanencia_ni_renovacion():
    """Hay ventas cargadas solo como FinancialSale, sin Enrollment con fecha: no se puede saber
    cuánto lleva en el programa, y afirmarlo sería mentirle al closer."""
    etapa = resolver_etapa(deuda=0.0, enrollment_date=None, hoy=HOY)
    assert etapa['clave'] == 'al_dia'
    assert 'dias_en_programa' not in etapa


# --- Contrato del descriptor ---

@pytest.mark.parametrize('deuda,cuota_arg,ingreso', [
    (900.0, None, None),
    (500.0, {'monto': 250.0, 'fecha_vencimiento': '2026-09-14'}, None),
    (500.0, {'monto': 250.0, 'fecha_vencimiento': '2026-10-01'}, None),
    (0.0, None, '2026-09-01'),
    (0.0, None, '2026-01-01'),
    (0.0, None, None),
])
def test_toda_etapa_trae_texto_tono_y_una_accion_principal_dentro_de_sus_acciones(deuda, cuota_arg, ingreso):
    """El modal pinta el encabezado y abre la acción principal sin consultar nada más: si
    alguna etapa se quedara sin título o con una acción principal que no está en la lista, la
    pantalla saldría vacía o abriría un paso que no ofrece."""
    etapa = resolver_etapa(deuda=deuda, proxima_cuota=cuota_arg, enrollment_date=ingreso, hoy=HOY)
    assert etapa['titulo'] and etapa['subtitulo']
    assert etapa['tono'] in ('error', 'warning', 'primary', 'success')
    assert etapa['accion_principal'] in etapa['acciones']
