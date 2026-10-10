"""«Mis datos» del setter (10/10/2026): lo que reportó y lo que registra el sistema, lado a lado.

Por qué existe
--------------
Hasta acá «Mis datos» era el Analizar del dashboard comercial con el rol setters: todo salía del
sistema (los leads de ManyChat y las agendas generadas) y del reporte diario no se veía nada. Y la
Vista General de /admin/ventas › Setters, donde la dirección analiza a los setters, mostraba el
reporte y casi nada del sistema. Kerwin: «hay muchos datos del reporte diario que no se ven, el
embudo está incompleto, hay datos que no cuadran». Medido en septiembre de 2026 (copia de la base):

  · Elias reportó 971 entrantes; ManyChat le registra 696 leads. Paula, 640 contra 484.
  · El tile «Agendas» de «Mis datos» decía 40 (leads del período que agendaron con él), Elias
    reportó 75 y el sistema le registra 68 agendas generadas: tres números con el mismo nombre.
  · El embudo iba Entrantes → Respondieron → Cualificados → Agendaron, todo de ManyChat, y en los
    datos «Respondieron» y «Cualificados» dan lo mismo (662 = 662): Dolor, Oferta y Link —lo que el
    setter carga todos los días— no aparecían.

Lo que no cuadraba no es un error de cuenta: son dos fuentes que miden cosas distintas. Por eso
esta vista no las mezcla: el reporte (lo que el setter cargó, `setter_reporte_v2`) y el sistema
(`ComercialService`, con las definiciones de Kerwin del 01/10: agendas generadas por fecha de
CREACIÓN, una por persona) van cada uno con su nombre, y donde miden lo mismo se ponen juntos con la
diferencia a la vista («reportaste 75 · el sistema registra 68»).

Los reportes v1 (sin canal) suman en los totales y, en lo que va por canal, aparecen aparte como
«sin canal» (`sumar` los deja en `sin_canal`): nunca se reparten entre anuncios e inbound.

El mismo embudo de punta a punta es el que Comparativas dibuja para cada setter y para el equipo
(`embudo_de`): Entrantes → Cualificados → Dolor → Oferta → Link → Agendas, del reporte, y Generadas
→ Asistieron → Ventas, del sistema. Los reportes se leen con UNA consulta para todo el equipo
(`lecturas_por_setter`), porque Comparativas ya recorre las agendas persona por persona.
"""
from datetime import date, timedelta

from app.models import SetterDailyStats, User
from app.services import setter_reporte_v2 as reporte_v2
from app.services.comercial_analitica import delta
from app.services.comercial_service import ComercialService, pct

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

# Las métricas que llevan delta contra el período comparado: 'pts' para tasas, 'pct' para conteos.
DELTAS = {
    'entrantes': 'pct', 'cualificacion': 'pts', 'apertura': 'pts', 'agendas': 'pct',
    'bienvenidas_respuesta': 'pts', 'followups': 'pct', 'conversion': 'pts',
    'generadas': 'pct', 'show_up': 'pts', 'ventas': 'pct', 'leads': 'pct',
}


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


def dias_habiles(start, end):
    """De lunes a viernes: contra eso se mide cuántos días reportó."""
    return sum(1 for i in range((end - start).days + 1) if (start + timedelta(days=i)).weekday() < 5)


def reporte_de(lecturas):
    """`sumar` del período más las tasas que muestra la pantalla, todas sobre lo mismo que el
    formulario: cualificación y apertura sobre los entrantes, la de las bienvenidas sobre las hechas
    y sus aperturas sobre las que respondieron. Una tasa sin denominador es None («—»), no 0%."""
    s = reporte_v2.sumar(lecturas)
    tot, bnv = s['totales'], s['bienvenidas']
    for datos in list(s['canales'].values()) + [s['sin_canal']]:
        datos['cualificacion'] = pct(datos['cualificados'], datos['entrantes'])
        datos['apertura'] = pct(datos['aperturas'], datos['entrantes'])
    s['tasas'] = {
        'cualificacion': pct(tot['cualificados'], tot['entrantes']),
        'apertura': pct(tot['aperturas'], tot['entrantes']),
        'bienvenidas_respuesta': pct(bnv['respondidas'], bnv['hechas']),
        'bienvenidas_apertura': pct(bnv['aperturas'], bnv['respondidas']),
        # De cualificados a agenda, como el «de cualificados a agenda» del formulario.
        'conversion': pct(tot['agendas'], tot['cualificados']),
    }
    s['followups_total'] = sum(s['followups'].values())
    return s


