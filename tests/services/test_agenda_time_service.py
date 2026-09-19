"""agenda_time_service: la convencion horaria de las agendas (en la base TODO es UTC naive).

Fija la regla que arreglo el bug de "Hace 3 horas" para una cita a la que aun le faltaba 1 hora:
  · string con offset ('...Z', '-04:00') -> se convierte a UTC. Punto.
  · string sin offset                    -> se asume AGENDAS_SOURCE_TZ (La Paz, UTC-4) y recien
                                            ahi se pasa a UTC.
"""
from datetime import datetime, timedelta, timezone

import pytest
import pytz
from freezegun import freeze_time

from app.services import agenda_time_service as ats

# --- zona_origen ------------------------------------------------------------------------------

def test_zona_origen_por_defecto_es_la_paz():
    assert ats.zona_origen().zone == 'America/La_Paz'


def test_zona_origen_se_cambia_por_variable_de_entorno(monkeypatch):
    monkeypatch.setenv('AGENDAS_SOURCE_TZ', 'America/Bogota')
    assert ats.zona_origen().zone == 'America/Bogota'


@pytest.mark.parametrize('valor', ['Marte/Olympus', ''])
def test_zona_origen_invalida_o_vacia_cae_a_la_paz(monkeypatch, valor):
    monkeypatch.setenv('AGENDAS_SOURCE_TZ', valor)
    assert ats.zona_origen().zone == 'America/La_Paz'


# --- parse_flexible ---------------------------------------------------------------------------

@pytest.mark.parametrize('valor', [None, '', '   ', 'no es una fecha', 'manana'])
def test_parse_flexible_devuelve_none_si_no_hay_fecha_legible(valor):
    assert ats.parse_flexible(valor) is None


def test_parse_flexible_deja_pasar_un_datetime_sin_tocarlo():
    dt = datetime(2026, 9, 19, 10, 0)
    assert ats.parse_flexible(dt) is dt


def test_parse_flexible_iso_va_con_el_anio_primero():
    # '2026-03-04' es 4 de marzo, no 3 de abril.
    assert ats.parse_flexible('2026-03-04') == datetime(2026, 3, 4)


def test_parse_flexible_con_barras_va_con_el_dia_primero():
    assert ats.parse_flexible('04/03/2026') == datetime(2026, 3, 4)
    assert ats.parse_flexible('4/3/2026 15:30') == datetime(2026, 3, 4, 15, 30)


def test_parse_flexible_ignora_espacios_alrededor():
    assert ats.parse_flexible('  2026-09-19 10:00  ') == datetime(2026, 9, 19, 10, 0)


def test_parse_flexible_conserva_el_offset_que_traiga():
    dt = ats.parse_flexible('2026-09-19T10:00:00-04:00')
    assert dt.utcoffset() == timedelta(hours=-4)
    assert (dt.hour, dt.minute) == (10, 0)


def test_parse_flexible_la_z_final_es_utc():
    assert ats.parse_flexible('2026-09-19T10:00:00Z').utcoffset() == timedelta(0)


def test_parse_flexible_no_inventa_zona_si_el_string_no_la_trae():
    assert ats.parse_flexible('2026-09-19 10:00').tzinfo is None


# --- a_utc_naive ------------------------------------------------------------------------------

def test_a_utc_naive_de_none_es_none():
    assert ats.a_utc_naive(None) is None


def test_a_utc_naive_con_offset_convierte_a_utc():
    dt = datetime(2026, 9, 19, 10, 0, tzinfo=timezone(timedelta(hours=-4)))
    assert ats.a_utc_naive(dt) == datetime(2026, 9, 19, 14, 0)


def test_a_utc_naive_devuelve_un_datetime_naive():
    assert ats.a_utc_naive(datetime(2026, 9, 19, 10, 0, tzinfo=timezone.utc)).tzinfo is None


def test_a_utc_naive_sin_offset_asume_la_zona_de_origen():
    # 10:00 en La Paz (UTC-4) son las 14:00 UTC.
    assert ats.a_utc_naive(datetime(2026, 9, 19, 10, 0)) == datetime(2026, 9, 19, 14, 0)


def test_a_utc_naive_cruza_de_dia_cuando_corresponde():
    # 22:00 en La Paz ya es el dia siguiente en UTC.
    assert ats.a_utc_naive(datetime(2026, 9, 19, 22, 0)) == datetime(2026, 9, 20, 2, 0)


