"""Por qué un lead que asistió al triage no pasó a closing (ADR-W153, pedido del 17/11/2026).

El triage lo elige al descalificar, en vez de la nota libre de antes: no tenía dinero, no encontramos
horario, puso una objeción que no se resolvió, u otro motivo. Los dos últimos piden contar cuál.

**Contrato** (lo leen el Reporte y la tarjeta «Por qué no pasaron a closing» de Dirección comercial ›
Triage; no cambiarlo sin avisar):

  · una fila de `lead_event_logs` con `action_type='motivo_triage'`, colgada de la agenda de triage
    (`origen='appointment'`, `origen_id`), con la clave en `payload['motivo']` y el rótulo en `description`;
  · el vigente de una agenda es su fila MÁS NUEVA, y solo vale mientras la agenda siga descalificada;
  · el texto (la objeción, el detalle) no va acá: es la nota de la llamada (`nota_llamada`), como antes.
    Sin columna nueva ni migración, igual que la objeción del closer (`objeciones_service`).

Una descalificada sin fila (reportada antes de este cambio, o desde una pestaña vieja) cuenta en `SIN_DATO`.
"""
from app.models import LeadEventLog
from app.services import lead_log_service

ACCION = 'motivo_triage'
MOTIVOS = {
    'sin_dinero': 'No tenía dinero',
    'sin_horario': 'No encontramos horario',
    'objecion': 'Puso una objeción y no la resolví',
    'otro': 'Otro motivo',
}
# Estos dos no dicen nada sin su texto.
_PIDE_TEXTO = {'objecion': 'Contá cuál fue la objeción.', 'otro': 'Contá cuál fue el motivo.'}
SIN_DATO = 'sin_dato'
CLAVES = tuple(MOTIVOS) + (SIN_DATO,)


def falta(datos):
    """(mensaje, campo) de lo que le falta al motivo de un descalificado, o None si está bien.
    Sin motivo se acepta solo con nota: es el reporte de una pestaña que quedó abierta de antes."""
    motivo = datos.get('motivo')
    nota = (datos.get('nota') or '').strip()
    if not motivo:
        return None if nota else ('Elegí por qué no pasó a closing.', 'motivo')
    if motivo not in MOTIVOS:
        return 'Ese motivo no existe.', 'motivo'
    if motivo in _PIDE_TEXTO and not nota:
        return _PIDE_TEXTO[motivo], 'nota'
    return None


def de(appt):
    """La clave del motivo vigente de una agenda descalificada, o None."""
    if appt is None or appt.triage_calificacion != 'descalificado':
        return None
    entrada = lead_log_service.ultima(ACCION, 'appointment', appt.id)
    return (entrada.payload or {}).get('motivo') if entrada else None


def guardar(appt, motivo, usuario):
    """Deja el motivo ya validado (`falta`). NO comitea: va junto con el reporte. Repetir el mismo no suma fila."""
    if not motivo or de(appt) == motivo:
        return None
    return lead_log_service.evento(appt, ACCION, f'No pasó a closing: {MOTIVOS[motivo]}', usuario,
                                   payload={'motivo': motivo})


def de_agendas(agendas):
    """`{id de la agenda: clave}` de las descalificadas que tienen motivo, en una sola consulta."""
    ids = [a.id for a in agendas if a.triage_calificacion == 'descalificado']
    if not ids:
        return {}
    vigentes = {}
    filas = (LeadEventLog.query.filter(LeadEventLog.action_type == ACCION, LeadEventLog.origen == 'appointment',
                                       LeadEventLog.origen_id.in_(ids))
             .order_by(LeadEventLog.created_at, LeadEventLog.id))
    for e in filas:
        clave = (e.payload or {}).get('motivo')
        if clave in MOTIVOS:
            vigentes[e.origen_id] = clave
    return vigentes
