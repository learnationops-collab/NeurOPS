"""Qué agendas No show fueron descartadas por el closer (ADR-W109/W110).

El estado sigue siendo No show y cuenta como tal; el descarte es una etiqueta al lado («Descartado»):
el lead no respondió ningún mensaje. Lo dice la nota del descarte (`payload.descarte`), que deja el
árbol de Resultado desde el 06/11/2026 y la corrección de las 13 agendas viejas del mismo día.
"""
from app.models import LeadEventLog, db

AYUDA = 'No respondió ningún mensaje; el closer lo descartó.'


def ids_descartados(appt_ids):
    """El subconjunto de `appt_ids` con nota de descarte."""
    ids = [i for i in set(appt_ids or ()) if i]
    if not ids:
        return set()
    filas = (db.session.query(LeadEventLog.origen_id, LeadEventLog.payload)
             .filter(LeadEventLog.origen == 'appointment', LeadEventLog.origen_id.in_(ids),
                     LeadEventLog.payload.isnot(None))
             .all())
    return {oid for oid, payload in filas if isinstance(payload, dict) and payload.get('descarte')}


def marcar(filas, clave_id='id', es_no_show=None):
    """Suma `descartado: True` a las filas No show con descarte. `es_no_show(fila)` elige cuáles mirar."""
    candidatas = [f for f in filas if es_no_show(f)]
    descartadas = ids_descartados(f[clave_id] for f in candidatas)
    for f in candidatas:
        if f[clave_id] in descartadas:
            f['descartado'] = True
    return filas
