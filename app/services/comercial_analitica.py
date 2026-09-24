"""Analizar y Comparativas del dashboard comercial.

Vive aparte de `comercial_service.py` (que arma las filas: agendas, ventas y leads) porque son
dos responsabilidades distintas y juntas pasaban las 800 líneas: acá no se consulta nada nuevo,
se agregan las mismas filas que muestra Revisar. Esa es la razón de que los números cierren —
el show up de la tarjeta de arriba y el de "Totales de lo filtrado" salen del mismo conteo.

Los deltas se calculan pidiendo el MISMO bloque para el período comparado, en vez de tener una
segunda fórmula por métrica: si una definición cambia, cambia para los dos lados a la vez.
"""
from datetime import date, timedelta

from sqlalchemy import func

from app import db
from app.models import FinancialSale, User
from app.services.closer_dashboard_service import CloserDashboardService
from app.services.comercial_service import (
    DIAS_SENA_CAIDA, POST_CALL, ROL_CLOSERS, ROL_SETTERS, TIPOS_PAGO, ComercialService,
    _limpiar_email, _limpiar_ig, chip, pct,
)
from app.services.commission_service import CLOSER_RATE

# Qué métricas llevan badge de delta y cómo se lee la diferencia: 'pts' para las tasas (la
# diferencia entre dos porcentajes son puntos, no un porcentaje) y 'pct' para montos y conteos.
DELTAS = {
    ROL_CLOSERS: {'show_up': 'pts', 'close_rate': 'pts', 'cash': 'pct', 'ventas': 'pct',
                  'ticket': 'pct', 'agendas': 'pct', 'comision': 'pct'},
    ROL_SETTERS: {'leads': 'pct', 'respuesta': 'pts', 'cualificacion': 'pts', 'agendas': 'pct',
                  'conversion': 'pts', 'generadas': 'pct', 'mensajes': 'pct'},
}

# Las métricas rankeables, en el orden en que las muestra el selector del ranking. `suma`
# distingue las que se totalizan para el equipo (cash, ventas) de las tasas, que no se suman.
METRICAS = {
    ROL_CLOSERS: [
        {'key': 'cash', 'label': 'Cash collected', 'formato': 'money', 'suma': True,
         'desc': 'Todo lo cobrado en el período: ventas nuevas, cuotas y señas.'},
        {'key': 'show_up', 'label': 'Show up', 'formato': 'pct', 'suma': False,
         'desc': 'De las llamadas con resultado, cuántas asistieron.'},
        {'key': 'close_rate', 'label': 'Close rate', 'formato': 'pct', 'suma': False,
         'desc': 'De los que asistieron, cuántos compraron.'},
        {'key': 'ticket', 'label': 'Ticket promedio', 'formato': 'money', 'suma': False,
         'desc': 'Cash dividido por las ventas cerradas.'},
        {'key': 'comision', 'label': 'Comisión', 'formato': 'money', 'suma': True,
         'desc': '10% del cash neto, ya descontadas las fees de la pasarela.'},
        {'key': 'senas_conversion', 'label': 'Conversión de señas', 'formato': 'pct', 'suma': False,
         'desc': 'De las señas del período, cuántas terminaron en una venta.'},
        {'key': 'agendas', 'label': 'Agendas', 'formato': 'num', 'suma': True,
         'desc': 'Llamadas agendadas en el período.'},
    ],
    ROL_SETTERS: [
        {'key': 'leads', 'label': 'Leads', 'formato': 'num', 'suma': True,
         'desc': 'Prospectos entrantes del período.'},
        {'key': 'respuesta', 'label': 'Respuesta', 'formato': 'pct', 'suma': False,
         'desc': 'De los leads entrantes, cuántos contestaron.'},
        {'key': 'cualificacion', 'label': 'Cualificación', 'formato': 'pct', 'suma': False,
         'desc': 'De los que contestaron, cuántos cualificaron.'},
        {'key': 'agendas', 'label': 'Agendas', 'formato': 'num', 'suma': True,
         'desc': 'Leads que llegaron a agendar una llamada.'},
        {'key': 'conversion', 'label': 'Conv. final', 'formato': 'pct', 'suma': False,
         'desc': 'De entrante a agenda, punta a punta.'},
        {'key': 'show_up', 'label': 'Show up', 'formato': 'pct', 'suma': False,
         'desc': 'De las agendas que generó, cuántas asistieron.'},
        {'key': 'ventas_originadas', 'label': 'Ventas originadas', 'formato': 'num', 'suma': True,
         'desc': 'Ventas salidas de las agendas que generó.'},
    ],
}

