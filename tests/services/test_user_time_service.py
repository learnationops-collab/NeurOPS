"""user_time_service: el "hoy" de cada usuario, no el del servidor.

El servidor corre en UTC y el equipo trabaja en UTC-3/-4: a las 20:00 de Caracas ya es el dia
siguiente en UTC, asi que calcular "hoy" con date.today() vaciaba las bandejas cada noche.
"""
from datetime import date, datetime, timedelta
from types import SimpleNamespace

import pytest
from freezegun import freeze_time

from app.services import user_time_service as uts


def _usuario(zona):
    return SimpleNamespace(timezone=zona)


# --- zona_del_usuario -------------------------------------------------------------------------

def test_zona_del_usuario_usa_la_del_usuario():
    assert uts.zona_del_usuario(_usuario('America/Caracas')).zone == 'America/Caracas'


@pytest.mark.parametrize('usuario', [
    _usuario(None),
    _usuario(''),
    _usuario('No/Existe'),
    SimpleNamespace(),  # objeto sin atributo `timezone`
    None,
])
def test_zona_del_usuario_cae_a_la_paz_si_no_hay_una_valida(usuario):
    assert uts.zona_del_usuario(usuario).zone == 'America/La_Paz'


# --- hoy_del_usuario --------------------------------------------------------------------------

@freeze_time('2026-09-20 00:00:01')  # UTC: ya es 20, pero en Caracas (UTC-4) son las 20:00 del 19
def test_hoy_del_usuario_no_es_el_hoy_del_servidor():
    assert date.today() == date(2026, 9, 20)  # el "hoy" del servidor, que es lo que fallaba
    assert uts.hoy_del_usuario(_usuario('America/Caracas')) == date(2026, 9, 19)


@freeze_time('2026-09-20 01:30:00')
@pytest.mark.parametrize('zona,esperado', [
    ('America/La_Paz', date(2026, 9, 19)),  # 21:30 del 19
    ('America/Caracas', date(2026, 9, 19)),
    ('UTC', date(2026, 9, 20)),
    ('Europe/Madrid', date(2026, 9, 20)),  # 03:30 del 20 (horario de verano)
    ('Asia/Tokyo', date(2026, 9, 20)),  # 10:30 del 20
    ('Pacific/Honolulu', date(2026, 9, 19)),  # 15:30 del 19 (UTC-10)
])
def test_hoy_del_usuario_segun_su_zona(zona, esperado):
    assert uts.hoy_del_usuario(_usuario(zona)) == esperado


# --- limites_dia_utc --------------------------------------------------------------------------

def test_limites_dia_utc_de_un_usuario_en_la_paz():
    inicio, fin = uts.limites_dia_utc(_usuario('America/La_Paz'), date(2026, 9, 19))

    assert inicio == datetime(2026, 9, 19, 4, 0)  # 00:00 La Paz
    assert fin == datetime(2026, 9, 20, 3, 59, 59, 999999)  # 23:59:59.999999 La Paz


def test_limites_dia_utc_devuelve_datetimes_naive():
    inicio, fin = uts.limites_dia_utc(_usuario('America/La_Paz'), date(2026, 9, 19))

    assert inicio.tzinfo is None and fin.tzinfo is None


def test_limites_dia_utc_de_un_usuario_en_utc_es_el_dia_calendario():
    inicio, fin = uts.limites_dia_utc(_usuario('UTC'), date(2026, 9, 19))

    assert inicio == datetime(2026, 9, 19, 0, 0)
    assert fin == datetime(2026, 9, 19, 23, 59, 59, 999999)


def test_limites_dia_utc_con_zona_al_este_de_utc_empieza_el_dia_anterior():
    inicio, fin = uts.limites_dia_utc(_usuario('Asia/Tokyo'), date(2026, 9, 19))  # UTC+9

    assert inicio == datetime(2026, 9, 18, 15, 0)
    assert fin == datetime(2026, 9, 19, 14, 59, 59, 999999)


def test_un_dia_normal_dura_24_horas():
    inicio, fin = uts.limites_dia_utc(_usuario('America/La_Paz'), date(2026, 9, 19))

    assert fin - inicio == timedelta(hours=24) - timedelta(microseconds=1)


def test_dos_dias_seguidos_no_se_solapan_ni_dejan_hueco():
    usuario = _usuario('America/Caracas')
    _, fin_del_19 = uts.limites_dia_utc(usuario, date(2026, 9, 19))
    inicio_del_20, _ = uts.limites_dia_utc(usuario, date(2026, 9, 20))

    assert inicio_del_20 - fin_del_19 == timedelta(microseconds=1)


def test_el_dia_en_que_empieza_el_horario_de_verano_dura_23_horas():
    # Nueva York, 8-mar-2026: a las 02:00 los relojes saltan a las 03:00. Cada borde se localiza
    # por separado, en vez de aplicar un offset fijo a todo el dia.
    inicio, fin = uts.limites_dia_utc(_usuario('America/New_York'), date(2026, 3, 8))

    assert inicio == datetime(2026, 3, 8, 5, 0)  # 00:00 EST (UTC-5)
    assert fin == datetime(2026, 3, 9, 3, 59, 59, 999999)  # 23:59:59 EDT (UTC-4)
    assert fin - inicio == timedelta(hours=23) - timedelta(microseconds=1)


def test_el_dia_en_que_termina_el_horario_de_verano_dura_25_horas():
    inicio, fin = uts.limites_dia_utc(_usuario('America/New_York'), date(2026, 11, 1))

    assert inicio == datetime(2026, 11, 1, 4, 0)  # 00:00 EDT (UTC-4)
    assert fin == datetime(2026, 11, 2, 4, 59, 59, 999999)  # 23:59:59 EST (UTC-5)
    assert fin - inicio == timedelta(hours=25) - timedelta(microseconds=1)


# --- limites_rango_utc ------------------------------------------------------------------------

def test_un_rango_de_un_solo_dia_es_igual_a_limites_dia_utc():
    usuario = _usuario('America/La_Paz')

    assert uts.limites_rango_utc(usuario, date(2026, 9, 19), date(2026, 9, 19)) == \
        uts.limites_dia_utc(usuario, date(2026, 9, 19))


def test_un_rango_va_del_inicio_del_primer_dia_al_fin_del_ultimo():
    usuario = _usuario('America/La_Paz')

    inicio, fin = uts.limites_rango_utc(usuario, date(2026, 9, 17), date(2026, 9, 19))

    assert inicio == uts.limites_dia_utc(usuario, date(2026, 9, 17))[0]
    assert fin == uts.limites_dia_utc(usuario, date(2026, 9, 19))[1]
    assert fin - inicio == timedelta(days=3) - timedelta(microseconds=1)
