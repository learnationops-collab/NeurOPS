"""Lo que sale a Discord cuando un setter manda el reporte v2: el texto del mensaje y la tarjeta.

El v1 sigue saliendo como siempre (`_prepare_setter_report_data` + `setter_report.html`). El v2 se
lee por canal, así que el mensaje cuenta lo mismo que el Resumen del formulario: entrantes y
agendas por canal, cualificación, apertura, bienvenidas, el embudo, los follow-ups, la reflexión y
los avisos. El texto va completo en el mensaje aunque la tarjeta no se pueda dibujar (la imagen
depende de un Chromium del servidor): el reporte llega igual.
"""
from markupsafe import Markup, escape

from app.services import setter_reporte_v2

# Los colores de cada canal: los del formulario (tema oscuro, `--ch-*`).
COLOR = {'anuncios': '#FF3FA4', 'inbound': '#6F7BFF', 'bienvenidas': '#9A7BE0', 'tot': '#C9B8FF'}
NOMBRE = {'anuncios': 'Anuncios', 'inbound': 'Inbound'}

# El largo máximo de cada reflexión en el mensaje: Discord corta en 2000 caracteres.
LARGO_REFLEXION = 380


def pct(parte, total):
    """Porcentaje con un decimal, o None si no hay de dónde (se muestra «—», no 0%)."""
    return round(parte / total * 100, 1) if total else None


def fmt_pct(valor):
    if valor is None:
        return '—'
    entero = int(valor)
    return f'{entero}%' if valor == entero else f'{valor:.1f}%'.replace('.', ',')


def fmt_num(valor):
    """Un promedio con coma decimal y sin «,0»: 14,3 / 2."""
    if valor is None:
        return '—'
    return str(int(valor)) if valor == int(valor) else f'{valor:.1f}'.replace('.', ',')


def _recortar(texto, largo=LARGO_REFLEXION):
    texto = ' '.join((texto or '').split())
    return texto if len(texto) <= largo else texto[:largo - 1].rstrip() + '…'


# --- El embudo de la tarjeta: el mismo dibujo que el formulario, quieto ----------------------------

FH, FCY, FMAX = 156, 78, 92


