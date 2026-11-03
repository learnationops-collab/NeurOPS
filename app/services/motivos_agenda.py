"""El motivo que se muestra junto al estado de una agenda «No show», «Canceló» o «Reagendó» (pedido de la
dirección comercial, 03/11/2026): al pasar el mouse por el estado en Revisar se lee por qué.

El motivo escrito lo guarda `motivo_estado_service` como nota de la agenda (`payload.motivo_estado`). Lo que
no tiene motivo escrito:
  · las reagendas que llegan solas (el lead desde el link, el evento movido en Calendar) dejan su nota
    automática en la agenda NUEVA, enlazada por `agenda_payload.reagenda_de`: se muestra esa nota, marcada
    `auto`;
  · todo lo marcado antes del 02/11/2026 (ADR-W066) no tiene nada: `{'texto': None}`.
"""
from sqlalchemy.orm import joinedload

from app.models import Appointment, LeadEventLog
from app.services import motivo_estado_service as motivos

_LOTE = 500

# Cómo empieza cada nota de motivo (ver `motivo_estado_service.texto_nota`): lo que hay que cortar para
# quedarse con lo que el closer escribió. Las notas nuevas guardan el texto crudo en el payload.
_SEPARADOR = {motivos.CANCELADO: ': ', motivos.REAGENDADO: '. Razón: ', motivos.NO_SHOW: '. Motivo: '}
_CITA = '. Nueva cita el '


def _texto_escrito(entrada, clave):
    """Lo que escribió quien marcó el estado: del payload, o recortado de la descripción de las notas viejas."""
    crudo = (entrada.payload or {}).get('motivo')
    if crudo:
        return crudo
    descripcion = entrada.description or ''
    sep = _SEPARADOR[clave]
    if sep not in descripcion:
        return descripcion.strip() or None
    texto = descripcion.split(sep, 1)[1]
    if clave == motivos.REAGENDADO and _CITA in texto:
        texto = texto.split(_CITA, 1)[0]
    return texto.strip() or None


def _dato(entrada, texto, auto=False):
    user = entrada.user
    return {'texto': texto, 'quien': user.username if user else None,
            'cuando': entrada.created_at.isoformat() if entrada.created_at else None,
            'auto': auto, 'nueva_cita': None}


def _notas(origen_ids, tipos):
    """{agenda: [notas de más nueva a más vieja]} de las agendas pedidas."""
    por_agenda = {}
    ids = list(origen_ids)
    for i in range(0, len(ids), _LOTE):
        for e in (LeadEventLog.query.options(joinedload(LeadEventLog.user))
                  .filter(LeadEventLog.origen == 'appointment', LeadEventLog.origen_id.in_(ids[i:i + _LOTE]),
                          LeadEventLog.action_type.in_(tipos))
                  .order_by(LeadEventLog.created_at.desc(), LeadEventLog.id.desc())):
            por_agenda.setdefault(e.origen_id, []).append(e)
    return por_agenda


def _sucesoras(pedidas):
    """{id de la agenda reagendada: la agenda nueva} (la que nació de ella con `reagenda_de`)."""
    personas = {persona for _, clave, persona in pedidas if clave == motivos.REAGENDADO and persona}
    if not personas:
        return {}
    ids = {i for i, clave, _ in pedidas if clave == motivos.REAGENDADO}
    nuevas = Appointment.query.filter(Appointment.is_rescheduled.is_(True),
                                      Appointment.person_uuid.in_(personas)).all()
    return {(a.agenda_payload or {}).get('reagenda_de'): a for a in nuevas
            if (a.agenda_payload or {}).get('reagenda_de') in ids}


def de_agendas(pedidas):
    """{id de agenda: motivo} para `pedidas = [(id, clave del estado, person_uuid)]`.

    Cada motivo es `{'texto', 'quien', 'cuando', 'auto', 'nueva_cita'}`; `texto` es None si no hay nada que
    mostrar. Dos consultas por tandas de `_LOTE` agendas, no una por fila."""
    if not pedidas:
        return {}
    sucesoras = _sucesoras(pedidas)
    propias = _notas([i for i, _, _ in pedidas], ('nota',))
    de_las_nuevas = _notas([a.id for a in sucesoras.values()], ('nota',))

    salida = {}
    for appt_id, clave, _ in pedidas:
        dato = {'texto': None, 'quien': None, 'cuando': None, 'auto': False, 'nueva_cita': None}
        escrita = next((e for e in propias.get(appt_id, [])
                        if (e.payload or {}).get('motivo_estado') == clave), None)
        nueva = sucesoras.get(appt_id)
        if escrita:
            dato = _dato(escrita, _texto_escrito(escrita, clave))
        elif nueva and de_las_nuevas.get(nueva.id):
            # La nota más vieja de la agenda nueva es la que dejó la reagenda al crearla.
            automatica = de_las_nuevas[nueva.id][-1]
            dato = _dato(automatica, (automatica.description or '').strip() or None, auto=True)
        if nueva and nueva.start_time:
            dato['nueva_cita'] = nueva.start_time.isoformat()
        salida[appt_id] = dato
    return salida
