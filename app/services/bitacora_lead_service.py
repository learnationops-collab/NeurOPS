"""La bitácora del lead (23/10/2026): todo lo que pasó con una persona, de la primera palabra clave a sus
meses en la Academia, repartido en tramos para saber qué pasó en cada momento.

Tramos:
  · Pre call: la conversación de Instagram y cuándo agendó.
  · Call y venta: las llamadas, los seguimientos, la venta y los pagos hasta que arranca el acceso.
  · Primer mes / Segundo y tercer mes / Después: contados desde el primer acceso a la Academia (su
    primera suscripción en Work). Ahí va lo de Work de esas fechas y la bitácora de la Academia.

Lo de la Academia sale de `agent/ask` con `expediente` (ADR-168), que es una consulta sin IA. Si la
Academia no responde, la bitácora sale igual con lo de Work y un aviso.
"""
import logging
from datetime import datetime, timedelta, timezone

from app.services import bitacora_lead_work as work
from app.services import ficha_lead_secciones as secciones

logger = logging.getLogger(__name__)

TRAMOS = [
    {'key': 'pre_call', 'label': 'Pre call'},
    {'key': 'call_venta', 'label': 'Call y venta'},
    {'key': 'mes_1', 'label': 'Primer mes'},
    {'key': 'mes_2_3', 'label': 'Segundo y tercer mes'},
    {'key': 'despues', 'label': 'Después del tercer mes'},
]
# El día que arranca el acceso todavía es de la venta: la entrada de ese día queda en Call y venta.
DIAS_MES_1 = 30
DIAS_MES_3 = 90

_TONO_ACADEMIA = {'Estudio': 'info', 'Entregas': 'brand-primary', 'Sesiones y clases': 'brand-secondary',
                  'Seguimiento': 'warning', 'Cuenta y pagos': 'success', 'Ingresos': 'idle'}


def _utc(iso):
    """Un instante ISO de la Academia (con zona) como datetime UTC sin zona, como los de Work."""
    try:
        dt = datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
    except (TypeError, ValueError):
        return None
    return dt.astimezone(timezone.utc).replace(tzinfo=None) if dt.tzinfo else dt


def tramo_de(fecha, inicio, de_academia=False):
    """El tramo de una entrada por su fecha. Sin acceso a la Academia todo lo que no es Pre call es Call y
    venta. Lo de la Academia anterior al acceso (la cuenta se crea antes) cuenta como primer mes."""
    if not inicio or (fecha.date() <= inicio.date() and not de_academia):
        return 'call_venta'
    dias = (fecha.date() - inicio.date()).days
    if dias <= DIAS_MES_1:
        return 'mes_1'
    return 'mes_2_3' if dias <= DIAS_MES_3 else 'despues'


def _clave_academia(client):
    from app.services import person_service

    alumno_id = person_service.dato(client.person, 'learnation_user_id') if client.person else None
    if alumno_id:
        return {'alumno_id': int(alumno_id)}
    return {'work_uuid': client.person_uuid} if client.person_uuid else None


def expediente(client, quien=None):
    """(expediente, aviso) de la Academia. `aviso` dice por qué falta, si falta."""
    from app.services.learnation_service import LearnationAPIError, LearnationService

    clave = _clave_academia(client)
    if not clave:
        return None, 'No está vinculado a la Academia.'
    try:
        return LearnationService.agent_ask(expediente=clave, quien=quien), None
    except LearnationAPIError as e:
        if getattr(e, 'status_code', None) == 404:
            return None, 'No tiene cuenta en la Academia.'
        logger.error(f'[bitacora] expediente de la Academia ({clave}): {e}')
        return None, 'La Academia no respondió: se muestra solo lo de Work.'


