"""Contrato de `normalize_ig`: la funcion se copio modulo por modulo y hoy hay varias iguales.

Si dos copias normalizan distinto, el mismo Instagram se reconoce como el mismo lead en un reporte y
como dos leads en otro (ventas atribuidas de mas, de menos o a la persona equivocada). Estos tests
corren la MISMA tabla contra cada copia importable, para que arreglar una y olvidar las otras se note.

(Ademas hay copias locales dentro de funciones en marketing_service, conversational, manychat y
public/marketing que no se pueden importar; conviene consolidar todo en un solo helper.)
"""
import pytest

from app.api.public.finance import normalize_ig as ig_finance
from app.api.public.financial_sales import normalize_ig as ig_financial_sales
from app.api.public.lead_roadmap import normalize_ig as ig_lead_roadmap
from app.api.public.new_clients import normalize_ig as ig_new_clients
from app.services.attribution_service import normalize_ig as ig_attribution

COPIAS = {
    'attribution_service': ig_attribution,
    'public/finance': ig_finance,
    'public/financial_sales': ig_financial_sales,
    'public/lead_roadmap': ig_lead_roadmap,
    'public/new_clients': ig_new_clients,
}
COPIAS_PARAM = [pytest.param(fn, id=nombre) for nombre, fn in COPIAS.items()]

CASOS = [
    ('foo', 'foo'), ('@foo', 'foo'), ('@Foo', 'foo'), ('  @Foo  ', 'foo'), ('FOO', 'foo'), ('@@foo', 'foo'),
    ('foo.bar_baz', 'foo.bar_baz'),
    (None, None), ('', None), ('n/a', None), ('N/A', None),
    (123, None), (['foo'], None),
]


@pytest.mark.parametrize('normalize_ig', COPIAS_PARAM)
@pytest.mark.parametrize('crudo,esperado', CASOS)
def test_cada_copia_normaliza_igual(normalize_ig, crudo, esperado):
    assert normalize_ig(crudo) == esperado


@pytest.mark.parametrize('crudo', [
    'foo', '@Foo ', ' @FOO', 'N/A', 'n/a', 'N/A ', ' n/a', '@', '   ', None, '', 0,
])
def test_todas_las_copias_coinciden_entre_si(crudo):
    resultados = {nombre: fn(crudo) for nombre, fn in COPIAS.items()}

    assert len(set(resultados.values())) == 1, f'Las copias difieren para {crudo!r}: {resultados}'


@pytest.mark.parametrize('normalize_ig', [
    pytest.param(fn, id=nombre, marks=pytest.mark.xfail(strict=True, reason=(
        "BUG: un placeholder con espacio ('N/A ', ' n/a') se devuelve como usuario real ('n/a'): la "
        "comparacion contra 'n/a' se hace ANTES de recortar. conversational.py y "
        "client_dedup_service._normalize_instagram si recortan primero y lo descartan bien.")))
    for nombre, fn in COPIAS.items()
])
def test_un_placeholder_con_espacios_no_es_un_usuario(normalize_ig):
    for placeholder in ('N/A ', ' n/a', '  N/A  '):
        assert normalize_ig(placeholder) is None, f'{placeholder!r} se tomo como un usuario real'
