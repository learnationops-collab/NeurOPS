"""Lo que sale a Discord cuando un setter manda el reporte: el v2 por canal, el v1 como siempre.

No sale nada a la red: la URL del webhook es de mentira, la tarjeta se reemplaza por bytes y
`requests.post` solo anota lo que se habría mandado.
"""
import io
import json
from datetime import date

import pytest
from flask import render_template_string

from app.models import SetterDailyStats
from app.services import setter_reporte_discord as discord
from app.services import setter_reporte_v2 as rv2

URL = '/api/public/setter-report'


@pytest.fixture()
def elias(make_user):
    return make_user(role='setter', username='Elias')


@pytest.fixture()
def enviados(monkeypatch):
    import requests

    from app.services.image_service import ImageService

    monkeypatch.setenv('DISCORD_REPORTS_WEBHOOK', 'https://discord.test/webhook')
    tarjetas = {'v1': 0, 'v2': 0}

    def v1(datos):
        tarjetas['v1'] += 1
        return io.BytesIO(b'png-v1')

    def v2(datos):
        tarjetas['v2'] += 1
        return io.BytesIO(b'png-v2')

    monkeypatch.setattr(ImageService, 'generate_setter_report_card', v1)
    monkeypatch.setattr(ImageService, 'generate_setter_report_v2_card', v2)
    salidas = []
    monkeypatch.setattr(requests, 'post', lambda url, **kw: salidas.append((url, kw)) or
                        type('R', (), {'status_code': 204})())
    return {'salidas': salidas, 'tarjetas': tarjetas}


def reporte_v2(setter_id, **cambios):
    datos = {
        'setter_id': setter_id, 'date': '2026-10-10', 'version': 2,
        'anuncios': {'entrantes': 10, 'no_lead': 1, 'inabribles': 0, 'ap_entrantes': 3, 'ap_dolor': 5, 'agendas': 2},
        'inbound': {'entrantes': 6, 'no_lead': 0, 'inabribles': 1, 'ap_entrantes': 1, 'ap_dolor': 3, 'agendas': 1},
        'bienvenidas': {'hechas': 12, 'respondidas': 5, 'aperturas': 4},
        'embudo': {'dolor': 10, 'oferta': 7, 'link': 5},
        'followups': {'entrantes': 9, 'dolor': 5, 'oferta': 3, 'link': 3},
        'followups_respondidos': {'entrantes': 4, 'dolor': 2, 'oferta': 1, 'link': 1},
        'reflexion': {'flujo_trabajo': 'Abrí 40 conversaciones', 'win_del_dia': 'Una fría agendó'},
    }
    datos.update(cambios)
    return datos


def contenido(salida):
    url, kw = salida
    if 'json' in kw:
        return kw['json']
    return json.loads(kw['data']['payload_json'])


def test_el_v2_sale_por_canal_con_su_tarjeta(client, elias, auth_headers, enviados):
    r = client.post(URL, json=reporte_v2(elias.id), headers=auth_headers(elias))

    assert r.status_code == 201
    assert len(enviados['salidas']) == 1
    url, kw = enviados['salidas'][0]
    assert url == 'https://discord.test/webhook'
    assert kw['files']['file1'][0] == 'setter_report.png'
    assert enviados['tarjetas'] == {'v1': 0, 'v2': 1}
    texto = contenido(enviados['salidas'][0])['content']
    assert '👤 **Setter:** `Elias`' in texto
    assert '📅 **Fecha:** `10/10/2026`' in texto
    assert '📥 **Entrantes:** 16 · Anuncios 10 · Inbound 6' in texto
    assert '✅ **Cualificación:** 87,5% (14 cualificados · Anuncios 90% · Inbound 83,3%)' in texto
    assert '💬 **Apertura:** 75% (4 en entrantes · 8 en dolor)' in texto
    assert '📅 **Agendas:** 3 · Anuncios 2 · Inbound 1' in texto
    assert '👋 **Bienvenidas:** 12 hechas · 5 respondidas (41,7%) · 4 aperturas' in texto
    assert '🔻 **Embudo:** Cualificados 14 → Dolor 10 → Oferta 7 → Link 5 → Agendas 3' in texto
    assert '🔁 **Follow-ups:** 20 (Entrantes 9 · Dolor 5 · Oferta 3 · Link 3)' in texto
    assert '↩️ **Respondieron:** 8 (40%) · Entrantes 4 · Dolor 2 · Oferta 1 · Link 1' in texto
    assert '🧭 **Flujo de trabajo:** Abrí 40 conversaciones' in texto
    assert '🏆 **Win del día:** Una fría agendó' in texto
    assert 'Avisos' not in texto


