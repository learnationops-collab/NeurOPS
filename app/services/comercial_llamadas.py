"""Las llamadas de closing por su orden (1ª, 2ª o más) y la lista detrás de cada cifra de los paneles
«Destino de las agendas» y «Cierre» de Analizar › Closers (ADR-W144, 16/11/2026).

El orden no sale de una marca de la agenda: `llamada_n` = 1 + las llamadas de closing a las que ESE lead
ya asistió en los 90 días anteriores (la misma ventana que `cierres_reales`). No cuentan las de quien
tiene rol triage ni las Momentum, y dos agendas del mismo minuto son una. Una reagenda a la que no
asistió no consume orden. Lo que no puede ver: la «2ª llamada» del árbol de Resultado mueve la misma
agenda (salvo a prueba), así que esa primera llamada deja de existir y la segunda cuenta como primera.

Todo se calcula sobre las MISMAS filas que el resto del bloque (`filas_de_closing`): por eso los grupos
suman exacto las cifras del panel y cada lista mide lo que dice su cifra.
"""
from datetime import datetime, timedelta

from app.models import Appointment
from app.services.cierres_reales import CON_SHOW_UP, VENTANA_LLAMADA_DIAS, _lotes
from app.services.closer_agendas_service import derivar_estado
from app.services.ficha_de_fila import ficha_de

PRIMERA, SEGUNDA, MOMENTUM = 'primera', 'segunda', 'momentum'
GRUPOS = (PRIMERA, SEGUNDA, MOMENTUM)
ROTULO = {PRIMERA: '1ª llamada', SEGUNDA: '2ª llamada o más', MOMENTUM: 'Momentum'}
_VENTANA = timedelta(days=VENTANA_LLAMADA_DIAS)
# Cifras que no son un estado ni un grupo de estados: la condición va sobre la marca de la fila.
_MARCAS = {
    'agendas': ('Agendas', lambda f: True),
    'base': ('Agendas con destino', lambda f: f['base_show_up']),
    'asistieron': ('Asistieron', lambda f: f['asistio']),
    'ventas': ('Ventas', lambda f: f['post_call']['key'] == 'venta'),
}
_ROTULO_GRUPO = {'show_up': 'Se presentaron', 'no_show': 'No show', 'canceladas': 'Cancelaron',
                 'reprogramadas': 'Reprogramaron', 'sin_reporte': 'Sin reportar', 'por_ocurrir': 'Aún no ocurren',
                 'descalificadas': 'Descalificadas', 'descartadas': 'Descartadas'}
_COLUMNAS = [
    {'key': 'persona', 'header': 'Persona', 'tipo': 'texto', 'ancho': 'minmax(160px,1.6fr)'},
    {'key': 'cita', 'header': 'Cita', 'tipo': 'fecha', 'ancho': '150px'},
    {'key': 'closer', 'header': 'Closer', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)'},
    {'key': 'estado', 'header': 'Estado', 'tipo': 'texto', 'ancho': 'minmax(120px,1fr)'},
    {'key': 'llamada', 'header': 'Llamada', 'tipo': 'texto', 'ancho': '110px'},
    {'key': 'setter', 'header': 'Setter', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)', 'oculta': True},
    {'key': 'fuente', 'header': 'Fuente', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)', 'oculta': True},
]


def _minuto(fila):
    return datetime.fromisoformat(fila['fecha']).replace(second=0, microsecond=0) if fila.get('fecha') else None


def _asistidas(filas, desde, hasta):
    """({persona: {minuto}}, {cliente: {minuto}}) de las llamadas de closing con show up de esos leads."""
    from app.agendas_v2.manual import ORIGEN_MOMENTUM
    from app.models import User

    triage = {u.id for u in User.query.all() if u.tiene_rol('triage')}
    ahora = datetime.utcnow()
    por_persona, por_cliente, vistas = {}, {}, set()
    pedidos = ((Appointment.person_uuid, {f['person_uuid'] for f in filas if f.get('person_uuid')}),
               (Appointment.client_id, {f['client_id'] for f in filas if f.get('client_id')}))
    for columna, valores in pedidos:
        for lote in _lotes(valores):
            for a in Appointment.query.filter(Appointment.start_time >= desde, Appointment.start_time < hasta,
                                              columna.in_(lote)):
                if a.id in vistas:
                    continue
                vistas.add(a.id)
                if a.closer_id in triage or a.origin == ORIGEN_MOMENTUM or derivar_estado(a, ahora) not in CON_SHOW_UP:
                    continue
                minuto = a.start_time.replace(second=0, microsecond=0)
                if a.person_uuid:
                    por_persona.setdefault(a.person_uuid, set()).add(minuto)
                if a.client_id:
                    por_cliente.setdefault(a.client_id, set()).add(minuto)
    return por_persona, por_cliente


def marcar(filas):
    """Suma a cada fila de agenda `llamada_n` (1, 2, 3…) y `llamada` ('primera', 'segunda' o 'momentum')."""
    minutos = [m for m in map(_minuto, filas) if m]
    por_persona, por_cliente = _asistidas(filas, min(minutos) - _VENTANA, max(minutos)) if minutos else ({}, {})
    for f in filas:
        tope, n = _minuto(f), 1
        if tope:
            antes = por_persona.get(f.get('person_uuid'), set()) | por_cliente.get(f.get('client_id'), set())
            n += sum(1 for m in antes if tope - _VENTANA <= m < tope)
        f['llamada_n'] = n
        f['llamada'] = MOMENTUM if f.get('tipo_llamada') == 'momentum' else (PRIMERA if n == 1 else SEGUNDA)
    return filas