def test_a_utc_naive_respeta_la_zona_pedida():
    bogota = pytz.timezone('America/Bogota')  # UTC-5
    assert ats.a_utc_naive(datetime(2026, 9, 19, 10, 0), bogota) == datetime(2026, 9, 19, 15, 0)


def test_a_utc_naive_aplica_el_horario_de_verano_de_la_zona_pedida():
    nueva_york = pytz.timezone('America/New_York')
    assert ats.a_utc_naive(datetime(2026, 7, 1, 12, 0), nueva_york) == datetime(2026, 7, 1, 16, 0)  # EDT
    assert ats.a_utc_naive(datetime(2026, 1, 15, 12, 0), nueva_york) == datetime(2026, 1, 15, 17, 0)  # EST


# --- parse_a_utc ------------------------------------------------------------------------------

@pytest.mark.parametrize('valor,utc,traia_offset', [
    ('2026-09-19T10:00:00Z', datetime(2026, 9, 19, 10, 0), True),
    ('2026-09-19T10:00:00-04:00', datetime(2026, 9, 19, 14, 0), True),
    ('2026-09-19T10:00:00+02:00', datetime(2026, 9, 19, 8, 0), True),
    ('2026-09-19 10:00', datetime(2026, 9, 19, 14, 0), False),  # sin zona: se asume La Paz
    ('19/09/2026 10:00', datetime(2026, 9, 19, 14, 0), False),
])
def test_parse_a_utc(valor, utc, traia_offset):
    assert ats.parse_a_utc(valor) == (utc, traia_offset)


@pytest.mark.parametrize('valor', [None, '', 'basura'])
def test_parse_a_utc_ilegible(valor):
    assert ats.parse_a_utc(valor) == (None, False)


def test_parse_a_utc_usa_la_zona_pedida_solo_si_el_string_no_trae_offset():
    bogota = pytz.timezone('America/Bogota')
    assert ats.parse_a_utc('2026-09-19 10:00', bogota) == (datetime(2026, 9, 19, 15, 0), False)
    assert ats.parse_a_utc('2026-09-19T10:00:00-04:00', bogota) == (datetime(2026, 9, 19, 14, 0), True)


# --- limites_dia_origen -----------------------------------------------------------------------

def test_una_cita_de_las_21_locales_cae_en_su_propio_dia():
    # 21:30 del 19 en La Paz son las 01:30 UTC del 20: cortar en medianoche UTC la mandaria al 20.
    utc = datetime(2026, 9, 20, 1, 30)

    inicio, fin = ats.limites_dia_origen(utc)

    assert inicio == datetime(2026, 9, 19, 4, 0)  # 00:00 en La Paz
    assert fin == datetime(2026, 9, 20, 3, 59, 59, 999999)  # 23:59:59.999999 en La Paz
    assert inicio <= utc <= fin


@pytest.mark.parametrize('hora_local', range(24))
def test_todo_instante_del_dia_local_cae_en_el_mismo_rango(hora_local):
    referencia = ats.limites_dia_origen(ats.a_utc_naive(datetime(2026, 9, 19, 12, 0)))
    instante = ats.a_utc_naive(datetime(2026, 9, 19, hora_local, 30))

    assert ats.limites_dia_origen(instante) == referencia


def test_un_dia_empieza_justo_donde_termina_el_anterior():
    _, fin = ats.limites_dia_origen(datetime(2026, 9, 19, 14, 0))
    inicio_siguiente, _ = ats.limites_dia_origen(datetime(2026, 9, 20, 14, 0))

    assert inicio_siguiente - fin == timedelta(microseconds=1)


def test_limites_dia_origen_respeta_la_zona_pedida():
    tokio = pytz.timezone('Asia/Tokyo')  # UTC+9
    inicio, fin = ats.limites_dia_origen(datetime(2026, 9, 19, 12, 0), tokio)

    assert inicio == datetime(2026, 9, 18, 15, 0)
    assert fin == datetime(2026, 9, 19, 14, 59, 59, 999999)


# --- resolver_hora_agenda ---------------------------------------------------------------------

def test_una_fecha_con_zona_es_confiable():
    utc, diag = ats.resolver_hora_agenda({'fecha': '2026-09-19T10:00:00-04:00'})

    assert utc == datetime(2026, 9, 19, 14, 0)
    assert diag['campo'] == 'fecha'
    assert diag['nivel'] == 'ok'
    assert diag['traia_zona'] is True
    assert diag['es_respaldo'] is False
    assert diag['utc'] == '2026-09-19T14:00:00'
    assert diag['valor_recibido'] == '2026-09-19T10:00:00-04:00'


