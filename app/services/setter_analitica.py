"""Analizar con Setters: el reporte diario del setter y lo que registra el sistema (10/10/2026).

Es el bloque del tablero de setters (`comercial_analitica.bloque_setters`), el MISMO para la dirección
(Analizar con Setters, una persona o el equipo) y para el setter en su «Mis datos»: un solo cálculo,
una sola pantalla.

Por qué salió de ManyChat
-------------------------
Hasta el 10/10/2026 la conversación se medía con los leads de ManyChat, y esos números estaban mal:
ManyChat marca como «cualificada» casi cualquier respuesta (cualificación ≈ 100%) y cuenta como
respuesta cualquier interacción (tasa de respuesta ≈ 98%, «no todos responden»), así que la
conversión, el embudo y la variabilidad heredaban el error. Kerwin: «los datos centrales son
entrantes, tasa de apertura, cantidad de agendas y % de cualificación», los del reporte diario.

Las dos fuentes, cada una con lo suyo
-------------------------------------
  · **La conversación sale del reporte** (`setter_reporte_v2.leer/sumar`): entrantes, no leads,
    in-abribles, cualificados, aperturas, agendas reportadas, bienvenidas, el embudo dolor → oferta →
    link y los follow-ups con su respuesta.
  · **Lo que pasa después sale del sistema**, con las definiciones de Kerwin del 01/10 (agendas
    generadas por fecha de CREACIÓN, una por persona, `ComercialService.generadas`): canceladas,
    reagendadas, no show, show up y ventas originadas. Son filas, así que abren su lista en Revisar.

La «tasa de respuesta» se fue: el reporte no tiene un «cuántos respondieron» de los entrantes, y el de
ManyChat no es honesto. Lo que sí se carga —la apertura y la respuesta a bienvenidas y a follow-ups—
la reemplaza.

Las vistas por canal
--------------------
El tablero se filtra General · Anuncios · Inbound. Lo que el reporte separa por canal (entrantes, no
leads, in-abribles, aperturas, agendas) va en `canales`; General es todo, también los reportes v1, que
no tienen canal y solo entran ahí (`sin_canal` los muestra aparte, nunca repartidos). El embudo dolor
→ link, las bienvenidas, los follow-ups y el sistema no se pueden separar por canal: son uno solo.
"""
from datetime import date, timedelta

from app.models import SetterDailyStats, User
from app.services import setter_reporte_v2 as reporte_v2
from app.services.comercial_service import ComercialService, pct

CANALES = ('anuncios', 'inbound')
# Lo que una vista del reporte suma: lo que `sumar` trae por canal y en el total.
CAMPOS_VISTA = ('entrantes', 'no_lead', 'inabribles', 'cualificados', 'no_contestaron', 'ap_entrantes', 'ap_dolor',
                'aperturas',
                'agendas')
FOLLOWUPS = ('entrantes', 'dolor', 'oferta', 'link')

# Cuántos «Win del día» muestra la tarjeta: los últimos del período.
ULTIMOS_WINS = 5
# Lo que se escribe en el campo para no dejarlo vacío y no es un win.
WIN_VACIO = {'', '-', '--', '.', '..', '...', 'x', 'no', 'n/a', 'na', 'ninguno', 'ninguna', 'nada', 'ningun'}
# Más de esto no se pinta día por día: 90 días ya son tres meses de puntos.
TOPE_DIAS = 93

# El embudo de punta a punta. `fuente` dice de dónde sale cada número: lo que cargó el setter o lo
# que registra el sistema. El primer paso del sistema (`cruce`) no es una conversión sino la
# comparación entre las agendas reportadas y las generadas: el frontend la marca distinto.
ETAPAS = (
    ('entrantes', 'Entrantes', 'reporte'),
    ('cualificados', 'Cualificados', 'reporte'),
    ('dolor', 'Dolor', 'reporte'),
    ('oferta', 'Oferta', 'reporte'),
    ('link', 'Link', 'reporte'),
    ('agendas', 'Agendas', 'reporte'),
    ('generadas', 'Generadas', 'sistema'),
    ('asistieron', 'Asistieron', 'sistema'),
    ('ventas', 'Ventas', 'sistema'),
)


