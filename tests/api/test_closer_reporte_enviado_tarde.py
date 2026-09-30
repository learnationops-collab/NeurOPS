"""Un reporte del closer mandado al día siguiente dice de qué día es y cuándo se mandó.

Desde que el closer puede mandar el reporte de ayer, la imagen y el mensaje de Discord tienen que
decirlo: si no, el de ayer mandado hoy se lee como el reporte de hoy. La fecha guardada sigue
siendo la del día reportado; "enviado el" sale de `created_at`, en la zona del closer.
"""
import io
import json
import os
from datetime import date, datetime

import pytest
from flask import render_template_string
from freezegun import freeze_time

from app.api.public.closer import _mensaje_discord, _prepare_report_data
from app.models import CloserDailyReport

LEYENDA = 'Reporte del martes 29/09 · enviado el 30/09'


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='cerrador', email='cerrador@neuro.com',
                     timezone='America/La_Paz')


def reporte(db, closer, dia, enviado):
    r = CloserDailyReport(closer_id=closer.id, date=dia, slots=5, created_at=enviado)
    db.session.add(r)
    db.session.commit()
    return r


def render_imagen(app, datos):
    ruta = os.path.join(app.root_path, 'templates', 'reports', 'closer_report.html')
    with open(ruta, encoding='utf-8') as f:
        return render_template_string(f.read(), **datos)


# --- De qué día es y cuándo se mandó ----------------------------------------------------------

def test_el_de_ayer_mandado_hoy_dice_las_dos_fechas(db, closer):
    # 30/09 11:00 en La Paz.
    datos = _prepare_report_data(reporte(db, closer, date(2026, 9, 29), datetime(2026, 9, 30, 15, 0)))

    assert datos['date_str'] == '29/09/2026'
    assert datos['late'] is True
    assert datos['report_day_label'] == 'martes 29/09'
    assert datos['sent_date_str'] == '30/09'
    assert datos['late_label'] == LEYENDA


def test_el_de_hoy_no_dice_nada_de_mas(db, closer):
    datos = _prepare_report_data(reporte(db, closer, date(2026, 9, 30), datetime(2026, 9, 30, 15, 0)))

    assert datos['late'] is False
    assert datos['late_label'] is None
    assert datos['sent_date_str'] is None


@pytest.mark.parametrize('enviado,tarde', [
    (datetime(2026, 9, 30, 3, 59, 59), False),  # 29/09 23:59:59 en La Paz: a tiempo
    (datetime(2026, 9, 30, 4, 0, 0), True),     # 30/09 00:00:00 en La Paz: ya es otro día
])
def test_a_tiempo_o_tarde_se_decide_en_la_zona_del_closer(db, closer, enviado, tarde):
    """En UTC los dos envíos son del 30, pero para el closer el primero es del 29."""
    r = reporte(db, closer, date(2026, 9, 29), enviado)

    assert r.enviado_tarde() is tarde
    assert _prepare_report_data(r)['late'] is tarde


def test_un_reporte_viejo_sin_hora_de_envio_no_se_marca_tarde(db, closer):
    r = reporte(db, closer, date(2026, 9, 29), None)
    r.created_at = None  # filas anteriores a la columna
    db.session.commit()

    assert r.enviado_tarde() is False
    assert _prepare_report_data(r)['late'] is False


# --- Lo que sale -------------------------------------------------------------------------------

def test_el_mensaje_de_discord_avisa_que_llego_tarde(db, closer):
    tarde = _mensaje_discord(_prepare_report_data(
        reporte(db, closer, date(2026, 9, 29), datetime(2026, 9, 30, 15, 0))))
    a_tiempo = _mensaje_discord(_prepare_report_data(
        reporte(db, closer, date(2026, 9, 30), datetime(2026, 9, 30, 20, 0))))

    assert '📅 **Fecha:** `29/09/2026`' in tarde
    assert f'⏰ **Enviado tarde:** {LEYENDA}' in tarde
    assert 'Enviado tarde' not in a_tiempo
    assert '📅 **Fecha:** `30/09/2026`' in a_tiempo


def test_la_imagen_dice_de_que_dia_es(app, db, closer):
    html = render_imagen(app, _prepare_report_data(
        reporte(db, closer, date(2026, 9, 29), datetime(2026, 9, 30, 15, 0))))

    assert LEYENDA in html
    assert 'Cash Collected del martes 29/09' in html
    assert 'Cash Collected Hoy' not in html
    assert 'REPORTE DEL 29/09/2026 • ENVIADO EL 30/09' in html


def test_la_imagen_del_dia_queda_como_antes(app, db, closer):
    html = render_imagen(app, _prepare_report_data(
        reporte(db, closer, date(2026, 9, 30), datetime(2026, 9, 30, 15, 0))))

    assert 'Cash Collected Hoy' in html
    assert 'REPORTE GENERADO EL 30/09/2026' in html
    assert 'enviado el' not in html


@freeze_time('2026-09-30 15:00:00')
def test_mandar_el_de_ayer_desde_el_mazo_llega_a_discord_como_atrasado(
        client, db, closer, auth_headers, monkeypatch):
    import requests

    from app.services.image_service import ImageService

    monkeypatch.setenv('DISCORD_REPORTS_WEBHOOK', 'https://discord.test/webhook')
    monkeypatch.setattr(ImageService, 'generate_closer_report_card', lambda datos: io.BytesIO(b'png'))
    enviados = []
    monkeypatch.setattr(requests, 'post', lambda url, **kw: enviados.append(kw) or
                        type('R', (), {'status_code': 204})())

    r = client.post('/api/closer/deck/daily-report', json={'date': '2026-09-29', 'slots': 5},
                    headers=auth_headers(closer))

    assert r.status_code == 200
    assert CloserDailyReport.query.one().date == date(2026, 9, 29)
    contenido = json.loads(enviados[0]['data']['payload_json'])['content']
    assert f'⏰ **Enviado tarde:** {LEYENDA}' in contenido
