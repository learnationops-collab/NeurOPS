"""Avance, seguimiento del equipo y uso del alumno para la pestaña Fulfillment (ADR-W016).

Sale del expediente de la Academia (`agent/ask` con `expediente`, sin IA), que desde el ADR-202 de la Academia
trae `recorrido` (las sesiones), `seguimiento` (objetivos abiertos con su próximo paso y protocolo, y las últimas
acciones con su respuesta) y `uso` (Pulso y días activos). Acá solo se elige y se ordena: las cuentas son de allá.
"""
from datetime import datetime

from app.services import bitacora_lead_service as bitacora

# La bitácora de uso: lo que hace el alumno. Seguimiento y Cuenta y pagos ya están en otros bloques.
GRUPOS_USO = ('Ingresos', 'Estudio', 'Entregas', 'Sesiones y clases')
BITACORA_USO = 60
REGISTROS = 8


def _registros(exp):
    """Lo último que anotó el equipo: acciones (con su respuesta), observaciones y victorias, lo más nuevo primero."""
    seg = exp.get('seguimiento') or {}
    regs = [{'clase': 'accion', 'fecha': a.get('fecha'), 'por': a.get('por'), 'texto': a.get('texto'),
             'protocolo': a.get('protocolo'), 'respuesta': a.get('respuesta'),
             'tipo_respuesta': a.get('tipo_respuesta'), 'dijo': a.get('dijo')}
            for a in seg.get('acciones') or []]
    regs += [{'clase': 'observacion', 'fecha': o.get('fecha'), 'por': o.get('por'), 'texto': o.get('texto'),
              'tipo': o.get('tipo')}
             for o in exp.get('observaciones') or [] if o.get('tipo') not in ('esperando_respuesta', 'sin_respuesta', 'devolucion')]
    regs += [{'clase': 'victoria', 'fecha': v.get('fecha'), 'por': v.get('por'), 'texto': v.get('que_logro'),
              'detalle': v.get('por_que_cuenta')}
             for v in exp.get('victorias') or []]
    regs = [r for r in regs if r['fecha']]
    regs.sort(key=lambda r: bitacora._utc(r['fecha']) or datetime.min, reverse=True)
    return regs[:REGISTROS]


def seguimiento(client, quien=None):
    """`{recorrido, seguimiento, uso, registros, bitacora, aviso}`; sin vínculo o sin respuesta, todo vacío y el aviso."""
    exp, aviso = bitacora.expediente(client, quien)
    if exp is None:
        return {'recorrido': None, 'seguimiento': None, 'uso': None, 'registros': [], 'bitacora': [], 'aviso': aviso}
    uso = [b for b in exp.get('bitacora') or [] if b.get('grupo') in GRUPOS_USO and b.get('fecha')]
    uso.sort(key=lambda b: bitacora._utc(b['fecha']) or datetime.min, reverse=True)
    return {
        'recorrido': exp.get('recorrido'),
        'seguimiento': {'objetivos': (exp.get('seguimiento') or {}).get('objetivos') or []},
        'uso': exp.get('uso'),
        'registros': _registros(exp),
        'bitacora': uso[:BITACORA_USO],
        'aviso': None,
    }