def test_los_avisos_del_reporte_van_en_el_mensaje(client, elias, auth_headers, enviados):
    datos = reporte_v2(elias.id)
    datos['embudo']['oferta'] = 12

    client.post(URL, json=datos, headers=auth_headers(elias))

    assert '⚠️ **Avisos:** Oferta supera a dolor (10)' in contenido(enviados['salidas'][0])['content']


def test_respondieron_de_mas_va_en_los_avisos(client, elias, auth_headers, enviados):
    datos = reporte_v2(elias.id)
    datos['followups_respondidos']['oferta'] = 4

    client.post(URL, json=datos, headers=auth_headers(elias))

    assert 'Oferta: más respuestas que follow-ups (3)' in contenido(enviados['salidas'][0])['content']


def test_sin_tarjeta_el_reporte_sale_igual_en_texto(client, elias, auth_headers, enviados, monkeypatch):
    from app.services.image_service import ImageService

    def rota(datos):
        raise RuntimeError('sin chromium')

    monkeypatch.setattr(ImageService, 'generate_setter_report_v2_card', rota)

    client.post(URL, json=reporte_v2(elias.id), headers=auth_headers(elias))

    url, kw = enviados['salidas'][0]
    assert 'files' not in kw
    assert '📥 **Entrantes:** 16' in kw['json']['content']


def test_un_dia_no_laborable_lo_dice_y_nada_mas(client, elias, auth_headers, enviados):
    client.post(URL, json=reporte_v2(elias.id, is_non_working_day=True), headers=auth_headers(elias))

    texto = contenido(enviados['salidas'][0])['content']
    assert '🌙 **Día no laborable**' in texto
    assert 'Entrantes' not in texto


def test_el_v1_sale_como_antes(client, elias, auth_headers, enviados):
    client.post(URL, headers=auth_headers(elias), json={
        'setter_id': elias.id, 'date': '2026-10-10', 'inbox_entrantes': 20, 'funnel_agenda': 2})

    assert enviados['tarjetas'] == {'v1': 1, 'v2': 0}
    texto = contenido(enviados['salidas'][0])['content']
    assert texto == ("🚀 **NUEVO REPORTE DIARIO DE SETTER**\n"
                     "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                     "👤 **Setter:** `Elias`\n"
                     "📅 **Fecha:** `10/10/2026`\n"
                     "━━━━━━━━━━━━━━━━━━━━━━━━\n"
                     "@everyone")


def test_la_tarjeta_v2_se_dibuja_con_sus_datos(app, db, elias):
    stat = rv2.escribir(SetterDailyStats(setter_id=elias.id, date=date(2026, 10, 10)),
                        {k: v for k, v in reporte_v2(elias.id).items() if k not in ('setter_id', 'date', 'version')})
    db.session.add(stat)
    db.session.add(SetterDailyStats(setter_id=elias.id, date=date(2026, 10, 9), inbox_entrantes=20,
                                    inbox_leads=10, funnel_agenda=4))
    db.session.commit()

    datos = discord.datos_de_la_imagen(stat)
    with open('app/templates/reports/setter_report_v2.html', encoding='utf-8') as f:
        html = render_template_string(f.read(), **datos)

    assert datos['kpis']['cualificacion'] == '87,5%'
    assert datos['promedio'] == {'reportes': 1, 'entrantes': '20', 'cualificacion': '50%', 'agendas': '4'}
    assert [c['nombre'] for c in datos['canales']] == ['Anuncios', 'Inbound']
    assert (datos['followups']['total'], datos['followups']['respondidos'], datos['followups']['respuesta']) == (20, 8, '40%')
    assert 'Elias' in html and 'Anuncios' in html and 'Bienvenidas' in html
    assert html.count('<svg class="flujo"') == 5
    assert 'Una fría agendó' in html
    assert 'respuesta · 8 de 20' in html


def test_el_embudo_marca_en_ambar_una_conversion_de_mas_de_100():
    svg = discord.flujo_svg([{'n': 'A'}, {'n': 'B'}], [2, 5], 5, '#fff', convs=[250])

    assert 'class="pill alto"' in svg
    assert '>250%<' in svg


def test_la_vista_previa_de_un_v2_usa_su_tarjeta(client, db, elias, make_user, auth_headers):
    stat = rv2.escribir(SetterDailyStats(setter_id=elias.id, date=date(2026, 10, 10)), rv2.vacio())
    db.session.add(stat)
    db.session.commit()

    r = client.get(f'/api/public/setter-reports/{stat.id}/preview', headers=auth_headers(make_user(role='admin')))

    assert r.status_code == 200
    assert 'Embudo · ambos canales' in r.get_data(as_text=True)