# Columnas informativas del mapa del equipo: no rankean, solo describen de qué está hecha la
# mezcla de cada persona. Reemplazan a las barras de mezcla de pagos y programas del diseño
# anterior, que ocupaban mucho y no permitían comparar a nadie con nadie.
COLUMNAS_INFO = {
    ROL_CLOSERS: [
        {'key': 'completo_pct', 'label': 'Pago compl.', 'formato': 'pct',
         'desc': 'Qué parte de sus ventas se cobró en un solo pago.'},
        {'key': 'residency_pct', 'label': 'Residency', 'formato': 'pct',
         'desc': 'Qué parte de sus ventas fue Residency Roadmap, el programa de mayor ticket.'},
    ],
    ROL_SETTERS: [
        {'key': 'mensajes', 'label': 'Mensajes', 'formato': 'num',
         'desc': 'Cuántos mensajes mandó en total en el período.'},
    ],
}


def delta(actual, previo, modo):
    """Diferencia contra el período comparado. None cuando no hay contra qué comparar, o cuando
    el valor anterior es cero y el porcentaje sería infinito."""
    if actual is None or previo is None:
        return None
    if modo == 'pts':
        return {'valor': round(actual - previo, 1), 'modo': 'pts'}
    if not previo:
        return None
    return {'valor': round((actual - previo) / previo * 100, 1), 'modo': 'pct'}


def senas_de(filas_ventas):
    """En qué terminó cada seña del período.

    Una seña es una reserva, no una venta: lo que importa es si después se completó. No hay
    ninguna columna que lo diga, así que se resuelve buscando, para el mismo contacto, una venta
    posterior de tipo completo o parcial. Las que no aparecen quedan "en espera" mientras sean
    recientes y "caída" pasados `DIAS_SENA_CAIDA` días — es la única señal real de que el lead
    no va a volver (ver la constante).

    La antigüedad se mide contra HOY, no contra el fin del período: una seña de agosto mirada en
    diciembre lleva cuatro meses sin completarse, sea cual sea el filtro con el que se la mire.

    `desbloqueado` es el cash de esas ventas posteriores: la plata que la seña destrabó, que es
    el argumento para seguir pidiéndolas.
    """
    senas = [f for f in filas_ventas if f['tipo_pago']['key'] == 'seña']
    vacio = {'total': 0, 'completo': 0, 'parcial': 0, 'espera': 0, 'caida': 0,
             'cobrado': 0.0, 'ticket': None, 'desbloqueado': 0.0, 'conversion': None}
    if not senas:
        return vacio

    contactos = {}
    for f in senas:
        for clave in (_limpiar_email(f['email']), _limpiar_ig(f['ig'])):
            if clave:
                contactos.setdefault(clave, []).append(f)
    cobrado = sum(f['monto'] for f in senas)
    if not contactos:
        # Sin email ni instagram no hay forma de saber si se convirtió: se cuentan como en
        # espera en vez de darlas por caídas.
        return {**vacio, 'total': len(senas), 'espera': len(senas), 'cobrado': round(cobrado, 2),
                'ticket': round(cobrado / len(senas), 2)}

    claves = sorted(contactos)
    posteriores = FinancialSale.query.filter(
        db.or_(func.lower(FinancialSale.mail_cliente).in_(claves),
               func.lower(func.replace(FinancialSale.instagram, '@', '')).in_(claves))
    ).all()

    # Primera venta real de cada contacto, para no contar dos veces al mismo lead.
    conversion = {}
    for v in posteriores:
        if (v.estado or '').strip().lower() not in ('', 'completada', 'confirmada'):
            continue
        _, tipo, es_venta = ComercialService.clasificar_venta(v)
        if not es_venta or not v.date:
            continue
        for clave in (_limpiar_email(v.mail_cliente), _limpiar_ig(v.instagram)):
            if clave in contactos:
                previa = conversion.get(clave)
                if not previa or v.date < previa.date:
                    conversion[clave] = v

    hoy = date.today()
    grupos = {'completo': 0, 'parcial': 0, 'espera': 0, 'caida': 0}
    desbloqueado, ya_contadas = 0.0, set()
    for f in senas:
        venta = None
        for clave in (_limpiar_email(f['email']), _limpiar_ig(f['ig'])):
            candidata = conversion.get(clave)
            # La venta tiene que ser POSTERIOR a la seña: una venta vieja del mismo lead no la
            # convirtió.
            if candidata and (not f['fecha'] or candidata.date.date() >= date.fromisoformat(f['fecha'][:10])):
                venta = candidata
                break
        if venta:
            _, tipo, _ = ComercialService.clasificar_venta(venta)
            grupos['completo' if tipo == 'completo' else 'parcial'] += 1
            if venta.id not in ya_contadas:
                ya_contadas.add(venta.id)
                desbloqueado += float(venta.monto or 0.0)
        else:
            dias = (hoy - date.fromisoformat(f['fecha'][:10])).days if f['fecha'] else 0
            grupos['caida' if dias > DIAS_SENA_CAIDA else 'espera'] += 1

    convertidas = grupos['completo'] + grupos['parcial']
    return {
        'total': len(senas), **grupos,
        'cobrado': round(cobrado, 2),
        'ticket': round(cobrado / len(senas), 2),
        'desbloqueado': round(desbloqueado, 2),
        'conversion': pct(convertidas, len(senas)),
    }


