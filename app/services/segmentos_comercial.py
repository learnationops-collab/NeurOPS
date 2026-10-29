"""El segmento A/B/C/D en el dashboard comercial: lo que ven el setter (agendas del mes por segmento) y el closer
(show up y cierre por segmento), y el filtro por segmento de sus listas y de Analizar (Gabriela, 28/10/2026).

No consulta nada propio: reparte en grupos las MISMAS filas que usan el resto del dashboard
(`ComercialService.agendas` para el closer, `generadas` para el setter), con el segmento de la persona
(`segmentos_lectura`). Por eso los grupos —A, B, C, D y «sin segmento»— suman exacto el número de arriba y cada
cifra abre la lista de las filas que la suman.
"""
from app.services import segmentos_lectura as lectura
from app.services.comercial_service import ROL_CLOSERS, ROL_SETTERS, ComercialService, pct

METRICAS = ('agendas', 'realizadas', 'asistieron', 'ventas', 'sin_reporte')
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


def panel(rol, start, end, miembro_id=None, elegidos=None):
    """{segmentos, filas: [una por grupo], total}. Con `elegidos`, solo esos grupos y el total de ellos."""
    filas = con_segmento(_filas_del_rol(rol, start, end, miembro_id))
    por = {s: [] for s in lectura.ORDEN}
    for f in filas:
        por[f['segmento']].append(f)
    grupos = [s for s in lectura.ORDEN if not elegidos or s in elegidos]
    return {'rol': rol, 'segmentos': lectura.lista(),
            'filas': [{'segmento': s, 'label': lectura.ETIQUETAS[s], **_cuenta(por[s])} for s in grupos],
            'total': {'segmento': None, 'label': 'Total', **_cuenta([f for s in grupos for f in por[s]])}}


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


def registros(rol, start, end, miembro_id, metrica, segmento):
    """La lista de una cifra del panel: las filas del grupo `segmento` (varios por coma; vacío = todos) que suman
    `metrica`. Su cantidad es la cifra."""
    if metrica not in METRICAS:
        raise ValueError('Esa cifra todavía no tiene lista.')
    elegidos = lectura.parsear(segmento)
    filas = [f for f in filtrar(_filas_del_rol(rol, start, end, miembro_id), elegidos) if _CONDICION[metrica](f)]
    salida = [{
        'id': str(f['id']), 'persona': f['cliente'], 'segmento': lectura.ETIQUETAS[f['segmento']], 'cita': f['fecha'] or '',
        'closer': f['closer'] or '—', 'setter': f['setter'] or '—', 'fuente': f['fuente'] or '—',
        'estado': f['post_call']['label'],
    } for f in filas]
    nombre = ' + '.join(lectura.ETIQUETAS[s] for s in lectura.ORDEN if s in elegidos) if elegidos else 'todos los segmentos'
    return {'metrica': metrica, 'segmento': ','.join(s for s in lectura.ORDEN if s in elegidos) if elegidos else None,
            'columnas': _COLUMNAS, 'filas': salida, 'resumen': f'{len(salida)} {ROTULO[metrica].lower()} · {nombre}'}
