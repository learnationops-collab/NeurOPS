"""Leads que dejaron sus datos en un link y no terminaron de agendar: a los MINUTOS_SIN_AVANCE sin moverse,
aviso a Discord que etiqueta a su setter (Santi, 29/10/2026). Corre en el scheduler (reminder_scheduler)
cada minuto. Un aviso por intento (`avisado_en`); si después agenda, su intento se borra y no pasa nada más.
"""

from datetime import datetime, timedelta, timezone

from app import db
from app.agendas_v2 import avisos_discord
from app.agendas_v2.modelos import SchedIntento
from app.agendas_v2.nucleo.datos import buscar
from app.agendas_v2.nucleo.eventos import version_publicada
from app.agendas_v2.nucleo.normalizar import preguntas_flujo
from app.agendas_v2.nucleo.reserva import armar_reserva

MINUTOS_SIN_AVANCE = 5
# No se avisa lo que quedó quieto hace más de esto (el primer deploy, o el scheduler parado un rato).
VENTANA = timedelta(hours=2)


def _ahora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def hasta_donde(form, intento):
    """Hasta dónde llegó, en palabras (paso: 1 contacto, 2+j respondió la pregunta j, n+2 llegó al calendario)."""
    total = len(form.get('preguntas') or [])
    paso = intento.paso or 1
    if paso >= total + 2:
        return 'Llegó al calendario y no eligió horario'
    if paso <= 1:
        return 'Dejó sus datos y no respondió el formulario'
    return f'Respondió {paso - 1} de {total} preguntas'


def avisar_abandonos(ahora=None):
    """Avisa los intentos incompletos quietos hace MINUTOS_SIN_AVANCE. Devuelve cuántos avisó."""
    from app.agendas_v2 import servicio
    from app.models import User

    ahora = ahora or _ahora()
    quietos = SchedIntento.query.filter(
        SchedIntento.estado == 'incompleta',
        SchedIntento.avisado_en.is_(None),
        SchedIntento.actualizado_en <= ahora - timedelta(minutes=MINUTOS_SIN_AVANCE),
        SchedIntento.actualizado_en >= ahora - VENTANA,
    ).all()
    if not quietos:
        return 0
    d = servicio.colecciones()
    avisados = 0
    for intento in quietos:
        # Primero se marca: si Discord falla, no se repite cada minuto.
        intento.avisado_en = ahora
        db.session.commit()
        e = buscar(d, 'eventos', intento.evento_id)
        pub = version_publicada(e) if e else None
        if not pub or not pub.get('form'):
            continue
        evento, form = pub['evento'], pub['form']
        lead = {'preguntas': preguntas_flujo(form), 'resp': intento.resp or {}, 'pais': intento.pais or 'BO', 'tz': None}
        payload = armar_reserva(lead=lead, evento=evento, funnel=buscar(d, 'funnels', intento.funnel_id),
                                form=form, origen=intento.origen or '')
        setter = db.session.get(User, intento.setter_user_id) if intento.setter_user_id else None
        if avisos_discord.avisar_abandono(payload, setter, evento['nombre'], hasta_donde(form, intento)):
            avisados += 1
    return avisados
