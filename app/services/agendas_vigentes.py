"""Qué agendas cuentan como una de verdad: una persona no suma dos veces por reagendar ni por quedar dos veces
en el mismo horario.

Reagendar desde NeurOPS deja DOS filas (la vieja cerrada como 'Reagendado' y la nueva con `is_rescheduled`; ver
`agendas_v2/manual.py`), y la historia de esas filas sigue siendo necesaria (roadmap, cola «reagendar», embudo del
mazo). Lo que no puede pasar es que las dos sumen en los números de Dirección: la persona agendó UNA llamada. Dos
reglas, las mismas para Closing y para Triage, y viven acá para que no diverjan:

  · **Reemplazada**: una fila cerrada como 'Reagendado' que ya tiene una agenda posterior de la misma persona deja de
    contar; cuenta la nueva (la que se va a dar). Sin una posterior se queda: no hay otra que la reemplace y quitarla
    perdería la agenda.
  · **Mismo hueco**: dos filas vigentes de la misma persona a la misma fecha y hora son la misma llamada cargada dos
    veces. Se queda la que ya tiene un resultado (o la primera que se creó).

Las filas no se tocan en la base: solo se dejan de contar. «Persona» es `person_uuid` y, sin él, el cliente.
"""
from sqlalchemy import or_

from app.models import Appointment

_REAGENDADAS = ('reagendado', 'reagendada')
_SIN_RESULTADO = ('', 'pendiente')


def persona_de(a):
    return ('p', a.person_uuid) if a.person_uuid else ('c', a.client_id)


def _es_reagendada(a):
    return (a.closer_result or '').strip().lower() in _REAGENDADAS


def _con_resultado(a):
    return (a.closer_result or '').strip().lower() not in _SIN_RESULTADO or bool(a.closer_processed)


def _reemplazadas(appts):
    """Ids de las reagendadas que tienen una agenda posterior de la misma persona (en cualquier fecha)."""
    candidatas = [a for a in appts if _es_reagendada(a)]
    if not candidatas:
        return set()
    uuids = {a.person_uuid for a in candidatas if a.person_uuid}
    clientes = {a.client_id for a in candidatas if a.client_id}
    posteriores = Appointment.query.filter(
        or_(Appointment.person_uuid.in_(uuids or ['']), Appointment.client_id.in_(clientes or [0]))
    ).with_entities(Appointment.id, Appointment.person_uuid, Appointment.client_id).all()
    ultima_de_persona, ultima_de_cliente = {}, {}
    for id_, uuid, cliente in posteriores:
        if uuid:
            ultima_de_persona[uuid] = max(ultima_de_persona.get(uuid, 0), id_)
        ultima_de_cliente[cliente] = max(ultima_de_cliente.get(cliente, 0), id_)
    return {a.id for a in candidatas
            if (a.person_uuid and ultima_de_persona.get(a.person_uuid, 0) > a.id)
            or ultima_de_cliente.get(a.client_id, 0) > a.id}


def _mismo_hueco(appts, fuera):
    """Ids de las filas repetidas en el mismo minuto de la misma persona (la que gana es la que ya tiene resultado)."""
    por_hueco = {}
    for a in appts:
        if a.id in fuera or not a.start_time:
            continue
        por_hueco.setdefault((persona_de(a), a.start_time.replace(second=0, microsecond=0)), []).append(a)
    sobran = set()
    for grupo in por_hueco.values():
        if len(grupo) > 1:
            ganadora = min(grupo, key=lambda a: (not _con_resultado(a), a.id))
            sobran.update(a.id for a in grupo if a is not ganadora)
    return sobran


def sobrantes(appts):
    """Ids de las agendas de `appts` que no cuentan: las reemplazadas por una reagenda y las repetidas en el mismo
    horario."""
    appts = list(appts)
    fuera = _reemplazadas(appts)
    return fuera | _mismo_hueco(appts, fuera)


def vigentes(appts):
    """`appts` sin las que no cuentan (`sobrantes`), en el mismo orden."""
    appts = list(appts)
    fuera = sobrantes(appts)
    return [a for a in appts if a.id not in fuera]
