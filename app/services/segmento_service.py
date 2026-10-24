"""El segmento A/B/C/D en el cliente y en la agenda (docs/plan_segmentos_triage.md §8).

Lo calcula Thalamus al armar la reserva (`agenda_payload.segmento`, ver nucleo/segmento.py). Este módulo lo
copia a las columnas en un `before_flush`, así cualquier camino que guarde un formulario o cree una agenda
lo deja escrito sin acordarse:
  - el cliente toma el de su último formulario (`formulario_payload`);
  - la agenda toma el de su propio payload y, si no trae (manual, setter, referido…), el de su cliente.
"""

import logging

from sqlalchemy import event, inspect

from app import db
from app.models.booking import Appointment
from app.models.client import Client

logger = logging.getLogger(__name__)

COLUMNAS = {
    'segmento': 'segmento',
    'segmento_puntos': 'puntos',
    'segmento_preguntas': 'preguntas',
    'segmento_confianza': 'confianza',
    'segmento_version': 'version',
}


def aplicar(fila, seg):
    """Escribe el segmento (el dict de nucleo/segmento.py) en las columnas. None las deja vacías."""
    seg = seg or {}
    for columna, clave in COLUMNAS.items():
        setattr(fila, columna, seg.get(clave))


def copiar(destino, origen):
    for columna in COLUMNAS:
        setattr(destino, columna, getattr(origen, columna))


def _cambio(fila, campo):
    return inspect(fila).attrs[campo].history.has_changes()


def _del_payload(payload):
    """El segmento de una reserva, o None. Un formulario que no segmenta (Consultoría, Hiring…) no
    borra el que el lead ya tenía."""
    return payload.get('segmento') if isinstance(payload, dict) else None


def mantener(session):
    with session.no_autoflush:
        filas = list(session.new) + list(session.dirty)
        for c in [f for f in filas if isinstance(f, Client)]:
            if c in session.new or _cambio(c, 'formulario_payload'):
                seg = _del_payload(c.formulario_payload)
                if seg:
                    aplicar(c, seg)
        for a in [f for f in filas if isinstance(f, Appointment)]:
            nueva = a in session.new
            if nueva or _cambio(a, 'agenda_payload'):
                seg = _del_payload(a.agenda_payload)
                if seg:
                    aplicar(a, seg)
                    continue
            if nueva and a.segmento is None:
                cliente = a.client or (db.session.get(Client, a.client_id) if a.client_id else None)
                if cliente is not None and cliente.segmento:
                    copiar(a, cliente)


def register_segmento_tracking(app):
    @event.listens_for(db.session, 'before_flush')
    def _segmento_before_flush(session, flush_context, instances):
        try:
            mantener(session)
        except Exception as e:
            # La agenda se guarda igual: el segmento que faltó lo completa scripts/backfill_segmentos.py.
            logger.error(f'[SEGMENTO] No se pudo guardar el segmento: {e}')
