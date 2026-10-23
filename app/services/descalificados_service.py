"""Cuántos leads se descalifican y quién los descalifica (23/10/2026).

Hay dos formas de que un lead quede descalificado, y la dirección comercial las quiere ver juntas
pero separadas:

  · **Por el formulario.** El formulario de Agendas 2.0 corta a quien elige una opción que
    descalifica (o cae en «No califica» por segmentación): no le deja agendar, así que nunca llega a
    ser una agenda ni a tener closer. Queda como `SchedIntento` con estado 'descalificada'.
  · **Por el closer.** El closer lo ve al confirmar la llamada y toca «Descalificado» en la ficha:
    es una agenda que existe, con `closer_result` 'Descalificado' (`DESCALIFICADA`) y estado
    `descalificada` en el vocabulario del dashboard. Los que antes se marcaban «No Lead» cuentan acá
    también: es lo mismo con otro nombre (`derivar_estado` los lee como `descalificada`).

Las del closer ya salen de las filas de agendas (el panel Estados las cuenta); acá vive la mitad que
el panel no puede ver: las que el formulario cortó.
"""
from datetime import datetime, time


def por_formulario(start, end):
    """Leads que el formulario descalificó entre `start` y `end` (fechas, inclusive).

    Cuenta intentos 'descalificada' por la fecha en que el lead dejó sus datos, que es la que usa
    Stats: uno por lead y evento (por email). Un lead que se descalificó y después volvió a agendar
    sigue contando: el formulario SÍ lo descalificó esa vez.
    """
    # Import local: Agendas 2.0 es un módulo aparte que importa servicios de la operación.
    from app.agendas_v2.modelos import SchedIntento

    return SchedIntento.query.filter(
        SchedIntento.estado == 'descalificada',
        SchedIntento.creado_en >= datetime.combine(start, time.min),
        SchedIntento.creado_en <= datetime.combine(end, time.max),
    ).count()


def resumen(estados, start, end, closer_id=None):
    """`{'closer': n, 'formulario': n | None}` para el panel Estados de Analizar.

    `estados` es lo que devuelve `comercial_analitica.estados_de`. Con un closer elegido el
    formulario es None: esos leads no llegaron a tener closer, y mostrar el total del equipo al lado
    de las de un solo closer mezclaría dos universos distintos.
    """
    del_closer = sum(e['n'] for e in estados if e['key'] == 'descalificada')
    return {'closer': del_closer,
            'formulario': None if closer_id else por_formulario(start, end)}