def sistema_de(start, end, setter_id=None, setter_nombre=None):
    """Lo que registra el sistema para el setter (o el equipo de setting), con las definiciones de
    `comercial_analitica.bloque_setters`: las mismas filas que lista Revisar."""
    generadas = ComercialService.totales_agendas(ComercialService.generadas(start, end, setter_id=setter_id))
    leads = ComercialService.totales_leads(
        ComercialService.leads(start, end, setter_nombre=setter_nombre, setter_id=setter_id))
    return {
        'leads': leads['leads'],
        'agendaron': leads['agendas'],
        'generadas': generadas['agendas'],
        'realizadas': generadas['realizadas'],
        'asistieron': generadas['asistieron'],
        'show_up': generadas['show_up'],
        'ventas': generadas['ventas'],
        'senas': generadas['senas'],
    }


def embudo_de(reporte, sistema):
    """Las nueve etapas, cada una con su conversión contra la anterior (`tasa`, None en la primera).

    `reporte` es un `sumar` (o `reporte_de`) y `sistema` cualquier dict con `generadas`,
    `asistieron` y `ventas`. Las agendas reportadas llevan su reparto por canal (`partes`), con lo
    de los reportes v1 aparte: el mismo número, partido, nunca repartido a ojo.
    """
    emb = reporte['embudo']
    valores = {'entrantes': reporte['totales']['entrantes'], **{k: emb[k] for k in
               ('cualificados', 'dolor', 'oferta', 'link', 'agendas')},
               'generadas': sistema['generadas'], 'asistieron': sistema['asistieron'],
               'ventas': sistema['ventas']}
    etapas, anterior = [], None
    for key, label, fuente in ETAPAS:
        n = valores[key]
        etapa = {'key': key, 'label': label, 'fuente': fuente, 'n': n,
                 'tasa': pct(n, anterior) if anterior is not None else None}
        if key == 'agendas':
            etapa['partes'] = [
                {'key': 'anuncios', 'n': reporte['canales']['anuncios']['agendas']},
                {'key': 'inbound', 'n': reporte['canales']['inbound']['agendas']},
                {'key': 'sin_canal', 'n': reporte['sin_canal']['agendas']},
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


def contraste_de(reporte, sistema):
    """Donde el reporte y el sistema miden lo mismo, juntos y con su diferencia. Es la respuesta a
    «hay datos que no cuadran»: cada uno con su definición, en vez de un número que cambia según la
    pantalla."""
    filas = [
        {'key': 'agendas', 'label': 'Agendas', 'reportado': reporte['totales']['agendas'],
         'sistema': sistema['generadas'],
         'definicion': 'Agendas generadas: las que reservaste en el período, por fecha de creación '
                       'y una por persona aunque haya reagendado.'},
        {'key': 'entrantes', 'label': 'Entrantes', 'reportado': reporte['totales']['entrantes'],
         'sistema': sistema['leads'],
         'definicion': 'Leads de ManyChat asignados a vos. El reporte cuenta todos los mensajes '
                       'nuevos del día, también los que no pasaron por ManyChat.'},
    ]
    for f in filas:
        f['diferencia'] = f['reportado'] - f['sistema']
    return filas


def _plano(reporte, sistema):
    """Las cifras con delta, en un solo dict, para comparar dos períodos con `delta`."""
    return {
        'entrantes': reporte['totales']['entrantes'], 'cualificacion': reporte['tasas']['cualificacion'],
        'apertura': reporte['tasas']['apertura'], 'agendas': reporte['totales']['agendas'],
        'bienvenidas_respuesta': reporte['tasas']['bienvenidas_respuesta'],
        'followups': reporte['followups_total'], 'conversion': reporte['tasas']['conversion'],
        'generadas': sistema['generadas'], 'show_up': sistema['show_up'], 'ventas': sistema['ventas'],
        'leads': sistema['leads'],
    }


def mis_datos(setter_id, start, end, prev_start=None, prev_end=None):
    """Todo «Mis datos» de un setter, o del equipo de setting con `setter_id=None` (solo la
    dirección llega a pedir eso: a un setter `alcance_de` le fija siempre su id).

    Un setter sin reportes ni agendas ve ceros: sus lecturas son una lista vacía, nunca «todas»
    (la fuga del conjunto vacío de la cartera, 24/09/2026).
    """
    miembro = User.query.get(setter_id) if setter_id else None
    nombre = miembro.username if miembro else None
    ids = [setter_id] if setter_id else None

    pares = [p for filas in lecturas_por_setter(start, end, ids).values() for p in filas]
    lecturas = [l for l, _ in pares]
    reporte = reporte_de(lecturas)
    sistema = sistema_de(start, end, setter_id, nombre)

    previo, deltas = None, {}
    if prev_start:
        lecturas_previas = [l for filas in lecturas_por_setter(prev_start, prev_end, ids).values() for l, _ in filas]
        rep_prev = reporte_de(lecturas_previas)
        sis_prev = sistema_de(prev_start, prev_end, setter_id, nombre)
        previo = {'reporte': {'totales': rep_prev['totales'], 'tasas': rep_prev['tasas'],
                              'followups_total': rep_prev['followups_total']},
                  'sistema': sis_prev}
        actual_plano, previo_plano = _plano(reporte, sistema), _plano(rep_prev, sis_prev)
        for clave, modo in DELTAS.items():
            d = delta(actual_plano[clave], previo_plano[clave], modo)
            if d:
                deltas[clave] = d

    comision = None
    if miembro and miembro.role == 'setter':
        from app.services.commission_service import CommissionService
        comision = CommissionService.get_setter_commission(miembro)

    return {
        'rol': 'setters',
        'miembro': {'id': miembro.id, 'nombre': miembro.username} if miembro else None,
        'reporte': reporte,
        'sistema': sistema,
        'embudo': embudo_de(reporte, sistema),
        'contraste': contraste_de(reporte, sistema),
        'dias': dias_de(lecturas, start, end),
        'wins': wins_de(pares),
        'comision': comision,
        'previo': previo,
        'deltas': deltas,
    }


def embudos_de_comparativa(miembros, bloques, bloque_equipo, start, end):
    """Los embudos del bloque «Embudos» de Comparativas: uno por setter y el del equipo.

    `bloques` es `{id: bloque_setters}` de cada persona y `bloque_equipo` el del equipo, ya
    calculados por `comparativas`: de ahí salen generadas, asistieron y ventas sin volver a recorrer
    las agendas. Los reportes se leen UNA vez para todos.

    La fila del equipo NO suma las etapas de las filas: suma los reportes de todos los setters
    (también los de alguien que ya no está activo, como hace el sistema con sus agendas) y sus
    conversiones salen de esos totales, igual que las tasas de la fila «Equipo» del mapa.
    """
    lecturas = lecturas_por_setter(start, end)

    def sistema(b):
        return {'generadas': b['generadas'], 'asistieron': b['asistieron'], 'ventas': b['ventas_originadas']}

    filas = [{'id': m['id'], 'nombre': m['nombre'],
              'etapas': embudo_de(reporte_v2.sumar([l for l, _ in lecturas.get(m['id'], [])]),
                                  sistema(bloques[m['id']]))}
             for m in miembros]
    todas = [l for pares in lecturas.values() for l, _ in pares]
    return {'filas': filas,
            'equipo': {'id': 'equipo', 'nombre': 'Equipo',
                       'etapas': embudo_de(reporte_v2.sumar(todas), sistema(bloque_equipo))}}
