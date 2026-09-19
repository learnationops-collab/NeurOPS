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


def test_una_venta_se_atribuye_a_la_agenda_de_su_lead():
    a = agenda(1, 'foo', 'foo@x.com', D(2026, 1, 1))
    s = venta(10, 'foo', None, 'RR - Completo', D(2026, 1, 5))

    assert atribuir([s], [a])[10] is a


def test_se_atribuye_a_la_agenda_mas_reciente_anterior_a_la_venta():
    a1, a2, a3 = (agenda(1, 'foo', None, D(2026, 1, 1)), agenda(2, 'foo', None, D(2026, 1, 10)),
                  agenda(3, 'foo', None, D(2026, 1, 20)))
    s = venta(10, 'foo', None, 'RR - Completo', D(2026, 1, 15))

    assert atribuir([s], [a1, a2, a3])[10] is a2


def test_una_agenda_del_mismo_dia_de_la_venta_cuenta_como_anterior():
    a = agenda(1, 'foo', None, D(2026, 1, 5, 10, 0))
    s = venta(10, 'foo', None, 'RR - Completo', D(2026, 1, 5, 10, 0))

    assert atribuir([s], [a])[10] is a


# --- Regla del primer pago --------------------------------------------------------------------

def test_los_pagos_posteriores_siguen_a_la_agenda_del_primer_pago():
    a1, a2, a3 = (agenda(1, 'foo', None, D(2026, 1, 1)), agenda(2, 'foo', None, D(2026, 1, 10)),
                  agenda(3, 'foo', None, D(2026, 1, 20)))  # a3: llamada de seguimiento, DESPUES del primer pago
    sena = venta(10, 'foo', None, 'RR - Seña', D(2026, 1, 12))
    cuota_1 = venta(11, 'foo', None, 'RR - Cuota', D(2026, 2, 1))
    cuota_2 = venta(12, 'foo', None, 'RR - Cuota', D(2026, 3, 1))

    mapa = atribuir([sena, cuota_1, cuota_2], [a1, a2, a3])

    assert mapa[10] is a2
    assert mapa[11] is a2
    assert mapa[12] is a2


def test_el_primer_pago_se_elige_por_fecha_aunque_las_ventas_lleguen_desordenadas():
    a1, a2 = agenda(1, 'foo', None, D(2026, 1, 1)), agenda(2, 'foo', None, D(2026, 1, 20))
    cuota = venta(11, 'foo', None, 'RR - Cuota', D(2026, 2, 1))
    sena = venta(10, 'foo', None, 'RR - Seña', D(2026, 1, 5))

    mapa = atribuir([cuota, sena], [a2, a1])  # ambas listas fuera de orden

    assert mapa[10] is a1
    assert mapa[11] is a1


def test_un_upsell_se_atribuye_a_su_propia_agenda_mas_reciente():
    a1, a3 = agenda(1, 'foo', None, D(2026, 1, 1)), agenda(3, 'foo', None, D(2026, 3, 1))
    completo = venta(10, 'foo', None, 'RR - Completo', D(2026, 1, 5))
    upsell = venta(11, 'foo', None, 'RR - Upsell', D(2026, 3, 10))
    cuota_tras_upsell = venta(12, 'foo', None, 'RR - Cuota', D(2026, 3, 20))

    mapa = atribuir([completo, upsell, cuota_tras_upsell], [a1, a3])

    assert mapa[10] is a1
    assert mapa[11] is a3  # el cambio de programa se atribuye a la agenda que lo origino
    assert mapa[12] is a1  # una cuota, en cambio, sigue al primer pago


