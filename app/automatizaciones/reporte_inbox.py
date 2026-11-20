"""El reporte diario del setter contado desde el Inbox (entrega 2 de ADR-W184).

El setter ya no cuenta a mano lo que el Inbox sabe: este módulo devuelve, para un setter y un día (en
su zona), los números del reporte v2 (`setter_reporte_v2`) con la misma forma, y el formulario los
precarga. El setter revisa, corrige si hace falta y escribe la reflexión.

De quién es una conversación: del setter asignado (`bandeja.asignaciones`: el reparto de la campaña
o la asignación a mano). Los mensajes del equipo no traen autor (salen también desde la app de
Instagram), así que todo lo que pasa en sus conversaciones cuenta para él.

Cómo se cuenta cada número (por canal, `fases.canal`):

- Nuevos mensajes: conversaciones cuyo primer mensaje del lead cayó ese día.
- No leads / In-abribles: de esas, las marcadas en esa fase, o las que el bot dio por no calificadas.
- Entrantes cualificados: de esas, las que contestaron algo (al bot o al equipo) y no son in-abribles.
  Como en el formulario, incluyen a los no leads; las que no contestaron son lo que sobra.
- Embudo (dolor, oferta, link): conversaciones que llegaron ese día por primera vez a esa etapa
  (`ig_fases`, lo que marca el setter o «Adelantar»).
- Follow-ups: mensajes del equipo que salen tras SEGUIMIENTO_H horas sin respuesta a su mensaje
  anterior, en la etapa en que estaba la conversación; respondidos, los que el lead contestó.

El embudo y los follow-ups dependen de las fases: si ninguna conversación del setter tiene una fase
marcada hasta ese día, no se cuentan (vienen en None) y los carga él, para no repartir todo en
«Entrantes».

Lo que todavía no tiene definición acordada no se cuenta (`A_CONFIRMAR`, 20/11/2026): las aperturas
(en entrantes y en dolor, y cuántas respondieron) y las bienvenidas. Contadas desde el Inbox, las
aperturas en entrantes coincidían (24 de Elias el 18/11) pero las respondidas no (12 contra 21: el
setter cuenta a todos los que contestaron ese día). Las sigue cargando el setter.

Cada número trae en `detalle` la lista de conversaciones que suma ({id, quien, fase, en}), para
verla desde el formulario.
"""
from collections import defaultdict
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from app import db
from app.automatizaciones import bandeja, fases
from app.automatizaciones.modelos import AutEjecucion, IgContacto, IgFase, IgMensaje

SEGUIMIENTO_H = 12
# Sin definición acordada (20/11/2026): las aperturas y las bienvenidas.
A_CONFIRMAR = ('ap_entrantes', 'ap_entrantes_resp', 'ap_dolor', 'ap_dolor_resp', 'bienvenidas')
_ETAPA_EMBUDO = {'dolor': 'dolor', 'consecuencia': 'dolor', 'compromiso': 'dolor', 'propuesta': 'oferta', 'link': 'link'}


def _dia_utc(fecha, tz):
    """[inicio, fin) del día `fecha` en la zona del setter, en UTC naive (como guarda el Inbox)."""
    try:
        zona = ZoneInfo(tz or 'UTC')
    except Exception:  # zona mal cargada en el usuario: el día en UTC
        zona = ZoneInfo('UTC')
    ini = datetime.combine(fecha, time.min, zona).astimezone(ZoneInfo('UTC')).replace(tzinfo=None)
    return ini, ini + timedelta(days=1)


def _suyas(setter_id, desde):
    """{contacto_id: canal} de las conversaciones del setter con movimiento desde `desde`."""
    ids = [i for (i,) in db.session.query(IgMensaje.contacto_id).filter(IgMensaje.enviado_en >= desde).distinct()]
    asignados = bandeja.asignaciones(ids)
    contactos = {c.id: c for c in IgContacto.query.filter(IgContacto.id.in_(ids))} if ids else {}
    return {cid: fases.canal(contactos[cid], a) for cid, a in asignados.items()
            if a['id'] == setter_id and cid in contactos}, contactos


def _etapa_en(cambios, momento):
    """La etapa del reporte en la que estaba la conversación en `momento` (sin cambios: entrantes)."""
    etapa = 'entrantes'
    for en, fase in cambios:
        if en > momento:
            break
        etapa = fases.DEL_REPORTE.get(fase, etapa)
    return etapa