def lecturas_por_setter(start, end, setter_ids=None):
    """`{setter_id: [(lectura, fila)]}` con los reportes del período, en una sola consulta.

    Solo los de usuarios con rol setter, activos o no: es el mismo criterio con el que el sistema
    cuenta las agendas generadas del equipo (`ComercialService.agendas(de_setters=True)`), así el
    equipo del reporte y el del sistema son la misma gente. Una fila que alguien de la dirección
    cargó probando el formulario no es trabajo de setting.

    `setter_ids` acota a esas personas; una lista vacía no trae nada (nunca «todos»).
    """
    q = SetterDailyStats.query.join(User, User.id == SetterDailyStats.setter_id).filter(
        User.role == 'setter', SetterDailyStats.date >= start, SetterDailyStats.date <= end)
    if setter_ids is not None:
        if not setter_ids:
            return {}
        q = q.filter(SetterDailyStats.setter_id.in_(list(setter_ids)))
    salida = {}
    for fila in q.order_by(SetterDailyStats.date, SetterDailyStats.id).all():
        salida.setdefault(fila.setter_id, []).append((reporte_v2.leer(fila), fila))
    return salida


def pares_de(start, end, setter_id=None):
    """Los reportes del período de un setter, o de todo el equipo de setting con `setter_id=None`."""
    por_setter = lecturas_por_setter(start, end, [setter_id] if setter_id else None)
    return [p for filas in por_setter.values() for p in filas]


def dias_habiles(start, end):
    """De lunes a viernes: contra eso se mide cuántos días reportó."""
    return sum(1 for i in range((end - start).days + 1) if (start + timedelta(days=i)).weekday() < 5)


def vista_de(d, link=None, respuesta=None):
    """Los números de una vista del reporte —General o un canal— con sus tasas, todas sobre los
    entrantes salvo la de cualificado a agenda, que es la del formulario.

    `conversion` es la conversión final: agendas reportadas sobre entrantes reportados, las dos
    cosas del reporte y de la misma vista. Antes se medía con los leads de ManyChat contra las
    agendas, dos fuentes que no cuentan lo mismo.

    `link` (el embudo) es un total del reporte, sin canal: solo la vista General lo trae, y en un
    canal `conv_link` queda en None («—»), no se calcula con el link de los dos canales.

    `respuesta` (de `sumar`, `respuesta_aperturas`) es la respuesta a las aperturas que pidió el dueño
    el 15/10/2026: respondidas sobre las aperturas de los reportes que cargaron cuántos respondieron.
    Sin ninguno, None («—»).
    """
    v = {k: d[k] for k in CAMPOS_VISTA}
    entrantes = v['entrantes']
    resp = respuesta or {'aperturas': 0, 'respondidas': None}
    v.update({
        'cualificacion': pct(v['cualificados'], entrantes),
        'no_contestaron_pct': pct(v['no_contestaron'], entrantes),
        'no_lead_pct': pct(v['no_lead'], entrantes),
        'inabribles_pct': pct(v['inabribles'], entrantes),
        'apertura': pct(v['aperturas'], entrantes),
        'ap_respondidas': resp['respondidas'],
        'ap_con_respuesta': resp['aperturas'],
        'respuesta_aperturas': pct(resp['respondidas'], resp['aperturas']) if resp['respondidas'] is not None else None,
        'conversion': pct(v['agendas'], entrantes),
        'conv_cualificados': pct(v['agendas'], v['cualificados']),
        'link': link,
        'conv_link': pct(v['agendas'], link) if link is not None else None,
    })
    return v


def followups_de(suma):
    """Los follow-ups por etapa con su respuesta. `followups_respondidos` lo agrega el reporte
    (`setter_reporte_v2.sumar`); mientras no esté, la respuesta es None («—»): no se deduce de otra
    cosa."""
    respondidos = suma.get('followups_respondidos')
    etapas = []
    for k in FOLLOWUPS:
        hechos = suma['followups'][k]
        r = respondidos.get(k) if respondidos else None
        etapas.append({'key': k, 'hechos': hechos, 'respondidos': r,
                       'respuesta': pct(r, hechos) if r is not None else None})
    total = sum(e['hechos'] for e in etapas)
    total_resp = sum(e['respondidos'] for e in etapas) if respondidos else None
    return {'etapas': etapas, 'total': total, 'respondidos': total_resp,
            'respuesta': pct(total_resp, total) if total_resp is not None else None}


