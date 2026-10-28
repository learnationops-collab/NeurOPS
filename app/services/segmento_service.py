"""El segmento A/B/C/D en el cliente y en la agenda (docs/plan_segmentos_triage.md §8).

Lo calcula Thalamus al armar la reserva (`agenda_payload.segmento_lead`, ver nucleo/segmento.py). Este módulo lo
copia a las columnas en un `before_flush`, así cualquier camino que guarde un formulario o cree una agenda
lo deja escrito sin acordarse:
  - el cliente toma el de su último formulario (`formulario_payload`);
  - la agenda toma el de su propio payload y, si no trae (manual, setter, referido…), el de su cliente.
"""

import logging

from sqlalchemy import event, inspect

from app import db
from app.agendas_v2.nucleo.segmento import SEGMENTOS
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
    """El segmento de una reserva (`segmento_lead`; `segmento` es otra cosa: la regla y la estrategia del
    reparto), o None. Un formulario que no segmenta (Consultoría, Hiring…) no borra el que el lead ya tenía."""
    seg = payload.get('segmento_lead') if isinstance(payload, dict) else None
    return seg if isinstance(seg, dict) and seg.get('segmento') in SEGMENTOS else None


# Las mismas equivalencias que scripts/backfill_segmentos.py: opciones juntadas (§8.8) y renombradas (§8.9).
ALIAS = {'ogmgmpvwtgt': 'ogmdr0s275v'}
NO_DISPUESTO, PODRIA_AYUDA = 'oglxqqlugub', 'o8slpjgvje7'


def puntos_por_pregunta(payload):
    """{texto de la pregunta: puntos de segmento de la opción elegida} de una reserva de Thalamus, con los
    puntos de hoy del formulario (los mismos con los que se recalcula el segmento). Para que el closer vea de
    dónde sale la suma. Vacío si no es de Thalamus o el formulario no segmenta."""
    from app.agendas_v2.modelos import SchedFormulario

    if not isinstance(payload, dict) or not payload.get('formulario_id'):
        return {}
    fila = db.session.get(SchedFormulario, payload['formulario_id'])
    form = fila.datos if fila else None
    if not ((form or {}).get('segmento') or {}).get('activo'):
        return {}
    preguntas = {q['id']: q for q in form.get('preguntas') or [] if q.get('segmento')}
    puntos = {}
    for r in payload.get('respuestas') or []:
        q = preguntas.get(r.get('pregunta_id'))
        op = ALIAS.get(r.get('opcion_id'), r.get('opcion_id'))
        # Hasta el 26/10 esa opción decía «no estoy en posición de invertir»: es la de «podría conseguir ayuda».
        if op == NO_DISPUESTO and 'posici' in str(r.get('respuesta') or '').lower():
            op = PODRIA_AYUDA
        o = next((x for x in (q or {}).get('opciones') or [] if x.get('id') == op), None)
        if o is not None and o.get('puntosSeg') is not None:
            puntos[r.get('pregunta')] = o['puntosSeg']
    return puntos


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
