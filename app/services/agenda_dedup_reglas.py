"""Reglas de `agenda_dedup_service`: los umbrales, las señales de identidad de una agenda y su estado."""
from app.services.client_dedup_service import _normalize_email, _normalize_instagram, _normalize_phone

# Si una misma señal (mail/instagram/teléfono) aparece en agendas de más de esta cantidad
# de nombres distintos e incompatibles entre sí, deja de ser "el mismo lead dos veces" y
# pasa a ser un dato compartido o de relleno. Se cuenta por NOMBRES y no por agendas a
# propósito: que una persona tenga cinco agendas con el mismo mail es lo normal acá.
MAX_NOMBRES_POR_SENAL = 2

# Estados en los que la llamada todavía no ocurrió. Una agenda ya resuelta representa una
# llamada que pasó de verdad, y eso cambia la lectura del grupo: no es una reprogramación,
# es alguien que volvió a agendar.
ESTADOS_SIN_RESOLVER = {
    '', 'pendiente', 'confirmado', 'confirmada', 'por_confirmar', 'por confirmar',
    'agendado', 'agendada', 'contactado', 'contactada', 'sin respuesta',
    'reagendada', 'reagendado', 'reprogramada', 'reprogramado',
}

# Dos reuniones separadas por menos que esto son la MISMA reunión cargada dos veces, no
# dos llamadas: nadie agenda dos calls con el mismo lead con una hora de diferencia.
HORAS_MISMA_REUNION = 2

# Cuánto después de la hora de la reunión se sigue considerando que "todavía no pasó".
# Cubre al lead que reagenda apenas el closer no aparece o apenas cuelga sin avanzar.
HORAS_GRACIA_REUNION = 1

# Qué tan cerca tienen que estar dos reuniones para ser "la misma hora" y no una
# reprogramación. Con tolerancia amplia se confundirían las dos cosas; en los datos reales
# los duplicados exactos caen al mismo minuto, así que alcanza con un margen chico para
# absorber el redondeo de Calendly.
MINUTOS_MISMA_HORA = 5


def _senales(agenda):
    """Las señales normalizadas con las que se reconoce a la misma persona: su persona (la más
    fuerte) y su mail, instagram y teléfono, leídos de ella o, sin persona, de la copia."""
    c = agenda.contacto()
    senales = [('p', agenda.person_uuid)] if agenda.person_uuid else []
    mail = _normalize_email(c['mail'])
    ig = _normalize_instagram(c['instagram'])
    tel = _normalize_phone(c['whatsapp'])
    if mail:
        senales.append(('mail', mail))
    if ig:
        senales.append(('ig', ig))
    if tel:
        senales.append(('tel', tel))
    return senales


def _sin_resolver(agenda):
    return (agenda.estado or '').strip().lower() in ESTADOS_SIN_RESOLVER


def _asistio(agenda):
    return (agenda.estado or '').strip().lower() in ('show up', 'show_up', 'asistió', 'asistio')