def academia(client, quien=None):
    """(entradas, aviso) del expediente de la Academia. `aviso` dice por qué falta, si falta."""
    exp, aviso = expediente(client, quien)
    if exp is None:
        return [], aviso

    out = []
    for i, b in enumerate(exp.get('bitacora') or []):
        out.append(work.entrada(f'ac:{i}', _utc(b.get('fecha')), b.get('grupo') or 'Academia', b.get('que') or '',
                                b.get('detalle'), _TONO_ACADEMIA.get(b.get('grupo'), 'idle'), b.get('por')))
    for i, v in enumerate(exp.get('victorias') or []):
        out.append(work.entrada(f'vic:{i}', _utc(v.get('fecha')), 'Victoria', v.get('que_logro') or 'Victoria',
                                v.get('por_que_cuenta'), 'success', v.get('por'))
                   | {'link': v.get('link'), 'captura': v.get('captura')})
    for i, o in enumerate(exp.get('observaciones') or []):
        out.append(work.entrada(f'obs:{i}', _utc(o.get('fecha')), 'Observación', o.get('texto') or '',
                                o.get('tipo'), 'idle', o.get('por')))
    return out, None


# Lo que escribe el equipo de la Academia (Fulfillment, consultores, CES): observaciones, objetivos y acciones.
GRUPOS_COMENTARIO = ('Seguimiento', 'Observación', 'Victoria')


def comentarios(client, quien=None):
    """`{comentarios, aviso}`: lo que anotó el equipo de la Academia sobre el alumno, lo más nuevo primero.

    Para la pestaña Fulfillment (reunión del 26/10): el closer ve los comentarios de Fulfillment sin abrir la
    bitácora entera. Sale del mismo expediente que la bitácora; sin vínculo o sin respuesta, viaja el aviso.
    """
    entradas, aviso = academia(client, quien)
    elegidas = [e for e in entradas if e['grupo'] in GRUPOS_COMENTARIO and e['fecha']]
    elegidas.sort(key=lambda e: e['fecha'], reverse=True)
    return {'comentarios': [{**e, 'fecha': e['fecha'].isoformat() + 'Z'} for e in elegidas], 'aviso': aviso}


def bitacora(client, quien=None, ahora=None):
    """`{inicio_academia, aviso_academia, tramos: [{key, label, entradas}]}`; cada tramo en orden de fecha."""
    ahora = ahora or datetime.utcnow()
    appts = work.agendas_del_cliente(client)
    hist = secciones.historial(appts, ahora)
    chips = {a['id']: a['chip'] for a in hist['agendas']}
    inicio = work.inicio_academia(client)

    de_work = (work.conversacion(client.person_uuid) + work.agendas(appts, chips)
               + work.ventas_y_pagos(client, work.pagos_del_cliente(client)))
    de_academia, aviso = academia(client, quien) if inicio else ([], None)

    por_tramo = {t['key']: [] for t in TRAMOS}
    for e, es_academia in [(e, False) for e in de_work] + [(e, True) for e in de_academia]:
        if not e['fecha']:
            continue
        tramo = e.pop('tramo', None) or tramo_de(e['fecha'], inicio, es_academia)
        por_tramo[tramo].append({**e, 'origen': 'academia' if es_academia else 'work'})

    tramos = []
    for t in TRAMOS:
        entradas = sorted(por_tramo[t['key']], key=lambda e: e['fecha'])
        # «Después» solo aparece si tiene algo; los otros siempre, para que se vea qué falta.
        if t['key'] == 'despues' and not entradas:
            continue
        tramos.append({**t, 'entradas': [{**e, 'fecha': e['fecha'].isoformat() + 'Z'} for e in entradas],
                       **_rango(t['key'], inicio)})
    return {'inicio_academia': inicio.date().isoformat() if inicio else None,
            'aviso_academia': aviso, 'tramos': tramos}


def _rango(key, inicio):
    """Las fechas que abarca un tramo de la Academia, para el rótulo."""
    if not inicio or key not in ('mes_1', 'mes_2_3', 'despues'):
        return {}
    desde = {'mes_1': 0, 'mes_2_3': DIAS_MES_1 + 1, 'despues': DIAS_MES_3 + 1}[key]
    hasta = {'mes_1': DIAS_MES_1, 'mes_2_3': DIAS_MES_3}.get(key)
    return {'desde': (inicio + timedelta(days=desde)).date().isoformat(),
            'hasta': (inicio + timedelta(days=hasta)).date().isoformat() if hasta is not None else None}
