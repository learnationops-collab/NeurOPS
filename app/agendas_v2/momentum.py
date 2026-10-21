"""El evento Momentum de cada closer: cómo agenda la Academia sus Momentum con él.

Una Momentum es la llamada del closer con un alumno de la Academia (la de la seña o la del cierre). La
Academia las agenda por su API (app/api/external/agenda.py, modo ventas), nunca por la página pública.
Cada closer puede tener su evento propio («Mis eventos») asociado a un funnel de tipo `momentum`: con
él elige la duración, el margen entre sesiones, hasta cuántos días adelante, la antelación, el paso y
su horario (el del evento, o si no tiene, el de su persona de Team). Sin ese evento, la Academia sigue
mandando duración, margen, antelación y días en cada pedido, como antes.

El agendamiento de setting no se toca: un funnel de tipo `momentum` no se sirve en la página pública
(servicio._disponible) y la asignación de los eventos compartidos no mira los eventos de un closer.
"""

from app.agendas_v2.modelos import SchedEvento

TIPO_MOMENTUM = 'momentum'
DIAS_MAX = 60


def es_funnel_momentum(f):
    return bool(f) and f.get('tipo') == TIPO_MOMENTUM


def funnels_momentum(d):
    return [f for f in d['funnels'] if es_funnel_momentum(f)]


def evento_momentum(d, persona):
    """El evento Momentum activo de esa persona (de un funnel Momentum activo), o None. Si tiene
    varios, el último que se editó."""
    if not persona:
        return None
    activos = {f['id'] for f in funnels_momentum(d) if f.get('activo')}
    candidatos = {e['id']: e for e in d['eventos']
                  if e.get('persona') == persona['id'] and e.get('activo') and e.get('funnel') in activos}
    if len(candidatos) <= 1:
        return next(iter(candidatos.values()), None)
    fila = (SchedEvento.query.filter(SchedEvento.id.in_(list(candidatos)))
            .order_by(SchedEvento.actualizado_en.desc(), SchedEvento.id.desc()).first())
    return candidatos.get(fila.id) if fila else None


def config_momentum(d, persona, dias_pedidos=None):
    """Lo que manda el evento Momentum del closer para calcular y reservar sus Momentum, o None.

    `dias`: los del evento (si reserva por días; si no, los que pidió la Academia), nunca más que los
    que pidió la Academia ni más de 60: ni el closer recibe Momentum más lejos de lo que eligió, ni la
    Academia muestra más días de los que pidió."""
    e = evento_momentum(d, persona)
    if not e:
        return None
    rs = e['reservas']
    dias = rs['n'] if rs['modo'] == 'dias' else (dias_pedidos or rs['n'])
    if dias_pedidos:
        dias = min(dias, dias_pedidos)
    return {
        'evento': e,
        'duracion': e['duracion'],
        'margen': e.get('margen') or 0,
        'dias': max(1, min(DIAS_MAX, dias)),
        'tipo_dias': rs['tipo'] if rs['modo'] == 'dias' else 'corridos',
        'antel': {'n': e['antel']['n'], 'u': e['antel']['u']},
        'paso': {'n': e['paso']['n'], 'u': e['paso']['u']},
        # El horario propio del evento; None: el de ventas de su persona (lo pone quien llama).
        'horario': e.get('horario'),
    }


def config_de_usuario(user, dias_pedidos=None):
    """config_momentum del closer de esa cuenta (por su persona de Team), o None."""
    from app.agendas_v2.servicio import colecciones, persona_de_usuario

    d = colecciones()
    return config_momentum(d, persona_de_usuario(d, user), dias_pedidos)


def resumen(cfg):
    """Lo que la Academia ve de la fuente usada (`evento_momentum` en sus respuestas), o None."""
    if not cfg:
        return None
    from app.agendas_v2.nucleo.catalogos import MS_U

    e = cfg['evento']
    return {
        'id': e['id'], 'nombre': e['nombre'], 'duracion': cfg['duracion'], 'margen': cfg['margen'],
        'dias': cfg['dias'], 'antel_min': int(cfg['antel']['n'] * MS_U[cfg['antel']['u']] / 60000),
        'paso_min': cfg['paso']['n'] * (60 if cfg['paso']['u'] == 'h' else 1),
        'horario_propio': bool(e.get('horario')),
    }
