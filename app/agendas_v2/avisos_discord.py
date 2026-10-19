"""Aviso de Agendas 2.0 al canal de ventas de Discord: cada agenda (nueva o reprogramada) y cada lead que
no calificó.

El texto lleva solo lo que se busca después en Discord (nombre y WhatsApp del lead) y etiqueta al setter
con su ID (`<@id>`: escribir «@nombre» no notifica a nadie). Todo lo demás va en una imagen
(app/templates/reports/agenda_v2.html). Si la imagen falla, sale un embed de texto.

Webhooks: DISCORD_AGENDAS_WEBHOOK; los que no califican, DISCORD_NO_CALIFICA_WEBHOOK (sin esa, el mismo).
Los datos se arman en la request y el envío va en un hilo: Chromium tarda segundos y el lead no los
espera. Si falta el webhook o Discord falla, queda en el log: nunca frena la agenda.
"""

import json
import os
import threading
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from flask import current_app

from app import db
from app.models import User
from app.agendas_v2.operacion import BANDERAS, DIAS, ZONA_EQUIPO, zona_del_lead

TIPOS = {
    'nueva': {'titulo': 'Nueva agenda', 'emoji': '📅', 'color': 0x2ECC71},
    'reprogramada': {'titulo': 'Agenda reprogramada', 'emoji': '🔁', 'color': 0xF1C40F},
    'no_califica': {'titulo': 'No calificó', 'emoji': '🚫', 'color': 0x95A5A6},
}
# A quién le interesa cada aviso: el que no califica, al setter (lo sigue); la agenda nueva, a los dos;
# la reprogramada, solo al closer (el setter ya la cerró).
ETIQUETA = {'nueva': ('closer', 'setter'), 'reprogramada': ('closer',), 'no_califica': ('setter',)}
FUNNELS = {'setting': 'Setting', 'workshop': 'Workshop', 'otro': '', 'manual': ''}
MOTIVOS = {
    'respuesta': 'Eligió una respuesta que descalifica',
    'segmentacion': 'La segmentación lo manda a «No califica»',
    'redirigido': 'Una regla lo manda a otra página',
}


def _corto(texto, n):
    texto = str(texto or '').strip()
    return texto if len(texto) <= n else texto[: n - 1] + '…'


def _estado(r):
    """El color de la respuesta en la imagen: descalifica o pocos puntos, mal; sin puntos, neutro."""
    p = r.get('puntos')
    if r.get('descalifica'):
        return 'mal'
    if p is None:
        return 'neutro'
    return 'bien' if p >= 7 else 'medio' if p >= 4 else 'mal'


def _filas(payload):
    """Cada respuesta con su nombre y su respuesta cortos (los del formulario o el texto recortado). Si
    la respuesta tiene versión corta, la larga va de detalle."""
    return [
        {
            'pregunta': r.get('pregunta_corta') or _corto(r.get('pregunta'), 60),
            'respuesta': r.get('respuesta_corta') or _corto(r.get('respuesta'), 140),
            'detalle': _corto(r.get('respuesta'), 140) if r.get('respuesta_corta') else '',
            'puntos': r.get('puntos'),
            'descalifica': bool(r.get('descalifica')),
            'estado': _estado(r),
        }
        for r in payload.get('respuestas') or []
        if r.get('respuesta')
    ]


def _hora(dt, zona):
    local = dt.astimezone(zona)
    return local, f"{DIAS[local.weekday()]} {local.strftime('%d/%m %H:%M')}"


def _horario(inicio_utc, lead):
    """La hora en la zona del lead y, si es otra, la del equipo (los closers trabajan con esa)."""
    zona, pais = zona_del_lead(lead)
    dt = inicio_utc.replace(tzinfo=ZoneInfo('UTC'))
    local, texto = _hora(dt, zona)
    equipo = dt.astimezone(ZoneInfo(ZONA_EQUIPO))
    return {
        'lead': texto,
        'dia': f"{DIAS[local.weekday()][:3].capitalize()} {local.strftime('%d/%m')}",
        'hora': local.strftime('%H:%M'),
        'pais': pais['n'],
        'bandera': BANDERAS.get(pais['c'], '🌍'),
        'equipo': equipo.strftime('%H:%M') if local.utcoffset() != equipo.utcoffset() else None,
    }


