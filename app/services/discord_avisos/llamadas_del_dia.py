"""Cada mañana, en #🔔-new-call, las llamadas del día (triage y aceleración) agrupadas por setter, con el
setter etiquetado, para que le escriba al lead por Instagram antes de la llamada (pedido de Elias, 10/11/2026).

La hora va con el formato de Discord `<t:…:t>`: cada persona la ve en su propia zona. Corre una vez por
día desde el scheduler (`reminder_scheduler`, en el proceso líder). Cubre hasta las 06:00 UTC del día
siguiente: la medianoche de México, así entran las llamadas de la noche de todo el equipo.
La Momentum no entra: es con alumnos, no con leads de los setters.
"""
import calendar
import os
from datetime import datetime, timedelta

from app import db
from app.models import Appointment, User
from app.services.discord_avisos import envio

CANAL = 'new_call'
HORA_UTC = int(os.environ.get('LLAMADAS_DEL_DIA_HORA_UTC', '12'))  # 8:00 Bolivia, 6:00 México
HASTA_UTC = 6
LARGO_MAX = 1900  # Discord corta a los 2000 caracteres


def de_hoy(ahora):
    """Las agendas vigentes entre `ahora` y las 06:00 UTC del día siguiente, por hora."""
    from app.agendas_v2.manual import ORIGEN_MOMENTUM
    from app.agendas_v2.servicio import _vigente

    fin = (ahora + timedelta(days=1)).replace(hour=HASTA_UTC, minute=0, second=0, microsecond=0)
    q = (Appointment.query.filter(Appointment.start_time >= ahora, Appointment.start_time < fin)
         .order_by(Appointment.start_time))
    return [a for a in q if _vigente(a) and a.origin != ORIGEN_MOMENTUM]


def _linea(appt):
    from app.services.triage_service import es_de_triage

    lead = (appt.agenda_payload or {}).get('lead') or {}
    cliente = appt.client
    nombre = lead.get('nombre') or (cliente.full_name if cliente else '') or 'Lead'
    ig = (lead.get('instagram') or (cliente.instagram if cliente else '') or '').lstrip('@')
    tipo = 'Triage' if es_de_triage(appt) else 'Aceleración'
    closer = appt.closer.username if appt.closer else '-'
    unix = calendar.timegm(appt.start_time.timetuple())  # start_time es UTC sin zona
    return f"• <t:{unix}:t> {tipo} · {nombre}{f' (@{ig})' if ig else ''} con {closer}"


def armar(agendas):
    """Los mensajes (de a menos de 2000 caracteres): un bloque por setter, con su mención."""
    if not agendas:
        return ['📞 **Llamadas de hoy**: no hay ninguna agendada.']
    grupos = {}
    for a in agendas:
        grupos.setdefault(a.setter_id, []).append(a)
    setters = {u.id: u for u in User.query.filter(User.id.in_([k for k in grupos if k])).all()}

    def titulo(setter_id):
        u = setters.get(setter_id)
        if not u:
            return '**Sin setter**'
        return f'<@{u.discord_id}>' if u.discord_id else f'**{u.username}**'

    orden = sorted(grupos, key=lambda k: (k is None, (setters[k].username if k in setters else '').lower()))
    lineas = [f'📞 **Llamadas de hoy** ({len(agendas)}). La hora sale en tu zona; escribile a cada lead antes de su llamada.']
    for k in orden:
        lineas += ['', f'{titulo(k)} · {len(grupos[k])}', *(_linea(a) for a in grupos[k])]

    mensajes, actual = [], ''
    for linea in lineas:
        if actual and len(actual) + len(linea) + 1 > LARGO_MAX:
            mensajes.append(actual)
            actual = ''
        actual = f'{actual}\n{linea}' if actual else linea
    return mensajes + ([actual] if actual else [])


def publicar(ahora=None):
    """Publica el resumen. Devuelve cuántas llamadas listó."""
    ahora = ahora or datetime.utcnow()
    agendas = de_hoy(ahora)
    for texto in armar(agendas):
        envio.enviar(CANAL, {'content': texto, 'allowed_mentions': {'parse': ['users']}}, etiqueta='LLAMADAS DEL DIA')
    db.session.rollback()  # solo lectura: no deja la sesión abierta
    return len(agendas)