# El panel Estados parte "Pendiente" en dos. En la tabla de Revisar alcanza con un estado —la
# agenda no tiene resultado, punto—, pero en el panel las dos mitades son cosas opuestas: una
# llamada de mañana sin reportar es lo normal, y una de la semana pasada sin reportar es un
# agujero que además ENSUCIA el show up, porque lo deja medido sobre menos llamadas de las que
# hubo. `retraso_dias` ya distingue las dos (ver `ComercialService.agendas`).
SIN_REPORTE = {'key': 'sin_reporte', 'label': 'Sin reporte', 'tone': 'error'}
POR_OCURRIR = {'key': 'por_ocurrir', 'label': 'Aún no ocurrió', 'tone': 'idle'}


def estados_de(filas_agendas):
    """Desglose de las agendas del período por su resultado, en el orden del vocabulario.

    Cada estado lleva el `filtro` con el que Revisar lo reconoce, que es su PROPIA etiqueta:
    Revisar deriva el mismo estado fila por fila (ver `estadoDeAgenda`), así que las dos mitades
    de "Pendiente" se pueden filtrar por separado. Antes las dos mandaban 'Pendiente' y el clic
    en "Sin reporte · 62" aterrizaba en las 71 pendientes.

    Los estados en cero se omiten — una tabla con siete filas vacías esconde las tres que
    importan.
    """
    conteo = {}
    for f in filas_agendas:
        clave = f['post_call']['key']
        if clave == 'pendiente':
            clave = SIN_REPORTE['key'] if f['retraso_dias'] > 0 else POR_OCURRIR['key']
        conteo[clave] = conteo.get(clave, 0) + 1

    orden = []
    for estado in POST_CALL:
        if estado['key'] == 'pendiente':
            orden += [SIN_REPORTE, POR_OCURRIR]
        else:
            orden.append(estado)

    return [{'key': e['key'], 'label': e['label'], 'tone': e['tone'],
             'n': conteo[e['key']], 'filtro': e['label']}
            for e in orden if conteo.get(e['key'])]


def _cash_por_dia(filas_ventas, start, end):
    """Serie diaria del cash del período, para el mini gráfico de la tarjeta de Cash collected."""
    por_dia = {}
    for f in filas_ventas:
        if f['fecha']:
            por_dia[f['fecha'][:10]] = por_dia.get(f['fecha'][:10], 0.0) + f['monto']
    dias, cursor = [], start
    while cursor <= end:
        clave = cursor.isoformat()
        dias.append({'dia': clave, 'cash': round(por_dia.get(clave, 0.0), 2)})
        cursor += timedelta(days=1)
    mejor = max(dias, key=lambda d: d['cash'], default=None)
    return dias, (mejor if mejor and mejor['cash'] > 0 else None)