def flujo_svg(etapas, valores, maximo, color, convs=(), fb=64, fg=150, bandas=True, tot=False, id_grad='g'):
    """El embudo horizontal del reporte como SVG: una barra por etapa, la banda de la conversión
    entre una y otra y la píldora con el porcentaje (en ámbar si pasa de 100).

    `etapas`: `[{'n': ..., 'ref': bool, 'split': True | 'canales'}]`; `valores`: un número por
    etapa o `(a, b)` si está partida. Es `Flujo.jsx` sin la animación.
    """
    n = len(etapas)
    ancho = n * fb + (n - 1) * fg
    pw = min(60, fg - 6)
    alturas = []
    for v in valores:
        a, b = (v if isinstance(v, (tuple, list)) else (v, 0))
        alturas.append(((a / maximo * FMAX) if maximo else 0, (b / maximo * FMAX) if maximo else 0))

    partes = [f'<svg class="flujo" viewBox="-28 0 {ancho + 56} {FH}" style="--c:{color}" xmlns="http://www.w3.org/2000/svg">']
    if tot:
        partes.append(f'<defs><linearGradient id="{id_grad}" x1="0" y1="0" x2="1" y2="1">'
                      f'<stop offset="0" stop-color="{COLOR["anuncios"]}"/><stop offset="1" stop-color="{COLOR["inbound"]}"/>'
                      '</linearGradient></defs>')
    totales = [max(2, a + b) for a, b in alturas]
    if bandas:
        for i in range(n - 1):
            x1 = i * (fb + fg) + fb
            x2 = x1 + fg
            xm = (x1 + x2) / 2
            a, b = totales[i] / 2, totales[i + 1] / 2
            partes.append(f'<path class="band" d="M{x1},{FCY - a} C{xm},{FCY - a} {xm},{FCY - b} {x2},{FCY - b} '
                          f'L{x2},{FCY + b} C{xm},{FCY + b} {xm},{FCY + a} {x1},{FCY + a} Z"/>')
    for i, (etapa, (ha, hb), t, v) in enumerate(zip(etapas, alturas, totales, valores)):
        x = i * (fb + fg)
        cx = x + fb / 2
        y0 = FCY - t / 2
        rx = min(10, t / 2)
        split = etapa.get('split')
        clase_a = 'bar ref' if etapa.get('ref') else 'bar'
        clase_a += ' ads' if split == 'canales' else (' claro' if split else '')
        relleno = f' style="fill:url(#{id_grad})"' if tot and not etapa.get('ref') and not split else ''
        if split:
            partes.append(f'<rect class="{clase_a}" x="{x}" y="{y0}" width="{fb}" height="{max(0, ha)}" rx="{rx}"/>')
            clase_b = 'bar inb' if split == 'canales' else 'bar'
            partes.append(f'<rect class="{clase_b}" x="{x}" y="{y0 + ha}" width="{fb}" height="{max(0, hb)}" rx="{rx}"/>')
        else:
            partes.append(f'<rect class="{clase_a}" x="{x}" y="{y0}" width="{fb}" height="{t}" rx="{rx}"{relleno}/>')
        total = sum(v) if isinstance(v, (tuple, list)) else v
        partes.append(f'<text class="val{" ref" if etapa.get("ref") else ""}" x="{cx}" y="{y0 - 10}" text-anchor="middle">{int(total)}</text>')
        partes.append(f'<text class="et" x="{cx}" y="{FH - 6}" text-anchor="middle">{escape(etapa["n"].upper())}</text>')
    if bandas:
        for i in range(n - 1):
            cx = i * (fb + fg) + fb + fg / 2
            cv = convs[i] if i < len(convs) else None
            alto = ' alto' if cv is not None and cv > 100 else ''
            texto = '—' if cv is None else f'{round(cv)}%'
            partes.append(f'<g class="pill{alto}"><rect x="{cx - pw / 2}" y="{FCY - 14}" width="{pw}" height="28" rx="14"/>'
                          f'<text x="{cx}" y="{FCY + 5}" text-anchor="middle">{texto}</text></g>')
    partes.append('</svg>')
    return Markup(''.join(partes))


# --- Lo que lleva la tarjeta -------------------------------------------------------------------

def _promedios_previos(stat, cuantos=7):
    """Entrantes, cualificación y agendas de los últimos `cuantos` reportes ANTERIORES (laborables),
    para el «vs promedio» de la tarjeta. None si no hay ninguno."""
    from app.models import SetterDailyStats

    previos = SetterDailyStats.query.filter(
        SetterDailyStats.setter_id == stat.setter_id,
        SetterDailyStats.date < stat.date,
    ).order_by(SetterDailyStats.date.desc()).limit(cuantos * 2).all()
    lecturas = [setter_reporte_v2.leer(p) for p in previos]
    lecturas = [l for l in lecturas if not l['no_laborable']][:cuantos]
    if not lecturas:
        return None
    suma = setter_reporte_v2.sumar(lecturas)['totales']
    return {
        'reportes': len(lecturas),
        'entrantes': fmt_num(round(suma['entrantes'] / len(lecturas), 1)),
        'cualificacion': fmt_pct(pct(suma['cualificados'], suma['entrantes'])),
        'agendas': fmt_num(round(suma['agendas'] / len(lecturas), 1)),
    }


