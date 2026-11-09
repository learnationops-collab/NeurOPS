"""El reporte de la Momentum en la ficha (ADR-W129): como el de la venta, con lo básico de la llamada.

Después de «Asistió» la ficha no pregunta decisor ni oferta: pregunta si el alumno sigue (`respuestas.sigue`):

- `pago`: sigue y pagó → la venta, por el camino de siempre (accion `venta`);
- `plan`: sigue con un plan de pago y hoy no paga → se arma el plan del saldo (`datos.momentum.plan`), solo si no
  tiene uno;
- `pensando`: no decidió → objeción y seguimiento, como un «No cerró»;
- `no`: no sigue (en la de cierre, no hace el upsell por ahora) → motivo.

`sugerencia` lee la nota de Gemini de la llamada (app/services/notas_meet/, la Momentum la organiza team@:
ADR-W127/W128) y propone esas respuestas para precargar el reporte. Queda guardada en la agenda
(`agenda_payload.momentum_nota`) para no volver a pedírsela a Claude.
"""
import logging

from app import db

logger = logging.getLogger(__name__)

SIGUE = ('pago', 'plan', 'pensando', 'no')
# Cómo se lee cada respuesta, según la Momentum: (seña, cierre).
ETIQUETAS = {
    'pago': ('Sigue: pagó', 'Hizo el upsell'),
    'plan': ('Sigue con plan de pago', 'Upsell con plan de pago'),
    'pensando': ('Lo está pensando', 'Lo está pensando'),
    'no': ('No sigue', 'No por ahora'),
}
FEATURE = 'momentum_nota'
CONTENIDO_MAX = 30000


def sigue_de(datos):
    respuestas = (datos or {}).get('respuestas')
    valor = respuestas.get('sigue') if isinstance(respuestas, dict) else None
    return valor if valor in SIGUE else None


def etiqueta(sigue, tipo):
    par = ETIQUETAS.get(sigue)
    return (par[0] if tipo == 'sena' else par[1]) if par else None


def _plan_valido(appt, plan):
    from app.models import InstallmentPlan
    from app.services.ficha_acciones_service import ErrorDeAccion

    if not isinstance(plan, dict):
        raise ErrorDeAccion('Falta el plan de pago.', 'plan')
    try:
        total, num = float(plan.get('total') or 0), int(plan.get('num_cuotas') or 0)
    except (TypeError, ValueError):
        raise ErrorDeAccion('El plan necesita el total y la cantidad de cuotas.', 'plan') from None
    if total <= 0 or num < 1:
        raise ErrorDeAccion('El plan necesita el total y al menos una cuota.', 'plan')
    programa = (plan.get('programa_code') or '').strip().upper() or None
    pagadas = InstallmentPlan.query.filter_by(client_id=appt.client_id, programa_code=programa, estado='pagado').count()
    if pagadas:
        raise ErrorDeAccion('Ya tiene un plan de este programa con cuotas cobradas: cobrá la que corresponde.', 'plan')
    return programa


def resultado(appt, datos, usuario):
    """El resultado de la llamada (ficha_acciones_service.resultado) y, si sigue con plan, el plan del saldo.
    El plan se valida antes de guardar nada."""
    from app.services import ficha_acciones_service as acciones

    plan = ((datos.get('momentum') or {}) if isinstance(datos.get('momentum'), dict) else {}).get('plan')
    con_plan = sigue_de(datos) == 'plan'
    programa = _plan_valido(appt, plan) if con_plan else None
    res = acciones.resultado(appt, datos, usuario)
    if con_plan:
        acciones.plan_cuotas(appt, {**plan, 'programa_code': programa}, usuario)
        db.session.commit()
    return res


# --- La nota de Gemini --------------------------------------------------------------------------

HERRAMIENTA = {
    'name': 'reporte_momentum',
    'description': 'Lo que se decidió en la llamada Momentum, según la nota de la reunión.',
    'input_schema': {
        'type': 'object',
        'properties': {
            'sigue': {'type': 'string', 'enum': [*SIGUE, 'no_se_sabe'],
                      'description': 'pago: pagó en la llamada; plan: sigue y acordó cómo paga el saldo sin pagar hoy; '
                                     'pensando: no decidió; no: no sigue; no_se_sabe: la nota no lo dice.'},
            'num_cuotas': {'type': 'integer', 'description': 'Cuotas acordadas para el saldo, si se dijo.'},
            'dia_de_pago': {'type': 'integer', 'description': 'Día del mes en que paga, si se dijo.'},
            'monto_hoy': {'type': 'number', 'description': 'Lo que pagó o va a pagar hoy, si se dijo.'},
            'objecion': {'type': 'string', 'description': 'Por qué no sigue o qué lo frena, con sus palabras.'},
            'proximo_paso': {'type': 'string', 'description': 'Lo que quedaron en hacer y cuándo.'},
            'resumen': {'type': 'string', 'description': 'Dos o tres oraciones de cómo fue la llamada.'},
        },
        'required': ['sigue', 'resumen'],
    },
}
SISTEMA = ('Leés la nota que Gemini tomó de una llamada Momentum entre un closer de Learnation y un alumno. En la de seña '
           'se define si el alumno sigue en el programa y cómo paga el saldo; en la de cierre, si hace el upsell. '
           'Contestá solo con lo que la nota dice; lo que no dice, dejalo vacío. En español.')


def _nota_de(appt):
    from app.models import MeetingNote

    return (MeetingNote.query.filter_by(appointment_id=appt.id).order_by(MeetingNote.id.desc()).first()
            if appt else None)


def sugerencia(appt, usuario):
    """{nota_id, doc_url, sigue?, num_cuotas?, …} o None si la llamada no tiene nota. Nunca lanza."""
    from app.services.claude_service import ClaudeService

    nota = _nota_de(appt)
    if not nota or not (nota.content or nota.summary):
        return None
    guardada = (appt.agenda_payload or {}).get('momentum_nota') or {}
    if guardada.get('nota_id') == nota.id:
        return guardada
    try:
        respuesta = ClaudeService.create_message(
            FEATURE, usuario.id if usuario else None, max_tokens=1500, system=SISTEMA,
            tools=[HERRAMIENTA], tool_choice={'type': 'tool', 'name': HERRAMIENTA['name']},
            messages=[{'role': 'user', 'content': (nota.content or nota.summary)[:CONTENIDO_MAX]}])
    except Exception as e:  # noqa: BLE001
        logger.error(f'[MOMENTUM] No se pudo leer la nota {nota.id} de la agenda #{appt.id}: {e}')
        return None
    datos = next((dict(b.input) for b in respuesta.content if getattr(b, 'type', None) == 'tool_use'), None)
    if not datos:
        return None
    if datos.get('sigue') not in SIGUE:
        datos.pop('sigue', None)
    datos.update(nota_id=nota.id, doc_url=nota.doc_url)
    appt.agenda_payload = {**(appt.agenda_payload or {}), 'momentum_nota': datos}
    db.session.commit()
    return datos