def bloque_closers(start, end, closer_id=None, closer_nombre=None):
    """Todos los números de Analizar para closers, de un período. Se llama dos veces (período y
    período comparado) para sacar los deltas sin duplicar ninguna fórmula."""
    agendas = ComercialService.agendas(start, end, closer_id=closer_id)
    ventas = ComercialService.ventas(start, end, closer_nombre=closer_nombre)
    tot_a = ComercialService.totales_agendas(agendas)
    tot_v = ComercialService.totales_ventas(ventas)

    # Una llamada a la que el lead ASISTIO estaba confirmada, por definicion: el embudo es una
    # cadena de subconjuntos y sin esto mostraba mas asistencias que confirmadas — en produccion,
    # 15 asistieron sobre 7 confirmadas, o sea un 214.3% imposible en la fila siguiente. El
    # mismo criterio que ya aplica `CloserService.mark_sale_appointment_as_show_up`, que fuerza
    # `result='Confirmado'` al registrar una venta justamente por este motivo.
    confirmadas = sum(1 for f in agendas if f['pre_call']['key'] == 'confirmada' or f['asistio'])
    # Presentaciones: asistencias en las que se presentó la oferta. Una venta cuenta como
    # presentación aunque nadie haya tildado el campo — sin eso el embudo mostraría más ventas
    # que presentaciones, que es imposible.
    presentaciones = sum(1 for f in agendas if f['asistio'] and f['presento'])

    por_tipo, programas = {}, {}
    for f in ventas:
        bucket = por_tipo.setdefault(f['tipo_pago']['key'], {'ventas': 0, 'cash': 0.0})
        bucket['ventas'] += 1
        bucket['cash'] += f['monto']

        p = programas.setdefault(f['programa'], {'filas': 0, 'cash': 0.0, 'ventas': 0, 'por_tipo': {}})
        p['filas'] += 1
        p['cash'] += f['monto']
        p['ventas'] += 1 if f['es_venta'] else 0
        t = p['por_tipo'].setdefault(f['tipo_pago']['key'], {'ventas': 0, 'cash': 0.0})
        t['ventas'] += 1
        t['cash'] += f['monto']

    dias, mejor_dia = _cash_por_dia(ventas, start, end)

    return {
        'agendas': tot_a['agendas'],
        'realizadas': tot_a['realizadas'],
        'asistieron': tot_a['asistieron'],
        'show_up': tot_a['show_up'],
        # El close rate se mide sobre las AGENDAS, no sobre las filas de venta del período: la
        # pregunta es "de los que asistieron, cuántos compraron", y eso solo lo puede contestar
        # el conjunto de llamadas. Las dos cifras no son la misma — una venta del período puede
        # no tener agenda en él (una cuota vieja, un cliente que volvió), y una llamada de este
        # mes puede haber cerrado en otro. Usar las filas de venta acá daba 20.6% en la tarjeta
        # contra 35.3% en "Totales de lo filtrado", que es exactamente lo que el diseño pide
        # que no pase.
        'cerradas': tot_a['ventas'],
        'close_rate': tot_a['close_rate'],
        # Las presentaciones ya se contaban para el embudo; salen acá también porque el panel
        # Cierre necesita las DOS tasas de cierre para que la diferencia entre ellas se pueda
        # leer: `close_rate` mide sobre todas las llamadas con show up y `close_presentacion`
        # solo sobre las que además llegaron a mostrar la oferta. La brecha entre las dos es
        # cuánto se pierde ANTES de presentar, que es un problema distinto de no cerrar.
        'presentaciones': presentaciones,
        'presentacion_rate': pct(presentaciones, tot_a['asistieron']),
        'close_presentacion': pct(tot_a['ventas'], presentaciones),
        'estados': estados_de(agendas),
        'cash': tot_v['cash'],
        'cash_neto': tot_v['cash_neto'],
        'ventas': tot_v['ventas'],
        'ticket': tot_v['ticket'],
        'comision': round(tot_v['cash_neto'] * CLOSER_RATE, 2),
        'cash_por_dia': dias,
        'mejor_dia': mejor_dia,
        'payment_types': [
            {**chip('tipo_pago', t['key']),
             'ventas': por_tipo.get(t['key'], {}).get('ventas', 0),
             'cash': round(por_tipo.get(t['key'], {}).get('cash', 0.0), 2)}
            for t in TIPOS_PAGO
        ],
        'programas': sorted((
            # `ventas` son ventas de verdad (completo/parcial) y `cobros` todas las filas, cuotas
            # y señas incluidas. Antes `ventas` caía a `filas` cuando no había ninguna venta real,
            # y un programa con solo cuotas declaraba más "ventas" que el total del período: en
            # producción eso daba un "Residency 200%" en el mapa del equipo.
            {'programa': nombre,
             'ventas': datos['ventas'],
             'cobros': datos['filas'],
             'cash': round(datos['cash'], 2),
             'ticket': round(datos['cash'] / datos['ventas'], 2) if datos['ventas'] else None,
             'por_tipo': [{**chip('tipo_pago', k), 'ventas': v['ventas'], 'cash': round(v['cash'], 2)}
                          for k, v in datos['por_tipo'].items()]}
            for nombre, datos in programas.items()
        ), key=lambda p: p['cash'], reverse=True),
        # Los cinco pasos cuentan AGENDAS, incluido el último: un embudo cuyo último escalón
        # cambiara de unidad (filas de venta del período) no se puede leer — "de 29
        # presentaciones a 7 ventas" mezclaría llamadas con cobros y daría un porcentaje que no
        # significa nada.
        'funnel': [
            {'paso': 'Agendas', 'n': tot_a['agendas']},
            {'paso': 'Confirmadas', 'n': confirmadas},
            {'paso': 'Asistieron', 'n': tot_a['asistieron']},
            {'paso': 'Presentaciones', 'n': presentaciones},
            {'paso': 'Ventas', 'n': tot_a['ventas']},
        ],
        'senas': senas_de(ventas),
    }