def filas_de_closing(start, end, closer_id=None, segmento=None, paises=None, sin_excluidos=False, con_orden=True):
    """Las agendas de closing del período con los filtros del tablero: las filas de `bloque_closers` y de las
    listas de sus cifras. `con_orden=False` saltea la consulta del orden (el ranking no lo muestra)."""
    from app.services.comercial_analitica import _sin_triage
    from app.services.comercial_service import ComercialService

    filas = _sin_triage(ComercialService.agendas(start, end, closer_id=closer_id), closer_id)
    if sin_excluidos:
        # La fila «Equipo» de las Comparativas: todo el equipo menos quienes no cuentan ahí.
        filas = [f for f in filas if ComercialService.comparable(f['closer'])]
    if segmento:
        from app.services.segmentos_comercial import filtrar
        filas = filtrar(filas, segmento)
    if paises:
        from app.services import paises_lectura
        filas = paises_lectura.filtrar(filas, paises)
    return marcar(filas) if con_orden else filas


def estados_por_llamada(filas):
    """Los estados de las primeras llamadas y los de las segundas o más. Las Momentum solo van en «Todas»."""
    from app.services.comercial_analitica import estados_de

    salida = {}
    for grupo in (PRIMERA, SEGUNDA):
        parte = [f for f in filas if f['llamada'] == grupo]
        salida[grupo] = {'agendas': len(parte), 'estados': estados_de(parte)}
    return salida


def cierres_por_llamada(filas):
    """`{primera | segunda | momentum: {asistieron, ventas, senas}}`: suman las del panel Cierre. La segunda
    lleva además `terceras`: cuántas de sus llamadas con show up son la tercera o más."""
    salida = {g: {'asistieron': 0, 'ventas': 0, 'senas': 0} for g in GRUPOS}
    salida[SEGUNDA]['terceras'] = 0
    for f in filas:
        if not f['asistio']:
            continue
        c = salida[f['llamada']]
        c['asistieron'] += 1
        c['ventas'] += 1 if f['post_call']['key'] == 'venta' else 0
        c['senas'] += 1 if f['post_call']['key'] == 'sena' else 0
        if f['llamada'] == SEGUNDA and f['llamada_n'] >= 3:
            c['terceras'] += 1
    return salida


def _condicion(que):
    """(rótulo, condición sobre la fila) de una cifra: una marca, un estado o un grupo de estados."""
    from app.services.comercial_analitica import GRUPO_DE_ESTADO, POR_OCURRIR, SIN_REPORTE
    from app.services.comercial_vocabulario import chip

    if que in _MARCAS:
        return _MARCAS[que]

    def clave(f):
        # La misma partición de «Pendiente» que `estados_de`.
        k = f['post_call']['key']
        return k if k != 'pendiente' else (SIN_REPORTE['key'] if f['ya_paso'] else POR_OCURRIR['key'])

    if que in _ROTULO_GRUPO:
        return _ROTULO_GRUPO[que], lambda f: GRUPO_DE_ESTADO.get(clave(f)) == que
    if que in GRUPO_DE_ESTADO:
        return chip('post_call', que)['label'], lambda f: clave(f) == que
    raise ValueError('Esa cifra todavía no tiene lista.')


def registros(filas, que, llamada=None):
    """La lista de una cifra: las filas de `filas_de_closing` que suman `que` (una marca de `_MARCAS`, un grupo
    del panel o un estado) en `llamada` (None o 'todas' = todas). Su cantidad es la cifra."""
    from app.services.comercial_analitica import POR_OCURRIR, SIN_REPORTE

    rotulo, suma = _condicion(que)
    if llamada in (None, '', 'todas'):
        llamada = None
    elif llamada not in GRUPOS:
        raise ValueError('Esa llamada no existe.')
    elegidas = [f for f in filas if suma(f) and (llamada is None or f.get('llamada') == llamada)]

    def estado(f):
        if f['post_call']['key'] != 'pendiente':
            return f['post_call']['label']
        return (SIN_REPORTE if f['ya_paso'] else POR_OCURRIR)['label']

    salida = [{
        'id': str(f['id']), 'persona': f['cliente'], 'cita': f['fecha'] or '', 'closer': f['closer'] or '—',
        'estado': estado(f),
        'llamada': ROTULO[MOMENTUM] if f.get('llamada') == MOMENTUM else '{}ª'.format(f.get('llamada_n', 1)),
        'setter': f['setter'] or '—', 'fuente': f['fuente'] or '—', 'ficha': ficha_de(appointment_id=f['id']),
    } for f in elegidas]
    cual = ' · {}'.format(ROTULO[llamada]) if llamada else ''
    cuantas = '{} {}'.format(len(salida), 'agenda' if len(salida) == 1 else 'agendas')
    return {'que': que, 'llamada': llamada, 'columnas': _COLUMNAS, 'filas': salida,
            'resumen': '{} · {}{}'.format(cuantas, rotulo, cual)}
