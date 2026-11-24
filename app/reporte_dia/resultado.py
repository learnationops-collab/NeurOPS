"""`POST /api/reporte/agenda-resultado`: el resultado de una agenda pendiente, por la misma puerta que el
mazo del closer (`deck_escritura_service.aplicar_cambios` + motivo obligatorio + avisos de después)."""
from app import db
from app.models import Appointment

RESULTADOS = {'show up': 'Show up', 'asistió': 'Show up', 'asistio': 'Show up', 'no show': 'No Show',
              'reagendado': 'Reagendado', 'reprogramó': 'Reagendado', 'cancelado': 'Cancelado', 'canceló': 'Cancelado'}


class ResultadoInvalido(ValueError):
    def __init__(self, mensaje, campo='resultado', status=400, extra=None):
        super().__init__(mensaje)
        self.campo, self.status, self.extra = campo, status, extra or {}


def cargar(user, autor, appointment_id, resultado, motivo=None):
    """Guarda el resultado. `user` es el dueño del reporte; `autor`, quien lo carga (puede ser admin)."""
    from app.services import motivo_estado_service
    from app.services.deck_escritura_service import aplicar_cambios

    valor = RESULTADOS.get(' '.join(str(resultado or '').split()).lower())
    if not valor:
        raise ResultadoInvalido('Resultado inválido: Show up, No show, Reagendado o Cancelado.')
    try:
        appt_id = int(appointment_id)
    except (TypeError, ValueError):
        raise ResultadoInvalido('Falta la agenda.', campo='appointment_id')
    appt = db.session.get(Appointment, appt_id)
    if appt is None:
        raise ResultadoInvalido('Agenda no encontrada.', campo='appointment_id', status=404)
    if appt.closer_id != user.id:
        raise ResultadoInvalido('Esa agenda no es tuya.', campo='appointment_id', status=403)
    try:
        texto = motivo_estado_service.para_correccion(appt.closer_result, valor, motivo)
    except motivo_estado_service.MotivoInvalido as e:
        raise ResultadoInvalido(str(e), campo='motivo',
                                extra={'pregunta': motivo_estado_service.pregunta(valor)})
    data = {'result': valor}
    aplicar_cambios(appt, data, autor)
    if texto:
        motivo_estado_service.registrar(appt, autor, valor, texto)
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    # Lo mismo que hace el mazo después del commit (`process_closer_card`).
    from app.services import academy_payment_status, momentum_academia
    from app.services.discord_avisos import resultado as aviso_resultado
    academy_payment_status.avisar_bajas()
    momentum_academia.avisar(appt, 'mazo', data, autor)
    aviso_resultado.avisar_resultado(appt, data, autor)
    return appt