def bloque_setters(start, end, setter_id=None, setter_nombre=None):
    """Lo mismo para setters: el embudo va del lead entrante a la agenda generada."""
    leads = ComercialService.leads(start, end, setter_nombre=setter_nombre)
    generadas = ComercialService.agendas(start, end, setter_id=setter_id)
    tot_l = ComercialService.totales_leads(leads)
    tot_g = ComercialService.totales_agendas(generadas)

    # Tenacidad del seguimiento: cuántos leads recibieron 1, 2, 3 o 4+ toques antes de soltarlos.
    tenacidad = {'1': 0, '2': 0, '3': 0, '4+': 0}
    for f in leads:
        n = f['mensajes']
        if n > 0:
            tenacidad['4+' if n >= 4 else str(n)] += 1

    return {
        'leads': tot_l['leads'],
        'respondieron': tot_l['respondieron'],
        'respuesta': tot_l['respuesta'],
        'cualificados': tot_l['cualificados'],
        'cualificacion': tot_l['cualificacion'],
        'agendas': tot_l['agendas'],
        'conversion': tot_l['conversion'],
        'mensajes': tot_l['mensajes'],
        'generadas': tot_g['agendas'],
        'show_up': tot_g['show_up'],
        'ventas_originadas': tot_g['ventas'],
        'tenacidad': [{'toques': k, 'leads': v} for k, v in tenacidad.items()],
        'funnel': [
            {'paso': 'Entrantes', 'n': tot_l['leads']},
            {'paso': 'Respondieron', 'n': tot_l['respondieron']},
            {'paso': 'Cualificados', 'n': tot_l['cualificados']},
            {'paso': 'Agendaron', 'n': tot_l['agendas']},
        ],
    }


# ================================================================================================
# VARIABILIDAD — la serie por día de cada métrica, separada del dato del período
# ================================================================================================
#
# Es la tercera pestaña de Analizar. El dashboard contesta "cuánto dio el período" y esto contesta
# "cómo se movió": con 7 ventas en 17 días, un día bueno mueve el promedio del mes y desde el
# número agregado eso es invisible.
#
# Dos decisiones que atraviesan todas las series:
#
#   · **Los días sin actividad van en cero, no se omiten.** El eje es el calendario del período,
#     así que un fin de semana se ve como un hueco y no desaparece comprimiendo la serie.
#   · **Una tasa de un día sin denominador es 0, no None.** Se marca aparte con `activos` (la
#     cuenta de días con movimiento) y el encabezado de una tasa promedia SOLO esos días: con los
#     ceros adentro, el show up de un equipo que no trabaja el domingo caía sin que nadie hubiera
#     faltado a una llamada. Es el mismo criterio con el que `realizadas` excluye las canceladas.


def _dias_del(start, end):
    """El calendario del período, para que toda serie tenga el mismo eje."""
    dias, cursor = [], start
    while cursor <= end:
        dias.append(cursor.isoformat())
        cursor += timedelta(days=1)
    return dias


def _serie(dias, filas, fecha_de, valor_de=None, filtro=None):
    """Una serie diaria: suma `valor_de` (o cuenta filas) por día, sobre el eje de `dias`."""
    por_dia = {}
    for f in filas:
        if filtro and not filtro(f):
            continue
        clave = fecha_de(f)
        if not clave:
            continue
        por_dia[clave] = por_dia.get(clave, 0.0) + (valor_de(f) if valor_de else 1)
    return [round(por_dia.get(d, 0), 2) for d in dias]


def _tasa_diaria(dias, filas, fecha_de, numerador, denominador):
    """Serie de una tasa, día por día. Un día sin denominador da 0 y se cuenta como día sin
    movimiento (ver el encabezado del módulo): no es un 0% de rendimiento, es un día sin llamadas."""
    num = _serie(dias, filas, fecha_de, filtro=numerador)
    den = _serie(dias, filas, fecha_de, filtro=denominador)
    return [round(n / d * 100, 1) if d else 0 for n, d in zip(num, den)]


def _dia_de_agenda(fila):
    return fila['fecha'][:10] if fila['fecha'] else None


def _dia_de_venta(fila):
    return fila['fecha'][:10] if fila['fecha'] else None


def _dia_de_lead(fila):
    return fila['creada'][:10] if fila.get('creada') else None


def _sub(label, tone, vals):
    return {'label': label, 'tone': tone, 'vals': vals}