def datos_de_la_imagen(stat):
    """Todo lo que dibuja `setter_report_v2.html` para una fila v2."""
    lectura = setter_reporte_v2.leer(stat)
    tot = lectura['totales']
    canales = lectura['canales']
    b = lectura['bienvenidas']
    e = lectura['embudo']
    fu = lectura['followups']

    max_entrantes = max(1, *(canales[c]['entrantes'] for c in NOMBRE))
    columnas = []
    for i, (canal, nombre) in enumerate(NOMBRE.items()):
        d = canales[canal]
        columnas.append({
            'nombre': nombre, 'color': COLOR[canal], **d,
            'cualificacion': fmt_pct(pct(d['cualificados'], d['entrantes'])),
            'apertura': fmt_pct(pct(d['aperturas'], d['entrantes'])),
            'svg': flujo_svg([{'n': 'Entrantes'}, {'n': 'Cualificados'}, {'n': 'Agendas'}],
                             [d['entrantes'], d['cualificados'], d['agendas']], max_entrantes, COLOR[canal],
                             convs=[pct(d['cualificados'], d['entrantes']), pct(d['agendas'], d['cualificados'])],
                             id_grad=f'g{i}'),
        })
    max_b = max(1, b['hechas'], b['respondidas'], b['aperturas'])
    etapas = [e['cualificados'], e['dolor'], e['oferta'], e['link'], e['agendas']]
    resp = lectura['followups_respondidos']
    max_fu = max(1, *fu.values(), *resp.values())
    etapas_fu = ('entrantes', 'dolor', 'oferta', 'link')
    suma_ent = canales['anuncios']['entrantes'] + canales['inbound']['entrantes']
    suma_ag = canales['anuncios']['agendas'] + canales['inbound']['agendas']
    return {
        'setter_name': stat.setter.username if stat.setter else 'Setter',
        'date_str': stat.date.strftime('%d/%m/%Y'),
        'no_laborable': lectura['no_laborable'],
        'kpis': {
            'entrantes': tot['entrantes'],
            'cualificacion': fmt_pct(pct(tot['cualificados'], tot['entrantes'])),
            'apertura': fmt_pct(pct(tot['aperturas'], tot['entrantes'])),
            'agendas': tot['agendas'],
            'bienvenidas': fmt_pct(pct(b['respondidas'], b['hechas'])),
            # Cuánto de cada número fue de anuncios (el resto, inbound): la rayita de abajo.
            'reparto_entrantes': pct(canales['anuncios']['entrantes'], suma_ent) or 0,
            'reparto_agendas': pct(canales['anuncios']['agendas'], suma_ag) or 0,
        },
        'promedio': _promedios_previos(stat),
        'canales': columnas,
        'bienvenidas': {
            **b, 'respuesta': fmt_pct(pct(b['respondidas'], b['hechas'])),
            'apertura': fmt_pct(pct(b['aperturas'], b['respondidas'])),
            'svg': flujo_svg([{'n': 'Hechas'}, {'n': 'Respondidas'}, {'n': 'Aperturas'}],
                             [b['hechas'], b['respondidas'], b['aperturas']], max_b, COLOR['bienvenidas'],
                             convs=[pct(b['respondidas'], b['hechas']), pct(b['aperturas'], b['respondidas'])],
                             id_grad='gb'),
        },
        'embudo': {
            **e, 'conversion': fmt_pct(pct(e['agendas'], e['cualificados'])),
            'svg': flujo_svg([{'n': 'Cualificados'}, {'n': 'Dolor'}, {'n': 'Oferta'}, {'n': 'Link'},
                              {'n': 'Agendas', 'split': 'canales'}],
                             [etapas[0], etapas[1], etapas[2], etapas[3],
                              (canales['anuncios']['agendas'], canales['inbound']['agendas'])],
                             max(1, *etapas), COLOR['tot'],
                             convs=[pct(etapas[i], etapas[i - 1]) for i in range(1, 5)], fb=76, fg=150, tot=True,
                             id_grad='ge'),
        },
        # Cada barra es lo enviado: la parte clara, los que no respondieron; la llena, los que sí.
        'followups': {
            **fu, 'total': sum(fu.values()), 'respondidos': sum(resp.values()),
            'respuesta': fmt_pct(pct(sum(resp.values()), sum(fu.values()))),
            'svg': flujo_svg([{'n': 'Entrantes', 'split': True}, {'n': 'Dolor', 'split': True},
                              {'n': 'Oferta', 'split': True}, {'n': 'Link', 'split': True}],
                             [(max(0, fu[k] - resp[k]), resp[k]) for k in etapas_fu], max_fu, COLOR['tot'],
                             fb=70, fg=60, bandas=False, tot=True, id_grad='gf'),
        },
        'reflexion': lectura['reflexion'],
        'avisos': setter_reporte_v2.avisos(lectura),
    }