def test_una_fecha_sin_zona_asume_la_zona_de_origen_y_lo_avisa():
    utc, diag = ats.resolver_hora_agenda({'fecha': '2026-09-19 10:00'})

    assert utc == datetime(2026, 9, 19, 14, 0)
    assert diag['nivel'] == 'zona_asumida'
    assert diag['zona_asumida'] == 'America/La_Paz'
    assert diag['traia_zona'] is False
    assert diag['es_respaldo'] is False


def test_el_mismo_instante_se_lee_igual_con_o_sin_zona_explicita():
    sin_zona, _ = ats.resolver_hora_agenda({'fecha': '2026-09-19 10:00'})
    con_zona, _ = ats.resolver_hora_agenda({'fecha': '2026-09-19T10:00:00-04:00'})

    assert sin_zona == con_zona


def test_date_se_usa_cuando_no_hay_fecha():
    utc, diag = ats.resolver_hora_agenda({'date': '2026-09-19T10:00:00Z'})

    assert utc == datetime(2026, 9, 19, 10, 0)
    assert diag['campo'] == 'date'


def test_fecha_tiene_prioridad_sobre_date():
    utc, diag = ats.resolver_hora_agenda({'fecha': '2026-09-19T10:00:00Z', 'date': '2026-01-01T00:00:00Z'})

    assert utc == datetime(2026, 9, 19, 10, 0)
    assert diag['campo'] == 'fecha'


def test_un_campo_vacio_se_salta_al_siguiente():
    utc, diag = ats.resolver_hora_agenda({'fecha': '', 'date': '2026-09-19T10:00:00Z'})

    assert utc == datetime(2026, 9, 19, 10, 0)
    assert diag['campo'] == 'date'


def test_registro_es_el_ultimo_recurso_y_se_reporta_como_campo_incorrecto():
    # `registro` es cuando el lead se registro, NO la hora de la cita.
    utc, diag = ats.resolver_hora_agenda({'registro': '2026-09-19T10:00:00Z'})

    assert utc == datetime(2026, 9, 19, 10, 0)
    assert diag['campo'] == 'registro'
    assert diag['nivel'] == 'campo_incorrecto'
    assert diag['es_respaldo'] is False


def test_registro_nunca_pisa_a_fecha():
    _, diag = ats.resolver_hora_agenda({'fecha': '2026-09-19T10:00:00Z', 'registro': '2026-01-01T00:00:00Z'})

    assert diag['campo'] == 'fecha'
    assert diag['nivel'] == 'ok'


@freeze_time('2026-09-19 12:00:00')
def test_sin_fecha_guarda_la_hora_de_llegada_del_webhook():
    utc, diag = ats.resolver_hora_agenda({})

    assert utc == datetime(2026, 9, 19, 12, 0)
    assert diag['nivel'] == 'ausente'
    assert diag['es_respaldo'] is True
    assert diag['campo'] is None
    assert diag['utc'] == '2026-09-19T12:00:00'


@freeze_time('2026-09-19 12:00:00')
def test_una_fecha_ilegible_guarda_la_hora_de_llegada_del_webhook():
    utc, diag = ats.resolver_hora_agenda({'fecha': 'no se'})

    assert utc == datetime(2026, 9, 19, 12, 0)
    assert diag['nivel'] == 'ilegible'
    assert diag['es_respaldo'] is True
    assert diag['campo'] == 'fecha'
    assert diag['valor_recibido'] == 'no se'


# --- como_se_ve -------------------------------------------------------------------------------

def test_como_se_ve_sin_instante_es_vacio():
    assert ats.como_se_ve(None, ['America/La_Paz']) == {}


def test_como_se_ve_muestra_el_mismo_instante_en_cada_zona():
    vistas = ats.como_se_ve(
        datetime(2026, 9, 19, 14, 0),
        ['America/La_Paz', 'America/Bogota', 'UTC', 'Europe/Madrid'],
    )

    assert vistas == {
        'America/La_Paz': '2026-09-19 10:00',
        'America/Bogota': '2026-09-19 09:00',
        'UTC': '2026-09-19 14:00',
        'Europe/Madrid': '2026-09-19 16:00',  # horario de verano (UTC+2)
    }


def test_como_se_ve_ignora_zonas_invalidas():
    assert ats.como_se_ve(datetime(2026, 9, 19, 14, 0), ['Marte/Olympus', 'UTC']) == {'UTC': '2026-09-19 14:00'}
