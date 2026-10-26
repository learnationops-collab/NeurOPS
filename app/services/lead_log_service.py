"""El log de cada persona: lo que pasó o se dijo sobre ella (`lead_event_logs`, docs/plan_notas_avisos_settings.md
§2.1). Una entrada cuelga de la persona (`person_uuid`) y se conecta con una tabla (`origen` + `origen_id`).

Es el único lugar donde se escribe una nota. `TIPOS_NOTA` dice qué tipos son notas del equipo (las muestra
el hilo de Comunicación); el resto son eventos.

  · `nota`: lo que alguien escribe sobre el lead (el hilo, un motivo de cancelación, una objeción).
  · `nota_llamada`: la nota de la llamada de una agenda. La actual es la última; las anteriores son su
    historial. Mientras haya pantallas que leen `appointments.closer_notes`, la columna se sigue llenando.
  · `nota_setter`, `nota_para_closer`: la del setter y la que el triage le deja al closer.

Los procesos del sistema (archivado automático, agenda creada para una venta…) ya no escriben en la nota:
dejan su evento (`evento`).
"""
import re

from app import db
from app.models import LeadEventLog

TIPOS_NOTA = ('nota', 'nota_llamada', 'nota_setter', 'nota_para_closer')

_espacios = re.compile(r'\s+')


def _norm(texto):
    return _espacios.sub(' ', (texto or '').strip()).lower()


def _uid(usuario):
    """El id del autor: el usuario que se pasa o, si no se pasa, el de la sesión (None fuera de un pedido)."""
    if usuario is not None:
        return getattr(usuario, 'id', usuario)
    from flask import has_request_context
    from flask_login import current_user

    return current_user.id if has_request_context() and current_user.is_authenticated else None


def _persona(appt):
    return appt.person_uuid or (appt.client.person_uuid if appt.client else None)


def registrar(person_uuid, tipo, texto, user_id=None, origen=None, origen_id=None, payload=None,
              created_at=None):
    """Agrega la entrada (sin commit). Si el origen es una agenda, llena también `appointment_id`, que la
    bitácora todavía lee hasta que se borre la columna."""
    entrada = LeadEventLog(person_uuid=person_uuid, action_type=tipo, description=texto, user_id=user_id,
                           origen=origen, origen_id=origen_id, payload=payload,
                           appointment_id=origen_id if origen == 'appointment' else None)
    if created_at:
        entrada.created_at = created_at
    db.session.add(entrada)
    return entrada


def nota(texto, usuario=None, appt=None, cliente=None, tipo='nota', payload=None):
    """Una nota sobre el lead: de una agenda (`appt`) o de la persona (`cliente`). Sin texto no hace nada."""
    texto = (texto or '').strip()
    if not texto:
        return None
    if appt is not None:
        return registrar(_persona(appt), tipo, texto, user_id=_uid(usuario), origen='appointment',
                         origen_id=appt.id, payload=payload)
    return registrar(cliente.person_uuid if cliente else None, tipo, texto, user_id=_uid(usuario),
                     payload=payload)


def evento(appt, tipo, texto, usuario=None, payload=None):
    """Un evento del sistema sobre una agenda (lo que antes se pegaba en la nota de la llamada)."""
    return registrar(_persona(appt), tipo, texto, user_id=_uid(usuario), origen='appointment',
                     origen_id=appt.id, payload=payload)


def ultima(tipo, origen, origen_id):
    return (LeadEventLog.query.filter_by(action_type=tipo, origen=origen, origen_id=origen_id)
            .order_by(LeadEventLog.created_at.desc(), LeadEventLog.id.desc()).first())


def nota_llamada_de(appt):
    """La nota actual de la llamada de esta agenda, o None."""
    entrada = ultima('nota_llamada', 'appointment', appt.id) if appt is not None else None
    return entrada.description if entrada else None


def guardar_nota_llamada(appt, texto, usuario=None):
    """Cambia la nota de la llamada (y la columna, que todavía se lee): una entrada nueva solo si el texto
    cambió, así el autoguardado no la repite. Vaciarla también queda: una entrada vacía dice que se borró."""
    texto = (texto or '').strip()
    appt.closer_notes = texto
    if _norm(nota_llamada_de(appt)) == _norm(texto):
        return None
    return registrar(_persona(appt), 'nota_llamada', texto, user_id=_uid(usuario), origen='appointment',
                     origen_id=appt.id)


def agregar_a_nota_llamada(appt, texto, usuario=None):
    """Suma un renglón a la nota de la llamada (lo que hacían los `closer_notes += ...`)."""
    actual = nota_llamada_de(appt) or appt.closer_notes or ''
    return guardar_nota_llamada(appt, f'{actual}\n{texto}'.strip(), usuario)


def notas_de(person_uuid):
    """Las notas de la persona en orden. La nota de la llamada aparece una vez por agenda (la actual)."""
    if not person_uuid:
        return []
    filas = (LeadEventLog.query.filter(LeadEventLog.person_uuid == person_uuid,
                                       LeadEventLog.action_type.in_(TIPOS_NOTA))
             .order_by(LeadEventLog.created_at, LeadEventLog.id).all())
    actual = {e.origen_id: e.id for e in filas if e.action_type == 'nota_llamada'}
    return [e for e in filas if (e.action_type != 'nota_llamada' or actual.get(e.origen_id) == e.id)
            and (e.description or '').strip()]


def notas_de_agenda(appt_id):
    """Las notas escritas sobre una agenda (su hilo), sin la nota de la llamada."""
    return (LeadEventLog.query.filter(LeadEventLog.origen == 'appointment', LeadEventLog.origen_id == appt_id,
                                      LeadEventLog.action_type.in_(('nota', 'nota_para_closer')))
            .order_by(LeadEventLog.created_at, LeadEventLog.id).all())


def cuantas_notas(person_uuids):
    """{person_uuid: cantidad de notas}, para los contadores de los mazos."""
    from sqlalchemy import func

    ids = [p for p in person_uuids if p]
    if not ids:
        return {}
    return dict(db.session.query(LeadEventLog.person_uuid, func.count(LeadEventLog.id))
                .filter(LeadEventLog.person_uuid.in_(ids), LeadEventLog.action_type.in_(TIPOS_NOTA))
                .group_by(LeadEventLog.person_uuid).all())


def a_dict(e):
    """Una nota como la muestran los hilos viejos del mazo (`ClientComment`/`Comment`)."""
    return {'id': e.id, 'text': e.description, 'author_id': e.user_id,
            'author_name': e.user.username if e.user else 'Sistema',
            'author_role': e.user.role if e.user else 'system',
            'created_at': e.created_at.isoformat() if e.created_at else None,
            'type': e.action_type, 'associated_id': e.origen_id, 'parent_id': e.parent_id}