def _antes(iso, lead):
    if not iso:
        return None
    try:
        dt = datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except ValueError:
        return None
    return _hora(dt if dt.tzinfo else dt.replace(tzinfo=ZoneInfo('UTC')), zona_del_lead(lead)[0])[1]


def _base(tipo, payload, setter, evento_nombre):
    lead = payload.get('lead') or {}
    nota = payload.get('nota')
    return {
        'tipo': tipo,
        **TIPOS[tipo],
        'evento': evento_nombre or 'Llamada',
        'lead': {
            'nombre': lead.get('nombre') or 'Lead',
            'telefono': lead.get('telefono') or '',
            'email': lead.get('email') or '',
            'instagram': ('@' + lead['instagram']) if lead.get('instagram') else '',
        },
        'setter': (setter.username if setter else payload.get('origen')) or '-',
        'setter_discord': (setter.discord_id if setter else None) or None,
        'funnel': FUNNELS.get(payload.get('funnel_tipo'), str(payload.get('funnel_tipo') or '').capitalize()),
        'nota': None if nota is None else f'{nota:g}',
        'filas': _filas(payload),
    }


def datos_de_agenda(appt):
    """Todo lo del aviso de una agenda, ya resuelto (el hilo no toca la base)."""
    payload = appt.agenda_payload or {}
    lead = payload.get('lead') or {}
    closer = db.session.get(User, appt.closer_id)
    setter = db.session.get(User, appt.setter_id) if appt.setter_id else None
    reprogramada = bool(payload.get('reprogramada_desde'))
    return {
        **_base('reprogramada' if reprogramada else 'nueva', payload, setter, payload.get('evento_nombre')),
        'closer': closer.username if closer else '-',
        'closer_discord': (closer.discord_id if closer else None) or None,
        'prioridad': payload.get('prioridad_nombre') or '-',
        'horario': _horario(appt.start_time, lead),
        'antes': _antes(payload.get('reprogramada_desde'), lead) if reprogramada else None,
        'meet': payload.get('meet') or '',
        'pie': f'Agendas 2.0 · agenda #{appt.id}',
    }


def datos_de_no_califica(payload, setter, evento_nombre, motivo):
    return {
        **_base('no_califica', payload, setter, evento_nombre),
        'motivo': MOTIVOS.get(motivo, motivo),
        'horario': None,
        'prioridad': None,
        'pie': 'Agendas 2.0 · no agenda',
    }


def mensaje(d):
    """El texto del mensaje: etiqueta a los que les toca (ETIQUETA, si tienen su ID de Discord), el nombre
    y el WhatsApp."""
    partes = [f"{d['emoji']} **{d['titulo']}**", d['lead']['nombre'], d['lead']['telefono']]
    texto = ' · '.join(p for p in partes if p)
    ids = list(dict.fromkeys(i for i in (d.get(q + '_discord') for q in ETIQUETA[d['tipo']]) if i))
    if ids:
        return {'content': ' '.join(f'<@{i}>' for i in ids) + ' ' + texto, 'allowed_mentions': {'users': ids}}
    return {'content': texto, 'allowed_mentions': {'parse': []}}