def texto_de_discord(stat, setter_name):
    """El mensaje de Discord de un reporte v2: el Resumen del formulario en texto."""
    lectura = setter_reporte_v2.leer(stat)
    cabecera = (
        "🚀 **NUEVO REPORTE DIARIO DE SETTER**\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
        f"👤 **Setter:** `{setter_name}`\n"
        f"📅 **Fecha:** `{stat.date.strftime('%d/%m/%Y')}`\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━\n"
    )
    if lectura['no_laborable']:
        return cabecera + "🌙 **Día no laborable**\n@everyone"

    tot = lectura['totales']
    ads, inb = lectura['canales']['anuncios'], lectura['canales']['inbound']
    b = lectura['bienvenidas']
    e = lectura['embudo']
    fu = lectura['followups']
    resp = lectura['followups_respondidos']
    lineas = [
        f"📥 **Entrantes:** {tot['entrantes']} · Anuncios {ads['entrantes']} · Inbound {inb['entrantes']}",
        f"✅ **Cualificación:** {fmt_pct(pct(tot['cualificados'], tot['entrantes']))} "
        f"({tot['cualificados']} cualificados · Anuncios {fmt_pct(pct(ads['cualificados'], ads['entrantes']))}"
        f" · Inbound {fmt_pct(pct(inb['cualificados'], inb['entrantes']))})",
        f"💬 **Apertura:** {fmt_pct(pct(tot['aperturas'], tot['entrantes']))} "
        f"({tot['ap_entrantes']} en entrantes · {tot['ap_dolor']} en dolor)",
        f"📅 **Agendas:** {tot['agendas']} · Anuncios {ads['agendas']} · Inbound {inb['agendas']}",
        f"👋 **Bienvenidas:** {b['hechas']} hechas · {b['respondidas']} respondidas "
        f"({fmt_pct(pct(b['respondidas'], b['hechas']))}) · {b['aperturas']} aperturas",
        f"🔻 **Embudo:** Cualificados {e['cualificados']} → Dolor {e['dolor']} → Oferta {e['oferta']}"
        f" → Link {e['link']} → Agendas {e['agendas']}",
        f"🔁 **Follow-ups:** {sum(fu.values())} (Entrantes {fu['entrantes']} · Dolor {fu['dolor']}"
        f" · Oferta {fu['oferta']} · Link {fu['link']})",
        f"↩️ **Respondieron:** {sum(resp.values())} ({fmt_pct(pct(sum(resp.values()), sum(fu.values())))})"
        f" · Entrantes {resp['entrantes']} · Dolor {resp['dolor']} · Oferta {resp['oferta']} · Link {resp['link']}",
    ]
    avisos = setter_reporte_v2.avisos(lectura)
    if avisos:
        lineas.append('⚠️ **Avisos:** ' + ' · '.join(a['msg'] for a in avisos))
    reflexion = lectura['reflexion']
    if reflexion['flujo_trabajo'].strip():
        lineas.append(f"🧭 **Flujo de trabajo:** {_recortar(reflexion['flujo_trabajo'])}")
    if reflexion['win_del_dia'].strip():
        lineas.append(f"🏆 **Win del día:** {_recortar(reflexion['win_del_dia'])}")
    return cabecera + '\n'.join(lineas) + "\n━━━━━━━━━━━━━━━━━━━━━━━━\n@everyone"