def contar(setter_id, fecha, tz):
    ini, fin = _dia_utc(fecha, tz)
    # Una conversación de hoy pudo arrancar días antes: los mensajes se leen desde una semana atrás.
    suyas, contactos = _suyas(setter_id, ini - timedelta(days=7))
    canales = ('anuncios', 'inbound')
    salida = {c: dict.fromkeys(('entrantes', 'leads', 'no_lead', 'inabribles'), 0) for c in canales}
    embudo = dict.fromkeys(('dolor', 'oferta', 'link'), 0)
    fu = dict.fromkeys(('entrantes', 'dolor', 'oferta', 'link'), 0)
    fur = dict.fromkeys(fu, 0)
    detalle = defaultdict(list)
    if not suyas:
        return {'anuncios': salida['anuncios'], 'inbound': salida['inbound'], 'embudo': None,
                'followups': None, 'followups_respondidos': None, 'detalle': {}, 'a_confirmar': list(A_CONFIRMAR)}

    ids = list(suyas)
    mensajes = defaultdict(list)
    bot = defaultdict(list)
    for m in IgMensaje.query.filter(IgMensaje.contacto_id.in_(ids)).order_by(IgMensaje.enviado_en):
        if m.origen == IgMensaje.MOTOR:
            bot[m.contacto_id].append(m.enviado_en)
        else:
            mensajes[m.contacto_id].append((m.enviado_en, m.direccion == 'entrante'))
    cambios = defaultdict(list)
    for f in IgFase.query.filter(IgFase.contacto_id.in_(ids)).order_by(IgFase.en):
        cambios[f.contacto_id].append((f.en, f.fase))
    no_califica = {c for (c,) in db.session.query(AutEjecucion.contacto_id)
                   .filter(AutEjecucion.contacto_id.in_(ids), AutEjecucion.califica.is_(False))}

    for cid, canal in suyas.items():
        c = salida.get(canal)
        msgs = mensajes.get(cid, [])
        ct = contactos[cid]
        quien = lambda en: {'id': cid, 'quien': ct.username or ct.nombre or str(cid),  # noqa: E731
                            'fase': ct.fase, 'en': en.isoformat() + 'Z' if en else None}
        primero_lead = next((en for en, lead in msgs if lead), None)
        primero_equipo = next((en for en, lead in msgs if not lead), None)
        primera_salida = min(filter(None, (primero_equipo, (bot.get(cid) or [None])[0])), default=None)

        if c is not None and primero_lead and ini <= primero_lead < fin:
            c['entrantes'] += 1
            fase = contactos[cid].fase
            if fase == 'inabrible':
                c['inabribles'] += 1
                detalle[f'{canal}.inabribles'].append(quien(primero_lead))
            elif primera_salida and any(lead and en > primera_salida for en, lead in msgs):
                c['leads'] += 1
                detalle[f'{canal}.leads'].append(quien(primero_lead))
                if fase == 'nolead' or cid in no_califica:
                    c['no_lead'] += 1
                    detalle[f'{canal}.no_lead'].append(quien(primero_lead))
            detalle[f'{canal}.entrantes'].append(quien(primero_lead))

        vistas = set()
        for en, fase in cambios.get(cid, []):
            etapa = _ETAPA_EMBUDO.get(fase)
            if etapa and etapa not in vistas:
                vistas.add(etapa)
                if ini <= en < fin:
                    embudo[etapa] += 1
                    detalle[f'embudo.{etapa}'].append(quien(en))

        # Follow-up: mensaje del equipo tras SEGUIMIENTO_H sin que el lead contestara el anterior.
        previo = None
        for i, (en, lead) in enumerate(msgs):
            if lead:
                previo = None
                continue
            if previo and en - previo >= timedelta(hours=SEGUIMIENTO_H) and ini <= en < fin:
                etapa = _etapa_en(cambios.get(cid, []), en)
                if etapa in fu:
                    fu[etapa] += 1
                    detalle[f'followups.{etapa}'].append(quien(en))
                    if any(l for _, l in msgs[i + 1:]):
                        fur[etapa] += 1
                        detalle[f'followups_respondidos.{etapa}'].append(quien(en))
            previo = en

    con_fases = any(en < fin for lista in cambios.values() for en, _ in lista)
    if not con_fases:
        detalle = {k: v for k, v in detalle.items() if k.split('.')[0] in canales}
    return {'anuncios': salida['anuncios'], 'inbound': salida['inbound'],
            'embudo': embudo if con_fases else None,
            'followups': fu if con_fases else None,
            'followups_respondidos': fur if con_fases else None,
            'detalle': dict(detalle), 'a_confirmar': list(A_CONFIRMAR)}
