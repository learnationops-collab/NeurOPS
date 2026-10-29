"""Estado de las citas de un taller: a que columna del desglose va cada una y cuantas se reportaron.

Vive aparte de `workshop_metrics_service` (que lo importa) por el limite de lineas.

SHOW UP DE CITAS (24/10/2026): asistieron / (asistieron + no show), o sea solo las citas con
resultado. Dividir por TODAS las agendadas mezclaba citas futuras, canceladas, reagendadas,
descartadas y las que el closer nunca reporto, y el porcentaje dependia de cuantas llamadas
quedaban sin reportar en cada taller (62% el 26/09, 31% el 12/10). Las sin reportar se cuentan
aparte (`sin_reportar`): llamada ya vencida sin resultado, o archivada por el sistema sin reporte.
"""
from datetime import datetime

from app.services.fuente_service import normalizar

# Estados de la hoja de agendas que marcan a la persona como compradora cuando la venta todavia no
# esta cargada. 'seña'/'sena' ya no: una seña es una reserva, no un cierre (pedido del usuario,
# 30/09/2026: "el close rate no debe tomar señas").
ESTADOS_DE_VENTA = ['cierre', 'completo', 'ganado', 'venta', 'vendido', 'completado']

# Estados normalizados: la persona se presento / la llamada aun no ocurrio ('por_confirmar',
# 'confirmado' y 'conversando' son etapas de la confirmacion, no un resultado) / no se presento.
_ES_SHOW_UP = {'show up', 'asistio', 'cerrada', 'cerrado', 'completada', 'terminada', 'follow up',
               '2th call', '2da call', '2da llamada'} | set(ESTADOS_DE_VENTA)
_ES_PENDIENTE = {'', 'pendiente', 'por confirmar', 'confirmado', 'conversando', 'contactado'}
ARCHIVADA = 'archivada sin reporte'


def bucket_estado(estado):
    """A cual de las 6 columnas del desglose pertenece un estado. 'Cerrada', 'Follow Up' y '2TH Call'
    son citas a las que la persona asistio: caian en "Otros" y el close rate podia superar el show up."""
    e = normalizar(estado)
    if e in _ES_SHOW_UP:
        return "Show Up"
    if e in ('no show', 'inasistencia'):
        return "No Show"
    if e in ('cancelado', 'cancelada'):
        return "Cancelada"
    if e in ('reagendado', 'reagendada'):
        return "Reagendada"
    if e in _ES_PENDIENTE:
        return "Pendiente"
    return "Otros"


def bucket_de_persona(agendas, estado_de, ahora):
    """(columna del desglose, ¿sin reportar?) de UNA persona (su grupo de `_agrupar_por_persona`)."""
    estados = [(a.date, estado_de(a)) for a in agendas]
    buckets = [(f, bucket_estado(e)) for f, e in estados]
    if any(b == "Show Up" for _, b in buckets):
        return "Show Up", False
    i = max(range(len(buckets)), key=lambda k: (buckets[k][0] is not None, buckets[k][0]))
    fecha, bucket = buckets[i]
    vencida = fecha is not None and fecha < ahora
    return bucket, (bucket == "Pendiente" and vencida) or normalizar(estados[i][1]) == ARCHIVADA


def desglose_de_personas(personas, estado_de, ahora=None):
    """Cuenta PERSONAS, no filas: recibe los grupos de `_agrupar_por_persona`.

    Quien reprograma queda con dos filas (el webhook solo reconoce un duplicado si la reunion cae el
    MISMO dia) y antes sumaba dos veces. A cada persona le corresponde una sola columna: la de su
    ultima cita, salvo que haya asistido a alguna, en cuyo caso es Show Up -- lo que ya logro no lo
    borra una reprogramacion posterior.

    `estado_de(agenda)` es el estado real de la cita. Devuelve `show_up`, `desglose`, `reportadas`
    (con resultado: show up + no show) y `sin_reportar` (ver el docstring del modulo).
    """
    ahora = ahora or datetime.utcnow()
    desglose = {"Show Up": 0, "No Show": 0, "Cancelada": 0, "Reagendada": 0, "Pendiente": 0, "Otros": 0}
    sin_reportar = 0
    for agendas in personas:
        bucket, sin = bucket_de_persona(agendas, estado_de, ahora)
        desglose[bucket] += 1
        sin_reportar += 1 if sin else 0
    reportadas = desglose["Show Up"] + desglose["No Show"]
    return {"show_up": desglose["Show Up"], "desglose": desglose, "reportadas": reportadas,
            "sin_reportar": sin_reportar}
