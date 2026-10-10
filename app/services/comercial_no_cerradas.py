"""«No cerradas» del panel Cierre: la lista de las llamadas con show up que no terminaron ni en venta
ni en seña, con la objeción que quedó registrada en cada una.

Pedido del usuario (09/10/2026): el dato «No cerradas» de la tarjeta Cierre «debe mostrar un modal
con el lead y la objeción registrada», y desde ahí ir a la lista de esas agendas en Revisar.

Las filas son las MISMAS de `ComercialService.agendas` —las de Revisar y las que cuenta el panel—,
cortadas por la misma marca `no_cerrada`: así el modal, el número de la tarjeta y la lista de Revisar
no pueden dar tres cantidades distintas. Vive aparte de `comercial_analitica.py` porque esa es la
analítica del período (conteos), y esto es una lista que se pide recién cuando se abre el modal: leer
las objeciones de cada agenda no tiene por qué pagarse en cada carga del dashboard.
"""
from app import db
from app.models import LeadEventLog, User
from app.services.comercial_service import ComercialService

# Cómo se registra una objeción (contrato con la ficha del lead, que es donde se escribe): una fila
# de `lead_event_logs` con este `action_type`, `appointment_id` = la agenda, `user_id` = quien la
# cargó y `description` = el texto tal como se escribió. La más reciente de cada agenda es la vigente.
ACCION_OBJECION = 'objecion'

# Cuántos ids van en cada `IN (...)`: SQLite viejo corta en 999 variables, y un período de 90 días
# del equipo entero puede pasarlo.
_LOTE = 500


def objeciones_de(ids):
    """`{appointment_id: {'texto', 'autor', 'fecha'}}` con la objeción vigente de cada agenda.

    Una consulta por lote de ids, no una por agenda: el modal lista decenas de filas. Las agendas sin
    objeción no aparecen en el resultado.
    """
    ids = sorted({i for i in ids if i})
    salida = {}
    for desde in range(0, len(ids), _LOTE):
        lote = ids[desde:desde + _LOTE]
        filas = (db.session.query(LeadEventLog.appointment_id, LeadEventLog.description,
                                  LeadEventLog.created_at, User.username)
                 .outerjoin(User, User.id == LeadEventLog.user_id)
                 .filter(LeadEventLog.action_type == ACCION_OBJECION,
                         LeadEventLog.appointment_id.in_(lote))
                 .order_by(LeadEventLog.created_at.asc(), LeadEventLog.id.asc())
                 .all())
        # En orden de carga: la última que se escribe en el diccionario es la vigente.
        for appointment_id, texto, fecha, autor in filas:
            salida[appointment_id] = {'texto': texto, 'autor': autor,
                                      'fecha': fecha.isoformat() if fecha else None}
    return salida


def no_cerradas(start, end, closer_id=None):
    """Las agendas del período (por la fecha de la reunión, como el panel) que asistieron y no
    cerraron, cada una con su `objecion` (o None). En el orden de Revisar: la más reciente primero."""
    filas = [f for f in ComercialService.agendas(start, end, closer_id=closer_id) if f['no_cerrada']]
    objeciones = objeciones_de(f['id'] for f in filas)
    for f in filas:
        f['objecion'] = objeciones.get(f['id'])
    return filas
