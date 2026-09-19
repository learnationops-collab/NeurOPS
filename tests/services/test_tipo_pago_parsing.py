"""Clasificacion del tipo de pago de una venta (FinancialSale.tipo_pago).

Es texto libre del sheet historico ('Con Seña', 'RR - Parcial', 'rr-cuota', 'Pago completo'...).
De esta clasificacion dependen las reglas de secuencia de pago (SalesConsistencyService): un error
aca bloquea a un closer que intenta declarar una cuota, o le deja registrar un pago que no toca.
"""
import pytest

from app.services.sales_consistency_service import SalesConsistencyService
from app.services.sheets_service import SheetsService

# --- _extract_tipo_keyword --------------------------------------------------------------------

@pytest.mark.parametrize('texto,esperado', [
    # completo
    ('Completo', 'completo'), ('COMPLETO', 'completo'), ('Pago Completo', 'completo'),
    ('Con Completo', 'completo'), ('PIF', 'completo'), ('pif', 'completo'), (' PIF ', 'completo'),
    # parcial
    ('Parcial', 'parcial'), ('PARCIAL', 'parcial'), ('Con Parcial', 'parcial'),
    # seña (con y sin enie, y su nombre en ingles)
    ('Seña', 'seña'), ('SEÑA', 'seña'), ('Con Seña', 'seña'), ('sena', 'seña'), ('Deposit', 'seña'),
    # cuota
    ('Cuota', 'cuota'), ('cuota 2', 'cuota'), ('Installment', 'cuota'),
    # renovacion (con y sin tilde)
    ('Renovación', 'renovacion'), ('RENOVACION', 'renovacion'), ('Renewal', 'renovacion'),
    # upsell
    ('Upsell', 'upsell'), ('UPSELL', 'upsell'),
])
def test_extract_tipo_keyword_reconoce_las_variantes(texto, esperado):
    assert SheetsService._extract_tipo_keyword(texto) == esperado


@pytest.mark.parametrize('texto', [None, '', '   ', 'otra cosa', 'RR', 'Pifia'])
def test_extract_tipo_keyword_devuelve_none_si_no_reconoce_nada(texto):
    assert SheetsService._extract_tipo_keyword(texto) is None


def test_los_tipos_que_produce_son_exactamente_los_validos_del_sistema():
    producidos = {
        SheetsService._extract_tipo_keyword(texto)
        for texto in ('completo', 'parcial', 'seña', 'cuota', 'renovacion', 'upsell')
    }

    assert producidos == SalesConsistencyService.TIPOS_VALIDOS


def test_sales_consistency_usa_la_misma_clasificacion():
    assert SalesConsistencyService._normalize_tipo('Con Seña') == 'seña'
    assert SalesConsistencyService._normalize_tipo('basura') is None


# --- parse_tipo_pago --------------------------------------------------------------------------

@pytest.mark.parametrize('crudo,esperado', [
    # formato normal: PROGRAMA - tipo
    ('RR - Parcial', ('RR', 'parcial')),
    ('AL - Cuota', ('AL', 'cuota')),
    ('SI - Renovación', ('SI', 'renovacion')),
    ('RR - Completo', ('RR', 'completo')),
    ('AL - Upsell', ('AL', 'upsell')),
    ('RR - Con Seña', ('RR', 'seña')),
    # variantes reales de los datos historicos: minusculas, sin espacios, espacios de mas
    ('rr - parcial', ('RR', 'parcial')),
    ('RR-Seña', ('RR', 'seña')),
    ('  AL  -  Cuota  ', ('AL', 'cuota')),
    # codigo de programa desconocido: no se inventa programa, pero el tipo se rescata igual
    ('XX - Parcial', (None, 'parcial')),
    ('ABC - Cuota', (None, 'cuota')),
    ('Roadmap - Parcial', (None, 'parcial')),
    # sin prefijo de programa (datos viejos)
    ('Parcial', (None, 'parcial')),
    ('Con Seña', (None, 'seña')),
    ('Cuota', (None, 'cuota')),
    # basura
    (None, (None, None)),
    ('', (None, None)),
    ('RR', (None, None)),
    ('RR - Otra cosa', ('RR', None)),
])
def test_parse_tipo_pago(crudo, esperado):
    assert SheetsService.parse_tipo_pago(crudo) == esperado


def test_solo_hay_tres_programas_conocidos():
    assert set(SheetsService.PROGRAM_KEYWORDS) == {'RR', 'AL', 'SI'}
