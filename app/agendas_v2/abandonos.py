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


# --- Lista «Abandonos» del espacio del triage (30/10/2026) -------------------------------------------
HORAS_LISTA = 48
CONTACTOS = ('contactado', 'no_contesta')


def _fila(intento, d, nombres):
    """Un abandono listo para la pantalla; None si su evento ya no está publicado con formulario."""
    e = buscar(d, 'eventos', intento.evento_id)
    pub = version_publicada(e) if e else None
    if not pub or not pub.get('form'):
        return None
    evento, form = pub['evento'], pub['form']
    lead = {'preguntas': preguntas_flujo(form), 'resp': intento.resp or {}, 'pais': intento.pais or 'BO', 'tz': None}
    payload = armar_reserva(lead=lead, evento=evento, funnel=buscar(d, 'funnels', intento.funnel_id),
                            form=form, origen=intento.origen or '')
    datos = payload['lead']
    return {
        'id': intento.id, 'nombre': datos['nombre'], 'telefono': datos['telefono'], 'email': datos['email'],
        'instagram': datos['instagram'], 'evento': evento['nombre'], 'hasta_donde': hasta_donde(form, intento),
        'segmento': (payload.get('segmento_lead') or {}).get('segmento'), 'origen': payload.get('origen') or '',
        'setter': nombres.get(intento.setter_user_id), 'hora': intento.actualizado_en.isoformat(),
        'respuestas': [{'pregunta': r['pregunta_corta'] or r['pregunta'], 'respuesta': r['respuesta']}
                       for r in payload['respuestas'] if r['respuesta']],
        'contacto': intento.contacto_estado, 'contacto_por': nombres.get(intento.contacto_por_id),
        'contacto_en': intento.contacto_en.isoformat() if intento.contacto_en else None,
    }


def pendientes(ahora=None):
    """Los abandonos de las últimas HORAS_LISTA horas que siguen sin agendar (si agenda, el intento se borra),
    del más nuevo al más viejo."""
    from app.agendas_v2 import servicio
    from app.models import User

    ahora = ahora or _ahora()
    intentos = (SchedIntento.query
                .filter(SchedIntento.estado == 'incompleta',
                        SchedIntento.actualizado_en >= ahora - timedelta(hours=HORAS_LISTA))
                .order_by(SchedIntento.actualizado_en.desc()).all())
    ids = {i for x in intentos for i in (x.setter_user_id, x.contacto_por_id) if i}
    nombres = {u.id: u.username for u in User.query.filter(User.id.in_(ids or [0]))}
    d = servicio.colecciones()
    return [f for f in (_fila(x, d, nombres) for x in intentos) if f]


def marcar_contacto(intento_id, estado, usuario, ahora=None):
    """El triage marca qué hizo con un abandono (`estado` None lo deja sin tocar otra vez). Devuelve el
    intento, o None si no existe o ya agendó (su intento se borró)."""
    if estado is not None and estado not in CONTACTOS:
        raise ValueError('estado')
    intento = db.session.get(SchedIntento, intento_id)
    if intento is None or intento.estado != 'incompleta':
        return None
    # `actualizado_en` explícito: sin eso su onupdate lo correría y el abandono saltaría al principio de la lista.
    SchedIntento.query.filter_by(id=intento_id).update({
        'contacto_estado': estado, 'contacto_por_id': usuario.id if estado else None,
        'contacto_en': (ahora or _ahora()) if estado else None, 'actualizado_en': SchedIntento.actualizado_en})
    db.session.commit()
    db.session.refresh(intento)
    return intento


def resumen(desde, hasta):
    """Cuántos abandonos del período siguen sin agendar y qué se hizo con ellos (por fecha en que dejaron sus datos)."""
    intentos = SchedIntento.query.filter(SchedIntento.estado == 'incompleta',
                                         SchedIntento.creado_en >= desde, SchedIntento.creado_en < hasta).all()
    return {'total': len(intentos),
            'contactados': sum(1 for x in intentos if x.contacto_estado == 'contactado'),
            'no_contesta': sum(1 for x in intentos if x.contacto_estado == 'no_contesta')}
