"""identity_service: normalizacion de Instagram y mail con los que se reconoce a un lead.

Fija la regla que faltaba en 9 de las 10 copias que existian de `normalize_ig`: un placeholder
('N/A') se descarta AUNQUE traiga espacios, porque se recorta ANTES de comparar. Un 'N/A ' (tipico de
una celda de Google Sheets) se tomaba como un usuario real y fusionaba a dos personas distintas.
"""
import pytest

from app.services.identity_service import normalize_email, normalize_ig

# --- normalize_ig -----------------------------------------------------------------------------


@pytest.mark.parametrize('crudo,esperado', [
    ('foo', 'foo'), ('@foo', 'foo'), ('@Foo', 'foo'), ('  @Foo  ', 'foo'), ('FOO', 'foo'),
    ('@@foo', 'foo'), ('@ foo', 'foo'), ('foo.bar_baz', 'foo.bar_baz'),
])
def test_normalize_ig_usuarios_validos(crudo, esperado):
    assert normalize_ig(crudo) == esperado


@pytest.mark.parametrize('crudo', [
    None, '', '   ', '@', '@@', '@ ',
    'n/a', 'N/A', 'N/A ', ' n/a', '  N/A  ', '@N/A',  # placeholders, con y sin espacios
    123, 0, ['foo'], {'ig': 'foo'},  # no es texto
])
def test_normalize_ig_devuelve_none_para_vacios_placeholders_y_no_texto(crudo):
    assert normalize_ig(crudo) is None


def test_un_vacio_es_siempre_none_y_nunca_un_string_vacio():
    # Antes '@' o '   ' devolvian '' (falsy pero no None) segun la copia que se usara.
    assert normalize_ig('@') is None
    assert normalize_ig('   ') is None


# --- normalize_email --------------------------------------------------------------------------

@pytest.mark.parametrize('crudo,esperado', [
    ('foo@x.com', 'foo@x.com'), ('  Foo@X.COM ', 'foo@x.com'), ('FOO@X.COM', 'foo@x.com'),
])
def test_normalize_email_mails_validos(crudo, esperado):
    assert normalize_email(crudo) == esperado


@pytest.mark.parametrize('crudo', [
    None, '', '   ', 'n/a', 'N/A', 'N/A ', ' n/a', '  N/A  ',
    123, 0, ['foo@x.com'],
])
def test_normalize_email_devuelve_none_para_vacios_placeholders_y_no_texto(crudo):
    assert normalize_email(crudo) is None