def _por_categoria(dias, filas, fecha_de, categoria_de, valor_de=None, tonos=(), maximo=4):
    """Sub-series de una serie abierta por categoría (forma de pago, programa, fuente).

    Las categorías salen de los DATOS y no de una lista fija: el prototipo traía "Ads IG /
    Orgánico / Workshop / DM directo" de sus mocks, y una lista fija esconde cualquier fuente
    nueva y muestra vacías las que no existen. Se ordenan por volumen y se quedan las primeras
    `maximo`, porque una tira de quince pestañas no se lee.
    """
    totales = {}
    for f in filas:
        cat = categoria_de(f)
        if cat:
            totales[cat] = totales.get(cat, 0.0) + (valor_de(f) if valor_de else 1)
    # Con una sola categoría no hay nada que aislar: una tira de una pestaña sola es ruido.
    if len(totales) < 2:
        return []
    top = [c for c, _ in sorted(totales.items(), key=lambda kv: kv[1], reverse=True)[:maximo]]
    return [_sub(cat, tonos[i % len(tonos)] if tonos else 'info',
                 _serie(dias, filas, fecha_de, valor_de, lambda f, c=cat: categoria_de(f) == c))
            for i, cat in enumerate(top)]


CAT_TONOS = ('cat-1', 'cat-2', 'cat-3', 'cat-4')


def variabilidad(rol, start, end, miembro_id=None):
    """Las series por día de la pestaña Variabilidad, para el rol pedido.

    Se arma sobre las MISMAS filas que el dashboard y la tabla (`ComercialService.agendas` /
    `.ventas` / `.leads`), no con otra consulta: el total de una serie tiene que dar el número que
    muestra el tile de arriba, y con dos fuentes eso no se sostiene.
    """
    dias = _dias_del(start, end)
    nombre = ComercialService.nombre_de(miembro_id)

    if rol == ROL_SETTERS:
        series = _series_setters(dias, start, end, miembro_id, nombre)
    else:
        series = _series_closers(dias, start, end, miembro_id, nombre)
    return {'dias': dias, 'series': series}


def _series_closers(dias, start, end, closer_id, closer_nombre):
    agendas = ComercialService.agendas(start, end, closer_id=closer_id)
    ventas = ComercialService.ventas(start, end, closer_nombre=closer_nombre)
    monto = lambda f: f['monto']  # noqa: E731

    es_venta = lambda f: f['es_venta']  # noqa: E731
    es_cuota = lambda f: f['tipo_pago']['key'] == 'cuota'  # noqa: E731
    es_sena = lambda f: f['tipo_pago']['key'] == 'seña'  # noqa: E731
    # Todo lo que no es venta nueva, cuota ni seña. Existe para que las partes SUMEN el total:
    # el vocabulario tiene cuatro tipos canónicos, pero en la base hay filas con otros (medido:
    # $300 de "renovacion" en septiembre), y sin este cajon "Ventas nuevas + Cuotas + Señas"
    # daba menos que "Todo" — un panel donde las partes no cierran con el total.
    es_otro = lambda f: not (es_venta(f) or es_cuota(f) or es_sena(f))  # noqa: E731
    otros = _serie(dias, ventas, _dia_de_venta, monto, es_otro)

    return [
        {'key': 'cash', 'label': 'Cash cobrado', 'unidad': '$', 'tone': 'brand-secondary',
         'help': 'Lo cobrado cada día. Los días en cero son días sin cobranza, no días sin '
                 'trabajo. Aislá por tipo para ver de dónde viene cada pico.',
         'series': [
             _sub('Todo', 'brand-secondary', _serie(dias, ventas, _dia_de_venta, monto)),
             _sub('Ventas nuevas', 'cat-1', _serie(dias, ventas, _dia_de_venta, monto, es_venta)),
             _sub('Cuotas', 'cat-3', _serie(dias, ventas, _dia_de_venta, monto, es_cuota)),
             _sub('Señas', 'cat-4', _serie(dias, ventas, _dia_de_venta, monto, es_sena)),
         ] + ([_sub('Otros', 'idle', otros)] if sum(otros) else [])},
        {'key': 'agendas', 'label': 'Agendas', 'unidad': '', 'tone': 'info',
         'help': 'Llamadas agendadas cada día, por la fecha de la reunión.',
         'vals': _serie(dias, agendas, _dia_de_agenda)},
        {'key': 'ventas', 'label': 'Ventas', 'unidad': '', 'tone': 'success',
         'help': 'Cierres por día. Con pocas ventas en el mes, un día bueno se nota mucho en el '
                 'promedio — que es justamente lo que esta pestaña deja ver.',
         'series': [_sub('Todas', 'success', _serie(dias, ventas, _dia_de_venta, None, es_venta))]
                   + _por_categoria(dias, [f for f in ventas if f['es_venta']], _dia_de_venta,
                                    lambda f: f['tipo_pago']['label'], None, CAT_TONOS)},
        {'key': 'showup', 'label': 'Show up', 'unidad': '%', 'tone': 'success', 'tipo': 'tasa',
         'help': 'Qué porcentaje se presentó cada día, sobre las llamadas que ya tuvieron '
                 'resultado. Los días en cero son días sin llamadas, no días con show up cero.',
         'vals': _tasa_diaria(dias, agendas, _dia_de_agenda,
                              lambda f: f['asistio'], lambda f: f['realizada'])},
        {'key': 'senas', 'label': 'Señas', 'unidad': '', 'tone': 'warning',
         'help': 'Reservas tomadas cada día. Una seña bloquea un cupo hasta que se completa el pago.',
         'vals': _serie(dias, ventas, _dia_de_venta, None, es_sena)},
        {'key': 'programas', 'label': 'Programas', 'unidad': '$', 'tone': 'cat-2',
         'help': 'Cash cobrado por día, abierto por programa. Aislá uno para ver su ritmo propio.',
         'series': [_sub('Todos', 'brand-secondary', _serie(dias, ventas, _dia_de_venta, monto))]
                   + _por_categoria(dias, ventas, _dia_de_venta, lambda f: f['programa'],
                                    monto, CAT_TONOS)},
    ]


