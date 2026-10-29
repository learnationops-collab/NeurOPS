"""El segmento A/B/C/D en el dashboard comercial: lo que ven el setter (agendas del mes por segmento) y el closer
(show up y cierre por segmento), y el filtro por segmento de sus listas y de Analizar (Gabriela, 28/10/2026).
Cortado además por closer, setter, fuente u origen y comparado con otro período (Kerwin, 28/10/2026).

No consulta nada propio: reparte en grupos las MISMAS filas que usan el resto del dashboard
(`ComercialService.agendas` para el closer, `generadas` para el setter), con el segmento de la persona
(`segmentos_lectura`). Por eso los grupos —A, B, C, D y «sin segmento»— suman exacto el número de arriba y cada
cifra abre la lista de las filas que la suman. El corte y la comparación son los de Marketing (`segmentos_cortes`).
"""
from app.services import conteo_agendas_service, fuentes_service
from app.services import segmentos_cortes as cortes
from app.services import segmentos_lectura as lectura
from app.services.closer_name_service import SIN_CLOSER
from app.services.comercial_service import ROL_CLOSERS, ROL_SETTERS, ComercialService, pct
from app.services.procedencia_ingresos_service import setters_conocidos

METRICAS = ('agendas', 'realizadas', 'asistieron', 'ventas', 'sin_reporte')
CAMPOS = METRICAS + ('show_up', 'cierre')
CORTES = ('ninguno', 'closer', 'setter', 'fuente', 'origen')
ETIQUETA_CORTE = {'ninguno': 'Sin agrupar', 'closer': 'Closer', 'setter': 'Setter', 'fuente': 'Fuente', 'origen': 'Origen'}
ETIQUETA_FUENTE = {'setting': 'Setting', 'workshop': 'Workshop', 'otras': 'Otras'}
TODO = 'todo'
ROTULO = {'agendas': 'Agendas', 'realizadas': 'Con resultado', 'asistieron': 'Asistieron', 'ventas': 'Ventas',
          'sin_reporte': 'Sin reporte'}


def con_segmento(filas):
    """Suma `segmento` (A, B, C, D o 'sin') a cada fila (agendas o ventas) y la devuelve."""
    for f, g in zip(filas, lectura.de_filas(filas)):
        f['segmento'] = g
    return filas


def filtrar(filas, elegidos):
    """Las filas de los segmentos elegidos (un conjunto de claves; vacío o None = todas), con su `segmento`."""
    con_segmento(filas)
    return [f for f in filas if f['segmento'] in elegidos] if elegidos else filas


def _filas_del_rol(rol, start, end, miembro_id):
    """Las filas del panel: agendas del closer por fecha de reunión, o agendas generadas del setter por fecha de
    creación (una por persona), como las cuentan su Analizar y su Revisar."""
    if rol == ROL_SETTERS:
        return ComercialService.generadas(start, end, setter_id=miembro_id)
    return ComercialService.agendas(start, end, closer_id=miembro_id if rol == ROL_CLOSERS else None)


def _sin_reporte(f):
    return f['post_call']['key'] == 'pendiente' and f['ya_paso']


def _cuenta(filas):
    realizadas = sum(1 for f in filas if f['realizada'])
    asistieron = sum(1 for f in filas if f['asistio'])
    ventas = sum(1 for f in filas if f['post_call']['key'] == 'venta')
    return {'agendas': len(filas), 'realizadas': realizadas, 'asistieron': asistieron,
            'show_up': pct(asistieron, realizadas), 'ventas': ventas, 'cierre': pct(ventas, asistieron),
            'sin_reporte': sum(1 for f in filas if _sin_reporte(f))}


def _clave_de(corte):
    """La clave del grupo de una fila para el `corte`: la ÚNICA definición, del panel y de sus listas."""
    if corte == 'closer':
        return lambda f: f['closer'] or SIN_CLOSER
    if corte == 'setter':
        return lambda f: f['setter'] or 'Sin setter'
    if corte in ('origen', 'fuente'):
        setters = setters_conocidos()
        fuente_de = lambda f: fuentes_service.fuente_de_agenda(f['fuente'], setters) or 'otras'  # noqa: E731
        if corte == 'fuente':
            return lambda f: ETIQUETA_FUENTE[fuente_de(f)]
        return lambda f: conteo_agendas_service.origen_de_agenda(fuente_de(f), f['fuente'])
    return lambda f: TODO


