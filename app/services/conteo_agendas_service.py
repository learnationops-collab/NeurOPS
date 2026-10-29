"""UNA sola cuenta de agendas para Marketing (Kerwin, 28/10/2026): «Contar por: fecha de alta / fecha de reunión».

Marketing contaba las agendas por la fecha en que se DIERON DE ALTA y Closing, Analizar y Revisar por la fecha
de la REUNIÓN: octubre 01–28 daba 171 / 209 contra 223. Las dos cuentas viven acá y todas las pantallas de
Marketing (las tarjetas de Setting, Workshop y Otras, Todos, y la lista que se abre al tocar una cifra) leen
estas funciones; el frontend no cuenta nada.

  · **alta**: las `FinancialAgenda` (libro de agendas) creadas en el período, una por persona. Es la base de
    los costos y del ROAS: lo que Meta gastó genera agendas al darse de alta, no el día de la reunión.
  · **reunion**: las citas (`Appointment`) cuya reunión cae en el período, las MISMAS filas que Closing,
    Analizar y Revisar (`ComercialService.agendas`): el total es el suyo, incluidas las descartadas. Una fila
    por llamada, como ellos. El show up cuenta LEADS (asistió a alguna de sus llamadas), como la tarjeta de
    Analizar (26/10/2026), así que da la misma cifra.

En las dos, cada agenda es de una fuente: **setting** (la trajo un setter), **workshop** (el taller en vivo o su
grabación) u **otras** (entrevistas, VSL, Momentum, referidos, sin fuente): Setting + Workshop + Otras suman el
total de la base, siempre.
"""
from datetime import datetime, time

from sqlalchemy.orm import joinedload

from app.models import FinancialAgenda
from app.services.workshop_estados import bucket_estado

BASES = ('alta', 'reunion')
BASE_POR_DEFECTO = 'alta'
FUENTES = ('setting', 'workshop', 'otras')
ETIQUETA_BASE = {'alta': 'fecha de alta', 'reunion': 'fecha de reunión'}


def base_de(valor):
    """La base pedida (`?base=`), o la de siempre si no es una conocida."""
    return valor if valor in BASES else BASE_POR_DEFECTO


def _fuente(nombre, setters):
    from app.services import fuentes_service
    return fuentes_service.fuente_de_agenda(nombre, setters) or 'otras'


def _de_alta(desde, hasta):
    """Una fila por persona con agenda creada en el período (las repetidas de una reprogramación no suman).
    `asistio` si fue a alguna; `con_resultado` si asistió o su última cita fue un no show."""
    from app.services.procedencia_ingresos_service import setters_conocidos

    inicio, fin = datetime.combine(desde, time.min), datetime.combine(hasta, time.max)
    setters = setters_conocidos()
    filas = FinancialAgenda.query.options(joinedload(FinancialAgenda.person)).filter(
        FinancialAgenda.created_at >= inicio, FinancialAgenda.created_at <= fin,
        FinancialAgenda.duplicada_de_id.is_(None), FinancialAgenda.descartada_at.is_(None)) \
        .order_by(FinancialAgenda.created_at, FinancialAgenda.id).all()

    por_persona = {}
    for f in filas:
        fuente = _fuente(f.nombre, setters)
        persona = por_persona.setdefault((fuente, f.person_uuid or f'agenda-{f.id}'), {
            'fuente': fuente, 'dia': f.created_at.date().isoformat(), 'alta': f.created_at.date().isoformat(),
            'asistio': False, 'ultima': None, 'persona': f.nombre_persona, 'origen': f.nombre, 'closer': f.closer,
            'cita': f.date, 'estado': f.estado, 'agenda_id': f.id})
        bucket = bucket_estado(f.estado)
        if bucket == 'Show Up' or not persona['asistio']:
            persona['estado'] = f.estado
        persona['asistio'] = persona['asistio'] or bucket == 'Show Up'
        persona['ultima'] = bucket
        persona['closer'] = f.closer or persona['closer']
        persona['cita'] = f.date or persona['cita']
    personas = list(por_persona.values())
    for p in personas:
        p['con_resultado'] = bool(p['asistio'] or p['ultima'] == 'No Show')
        p['cita'] = p['cita'].isoformat() if p['cita'] else ''
    return personas


