"""El motivo por el que una llamada con show up no cerró, para analizarlo.

Pedido de Mario (23/10/2026): «el motivo por el que no se cerró debería ser obligatorio [...] y que
vaya a una base, porque luego vamos a analizar los motivos y clasificarlos: los que no se
presentaron, los que sí se presentaron». Por ahora es texto libre («todavía no quiero marcar
motivos predeterminados hasta que no tengamos la suficiente información»): con la oferta
presentada es la objeción (que además guarda `objeciones_service`); sin oferta, su propia pregunta.

**Contrato** (no cambiarlo sin avisar a quien lo lea):

  · una fila de `lead_event_logs` con `action_type='motivo_no_cierre'`, `appointment_id` la agenda
    y `user_id` quien la reportó;
  · `description` es «Con oferta · <texto>» o «Sin oferta · <texto>»: se lee igual en la bitácora
    y se parte con `_leer`;
  · la vigente de una agenda es la más nueva. Sin columna nueva ni migración.
"""
from datetime import datetime

from app import db
from app.models import LeadEventLog

ACCION = 'motivo_no_cierre'
MINIMO = 10
MAXIMO = 2000
_PREFIJO = {True: 'Con oferta', False: 'Sin oferta'}
_SEP = ' · '


class MotivoInvalido(ValueError):
    """El motivo que llegó no tiene la forma `{texto, oferta_presentada}` o no alcanza."""


def motivo_valido(dato):
    """(texto, oferta_presentada) listos para guardar, None si no vino ninguno, o
    `MotivoInvalido` con el porqué en palabras."""
    if dato is None:
        return None
    if not isinstance(dato, dict):
        raise MotivoInvalido('El motivo de no cierre tiene que ser un texto.')
    texto = str(dato.get('texto') or '').strip()
    if len(texto) < MINIMO:
        raise MotivoInvalido(f'Contá por qué no se cerró (al menos {MINIMO} caracteres).')
    if len(texto) > MAXIMO:
        raise MotivoInvalido(f'El motivo es demasiado largo: el máximo es {MAXIMO} caracteres.')
    presentada = dato.get('oferta_presentada')
    if presentada not in (True, False):
        raise MotivoInvalido('Falta si se presentó la oferta.')
    return texto, presentada


def registrar_motivo(appt, usuario, motivo):
    """Guarda el motivo ya validado (`motivo_valido`). NO comitea: va junto con el reporte."""
    texto, presentada = motivo
    fila = LeadEventLog(appointment_id=appt.id, user_id=usuario.id, action_type=ACCION,
                        description=f'{_PREFIJO[presentada]}{_SEP}{texto}', created_at=datetime.utcnow())
    db.session.add(fila)
    return fila


def _leer(descripcion):
    prefijo, _, texto = (descripcion or '').partition(_SEP)
    return {'oferta_presentada': prefijo == _PREFIJO[True], 'texto': texto or descripcion}


def motivos_por_agenda(ids):
    """{appointment_id: {'texto', 'oferta_presentada', 'autor', 'fecha'}} con el motivo vigente de
    cada agenda que tiene uno."""
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
