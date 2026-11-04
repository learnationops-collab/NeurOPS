"""La regla de Marketing para saber por qué palabra clave llegó una persona (de `anuncios_service`, por las 500 líneas).

La usan el tablero (`anuncios_service`, agendas y cobros) y el origen guardado de cada agenda (`origen_service`).
"""
from app.services.anuncios_claves_service import _interacciones
from app.services.cruce_conversaciones import Cruce


class _Atribuidor:
    """Le busca a una agenda o a una venta la palabra clave por la que llegó la persona: la de su
    última interacción de ManyChat hasta `tope` (la reunión o el pago).

    La conversación se busca con `cruce_conversaciones.Cruce`: primero la de la misma persona
    (`person_uuid`, plan_personas), después el Instagram exacto, el parecido y el nombre (Kerwin, 15/10/2026: el setter escribe mal el Instagram —«julio_garca» por «juliocgarca»—
    o pone el nombre en su lugar; 30 de 175 agendas pendientes en staging se resolvían así)."""

    def __init__(self, igs, clave_de_anuncio, nombres=(), personas=()):
        self.cruce = Cruce(igs, nombres, personas)
        self.interacciones = _interacciones(self.cruce.lead_ids(), clave_de_anuncio)

    def _ultima(self, lead_ids, tope):
        mejor, primera = None, None
        for lead_id in lead_ids:
            for creada, clave, *_ in self.interacciones.get(lead_id, ()):
                if not clave:
                    continue
                if primera is None or creada < primera[0]:
                    primera = (creada, clave, lead_id)
                if (tope is None or creada <= tope) and (mejor is None or creada > mejor[0]):
                    mejor = (creada, clave, lead_id)
        # Si hasta `tope` no había ninguna, la primera que la persona tuvo después: es la misma persona, y
        # una seña pagada antes de escribir la palabra clave es de ese mismo anuncio (04/11/2026).
        return mejor or primera

    def origen(self, ig, tope, nombre=None, persona=None):
        """(conversación, palabra clave) por la que llegó la persona, o (None, None)."""
        for lead_ids in self.cruce.candidatos(ig, nombre, persona):
            elegida = self._ultima(lead_ids, tope)
            if elegida:
                return elegida[2], elegida[1]
        return None, None

    def clave(self, ig, tope, nombre=None, persona=None):
        return self.origen(ig, tope, nombre, persona)[1]
