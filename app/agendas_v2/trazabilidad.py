"""Trazabilidad de cada agenda de NeurOPS en el Google Calendar del closer: cuál es su evento y qué pasó
con él.

El vínculo se arma solo: para las de Agendas 2.0, el evento que creó NeurOPS; para las de n8n, el de sus
calendarios de conflicto a la misma hora con el email del lead entre los invitados (o, si hay uno solo, con
su nombre en el título). Se guarda en calendar_evento_id / calendar_id / calendar_vinculo, y no en
google_event_id: ese es el que NeurOPS borra al cancelar o reprogramar, y un evento de Calendly no se toca.
Google solo se lee: nunca se cambia un evento. Lo único que se sigue es un evento movido: movidas.py pasa
la agenda a la hora nueva.
"""

import unicodedata
from datetime import datetime, timezone

from app import db

# Un evento es el de la agenda si empieza con esta diferencia como mucho.
TOLERANCIA_MS = 60000
# Eventos vinculados que no aparecen en lo leído (movidos lejos o borrados) que se buscan uno por uno.
MAX_SUELTOS = 30
# Lo que le pasó al evento que deja libre el horario de la agenda.
NO_OCUPA = ('cancelado', 'borrado', 'movido', 'disponible')


def _ms(dt):
    return int(dt.replace(tzinfo=timezone.utc).timestamp() * 1000) if dt else None


def _dt(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(tzinfo=None)


def _simple(t):
    t = unicodedata.normalize('NFKD', (t or '').lower())
    return ''.join(c for c in t if not unicodedata.combining(c))


def _email(appt):
    return ((appt.client.email if appt.client else None) or '').strip().lower()


def _primer_nombre(appt):
    partes = _simple(appt.client.full_name if appt.client else '').split()
    return partes[0] if partes and len(partes[0]) >= 3 else None


def _candidato(appt, eventos, usados):
    """(evento, cómo) de una agenda de n8n: a la misma hora, con el lead invitado o, si hay uno solo, con
    su nombre en el título. (None, None) si no hay uno seguro."""
    inicio = _ms(appt.start_time)
    misma = [
        e for e in eventos
        if e['inicio'] is not None and abs(e['inicio'] - inicio) <= TOLERANCIA_MS
        and (e['calendario'], e['id']) not in usados
    ]
    misma.sort(key=lambda e: e['estado'] == 'cancelled')  # los vigentes primero
    email = _email(appt)
    if email:
        con_lead = [e for e in misma if any(i['email'] == email for i in e['invitados'])]
        if con_lead:
            return con_lead[0], 'email'
    nombre = _primer_nombre(appt)
    if nombre:
        con_nombre = [e for e in misma if nombre in _simple(e['titulo'])]
        if len(con_nombre) == 1:
            return con_nombre[0], 'nombre'
    return None, None


def vincular(citas, eventos, calendario_destino):
    """Guarda el vínculo de las agendas que todavía no lo tienen. Devuelve cuántas se vincularon."""
    por_id = {e['id']: e for e in eventos}
    usados = {(a.calendar_id, a.calendar_evento_id) for a in citas if a.calendar_evento_id}
    n = 0
    for a in citas:
        if a.calendar_evento_id:
            continue
        if a.google_event_id:
            e = por_id.get(a.google_event_id)
            a.calendar_evento_id, a.calendar_vinculo = a.google_event_id, 'propio'
            a.calendar_id = e['calendario'] if e else calendario_destino
        else:
            e, como = _candidato(a, eventos, usados)
            if not e:
                continue
            a.calendar_evento_id, a.calendar_id, a.calendar_vinculo = e['id'], e['calendario'], como
        usados.add((a.calendar_id, a.calendar_evento_id))
        n += 1
    return n


def estado_de(appt, e):
    """La traza de una agenda vinculada según su evento (`e`: el evento, 'borrado' o None si no se sabe):
    {estado, vinculo, inicio_nuevo?}. estado: 'ok', 'cancelado', 'borrado', 'movido' (con inicio_nuevo),
    'disponible' (marcado «Disponible»), 'rechazado' (el lead rechazó la invitación) o 'sin_dato'."""
    base = {'vinculo': appt.calendar_vinculo}
    if e is None:
        return {**base, 'estado': 'sin_dato'}
    if e == 'borrado':
        return {**base, 'estado': 'borrado'}
    if e['estado'] == 'cancelled':
        return {**base, 'estado': 'cancelado'}
    inicio = _ms(appt.start_time)
    if e['inicio'] is not None and abs(e['inicio'] - inicio) > TOLERANCIA_MS:
        return {**base, 'estado': 'movido', 'inicio_nuevo': e['inicio']}
    if e['disponible']:
        return {**base, 'estado': 'disponible'}
    email = _email(appt)
    otros = [i for i in e['invitados'] if not i['propio']]
    lead = [i for i in otros if email and i['email'] == email] or otros
    if lead and all(i['respuesta'] == 'declined' for i in lead):
        return {**base, 'estado': 'rechazado'}
    return {**base, 'estado': 'ok'}


def trazas(user_id, citas, desde, hasta):
    """{appointment_id (str): traza} de agendas de un closer entre desde y hasta (ms). Vincula las que
    no tienen evento todavía; las que no se pueden vincular van 'sin_vincular'. None si no se pudo leer
    su Calendar."""
    from app.services.google_service import GoogleService

    eventos = GoogleService.eventos_para_traza(user_id, _dt(desde), _dt(hasta))
    if eventos is None:
        return None
    if vincular(citas, eventos, GoogleService._calendario(user_id)):
        db.session.commit()
    por_clave = {(e['calendario'], e['id']): e for e in eventos}
    por_id = {e['id']: e for e in eventos}
    out, sueltos = {}, 0
    for a in citas:
        if not a.calendar_evento_id:
            out[str(a.id)] = {'estado': 'sin_vincular', 'vinculo': None}
            continue
        e = por_clave.get((a.calendar_id, a.calendar_evento_id)) or por_id.get(a.calendar_evento_id)
        if e is None and sueltos < MAX_SUELTOS:
            sueltos += 1
            calendario = a.calendar_id or GoogleService._calendario(user_id)
            e = GoogleService.evento_para_traza(user_id, calendario, a.calendar_evento_id)
        out[str(a.id)] = estado_de(a, e)
    return out