def _series_setters(dias, start, end, setter_id, setter_nombre):
    leads = ComercialService.leads(start, end, setter_nombre=setter_nombre)
    generadas = ComercialService.agendas(start, end, setter_id=setter_id)

    return [
        {'key': 'entrantes', 'label': 'Entrantes', 'unidad': '', 'tone': 'info',
         'help': 'Leads nuevos que entraron al inbox cada día. Depende de la pauta y del '
                 'contenido, no del setter. Se abre por setter y NO por fuente: en las filas de '
                 'lead la fuente es siempre "ManyChat" (ver `ComercialService.leads`), así que '
                 'abrirla por ahí daría una sola serie repetida.',
         'series': [_sub('Todos', 'info', _serie(dias, leads, _dia_de_lead))]
                   + _por_categoria(dias, leads, _dia_de_lead, lambda f: f['setter'],
                                    None, CAT_TONOS)},
        {'key': 'respuestas', 'label': 'Respuestas', 'unidad': '', 'tone': 'success',
         'help': 'Leads que contestaron cada día. Seguir la forma de la curva de entrantes es '
                 'buena señal.',
         'vals': _serie(dias, leads, _dia_de_lead, None, lambda f: f['respondio'])},
        {'key': 'cualificados', 'label': 'Cualificados', 'unidad': '', 'tone': 'cat-1',
         'help': 'Leads que cumplieron el perfil cada día.',
         'vals': _serie(dias, leads, _dia_de_lead, None, lambda f: f['cualificado'])},
        {'key': 'agendas', 'label': 'Agendas generadas', 'unidad': '', 'tone': 'brand-secondary',
         'help': 'Citas reservadas cada día, por la fecha de la reunión. Es la salida del trabajo '
                 'de setting.',
         'vals': _serie(dias, generadas, _dia_de_agenda)},
        {'key': 'tasa_resp', 'label': 'Tasa de respuesta', 'unidad': '%', 'tone': 'success',
         'tipo': 'tasa',
         'help': 'Qué porcentaje de los entrantes de ese día contestó. Los días en cero son días '
                 'sin leads nuevos.',
         'vals': _tasa_diaria(dias, leads, _dia_de_lead,
                              lambda f: f['respondio'], lambda f: True)},
    ]

def por_cobrar_de(closer_id=None):
    """Lo que falta cobrar, A HOY. Reusa `CloserDashboardService._pending_collections`, que es de
    donde sale la misma cifra en el dashboard del closer y en su pool de llamadas cerradas: tener
    dos definiciones de la deuda ya pasó una vez y la pantalla mostraba $0 mientras el pool del
    mismo closer listaba 75 clientes debiendo $47.256.

    NO está acotado al período y no puede estarlo sin cambiar de pregunta. La deuda es un SALDO:
    sale de las inscripciones vivas menos lo pagado, sin fecha de corte. "Cuánto se debe hoy" y
    "cuánto se firmó del 1 al 30" son dos cosas distintas, y la segunda no es derivable —
    `FinancialSale` guarda el monto de cada cobro, no el total del contrato. Por eso el panel
    Cash muestra esta cifra rotulada "a hoy" en vez de un revenue del período que habría que
    inventar, y por eso `por_cobrar` no lleva delta: comparar el mismo saldo contra sí mismo
    daría 0% en todos los períodos.

    Se llama desde `resumen` y no desde `bloque_closers`: el bloque se ejecuta una vez por persona
    y por período comparado cuando lo pide `comparativas`, y esta consulta recorre todas las
    inscripciones del sistema.
    """
    _, totales = CloserDashboardService._pending_collections(closer_id, limit=0)
    return {'total': totales['total'], 'vencido': totales['vencido'],
            'por_vencer': totales['por_vencer'], 'sin_plan': totales['sin_plan'],
            'clientes': totales['count'], 'clientes_vencido': totales['count_vencido']}