def despues_de(generadas):
    """Lo que pasó con las agendas generadas: las mismas filas que lista Revisar › Agendas, una por
    persona y por fecha de creación (`ComercialService.generadas`).

    Corrección del dueño (15/10/2026): «fijate que acá solamente aparezcan las que ya se dieron, no
    las que todavía no se dieron». El panel parte de las agendas que YA SE DIERON (`ocurridas`): la
    hora de la llamada ya pasó, o se canceló o reagendó (eso ya pasó aunque la llamada fuera a ser
    la semana que viene). Las que todavía no ocurrieron quedan aparte (`por_venir`), y de las que
    ocurrieron, las que nadie reportó (`sin_reporte`): son la diferencia entre las agendas y los
    estados. `generadas` sigue siendo todas: es el cruce del embudo con las agendas reportadas.

    Las canceladas y las reagendadas se miden sobre las ocurridas; el show up y el no show, sobre
    las que ya tienen resultado (`realizadas`), que es el show up de todo el tablero. Las ventas,
    sobre las que asistieron.
    """
    tot = ComercialService.totales_agendas(generadas)
    cuenta = {}
    for f in generadas:
        cuenta[f['post_call']['key']] = cuenta.get(f['post_call']['key'], 0) + 1
    n = tot['agendas']
    ocurridas = [f for f in generadas if f.get('ya_paso') or f['post_call']['key'] in ('cancelo', 'reagendo')]
    sin_reporte = sum(1 for f in ocurridas if f['post_call']['key'] == 'pendiente')
    base = len(ocurridas)
    return {
        'generadas': n,
        'ocurridas': base,
        'por_venir': n - base,
        'sin_reporte': sin_reporte,
        'canceladas': cuenta.get('cancelo', 0),
        'canceladas_pct': pct(cuenta.get('cancelo', 0), base),
        'reagendadas': cuenta.get('reagendo', 0),
        'reagendadas_pct': pct(cuenta.get('reagendo', 0), base),
        'realizadas': tot['realizadas'],
        'no_show': tot['no_show'],
        'no_show_pct': tot['no_show_pct'],
        'asistieron': tot['asistieron'],
        'show_up': tot['show_up'],
        'ventas_originadas': tot['ventas'],
        'cierre': tot['close_rate'],
        'senas': tot['senas'],
    }


def embudo_de(suma, despues):
    """Las nueve etapas, cada una con su conversión contra la anterior (`tasa`, None en la primera).

    `suma` es un `sumar` y `despues` un `despues_de`. Las agendas reportadas llevan su reparto por
    canal (`partes`), con lo de los reportes v1 aparte: el mismo número, partido, nunca repartido a
    ojo.
    """
    emb = suma['embudo']
    valores = {'entrantes': suma['totales']['entrantes'],
               **{k: emb[k] for k in ('cualificados', 'dolor', 'oferta', 'link', 'agendas')},
               'generadas': despues['generadas'], 'asistieron': despues['asistieron'],
               'ventas': despues['ventas_originadas']}
    etapas, anterior = [], None
    for key, label, fuente in ETAPAS:
        n = valores[key]
        etapa = {'key': key, 'label': label, 'fuente': fuente, 'n': n,
                 'tasa': pct(n, anterior) if anterior is not None else None}
        if key == 'agendas':
            etapa['partes'] = [
                {'key': 'anuncios', 'n': suma['canales']['anuncios']['agendas']},
                {'key': 'inbound', 'n': suma['canales']['inbound']['agendas']},
                {'key': 'sin_canal', 'n': suma['sin_canal']['agendas']},
            ]
        if key == 'generadas':
            etapa['cruce'] = True
        etapas.append(etapa)
        anterior = n
    return etapas


def _win_de(lectura, fila):
    """El «Win del día» de un reporte, v2 o v1 (el v1 lo guardaba como `win_of_day`), o None si
    es uno de los rellenos con los que se deja el campo «completo» («-», «no», «ninguno»)."""
    texto = lectura['reflexion'].get('win_del_dia') or ''
    if not texto and isinstance(fila.reflections, dict):
        texto = fila.reflections.get('win_of_day') or ''
    texto = str(texto).strip()
    return None if texto.lower().strip(' .!-') in WIN_VACIO else texto


def wins_de(pares, cuantos=ULTIMOS_WINS):
    """Los últimos «Win del día» con texto, del más nuevo al más viejo."""
    salida = []
    for lectura, fila in sorted(pares, key=lambda p: (p[0]['fecha'] or '', p[0]['id'] or 0), reverse=True):
        texto = _win_de(lectura, fila)
        if texto:
            salida.append({'fecha': lectura['fecha'], 'texto': texto})
        if len(salida) >= cuantos:
            break
    return salida