@pytest.mark.parametrize('tipo_primer_pago', [
    'RR - Seña', 'RR - Con Seña', 'sena', 'RR - Completo', 'PIF', 'Split Pay', 'RR - Split', 'splt',
])
def test_estos_tipos_de_primer_pago_anclan_la_atribucion(tipo_primer_pago):
    a1, a2 = agenda(1, 'foo', None, D(2026, 1, 1)), agenda(2, 'foo', None, D(2026, 1, 20))
    primer_pago = venta(10, 'foo', None, tipo_primer_pago, D(2026, 1, 5))
    cuota = venta(11, 'foo', None, 'RR - Cuota', D(2026, 2, 1))

    assert atribuir([primer_pago, cuota], [a1, a2])[11] is a1


@pytest.mark.parametrize('tipo_no_calificado', ['RR - Cuota', 'RR - Renovación', None, ''])
def test_sin_un_primer_pago_calificado_cada_venta_sigue_a_la_agenda_mas_reciente(tipo_no_calificado):
    a1, a2 = agenda(1, 'foo', None, D(2026, 1, 1)), agenda(2, 'foo', None, D(2026, 1, 20))
    primera = venta(10, 'foo', None, tipo_no_calificado, D(2026, 1, 5))
    segunda = venta(11, 'foo', None, 'RR - Cuota', D(2026, 2, 1))

    mapa = atribuir([primera, segunda], [a1, a2])

    assert mapa[10] is a1
    assert mapa[11] is a2


def test_si_el_primer_pago_es_anterior_a_todas_las_agendas_se_usa_la_primera_del_lead():
    # Desfase de datos: el pago quedo registrado antes que cualquier agenda.
    a_temprana, a_tardia = agenda(1, 'foo', None, D(2026, 1, 10)), agenda(2, 'foo', None, D(2026, 1, 20))
    pago = venta(10, 'foo', None, 'RR - Completo', D(2026, 1, 1))

    assert atribuir([pago], [a_tardia, a_temprana])[10] is a_temprana


@pytest.mark.xfail(strict=True, reason=(
    "BUG: 'parcial' no se reconoce como primer pago. Hoy el Split Pay se registra como "
    "'RR - Parcial' (DeclararVentaWizard, NewSalePage, closer_service: 'parcial' -> 'split'), pero la "
    "lista de tipos calificados es split/splt/sena/completo/pif. En la copia local hay 231 de 889 "
    "ventas 'parcial' y 0 'split'. Con >1 agenda, las cuotas se van a la agenda mas reciente en vez "
    "de la que origino el primer pago. Arreglo: agregar 'parcial' a la lista de attribution_service."))
def test_un_parcial_ancla_la_atribucion_como_lo_hacia_el_split():
    a1, a2 = agenda(1, 'foo', None, D(2026, 1, 1)), agenda(2, 'foo', None, D(2026, 1, 20))
    parcial = venta(10, 'foo', None, 'RR - Parcial', D(2026, 1, 5))
    cuota = venta(11, 'foo', None, 'RR - Cuota', D(2026, 2, 1))

    assert atribuir([parcial, cuota], [a1, a2])[11] is a1


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

def test_una_venta_se_liga_al_lead_por_el_mail():
    a = agenda(1, 'foo', 'foo@x.com', D(2026, 1, 1))
    s = venta(10, None, 'foo@x.com', 'RR - Completo', D(2026, 1, 5))

    assert atribuir([s], [a])[10] is a


def test_una_venta_se_liga_al_lead_por_el_instagram():
    a = agenda(1, 'foo', 'foo@x.com', D(2026, 1, 1))
    s = venta(10, 'foo', None, 'RR - Completo', D(2026, 1, 5))

    assert atribuir([s], [a])[10] is a


def test_si_el_lead_cambio_de_instagram_el_mail_une_sus_agendas():
    vieja = agenda(1, 'foo', 'foo@x.com', D(2026, 1, 1))
    nueva = agenda(2, 'foo_nuevo', 'foo@x.com', D(2026, 1, 10))  # mismo mail, otro usuario de IG
    s = venta(10, 'foo_nuevo', None, 'RR - Completo', D(2026, 1, 15))

    assert atribuir([s], [vieja, nueva])[10] is nueva


