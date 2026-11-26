"""El reporte diario del setter contado desde el Inbox (entrega 2 de ADR-W184).

El setter ya no cuenta a mano lo que el Inbox sabe: este módulo devuelve, para un setter y un día (en
su zona), los números del reporte v2 (`setter_reporte_v2`) con la misma forma, y el formulario los
precarga. El setter revisa, corrige si hace falta y escribe la reflexión.

De quién es una conversación: del setter asignado (`bandeja.asignaciones`: el reparto de la campaña
o la asignación a mano). Lo que manda desde el Inbox lleva autor (`autor_id`); lo que sale de Kommo o
de la app de Instagram no. En aperturas y follow-ups cuentan los suyos y los sin autor; lo que mandó
otra persona del equipo desde el Inbox, no.

Cómo se cuenta cada número (por canal, `fases.canal`):

- Nuevos mensajes: conversaciones cuyo primer mensaje del lead cayó ese día.
- No leads / In-abribles: de esas, las marcadas en esa fase, o las que el bot dio por no calificadas.
- Entrantes cualificados: de esas, las que contestaron algo (al bot o al equipo) y no son in-abribles.
  Como en el formulario, incluyen a los no leads; las que no contestaron son lo que sobra.
- Embudo (dolor, oferta, link): conversaciones que llegaron ese día por primera vez a esa etapa
  (`ig_fases`, lo que marca el setter o «Adelantar»).
- Follow-ups: mensajes del equipo que salen tras SEGUIMIENTO_H horas sin respuesta a su mensaje
  anterior, en la etapa en que estaba la conversación; respondidos, los que el lead contestó.
- Conversaciones que empezamos nosotros (el primer mensaje es del equipo, a mano) no son entrantes: en
  Instagram son bienvenidas (nuevos seguidores a los que el setter les escribe; también las marcadas en
  el canal Bienvenida); en WhatsApp, reactivaciones, que el reporte no cuenta. Bienvenidas: hechas (el
  primer mensaje del setter cae ese día), respondidas (el lead contestó), aperturas (el setter volvió a
  escribir después de esa respuesta) y respondieron (el lead contestó a eso).
- Aperturas en entrantes: conversaciones a las que el equipo les escribió a mano por primera vez ese
  día (no el bot); respondieron, las que el lead contestó después. Comparado con lo cargado a mano
  del 18 al 23/11: las aperturas en el mismo orden (Elias 22 contra 25, Paula 14 contra 13); las
  respuestas, por debajo (el setter contaba a todos los que contestaron ese día).

El embudo y los follow-ups dependen de las fases: si ninguna conversación del setter tiene una fase
marcada hasta ese día, no se cuentan (vienen en None) y los carga él, para no repartir todo en
«Entrantes».

Lo que no se cuenta solo (`A_CONFIRMAR`): las aperturas en dolor, hasta que se acuerde qué son
(26/11/2026). Las sigue cargando el setter.

Cada número trae en `detalle` la lista de conversaciones que suma ({id, quien, fase, en}), para
verla desde el formulario.
"""
from collections import defaultdict
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from app import db
from app.automatizaciones import bandeja, fases
from app.automatizaciones.modelos import AutEjecucion, IgContacto, IgFase, IgMensaje
from app.whatsapp.cliente import es_whatsapp

SEGUIMIENTO_H = 12
# Sin definición acordada: las aperturas en dolor.
BIENVENIDAS = ('hechas', 'respondidas', 'aperturas', 'aperturas_resp')
A_CONFIRMAR = ('ap_dolor', 'ap_dolor_resp')
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


