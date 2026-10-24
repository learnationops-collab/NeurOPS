"""La calificación de un lead, con la descalificación posterior (Marketing, 23/10/2026).

ManyChat marca «calificado» a quien dice ser médico en la apertura, pero muchos de ésos después se
descalifican: el closer ve que no califica, el setter lo corrige a mano o el formulario de agenda lo
corta. Medir la calificación solo con lo que dijo ManyChat inflaba los calificados.

Regla única (la usan el tablero de anuncios y Entrantes, así no se contradicen):

  1. La calificación de base es la última 'true'/'false' que mandó ManyChat para esa persona
     (`ultima_de_manychat`); sin ninguna queda sin dato (pendiente).
  2. Un lead pasa a descalificado ('false') si, después de eso, alguna de estas fuentes lo descalifica:
       · el closer lo marcó «Descalificado» o «No Lead» en su agenda (`por_closer`);
       · el formulario de Agendas 2.0 lo cortó por una respuesta que descalifica, p. ej. «no es médico»
         (`por_formulario`: los `SchedIntento` 'descalificada', el mismo corte que cuenta
         `descalificados_service`);
       · el setter (o la dirección) lo corrigió a mano a «Descalificado»: eso ya se guarda como 'false'
         en el último webhook (`manychat_calificacion.calificar`), no necesita otra fuente.
  3. La descalificación del closer o del formulario vale para las palabras clave en que la persona entró hasta la fecha
     de su llamada; una que entró después es otro recorrido y se mide aparte.

La descalificación solo baja: nunca deja calificado a nadie que ManyChat no calificó.
"""
from datetime import datetime

from sqlalchemy import func

from app import db
from app.models import Appointment, Client
from app.services.cruce_conversaciones import Cruce
from app.services.identity_service import normalize_ig

CON_DATO = ('true', 'false')
FUTURO = datetime.max  # sin fecha de llamada: la descalificación vale para todo


def ultima_de_manychat(valores):
    """La última 'true'/'false' de una lista de valores en orden cronológico; None si no hay."""
    return next((v for v in reversed(list(valores)) if v in CON_DATO), None)


def por_closer():
    """{lead_id: instante hasta el que vale} de los leads que un closer descalificó.

    Mira las agendas con `closer_result` 'Descalificado' o 'No Lead' (el mismo criterio que
    `derivar_estado`) y busca la conversación de ManyChat de cada una como el resto de Marketing
    (persona, Instagram, nombre: `cruce_conversaciones`). Si el lead tiene varias, vale la más tardía."""
    from app.services.closer_agendas_service import _DESCALIFICADA

    filas = db.session.query(Appointment.start_time, Appointment.created_at, Appointment.person_uuid,
                             Client.instagram, Client.full_name) \
        .outerjoin(Client, Client.id == Appointment.client_id) \
        .filter(func.lower(func.trim(Appointment.closer_result)).in_(sorted(_DESCALIFICADA))).all()
    if not filas:
        return {}
    cruce = Cruce({normalize_ig(f.instagram) for f in filas}, {f.full_name for f in filas},
                  {f.person_uuid for f in filas})
    vale_hasta = {}
    for f in filas:
        tope = f.start_time or f.created_at or FUTURO
        for lead_ids in cruce.candidatos(f.instagram, f.full_name, f.person_uuid):
            if lead_ids:
                for lead_id in lead_ids:
                    vale_hasta[lead_id] = max(vale_hasta.get(lead_id, tope), tope)
                break
    return vale_hasta


def por_formulario():
    """{lead_id: instante hasta el que vale} de los leads que el formulario de agenda descalificó.

    El intento trae el email y, si lo dio, el nombre y el Instagram: la conversación se busca por la
    persona del email y, de respaldo, como el resto de Marketing (`cruce_conversaciones`). Vale hasta
    el momento en que dejó sus datos en el formulario."""
    # Import local: Agendas 2.0 es un módulo aparte que importa servicios de la operación.
    from app.agendas_v2.modelos import SchedIntento
    from app.services import person_service

    filas = SchedIntento.query.filter(SchedIntento.estado == 'descalificada').all()
    if not filas:
        return {}
    persona_de = {f.id: next(iter(sorted(person_service.duenos('email', (f.email or '').strip().lower()))), None)
                  for f in filas}
    datos = {f.id: f.resp or {} for f in filas}
    cruce = Cruce({normalize_ig(d.get('c-instagram')) for d in datos.values()},
                  {d.get('c-nombre') for d in datos.values()}, set(persona_de.values()))
    vale_hasta = {}
    for f in filas:
        tope = f.creado_en or FUTURO
        d = datos[f.id]
        for lead_ids in cruce.candidatos(d.get('c-instagram'), d.get('c-nombre'), persona_de[f.id]):
            if lead_ids:
                for lead_id in lead_ids:
                    vale_hasta[lead_id] = max(vale_hasta.get(lead_id, tope), tope)
                break
    return vale_hasta


def descalificados():
    """{lead_id: instante hasta el que vale} de quien descalificó el closer o el formulario."""
    resultado = por_closer()
    for lead_id, tope in por_formulario().items():
        resultado[lead_id] = max(resultado.get(lead_id, tope), tope)
    return resultado


def efectiva(valor_manychat, entro, descalificado_hasta=None):
    """La calificación final ('true' | 'false' | None) de una persona en una palabra clave.

    `valor_manychat`: lo que dejó `ultima_de_manychat`. `entro`: cuándo entró por esa palabra clave.
    `descalificado_hasta`: lo que devolvió `descalificados` para ese lead (None si nadie lo descalificó)."""
    if descalificado_hasta is not None and entro is not None and entro <= descalificado_hasta:
        return 'false'
    return valor_manychat if valor_manychat in CON_DATO else None
