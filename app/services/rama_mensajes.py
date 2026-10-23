"""La calificación que deja la rama del flujo de ManyChat cuando ManyChat no la manda (18/10/2026).

Después del Opening («¿médico o estudiante?») el flujo se abre: a los calificados les manda «¿Qué examen
prepara?» y ManyChat manda `cualificacion` = sí; a los demás, «¿Qué quiere mejorar?», y ahí no manda
nada: quedaban «Sin dato» (16 en 7 días en producción). Kerwin: recibir «¿Qué quiere mejorar?» marca
descalificado cuando ManyChat no mande el dato.

Cada mensaje del catálogo de Conversaciones puede tener `rama` ('calificados' | 'descalificados').
Al registrar el envío de un mensaje con rama, si la persona no tiene ninguna calificación (ningún
webhook con sí o no), ese envío toma la de la rama, marcado `calificacion_por_rama`. Lo que manda
ManyChat después, o una corrección a mano, pisa al deducido (vale el último sí o no, ver
`anuncios_service`). Cambiar la rama de un mensaje lo recalcula para atrás (`reaplicar`).
"""
from app import db
from app.models import ConversationalMessage, LeadAnswer

RAMAS = {'calificados': 'true', 'descalificados': 'false'}
CON_DATO = ('true', 'false')


def _valor_de_rama(message_id):
    if not message_id:
        return None
    rama = db.session.query(ConversationalMessage.rama).filter_by(message_id=str(message_id)).scalar()
    return RAMAS.get(rama)


def aplicar_a(respuesta):
    """Completa la calificación de un envío recién registrado con la de la rama de su mensaje, si la
    persona no tiene ninguna. No hace commit. Devuelve si cambió algo."""
    if respuesta.qualification in CON_DATO:
        return False
    valor = _valor_de_rama(respuesta.id_option_send)
    if not valor:
        return False
    tiene_dato = db.session.query(LeadAnswer.id).filter(
        LeadAnswer.conversation_id == respuesta.conversation_id, LeadAnswer.qualification.in_(CON_DATO)).first()
    if tiene_dato:
        return False
    respuesta.qualification = valor
    respuesta.calificacion_por_rama = True
    return True


def reaplicar(message_id):
    """Recalcula lo deducido de un mensaje cuando cambia su rama (o su id): borra lo que había
    deducido y lo vuelve a deducir para quien siga sin calificación. No hace commit. Devuelve
    cuántos envíos quedaron con calificación deducida."""
    message_id = str(message_id)
    deducidas = LeadAnswer.query.filter(LeadAnswer.id_option_send == message_id,
                                        LeadAnswer.calificacion_por_rama.is_(True)).all()
    for r in deducidas:
        r.qualification, r.calificacion_por_rama = 'null', False
    db.session.flush()
    valor = _valor_de_rama(message_id)
    if not valor:
        return 0
    con_dato = {lid for (lid,) in db.session.query(LeadAnswer.conversation_id).filter(
        LeadAnswer.qualification.in_(CON_DATO)).distinct()}
    aplicadas, vistas = 0, set()
    for r in LeadAnswer.query.filter(LeadAnswer.id_option_send == message_id,
                                     ~LeadAnswer.qualification.in_(CON_DATO) | LeadAnswer.qualification.is_(None)) \
            .order_by(LeadAnswer.created_at, LeadAnswer.id):
        if r.conversation_id in con_dato or r.conversation_id in vistas:
            continue
        r.qualification, r.calificacion_por_rama = valor, True
        vistas.add(r.conversation_id)
        aplicadas += 1
    return aplicadas
