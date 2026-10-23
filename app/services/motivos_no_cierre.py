"""El motivo clasificado por el que una llamada con show up no cerró.

Pedido de Mario (23/10/2026): «el motivo por el que no se cerró debería ser obligatorio [...] y que
vaya a una base, porque luego vamos a analizar los motivos y clasificarlos: los que no se
presentaron, los que sí se presentaron». La objeción (`objeciones_service`) es el texto libre de un
«No cerró» con oferta; esto es la categoría elegida de una lista, en las dos ramas: con oferta
presentada y sin ella.

**Contrato** (no cambiarlo sin avisar a quien lo lea):

  · una fila de `lead_event_logs` con `action_type='motivo_no_cierre'`, `appointment_id` la agenda
    y `user_id` quien la reportó;
  · `description` es «Con oferta · <categoría>» o «Sin oferta · <categoría>», con «: <detalle>» al
    final si se escribió uno («Otro motivo: …»). Se lee igual en la bitácora y se parte con
    `_leer`;
  · la vigente de una agenda es la más nueva. Sin columna nueva ni migración.
"""
from datetime import datetime

from app import db
from app.models import LeadEventLog

ACCION = 'motivo_no_cierre'
MAXIMO_CATEGORIA = 120
MAXIMO_DETALLE = 500
_PREFIJO = {True: 'Con oferta', False: 'Sin oferta'}
_SEP = ' · '


class MotivoInvalido(ValueError):
    """El motivo que llegó no tiene la forma `{categoria, oferta_presentada, detalle?}`."""


def motivo_valido(dato):
    """(categoria, oferta_presentada, detalle) listos para guardar, None si no vino ninguno, o
    `MotivoInvalido` con el porqué en palabras."""
    if dato is None:
        return None
    if not isinstance(dato, dict):
        raise MotivoInvalido('El motivo de no cierre tiene que traer la categoría.')
    categoria = str(dato.get('categoria') or '').strip()
    if not categoria:
        raise MotivoInvalido('Falta el motivo por el que no se cerró.')
    if len(categoria) > MAXIMO_CATEGORIA:
        raise MotivoInvalido('El motivo es demasiado largo.')
    presentada = dato.get('oferta_presentada')
    if presentada not in (True, False):
        raise MotivoInvalido('Falta si se presentó la oferta.')
    detalle = str(dato.get('detalle') or '').strip()[:MAXIMO_DETALLE] or None
    return categoria, presentada, detalle


def registrar_motivo(appt, usuario, motivo):
    """Guarda el motivo ya validado (`motivo_valido`). NO comitea: va junto con el reporte."""
    categoria, presentada, detalle = motivo
    texto = f'{_PREFIJO[presentada]}{_SEP}{categoria}{f": {detalle}" if detalle else ""}'
    fila = LeadEventLog(appointment_id=appt.id, user_id=usuario.id, action_type=ACCION,
                        description=texto, created_at=datetime.utcnow())
    db.session.add(fila)
    return fila


def _leer(texto):
    prefijo, _, resto = (texto or '').partition(_SEP)
    categoria, _, detalle = resto.partition(': ')
    return {'oferta_presentada': prefijo == _PREFIJO[True], 'categoria': categoria or texto,
            'detalle': detalle or None}


def motivos_por_agenda(ids):
    """{appointment_id: {'categoria', 'oferta_presentada', 'detalle', 'autor', 'fecha'}} con el
    motivo vigente de cada agenda que tiene uno."""
    ids = [i for i in (ids or []) if i is not None]
    if not ids:
        return {}
    filas = (LeadEventLog.query
             .filter(LeadEventLog.action_type == ACCION, LeadEventLog.appointment_id.in_(ids))
             .order_by(LeadEventLog.created_at.asc(), LeadEventLog.id.asc()).all())
    return {e.appointment_id: {**_leer(e.description),
                               'autor': e.user.username if e.user else 'Sistema',
                               'fecha': e.created_at.isoformat() if e.created_at else None}
            for e in filas}
