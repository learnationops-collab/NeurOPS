"""El log de cada persona: lo que pasó o se dijo sobre ella (`lead_event_logs`, docs/plan_notas_avisos_settings.md
§2.1). Una entrada cuelga de la persona (`person_uuid`) y se conecta con una tabla (`origen` + `origen_id`).

`TIPOS_NOTA` dice qué tipos son notas escritas por el equipo (el resto son eventos): son las que muestra el
hilo de Comunicación de la ficha.
"""
from app import db
from app.models import LeadEventLog

TIPOS_NOTA = ('nota_para_closer',)


def registrar(person_uuid, tipo, texto, user_id=None, origen=None, origen_id=None, payload=None):
    """Agrega la entrada (sin commit). Si el origen es una agenda, llena también `appointment_id`, que la
    bitácora todavía lee hasta la etapa 2 del plan."""
    entrada = LeadEventLog(person_uuid=person_uuid, action_type=tipo, description=texto, user_id=user_id,
                           origen=origen, origen_id=origen_id, payload=payload,
                           appointment_id=origen_id if origen == 'appointment' else None)
    db.session.add(entrada)
    return entrada


def ultima(tipo, origen, origen_id):
    return (LeadEventLog.query.filter_by(action_type=tipo, origen=origen, origen_id=origen_id)
            .order_by(LeadEventLog.created_at.desc(), LeadEventLog.id.desc()).first())


def notas_de(person_uuid):
    if not person_uuid:
        return []
    return (LeadEventLog.query.filter(LeadEventLog.person_uuid == person_uuid,
                                      LeadEventLog.action_type.in_(TIPOS_NOTA))
            .order_by(LeadEventLog.created_at).all())