def embed_de_texto(d):
    """El aviso sin imagen (si Chromium falla): los mismos datos en campos."""
    campos = [
        {'name': 'Setter / origen', 'value': d['setter'], 'inline': True},
        {'name': 'Nota', 'value': d['nota'] or '-', 'inline': True},
    ]
    if d['tipo'] == 'no_califica':
        campos.append({'name': 'Motivo', 'value': d['motivo'], 'inline': False})
    else:
        h = d['horario']
        hora = f"{h['lead']} {h['bandera']} {h['pais']}" + (f" ({h['equipo']} Bolivia)" if h['equipo'] else '')
        campos[:0] = [{'name': 'Closer', 'value': d['closer'], 'inline': True},
                      {'name': 'Horario del lead', 'value': hora, 'inline': True}]
        campos.append({'name': 'Prioridad', 'value': d['prioridad'], 'inline': True})
        if d.get('antes'):
            campos.append({'name': 'Antes', 'value': d['antes'], 'inline': True})
    if d['filas']:
        texto = '\n'.join(('🚫 ' if f['descalifica'] else '') + f"**{f['pregunta']}**: {f['respuesta']}" for f in d['filas'])
        campos.append({'name': 'Formulario', 'value': _corto(texto, 1024), 'inline': False})
    if d.get('meet'):
        campos.append({'name': 'Meet', 'value': d['meet'], 'inline': False})
    return {'title': _corto(f"{d['titulo']}: {d['evento']}", 256), 'color': d['color'], 'fields': campos,
            'footer': {'text': d['pie']}}


def _enviar(url, d):
    """Manda el aviso con la imagen; si la imagen falla, con el embed de texto. True si Discord lo aceptó."""
    from app.services.report_image_service import ReportImageService

    cuerpo = mensaje(d)
    try:
        imagen = ReportImageService.generate_agenda_v2_card(d)
    except Exception as e:  # noqa: BLE001  (sin imagen el aviso sale igual)
        current_app.logger.error(f'[AGENDAS 2.0] Sin imagen para Discord ({d["pie"]}): {e}')
        imagen = None
    try:
        if imagen is None:
            r = requests.post(url, json={**cuerpo, 'embeds': [embed_de_texto(d)]}, timeout=10)
        else:
            cuerpo['embeds'] = [{'color': d['color'], 'image': {'url': 'attachment://agenda.png'}}]
            r = requests.post(url, files={'file1': ('agenda.png', imagen, 'image/png')},
                              data={'payload_json': json.dumps(cuerpo)}, timeout=20)
        if r.status_code >= 300:
            current_app.logger.error(f'[AGENDAS 2.0] Discord respondio {r.status_code} ({d["pie"]})')
            return False
        return True
    except Exception as e:  # noqa: BLE001  (Discord nunca puede frenar una agenda)
        current_app.logger.error(f'[AGENDAS 2.0] No se pudo avisar a Discord ({d["pie"]}): {e}')
        return False


def _despachar(url, d):
    if current_app.testing:
        return _enviar(url, d)
    app = current_app._get_current_object()

    def correr():
        with app.app_context():
            _enviar(url, d)

    threading.Thread(target=correr, daemon=True).start()
    return True


def avisar_agenda(appt):
    """Avisa una agenda nueva o reprogramada. Nunca lanza."""
    url = os.environ.get('DISCORD_AGENDAS_WEBHOOK')
    if not url:
        current_app.logger.warning('[AGENDAS 2.0] Sin DISCORD_AGENDAS_WEBHOOK: no se avisa a Discord.')
        return False
    try:
        return _despachar(url, datos_de_agenda(appt))
    except Exception as e:  # noqa: BLE001
        current_app.logger.error(f'[AGENDAS 2.0] No se pudo armar el aviso de la agenda #{appt.id}: {e}')
        return False


def avisar_no_califica(payload, setter, evento_nombre, motivo):
    """Avisa un lead que no calificó (motivo: una clave de MOTIVOS). Nunca lanza."""
    url = os.environ.get('DISCORD_NO_CALIFICA_WEBHOOK') or os.environ.get('DISCORD_AGENDAS_WEBHOOK')
    if not url:
        return False
    try:
        return _despachar(url, datos_de_no_califica(payload, setter, evento_nombre, motivo))
    except Exception as e:  # noqa: BLE001
        current_app.logger.error(f'[AGENDAS 2.0] No se pudo armar el aviso de un lead que no calificó: {e}')
        return False