def dias_de(lecturas, start, end):
    """Constancia: cuántos días reportó contra los hábiles del período, y el detalle día por día
    (`reportado`, `no_laborable`, `falta` o `finde`) para pintarlo. Un día con dos reportes del
    equipo cuenta una vez en el detalle; `reportes` cuenta filas, como `sumar`."""
    por_dia = {}
    for l in lecturas:
        estado = 'no_laborable' if l['no_laborable'] else 'reportado'
        if por_dia.get(l['fecha']) != 'reportado':
            por_dia[l['fecha']] = estado
    total = (end - start).days + 1
    detalle = []
    if total <= TOPE_DIAS:
        for i in range(total):
            dia = start + timedelta(days=i)
            clave = dia.isoformat()
            detalle.append({'fecha': clave, 'estado': por_dia.get(clave) or ('finde' if dia.weekday() >= 5 else 'falta')})
    reportados = [f for f, e in por_dia.items() if e == 'reportado']
    return {
        'habiles': dias_habiles(start, end),
        'periodo': total,
        'reportados': len(reportados),
        'no_laborables': sum(1 for e in por_dia.values() if e == 'no_laborable'),
        'en_fin_de_semana': sum(1 for f in reportados if date.fromisoformat(f).weekday() >= 5),
        'detalle': detalle,
    }


def bloque(start, end, setter_id=None, pares=None):
    """Todos los números del tablero de setters de un período, para un setter o para el equipo.

    Arriba, en plano, la vista General (la que rankea Comparativas y la que lleva deltas); en
    `canales`, la de anuncios y la de inbound. `pares` son los reportes ya leídos (Comparativas lee
    los de todo el equipo una sola vez y los reparte); sin ellos se leen acá.
    """
    if pares is None:
        pares = pares_de(start, end, setter_id)
    lecturas = [l for l, _ in pares]
    suma = reporte_v2.sumar(lecturas)
    despues = despues_de(ComercialService.generadas(start, end, setter_id=setter_id))
    fu = followups_de(suma)
    bnv = suma['bienvenidas']
    sin_canal = suma['sin_canal']
    resp = suma['respuesta_aperturas']
    resp_bnv = resp['bienvenidas']
    return {
        **vista_de(suma['totales'], link=suma['embudo']['link'], respuesta=resp['total']),
        'canales': {c: vista_de(suma['canales'][c], respuesta=resp[c]) for c in CANALES},
        'sin_canal': {**sin_canal, 'apertura': pct(sin_canal['aperturas'], sin_canal['entrantes']),
                      'respuesta_aperturas': (pct(resp['sin_canal']['respondidas'], resp['sin_canal']['aperturas'])
                                              if resp['sin_canal']['respondidas'] is not None else None)},
        'reportes': suma['reportes'],
        'reportes_v2': suma['reportes_v2'],
        'no_laborables': suma['no_laborables'],
        'embudo': {k: suma['embudo'][k] for k in ('dolor', 'oferta', 'link')},
        'bienvenidas': {**bnv, 'respuesta': pct(bnv['respondidas'], bnv['hechas']),
                        'apertura': pct(bnv['aperturas'], bnv['respondidas']),
                        'aperturas_resp': resp_bnv['respondidas'],
                        'respuesta_aperturas': (pct(resp_bnv['respondidas'], resp_bnv['aperturas'])
                                                if resp_bnv['respondidas'] is not None else None)},
        'bienvenidas_respuesta': pct(bnv['respondidas'], bnv['hechas']),
        'followups': fu,
        'followups_total': fu['total'],
        **despues,
        'funnel': embudo_de(suma, despues),
        'dias': dias_de(lecturas, start, end),
        'wins': wins_de(pares),
    }


def comision_de(miembro):
    """La comisión del MES EN CURSO (no del período elegido), la que «Mis agendas» mostraba hasta el
    10/10/2026: la de un setter, o la suma de los setters activos para el equipo. La tasa del equipo
    va solo si es la misma para todos; si no, None (el total es lo que importa)."""
    from app.services.commission_service import CommissionService
    if miembro is not None:
        return CommissionService.get_setter_commission(miembro) if miembro.role == 'setter' else None
    setters = User.query.filter_by(role='setter', is_active=True).all()
    partes = [CommissionService.get_setter_commission(u) for u in setters]
    if not partes:
        return None
    tasas = {p['rate'] for p in partes}
    return {'role': 'setter', 'month': partes[0]['month'], 'rate': tasas.pop() if len(tasas) == 1 else None,
            'cash_neto': round(sum(p['cash_neto'] for p in partes), 2),
            'commission': round(sum(p['commission'] for p in partes), 2)}


# ================================================================================================
# VARIABILIDAD — las mismas fuentes, día por día
# ================================================================================================

def _por_dia(lecturas, dias, valor):
    """Una serie diaria sobre el eje de `dias`: suma `valor(lectura)` de los reportes de cada día."""
    acumulado = {}
    for l in lecturas:
        if l['fecha']:
            acumulado[l['fecha']] = acumulado.get(l['fecha'], 0) + valor(l)
    return [acumulado.get(d, 0) for d in dias]