def _grupo(corte, clave, filas, elegidos):
    por = cortes.separar(filas, lambda f: f['segmento'])
    grupos = [s for s in lectura.ORDEN if not elegidos or s in elegidos]
    return {'key': clave, 'label': 'Todo lo filtrado' if corte == 'ninguno' else clave,
            'filas': [{'segmento': s, 'label': lectura.ETIQUETAS[s], **_cuenta(por.get(s, []))} for s in grupos],
            'total': {'segmento': None, 'label': 'Total del filtro' if elegidos else 'Total',
                      **_cuenta([f for s in grupos for f in por.get(s, [])])}}


def panel(rol, start, end, miembro_id=None, elegidos=None, corte='ninguno', previo=None):
    """{rol, corte, segmentos, cuentas, grupos: [{key, label, filas: [una por segmento], total}], comparacion}. Con `elegidos`,
    solo esos segmentos y el total de ellos. `previo`: (desde, hasta) del período contra el que se compara; cada fila y
    total trae `previo` y `delta`."""
    corte = corte if corte in CORTES else 'ninguno'
    clave_de = _clave_de(corte)
    filas = con_segmento(_filas_del_rol(rol, start, end, miembro_id))
    sep = cortes.separar(filas, clave_de) or {TODO: []}
    sep_p = cortes.separar(con_segmento(_filas_del_rol(rol, *previo, miembro_id)), clave_de) if previo else {}
    grupos = [_grupo(corte, k, sep.get(k, []), elegidos) for k in cortes.claves(sep, sep_p)]
    if previo:
        grupos = cortes.unir_comparacion(grupos, [_grupo(corte, g['key'], sep_p.get(g['key'], []), elegidos) for g in grupos], CAMPOS)
    return {'rol': rol, 'corte': corte, 'cortes': [{'key': k, 'label': ETIQUETA_CORTE[k]} for k in CORTES],
            'segmentos': lectura.lista(),
            'cuentas': {s: sum(1 for f in filas if f['segmento'] == s) for s in lectura.ORDEN},
            'grupos': grupos,
            'comparacion': {'desde': previo[0].isoformat(), 'hasta': previo[1].isoformat()} if previo else None}


_COLUMNAS = [
    {'key': 'persona', 'header': 'Persona', 'tipo': 'texto', 'ancho': 'minmax(160px,1.6fr)'},
    {'key': 'segmento', 'header': 'Segmento', 'tipo': 'texto', 'ancho': '110px'},
    {'key': 'cita', 'header': 'Cita', 'tipo': 'fecha', 'ancho': '150px'},
    {'key': 'closer', 'header': 'Closer', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)'},
    {'key': 'setter', 'header': 'Setter', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)', 'oculta': True},
    {'key': 'fuente', 'header': 'Fuente', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)', 'oculta': True},
    {'key': 'estado', 'header': 'Estado', 'tipo': 'texto', 'ancho': 'minmax(120px,1fr)'},
]

_CONDICION = {
    'agendas': lambda f: True,
    'realizadas': lambda f: f['realizada'],
    'asistieron': lambda f: f['asistio'],
    'ventas': lambda f: f['post_call']['key'] == 'venta',
    'sin_reporte': _sin_reporte,
}


def registros(rol, start, end, miembro_id, metrica, segmento, corte='ninguno', grupo=None):
    """La lista de una cifra del panel: las filas del segmento `segmento` (varios por coma; vacío = todos) y del `grupo` del
    `corte` (None = todos) que suman `metrica`. Su cantidad es la cifra."""
    if metrica not in METRICAS:
        raise ValueError('Esa cifra todavía no tiene lista.')
    elegidos = lectura.parsear(segmento)
    clave_de = _clave_de(corte if corte in CORTES else 'ninguno')
    filas = [f for f in filtrar(_filas_del_rol(rol, start, end, miembro_id), elegidos)
             if _CONDICION[metrica](f) and (grupo is None or clave_de(f) == grupo)]
    salida = [{
        'id': str(f['id']), 'persona': f['cliente'], 'segmento': lectura.ETIQUETAS[f['segmento']], 'cita': f['fecha'] or '',
        'closer': f['closer'] or '—', 'setter': f['setter'] or '—', 'fuente': f['fuente'] or '—',
        'estado': f['post_call']['label'],
    } for f in filas]
    nombre = ' + '.join(lectura.ETIQUETAS[s] for s in lectura.ORDEN if s in elegidos) if elegidos else 'todos los segmentos'
    cual = f' · {grupo}' if grupo not in (None, TODO) else ''
    return {'metrica': metrica, 'segmento': ','.join(s for s in lectura.ORDEN if s in elegidos) if elegidos else None,
            'columnas': _COLUMNAS, 'filas': salida, 'resumen': f'{len(salida)} {ROTULO[metrica].lower()} · {nombre}{cual}'}