def test_ignora_mayusculas_arroba_y_espacios_al_unir_identidades():
    a = agenda(1, '@Foo', ' Foo@X.com ', D(2026, 1, 1))
    s = venta(10, None, 'FOO@x.com', 'RR - Completo', D(2026, 1, 5))

    assert atribuir([s], [a])[10] is a


def test_leads_distintos_no_se_mezclan():
    ana, beto = agenda(1, 'ana', 'ana@x.com', D(2026, 1, 1)), agenda(2, 'beto', 'beto@x.com', D(2026, 1, 2))
    venta_ana = venta(10, 'ana', None, 'RR - Completo', D(2026, 1, 5))
    venta_beto = venta(11, None, 'beto@x.com', 'RR - Completo', D(2026, 1, 6))

    mapa = atribuir([venta_ana, venta_beto], [ana, beto])

    assert mapa[10] is ana
    assert mapa[11] is beto


@pytest.mark.parametrize('placeholder', ['N/A', 'n/a', ''])
def test_un_placeholder_exacto_no_junta_a_dos_personas(placeholder):
    beto = agenda(1, placeholder, 'b@y.com', D(2026, 1, 1))
    ana = agenda(2, placeholder, 'a@x.com', D(2026, 1, 5))
    s = venta(10, None, 'b@y.com', 'RR - Completo', D(2026, 1, 10))

    assert atribuir([s], [ana, beto])[10] is beto


@pytest.mark.xfail(strict=True, reason=(
    "BUG: un Instagram placeholder con espacio ('N/A ', ' n/a') no se detecta: normalize_ig compara "
    "con 'n/a' ANTES de recortar, asi que devuelve 'n/a' como si fuera un usuario real y Union-Find "
    "fusiona a dos personas distintas; la venta de una se atribuye a la agenda de la otra. "
    "Arreglo: recortar antes de comparar (como ya hace conversational.py)."))
def test_un_instagram_placeholder_con_espacio_no_junta_a_dos_personas():
    beto = agenda(1, 'N/A ', 'b@y.com', D(2026, 1, 1))
    ana = agenda(2, 'N/A ', 'a@x.com', D(2026, 1, 5))
    s = venta(10, None, 'b@y.com', 'RR - Completo', D(2026, 1, 10))

    assert atribuir([s], [ana, beto])[10] is beto


@pytest.mark.xfail(strict=True, reason=(
    "BUG: igual que con el Instagram, un mail placeholder con espacio ('N/A ') se toma como un mail "
    "real ('n/a') y fusiona a dos personas con Instagram distintos."))
def test_un_mail_placeholder_con_espacio_no_junta_a_dos_personas():
    beto = agenda(1, 'persona_b', 'N/A ', D(2026, 1, 1))
    ana = agenda(2, 'persona_a', 'N/A ', D(2026, 1, 5))
    s = venta(10, 'persona_b', None, 'RR - Completo', D(2026, 1, 10))

    assert atribuir([s], [ana, beto])[10] is beto


# --- Fechas -----------------------------------------------------------------------------------

def test_sin_date_se_usa_created_at():
    a_vieja = agenda(1, 'foo', None, None, created_at=D(2026, 1, 1))
    a_nueva = agenda(2, 'foo', None, None, created_at=D(2026, 1, 20))
    s = venta(10, 'foo', None, 'RR - Completo', None, created_at=D(2026, 1, 10))

    assert atribuir([s], [a_nueva, a_vieja])[10] is a_vieja


def test_un_registro_sin_ninguna_fecha_se_considera_el_mas_antiguo():
    sin_fecha = agenda(1, 'foo', None, None)
    con_fecha = agenda(2, 'foo', None, D(2026, 1, 20))
    s = venta(10, 'foo', None, 'RR - Completo', D(2026, 1, 25))

    # Ambas son anteriores a la venta; gana la mas reciente, que es la que tiene fecha.
    assert atribuir([s], [con_fecha, sin_fecha])[10] is con_fecha