def _de_canal(canal, campo):
    """El valor de un campo en una lectura: el total (General) o el de un canal. Un reporte v1 no
    tiene canales y aporta cero a los canales: entra solo en General."""
    if canal is None:
        return lambda l: l['totales'][campo]
    return lambda l: (l['canales'][canal][campo] if l['canales'] else 0)


def _tasa(num, den):
    """Una tasa día por día. Un día sin denominador da 0 y cuenta como día sin movimiento, como en
    el resto de Variabilidad (ver `comercial_analitica`)."""
    return [round(n / d * 100, 1) if d else 0 for n, d in zip(num, den)]


def series(dias, start, end, setter_id=None):
    """Las series de la pestaña Variabilidad para setters. Las del reporte se abren por canal
    (Todos · Anuncios · Inbound) cuando hay algún reporte v2 en el período: sin ninguno, la tira
    tendría dos pestañas en cero."""
    lecturas = [l for l, _ in pares_de(start, end, setter_id) if not l['no_laborable']]
    generadas = ComercialService.generadas(start, end, setter_id=setter_id)
    con_canal = any(l['version'] == 2 for l in lecturas)
    # «Todos» va en el tono de la serie; los canales, en el de cada uno en todo el tablero.
    canales = [('Anuncios', 'anuncios', 'cat-1'), ('Inbound', 'inbound', 'cat-2')] if con_canal else []

    def vistas(tono):
        return [('Todos', None, tono)] + canales

    def conteo(campo, tono):
        return [{'label': label, 'tone': t, 'vals': _por_dia(lecturas, dias, _de_canal(canal, campo))}
                for label, canal, t in vistas(tono)]

    def tasa(num, den, tono):
        return [{'label': label, 'tone': t,
                 'vals': _tasa(_por_dia(lecturas, dias, _de_canal(canal, num)),
                               _por_dia(lecturas, dias, _de_canal(canal, den)))}
                for label, canal, t in vistas(tono)]

    def unica(subs):
        """Con una sola vista no hay tira: la serie va sola, como el resto de Variabilidad."""
        return {'series': subs} if len(subs) > 1 else {'vals': subs[0]['vals']}

    bnv_hechas = _por_dia(lecturas, dias, lambda l: (l['bienvenidas'] or {}).get('hechas', 0))
    bnv_resp = _por_dia(lecturas, dias, lambda l: (l['bienvenidas'] or {}).get('respondidas', 0))
    # Las generadas, por el día en que se RESERVARON (ver `ComercialService.generadas`): así la serie
    # suma el mismo número que el tablero.
    por_creacion = {}
    for f in generadas:
        if f.get('creada'):
            por_creacion[f['creada'][:10]] = por_creacion.get(f['creada'][:10], 0) + 1

    return [
        {'key': 'entrantes', 'label': 'Entrantes', 'unidad': '', 'tone': 'info',
         'help': 'Mensajes nuevos reportados cada día.', **unica(conteo('entrantes', 'info'))},
        {'key': 'cualificacion', 'label': 'Cualificación', 'unidad': '%', 'tone': 'success', 'tipo': 'tasa',
         'help': 'Cualificados sobre entrantes de cada día. Cero: día sin entrantes.',
         **unica(tasa('cualificados', 'entrantes', 'success'))},
        {'key': 'apertura', 'label': 'Apertura', 'unidad': '%', 'tone': 'warning', 'tipo': 'tasa',
         'help': 'Aperturas sobre entrantes de cada día. Cero: día sin entrantes.',
         **unica(tasa('aperturas', 'entrantes', 'warning'))},
        {'key': 'agendas', 'label': 'Agendas', 'unidad': '', 'tone': 'brand-secondary',
         'help': 'Agendas reportadas cada día.', **unica(conteo('agendas', 'brand-secondary'))},
        {'key': 'generadas', 'label': 'Agendas generadas', 'unidad': '', 'tone': 'cat-3',
         'help': 'Del sistema: reservadas cada día, una por persona. Sin separar por canal.',
         'vals': [por_creacion.get(d, 0) for d in dias]},
        {'key': 'bienvenidas', 'label': 'Bienvenidas', 'unidad': '%', 'tone': 'cat-4', 'tipo': 'tasa',
         'help': 'Bienvenidas respondidas sobre hechas, cada día. Sin separar por canal.',
         'vals': _tasa(bnv_resp, bnv_hechas)},
    ]