def _de_reunion(desde, hasta):
    """Una fila por cita con reunión en el período: las de Closing (`ComercialService.agendas`)."""
    from app.services.comercial_service import ComercialService
    from app.services.procedencia_ingresos_service import setters_conocidos

    setters = setters_conocidos()
    filas = []
    for f in ComercialService.agendas(desde, hasta):
        filas.append({
            'fuente': _fuente(f['fuente'], setters), 'dia': (f['fecha'] or '')[:10], 'alta': (f['creada'] or '')[:10],
            'asistio': bool(f['asistio']), 'con_resultado': bool(f['realizada']), 'ultima': None,
            'persona': f['cliente'], 'origen': f['fuente'], 'closer': f['closer'] if f['closer_id'] else None,
            'cita': f['fecha'] or '', 'estado': f['post_call']['label'], 'agenda_id': f['id'],
            # El lead (la persona, o el cliente sin ella): el show up de Analizar cuenta leads, no llamadas.
            'lead': ('p', f['person_uuid']) if f.get('person_uuid') else ('c', f['client_id'])})
    return [f for f in filas if f['dia']]


def personas(desde, hasta, base=BASE_POR_DEFECTO):
    """Las agendas del período en la base elegida, cada una con su `fuente` (setting, workshop u otras).
    De acá salen las cifras (`por_fuente`) y la lista que se abre al tocarlas: no pueden diferir."""
    return _de_reunion(desde, hasta) if base_de(base) == 'reunion' else _de_alta(desde, hasta)


def por_lead(filas):
    """Una fila por lead, para el show up de la base «reunión» (cuenta leads, no llamadas): la mejor de sus
    llamadas (la que asistió; si no, la que tuvo resultado; si no, la más reciente). Cada lead cuenta en UNA
    sola fuente, así que Setting + Workshop + Otras dan el show up de Analizar. `filas` ya trae `lead`."""
    mejor = {}
    for p in sorted(filas, key=lambda p: p['dia']):
        vigente = mejor.get(p['lead'])
        if vigente is None or (p['asistio'], p['con_resultado']) >= (vigente['asistio'], vigente['con_resultado']):
            mejor[p['lead']] = p
    return list(mejor.values())


def categoria_de_origen(origen):
    """El grupo de una agenda por cómo llegó (su `origen`, el nombre libre de la fuente): los «Referido de X» son
    un solo grupo y lo vacío es «Sin fuente». Es lo que ordena «Otras» (Kerwin, 28/10/2026)."""
    texto = (origen or '').strip()
    if not texto or texto == '—':
        return 'Sin fuente'
    if texto.lower().startswith('referid'):
        return 'Referido'
    return 'VSL' if texto.lower() == 'vsl' else texto


def por_fuente(desde, hasta, base=BASE_POR_DEFECTO):
    """{fuente: {agendas, show_up, reportadas, dias: {fecha: agendas}, origenes}} para setting, workshop y otras.

    `show_up`: asistieron; `reportadas`: con resultado (asistieron + no show), la base del % de show up. En
    reunión esas dos cuentan leads (`por_lead`): una persona que fue a la 1ª y faltó a la 2ª se presentó.
    `origenes`: lo mismo partido por `categoria_de_origen` (la suma de los grupos es la cifra de la fuente)."""
    base = base_de(base)
    filas = personas(desde, hasta, base)
    salida = {k: {'agendas': 0, 'show_up': 0, 'reportadas': 0, 'dias': {}, 'origenes': {}} for k in FUENTES}

    def del_origen(p):
        return salida[p['fuente']]['origenes'].setdefault(
            categoria_de_origen(p['origen']), {'agendas': 0, 'show_up': 0, 'reportadas': 0})

    for p in filas:
        fila = salida[p['fuente']]
        fila['agendas'] += 1
        del_origen(p)['agendas'] += 1
        fila['dias'][p['dia']] = fila['dias'].get(p['dia'], 0) + 1
    for p in (por_lead(filas) if base == 'reunion' else filas):
        salida[p['fuente']]['show_up'] += 1 if p['asistio'] else 0
        salida[p['fuente']]['reportadas'] += 1 if p['con_resultado'] else 0
        del_origen(p)['show_up'] += 1 if p['asistio'] else 0
        del_origen(p)['reportadas'] += 1 if p['con_resultado'] else 0
    for fila in salida.values():
        fila['dias'] = dict(sorted(fila['dias'].items()))
    return salida
