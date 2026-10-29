"""Eliminar un lead de prueba entero (Kerwin, 28/10/2026): el cliente, todas sus agendas y lo que cuelga de él.

La ficha ya borraba UNA agenda (`BookingService.eliminar_agenda`), pero el lead de prueba —la persona, su
registro en el libro de agendas, su conversación de Instagram— seguía contando en Marketing, Revisar y los
embudos. Esto lo saca de todos lados.

Es irreversible, así que se frena si el lead tiene plata o suscripción: pagos, ventas, plan de cuotas o una
suscripción. Un lead con cobros no es de prueba, y borrarlo descuadraría Finanzas, comisiones y la Academia.
Se limita a la dirección (`permisos_de`: `eliminar_lead`). Se borra todo en orden y, si algo falla, no queda
a medias lo que pueda deshacerse: lo primero que se comprueba son los bloqueos.
"""
import logging

from sqlalchemy import or_

from app import db
from app.models import (
    Appointment, Client, ClientMergeLog, Conversation, FinancialAgenda, FinancialSale, InstallmentPlan, LeadEventLog,
    Notification, Person, PersonEvent, PersonIdentity, PublicRegistration, Sale, Subscription, SurveyAnswer, WorkshopLead,
)
from app.services.booking_service import BookingService

logger = logging.getLogger(__name__)


class ErrorDeLead(Exception):
    """El lead no se puede eliminar (y por qué)."""


def _plural(n, uno, varios):
    return f'{n} {uno if n == 1 else varios}'


def bloqueos(cliente):
    """Los motivos por los que este lead NO es de prueba (tiene plata o suscripción). Vacío = se puede borrar."""
    uuid = cliente.person_uuid
    agendas = [a.id for a in Appointment.query.filter_by(client_id=cliente.id).all()]

    pagos = FinancialSale.query.filter(or_(
        FinancialSale.client_id == cliente.id,
        *([FinancialSale.person_uuid == uuid, FinancialSale.payer_person_uuid == uuid] if uuid else []),
    )).count()
    ventas = Sale.query.filter(or_(Sale.client_id == cliente.id, *([Sale.person_uuid == uuid] if uuid else []))).count()
    planes = InstallmentPlan.query.filter(or_(
        InstallmentPlan.client_id == cliente.id,
        *([InstallmentPlan.appointment_id.in_(agendas)] if agendas else []),
    )).count()
    suscripciones = Subscription.query.filter_by(client_id=cliente.id).count()

    motivos = []
    if pagos:
        motivos.append(_plural(pagos, 'pago registrado', 'pagos registrados'))
    if ventas:
        motivos.append(_plural(ventas, 'venta', 'ventas'))
    if planes:
        motivos.append(_plural(planes, 'plan de cuotas', 'planes de cuotas'))
    if suscripciones:
        motivos.append(_plural(suscripciones, 'suscripción', 'suscripciones'))
    return motivos


def eliminar(appt, usuario):
    """Borra el lead de `appt` con todas sus agendas. Devuelve lo que se borró, para la bitácora y el aviso."""
    cliente = appt.client
    if not cliente:
        raise ErrorDeLead('Esta agenda no tiene un lead que eliminar.')
    motivos = bloqueos(cliente)
    if motivos:
        raise ErrorDeLead('Este lead tiene ' + ' y '.join(motivos) + ': con plata o suscripción no es de prueba y no se '
                          'elimina por acá. Se puede borrar solo su agenda desde el Historial.')

    cliente_id, uuid, nombre = cliente.id, cliente.person_uuid, cliente.full_name
    agendas = Appointment.query.filter_by(client_id=cliente_id).all()
    cuenta = {'agendas': len(agendas)}
    try:
        for agenda in agendas:
            # Borra el evento de Google, desvincula las respuestas de la encuesta y se lleva el registro de eventos.
            ok, error = BookingService.eliminar_agenda(agenda)
            if not ok:
                raise ErrorDeLead(error or 'No se pudo eliminar una de las agendas.')

        SurveyAnswer.query.filter_by(client_id=cliente_id).delete(synchronize_session=False)
        ClientMergeLog.query.filter_by(survivor_client_id=cliente_id).delete(synchronize_session=False)
        WorkshopLead.query.filter(or_(WorkshopLead.promoted_client_id == cliente_id,
                                      *([WorkshopLead.person_uuid == uuid] if uuid else []))).delete(synchronize_session=False)
        if uuid:
            cuenta['libro'] = FinancialAgenda.query.filter_by(person_uuid=uuid).delete(synchronize_session=False)
            LeadEventLog.query.filter_by(person_uuid=uuid).delete(synchronize_session=False)
            Notification.query.filter_by(person_uuid=uuid).delete(synchronize_session=False)
            PublicRegistration.query.filter_by(person_uuid=uuid).delete(synchronize_session=False)
            for conversacion in Conversation.query.filter_by(person_uuid=uuid).all():
                db.session.delete(conversacion)  # sus respuestas del bot se van con ella
        db.session.delete(cliente)
        db.session.flush()

        # La persona se va solo si ningún otro cliente es suyo (un mismo número puede tener varios).
        if uuid and not Client.query.filter_by(person_uuid=uuid).first():
            Person.query.filter_by(merged_into_uuid=uuid).update({'merged_into_uuid': None}, synchronize_session=False)
            PersonEvent.query.filter_by(person_uuid=uuid).delete(synchronize_session=False)
            PersonIdentity.query.filter_by(person_uuid=uuid).delete(synchronize_session=False)
            Person.query.filter_by(uuid=uuid).delete(synchronize_session=False)
            cuenta['persona'] = 1
        db.session.commit()
    except ErrorDeLead:
        db.session.rollback()
        raise
    except Exception as e:  # noqa: BLE001 — se informa y no se deja a medias
        db.session.rollback()
        logger.error(f'No se pudo eliminar el lead {cliente_id}: {e}')
        raise ErrorDeLead('No se pudo eliminar el lead completo. Lo que ya se hubiera borrado de sus agendas no se deshace.') from e

    logger.warning(f'Lead eliminado por {getattr(usuario, "username", "?")}: cliente {cliente_id} «{nombre}» {cuenta}')
    return {'message': 'Lead eliminado', 'agenda_siguiente': None, 'borrado': cuenta}