def _bloque_de(rol):
    return bloque_setters if rol == ROL_SETTERS else bloque_closers


def _kwargs_de(rol, miembro_id, nombre):
    if rol == ROL_SETTERS:
        return {'setter_id': miembro_id, 'setter_nombre': nombre}
    return {'closer_id': miembro_id, 'closer_nombre': nombre}


def resumen(rol, start, end, prev_start=None, prev_end=None, miembro_id=None):
    """Todo lo que muestra la pestaña Analizar → Dashboard, con sus deltas."""
    miembro = User.query.get(miembro_id) if miembro_id else None
    nombre = miembro.username if miembro else None
    bloque = _bloque_de(rol)
    kwargs = _kwargs_de(rol, miembro_id, nombre)

    actual = bloque(start, end, **kwargs)
    previo = bloque(prev_start, prev_end, **kwargs) if prev_start else None

    deltas = {}
    if previo:
        for clave, modo in DELTAS[rol].items():
            d = delta(actual.get(clave), previo.get(clave), modo)
            if d:
                deltas[clave] = d

    datos = {'rol': rol, 'actual': actual, 'previo': previo, 'deltas': deltas,
             'miembro': {'id': miembro.id, 'nombre': miembro.username} if miembro else None}
    # Fuera de `actual` a propósito: no es una cifra del período (ver `por_cobrar_de`).
    if rol == ROL_CLOSERS:
        datos['por_cobrar'] = por_cobrar_de(miembro_id)
    return datos


def _fila_comparativa(rol, bloque):
    """Los números de una persona (o del equipo) para el ranking y el mapa."""
    if rol == ROL_SETTERS:
        return {k: bloque.get(k) for k in
                ('leads', 'respuesta', 'cualificacion', 'agendas', 'conversion', 'show_up',
                 'ventas_originadas', 'mensajes', 'generadas')}
    senas = bloque['senas']
    completo = next((p for p in bloque['payment_types'] if p['key'] == 'completo'), None)
    residency = next((p for p in bloque['programas'] if p['programa'] == 'Residency Roadmap'), None)
    return {
        'cash': bloque['cash'], 'show_up': bloque['show_up'], 'close_rate': bloque['close_rate'],
        'ticket': bloque['ticket'], 'comision': bloque['comision'], 'agendas': bloque['agendas'],
        'ventas': bloque['ventas'],
        'senas_conversion': senas['conversion'],
        'senas_detalle': '{} de {} señas'.format(senas['completo'] + senas['parcial'], senas['total']),
        'completo_pct': pct(completo['ventas'] if completo else 0, bloque['ventas']),
        'residency_pct': pct(residency['ventas'] if residency else 0, bloque['ventas']),
    }


def comparativas(rol, start, end, prev_start=None, prev_end=None):
    """Ranking por métrica + mapa del equipo, con el delta de cada persona en cada métrica."""
    miembros = ComercialService.miembros(rol)
    bloque = _bloque_de(rol)

    filas = []
    for m in miembros:
        kwargs = _kwargs_de(rol, m['id'], m['nombre'])
        datos = _fila_comparativa(rol, bloque(start, end, **kwargs))
        deltas = {}
        if prev_start:
            anterior = _fila_comparativa(rol, bloque(prev_start, prev_end, **kwargs))
            for metrica in METRICAS[rol]:
                modo = 'pts' if metrica['formato'] == 'pct' else 'pct'
                d = delta(datos.get(metrica['key']), anterior.get(metrica['key']), modo)
                if d:
                    deltas[metrica['key']] = d
        filas.append({'id': m['id'], 'nombre': m['nombre'], **datos, 'deltas': deltas})

    # La fila "Equipo" NO es la suma de las filas de arriba: las tasas se recalculan sobre el
    # total del equipo. Promediar los porcentajes de gente con volúmenes muy distintos da un
    # número que no le corresponde a nadie.
    equipo = _fila_comparativa(rol, bloque(start, end))

    return {'rol': rol, 'metricas': METRICAS[rol], 'columnas_info': COLUMNAS_INFO[rol],
            'filas': filas, 'equipo': equipo}
