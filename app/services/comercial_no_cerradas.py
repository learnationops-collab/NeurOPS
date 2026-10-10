"""«No cerradas» del panel Cierre: la lista de las llamadas con show up que no terminaron ni en venta
ni en seña, con la objeción que quedó registrada en cada una.

Pedido del usuario (09/10/2026): el dato «No cerradas» de la tarjeta Cierre «debe mostrar un modal
con el lead y la objeción registrada», y desde ahí ir a la lista de esas agendas en Revisar.

Las filas son las MISMAS de `ComercialService.agendas` —las de Revisar y las que cuenta el panel—,
cortadas por la misma marca `no_cerrada`: así el modal, el número de la tarjeta y la lista de Revisar
no pueden dar tres cantidades distintas. Vive aparte de `comercial_analitica.py` porque esa es la
analítica del período (conteos), y esto es una lista que se pide recién cuando se abre el modal: leer
las objeciones de cada agenda no tiene por qué pagarse en cada carga del dashboard.

La objeción la lee `objeciones_service.objeciones_por_agenda`, que es el dueño del contrato (cómo se
guarda y cuál es la vigente): una sola consulta para todas las agendas de la lista.
"""
from app.services.comercial_service import ComercialService
from app.services.objeciones_service import objeciones_por_agenda


def no_cerradas(start, end, closer_id=None):
    """Las agendas del período (por la fecha de la reunión, como el panel) que asistieron y no
    cerraron, cada una con su `objecion` (o None). En el orden de Revisar: la más reciente primero."""
    filas = [f for f in ComercialService.agendas(start, end, closer_id=closer_id) if f['no_cerrada']]
    objeciones = objeciones_por_agenda([f['id'] for f in filas])
    for f in filas:
        f['objecion'] = objeciones.get(f['id'])
    return filas
