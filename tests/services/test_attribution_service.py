"""attribution_service: a que agenda se atribuye cada venta.

Regla de negocio (docs/arquitectura_y_funcionamiento.md, "Regla de Atribucion Consistente por
Primer Pago"): todos los pagos de un lead (excepto upsells) se asocian a la MISMA agenda que origino
su primer pago (sena, split o completo). Un upsell se atribuye a la agenda mas reciente hasta su
fecha, para reflejar el cambio de programa. Las identidades de un lead se unen por Instagram y mail
(Union-Find). De esto salen las comisiones de los setters y el ROI de marketing.

Las agendas/ventas se simulan con SimpleNamespace: la funcion no necesita base de datos.
"""
from datetime import datetime
from types import SimpleNamespace

import pytest

from app.services.attribution_service import AttributionService, UnionFind, normalize_ig

D = datetime


def agenda(id_, ig, mail, fecha, created_at=None):
    return SimpleNamespace(id=id_, instagram=ig, mail=mail, date=fecha, created_at=created_at,
                           nombre=f'agenda{id_}')


def venta(id_, ig, mail, tipo, fecha, created_at=None):
    return SimpleNamespace(id=id_, instagram=ig, mail_cliente=mail, tipo_pago=tipo, date=fecha,
                           created_at=created_at)


def atribuir(ventas, agendas):
    return AttributionService.get_sales_attribution(sales=ventas, agendas=agendas)


# --- normalize_ig -----------------------------------------------------------------------------

@pytest.mark.parametrize('crudo,esperado', [
    ('foo', 'foo'), ('@foo', 'foo'), ('@Foo', 'foo'), ('  @Foo  ', 'foo'), ('FOO', 'foo'), ('@@foo', 'foo'),
    (None, None), ('', None), ('n/a', None), ('N/A', None),
    (123, None), (['foo'], None),  # no es texto
])
def test_normalize_ig(crudo, esperado):
    assert normalize_ig(crudo) == esperado


# --- UnionFind --------------------------------------------------------------------------------

def test_find_de_un_elemento_nuevo_es_el_mismo_elemento():
    assert UnionFind().find('a') == 'a'


def test_union_junta_dos_elementos():
    uf = UnionFind()
    uf.union('a', 'b')

    assert uf.find('a') == uf.find('b')


def test_union_es_transitiva_y_no_junta_grupos_ajenos():
    uf = UnionFind()
    uf.union('a', 'b')
    uf.union('b', 'c')
    uf.union('d', 'e')

    assert uf.find('a') == uf.find('c')
    assert uf.find('a') != uf.find('d')
    assert uf.find('d') == uf.find('e')


def test_un_puente_fusiona_dos_grupos():
    uf = UnionFind()
    uf.union('a', 'b')
    uf.union('c', 'd')
    uf.union('b', 'c')

    assert len({uf.find(x) for x in 'abcd'}) == 1


def test_union_de_elementos_ya_unidos_no_cambia_nada():
    uf = UnionFind()
    uf.union('a', 'b')
    raiz = uf.find('a')
    uf.union('b', 'a')
    uf.union('a', 'a')

    assert uf.find('a') == uf.find('b') == raiz


def test_find_comprime_el_camino():
    uf = UnionFind()
    uf.parent = {'a': 'b', 'b': 'c', 'c': 'd', 'd': 'd'}

    assert uf.find('a') == 'd'
    assert uf.parent['a'] == 'd' and uf.parent['b'] == 'd'


def test_funciona_con_ids_numericos():
    uf = UnionFind()
    uf.union(1, 2)
    uf.union(2, 3)

    assert uf.find(1) == uf.find(3)
    assert uf.find(1) != uf.find(4)


# --- Casos base -------------------------------------------------------------------------------

def test_sin_datos_no_hay_atribuciones():
    assert atribuir([], []) == {}
    assert atribuir([], [agenda(1, 'foo', 'foo@x.com', D(2026, 1, 1))]) == {}








# --- Regla del primer pago --------------------------------------------------------------------

















# --- Leads sin datos suficientes --------------------------------------------------------------

def test_una_venta_de_un_lead_sin_agendas_queda_sin_atribuir():
    s = venta(10, 'foo', None, 'RR - Completo', D(2026, 1, 5))

    mapa = atribuir([s], [])

    assert 10 in mapa and mapa[10] is None


def test_un_upsell_sin_agendas_queda_sin_atribuir():
    s = venta(10, 'foo', None, 'RR - Upsell', D(2026, 1, 5))

    assert atribuir([s], [])[10] is None


def test_una_venta_sin_ninguna_identidad_no_aparece_en_el_mapa():
    a = agenda(1, 'foo', 'foo@x.com', D(2026, 1, 1))
    s = venta(10, None, None, 'RR - Completo', D(2026, 1, 5))

    assert 10 not in atribuir([s], [a])


def test_una_agenda_sin_ninguna_identidad_se_ignora():
    huerfana = agenda(1, None, None, D(2026, 1, 1))
    s = venta(10, 'foo', None, 'RR - Completo', D(2026, 1, 5))

    assert atribuir([s], [huerfana])[10] is None


# --- Identidad del lead (Instagram + mail) ----------------------------------------------------











# Un placeholder ('N/A') en lugar del dato nunca es una identidad. Los que traen espacios vienen de
# celdas de Google Sheets y antes se tomaban como un usuario real: Union-Find fusionaba a dos
# personas distintas y la venta de una se atribuia a la agenda de la otra.
PLACEHOLDERS = ['N/A', 'n/a', '', 'N/A ', ' n/a', '  N/A  ', '   ']










@pytest.mark.parametrize('placeholder', PLACEHOLDERS)
def test_un_registro_con_solo_un_mail_placeholder_no_tiene_identidad(placeholder):
    # Sin Instagram y con un placeholder como mail no hay nada que lo identifique: ni la venta se
    # atribuye a esa agenda ni la agenda a esa venta (antes compartian la "identidad" 'n/a').
    sin_identidad = agenda(1, None, placeholder, D(2026, 1, 1))
    s = venta(10, None, placeholder, 'RR - Completo', D(2026, 1, 10))

    assert 10 not in atribuir([s], [sin_identidad])


# --- Fechas -----------------------------------------------------------------------------------