def _bienvenida(mios, msgs, ini, fin, bnv, detalle, quien):
    """Suma la bienvenida si el primer mensaje del setter cayó ese día, con lo que siguió después."""
    hecha = mios[0] if mios else None
    if not hecha or not (ini <= hecha < fin):
        return
    pasos = [('hechas', hecha)]
    resp = next((en for en, lead in msgs if lead and en > hecha), None)
    if resp:
        pasos.append(('respondidas', resp))
        apertura = next((en for en in mios if en > resp), None)
        if apertura:
            pasos.append(('aperturas', apertura))
            if any(lead and en > apertura for en, lead in msgs):
                pasos.append(('aperturas_resp', apertura))
    for paso, _ in pasos:
        bnv[paso] += 1
        detalle[f'bienvenidas.{paso}'].append(quien(hecha))


def contar(setter_id, fecha, tz):
    ini, fin = _dia_utc(fecha, tz)
    # Una conversación de hoy pudo arrancar días antes: los mensajes se leen desde una semana atrás.
    suyas, contactos = _suyas(setter_id, ini - timedelta(days=7))
    canales = ('anuncios', 'inbound')
    salida = {c: dict.fromkeys(('entrantes', 'leads', 'no_lead', 'inabribles', 'ap_entrantes', 'ap_entrantes_resp'), 0)
              for c in canales}
    embudo = dict.fromkeys(('dolor', 'oferta', 'link'), 0)
    fu = dict.fromkeys(('entrantes', 'dolor', 'oferta', 'link'), 0)
    fur = dict.fromkeys(fu, 0)
    bnv = dict.fromkeys(BIENVENIDAS, 0)
    detalle = defaultdict(list)
    if not suyas:
        return {'anuncios': salida['anuncios'], 'inbound': salida['inbound'], 'bienvenidas': bnv, 'embudo': None,
                'followups': None, 'followups_respondidos': None, 'detalle': {}, 'a_confirmar': list(A_CONFIRMAR)}

    ids = list(suyas)
    mensajes = defaultdict(list)
    propios = defaultdict(list)  # del equipo, sin contar lo que mandó otro desde el Inbox
    bot = defaultdict(list)
    for m in IgMensaje.query.filter(IgMensaje.contacto_id.in_(ids)).order_by(IgMensaje.enviado_en):
        if m.origen == IgMensaje.MOTOR:
            bot[m.contacto_id].append(m.enviado_en)
        else:
            mensajes[m.contacto_id].append((m.enviado_en, m.direccion == 'entrante'))
            if m.direccion != 'entrante' and m.autor_id in (None, setter_id):
                propios[m.contacto_id].append(m.enviado_en)
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
        mios = set(propios.get(cid, []))
        empezamos = bool(primero_equipo) and primera_salida == primero_equipo and not (
            primero_lead and primero_lead < primero_equipo)
        if empezamos or canal == 'bienvenida':
            c = None  # no es un entrante
            if not es_whatsapp(ct.igsid):
                _bienvenida(sorted(mios), msgs, ini, fin, bnv, detalle, quien)

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

        apertura = min(mios, default=None)
        if c is not None and apertura and ini <= apertura < fin:
            c['ap_entrantes'] += 1
            detalle[f'{canal}.ap_entrantes'].append(quien(apertura))
            if any(lead and en > apertura for en, lead in msgs):
                c['ap_entrantes_resp'] += 1
                detalle[f'{canal}.ap_entrantes_resp'].append(quien(apertura))

        # Follow-up: mensaje del equipo tras SEGUIMIENTO_H sin que el lead contestara el anterior.
        previo = None
        for i, (en, lead) in enumerate(msgs):
            if lead:
                previo = None
                continue
            if en not in mios:
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
        detalle = {k: v for k, v in detalle.items() if k.split('.')[0] in (*canales, 'bienvenidas')}
    return {'anuncios': salida['anuncios'], 'inbound': salida['inbound'], 'bienvenidas': bnv,
            'embudo': embudo if con_fases else None,
            'followups': fu if con_fases else None,
            'followups_respondidos': fur if con_fases else None,
            'detalle': dict(detalle), 'a_confirmar': list(A_CONFIRMAR)}
