"""«Pasar a seguimiento de recuperación»: la llamada que nadie reportó, a la cola de recuperación.

Pedido de Kerwin (19/10/2026): Jean Carlo y Facundo tienen agendas que eran de Gabriel, que ya no
es closer. Esas llamadas no tuvieron resultado y quien las tiene ahora no puede reportarlas: no
estuvo. Lo que corresponde es contactar al lead y volver a agendarlo.

Es lo mismo que se hizo a mano en prod el 15/10 con las 13 de Gabriel, ahora como botón:
  · la llamada queda 'Archivada sin reporte' (`ARCHIVADA_SIN_REPORTE`) y sale del mazo
    (`closer_processed`): no es un no show ni un lead perdido, nadie sabe qué pasó;
  · la agenda queda con un seguimiento de recuperación ('no_tomada') para el closer que la
    tiene, el día elegido, que es donde se lo contacta para agendar de nuevo.
"""
from datetime import datetime

from app import db
from app.services.closer_agendas_service import ARCHIVADA_SIN_REPORTE
from app.services.closer_followup_service import CloserFollowUpService
from app.services.ficha_acciones_service import ErrorDeAccion
from app.services.ficha_seguimientos_service import _dia, _nota

MOTIVO = 'Sin resultado de la llamada'
# Lo que todavía cuenta como «sin resultado»: lo que el closer no reportó.
SIN_RESULTADO = ('', 'pendiente')


def pasar_a_recuperacion(appt, datos, usuario):
    """Archiva la llamada sin resultado de ESTA agenda y le agenda el seguimiento de recuperación."""
    if (appt.closer_result or '').strip().lower() not in SIN_RESULTADO:
        raise ErrorDeAccion('Esta llamada ya tiene resultado: corregilo desde el historial.')
    if appt.start_time and appt.start_time > datetime.utcnow():
        raise ErrorDeAccion('Esta llamada todavía no ocurrió.')
    fecha = _dia(datos.get('fecha'))
    nota = _nota(datos.get('nota'))

    CloserFollowUpService.schedule_followup(appt, tipo='no_tomada', sub=nota or MOTIVO,
                                            fecha_seguimiento=fecha, intento=1, reminder_enabled=False)
    appt.closer_result = ARCHIVADA_SIN_REPORTE
    appt.closer_processed = True
    firma = f'[Sistema] {usuario.username} la pasó a seguimiento de recuperación: la llamada no tuvo resultado.'
    appt.closer_notes = f'{appt.closer_notes}\n{firma}'.strip() if appt.closer_notes else firma
    db.session.commit()

    from app.services.booking_service import BookingService

    BookingService.log_lead_event(
        appt.id, usuario.id, 'seguimiento_recuperacion',
        f'{usuario.username} pasó la llamada sin resultado a seguimiento de recuperación, el {fecha}'
        + (f': «{nota}».' if nota else '.'))
    return {'id': appt.id, 'closer_result': appt.closer_result, 'fecha': appt.fecha_seguimiento,
            'tipo': appt.seguimiento_tipo, 'nota': appt.seguimiento_sub}
