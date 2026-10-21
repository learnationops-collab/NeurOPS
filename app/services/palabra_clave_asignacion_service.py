"""La asignación de la palabra clave de una agenda del setter (la escritura de «Mis agendas»).

Ver el docstring de `palabra_clave_service` (que re-exporta todo esto).
"""
from datetime import datetime, timedelta
import uuid

from sqlalchemy import func

from app import db
from app.models import Ad, Appointment, LeadEventLog, ManychatLead, LeadAnswer
from app.services.comercial_service import es_agenda_del_setter

# El `action_type` del registro que deja cada asignación en el historial del lead. Es también con lo
# que se cuentan las de hoy y la racha: no hay columna nueva.
ACCION = 'palabra_clave'

# El `keyword` de la respuesta que se crea cuando la conversación no tenía ninguna para marcar: la
# misma marca que dejaba la atribución manual de Marketing, para distinguirla de las de ManyChat.
KEYWORD_MANUAL = 'manual_attribution'

# Palabras clave nuevas (15/10/2026). «Los setters no ven todas las palabras claves que llegan desde
# ManyChat: permití que puedan agregar una que no esté en los registros». El buscador ofrece también
# las palabras clave que llegaron por ManyChat y no tienen anuncio (`nueva: True`, sin id) y lo que
# el setter escriba; al asignar se crea el anuncio con la misma regla que el webhook
# (`anuncios_service.anuncio_de_keyword`: uno por palabra clave, sin campaña ni conjunto).


class ErrorDePalabraClave(ValueError):
    """La asignación no se puede hacer; `estado` es el código HTTP que corresponde."""

    def __init__(self, mensaje, estado=400):
        super().__init__(mensaje)
        self.estado = estado


def normalizar_ig(valor):
    """El usuario de Instagram sin @, en minúsculas, o None si no hay uno de verdad."""
    if not isinstance(valor, str):
        return None
    limpio = valor.strip().lstrip('@').strip().lower()
    if not limpio or limpio in ('n/a', 'none', 'null', '-'):
        return None
    if '/' in limpio or ' ' in limpio:
        return None
    # Un correo en el campo del Instagram («alexss_10@hotmail.com») no es un usuario: la consulta
    # de las conversaciones le saca todas las @ y no lo encontraba nunca, así que la agenda no
    # salía de la bandeja aunque se le asignara el anuncio. Sin usuario, la tarjeta lo pide.
    if '@' in limpio:
        return None
    return limpio


def anuncio_de_palabra(texto):
    """El anuncio de esa palabra clave (comparando sin tildes ni mayúsculas, `Ad.clave`); si no hay,
    lo crea como el webhook de ManyChat. No hace commit: lo hace `asignar`."""
    from app.services import anuncios_service

    if not anuncios_service.es_keyword_valida(texto):
        raise ErrorDePalabraClave('Esa palabra clave no sirve: escribila como llega de ManyChat.')
    return anuncios_service.anuncio_de_keyword(texto, crear=True)


# --- Escritura ----------------------------------------------------------------------------------

def asignar(setter, appointment_id, ad_id, instagram=None, palabra=None, cambiar=False):
    """Le pone a la agenda el anuncio por el que llegó el lead, de forma que Marketing la cuente.

    Deja lo mismo que la atribución manual de siempre (`/public/marketing/manual-attribution-agenda`),
    con tres correcciones:

      · la respuesta con anuncio queda ANTES de la primera agenda de esa persona con este setter, no
        un minuto antes de la reunión de la que se tocó: si no, una persona que reagendó quedaba con
        la agenda nueva atribuida y la vieja sin anuncio;
      · si la conversación ya tenía una respuesta sin anuncio de antes de la reunión (llegó por
        ManyChat y no se supo de qué anuncio), se le pone el anuncio a esa, que es la de verdad, en
        vez de pisarle la fecha a la primera que hubiera;
      · la conversación que se crea lleva el nombre del lead, no el de la fuente (el setter).

    El Instagram es obligatorio porque es con lo que Marketing encuentra la conversación (ver el
    docstring del módulo): si viene uno nuevo, se corrige en el cliente y en la fila del Tablero.
    Deja un registro `palabra_clave` en el historial del lead. Hace commit.

    **Si el cliente y el Tablero tienen Instagram distintos** (`Dafne.aj` y `Dafne_aj`: 7 de las 25
    de octubre de Elias en la copia local), el anuncio va a la conversación de los dos. Marketing
    atribuye con el del Tablero y la bandeja mira el del cliente (las filas de «Agendas generadas»):
    con solo el del Tablero, la agenda quedaba atribuida para Marketing y volvía a la bandeja en la
    próxima carga, que así no se podía vaciar.

    **Elegido y cambiable (18/10/2026).** El anuncio queda además en cada agenda de la persona con
    este setter (`Appointment.anuncio_id`), que manda sobre ManyChat en Marketing y en la bandeja. Con
    `cambiar` (una completada con la palabra clave equivocada) solo se corrige eso: ni Instagram ni
    respuesta en ManyChat, que no alcanzaría para pisar la que ya está.
    """
    from app.services.ficha_agendas_service import espejo_en_el_tablero

    cita = Appointment.query.filter(Appointment.id == appointment_id, es_agenda_del_setter(setter.id)).first()
    if not cita:
        raise ErrorDePalabraClave('Esta agenda no es tuya.', 403)
    if ad_id:
        anuncio = db.session.get(Ad, ad_id)
        if not anuncio:
            raise ErrorDePalabraClave('Ese anuncio no existe: elegilo de la lista.', 404)
    elif palabra is not None:
        # Una palabra clave que no está en la lista (o que llegó por ManyChat sin anuncio): se busca
        # sin tildes ni mayúsculas y, si no hay, se crea su anuncio (15/10/2026).
        anuncio = anuncio_de_palabra(palabra)
    else:
        raise ErrorDePalabraClave('Elegí el anuncio de la lista o escribí la palabra clave.')

    cliente = cita.client
    # Todas las agendas de esta persona con este setter: la respuesta va antes de la primera.
    suyas = Appointment.query.filter(es_agenda_del_setter(setter.id),
                                     Appointment.client_id == cita.client_id).all() if cita.client_id else [cita]
    if cambiar:
        _elegir(suyas, anuncio)
        db.session.add(LeadEventLog(appointment_id=cita.id, user_id=setter.id, action_type=ACCION,
                                    description=f'{_texto_del_registro(anuncio, setter)} (cambiada)',
                                    created_at=datetime.utcnow()))
        _guardar()
        return {'appointment_id': cita.id, 'instagram': normalizar_ig(cliente.instagram) if cliente else None,
                'anuncio': {'id': anuncio.id, 'keyword': anuncio.keyword or anuncio.name}}

    espejo = espejo_en_el_tablero(cita)
    nuevo = normalizar_ig(instagram) if instagram is not None else None
    if instagram is not None and (instagram or '').strip() and not nuevo:
        raise ErrorDePalabraClave('Ese Instagram no parece un usuario: escribilo sin espacios ni links.')
    # Marketing lee el de la fila del Tablero: ése manda sobre el del cliente.
    ig = nuevo or normalizar_ig(espejo.instagram if espejo else None) \
        or normalizar_ig(cliente.instagram if cliente else None)
    if not ig:
        raise ErrorDePalabraClave('Falta el Instagram del lead: es con lo que Marketing encuentra su conversación.')
    # El que se usó queda donde falte (o donde se corrigió): una fila del Tablero sin Instagram es
    # una agenda que Marketing no puede atribuir aunque la conversación tenga el anuncio.
    if cliente and (nuevo or not normalizar_ig(cliente.instagram)) and normalizar_ig(cliente.instagram) != ig:
        cliente.instagram = ig
    if espejo and (nuevo or not normalizar_ig(espejo.instagram)) and normalizar_ig(espejo.instagram) != ig:
        espejo.instagram = f'@{ig}'

    momentos = [m for a in suyas for m in (a.start_time, a.created_at) if m]
    antes_de_todo = min(momentos) - timedelta(minutes=1) if momentos else datetime.utcnow()
    tope = min((a.start_time for a in suyas if a.start_time), default=None)

    igs = [ig]
    del_cliente = normalizar_ig(cliente.instagram) if cliente else None
    if del_cliente and del_cliente != ig:
        igs.append(del_cliente)
    for usuario in igs:
        responder_con_anuncio(usuario, f'manual_agenda_{cita.id}', cliente.full_name if cliente else None,
                              anuncio, tope, antes_de_todo)

    _elegir(suyas, anuncio)
    db.session.add(LeadEventLog(appointment_id=cita.id, user_id=setter.id, action_type=ACCION,
                                description=_texto_del_registro(anuncio, setter),
                                created_at=datetime.utcnow()))
    _guardar()
    return {'appointment_id': cita.id, 'instagram': ig,
            'anuncio': {'id': anuncio.id, 'keyword': anuncio.keyword or anuncio.name}}


def _elegir(agendas, anuncio):
    for a in agendas:
        a.keyword = anuncio.keyword or anuncio.name
        a.anuncio_id = anuncio.id


def _guardar():
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise ErrorDePalabraClave('No se pudo guardar: probá de nuevo.', 500) from None


def responder_con_anuncio(ig, marca, nombre, anuncio, tope, antes_de_todo):
    """La conversación de ese Instagram (la crea si no está, con `marca` en su manychat_id) con una
    respuesta con el anuncio de antes de `tope` (la reunión o el primer pago): la que ya había sin
    anuncio o una nueva en `antes_de_todo`. La usan las agendas y las ventas del setter."""
    conversacion = ManychatLead.query.filter(
        func.lower(func.replace(ManychatLead.ig, '@', '')) == ig).first()
    if not conversacion:
        conversacion = ManychatLead(manychat_id=f'{marca}_{uuid.uuid4().hex[:6]}',
                                    name=nombre or 'Sin nombre',
                                    ig=f'@{ig}', follower=False)
        db.session.add(conversacion)
        db.session.flush()

    sin_anuncio = LeadAnswer.query.filter(LeadAnswer.lead_id == conversacion.id, LeadAnswer.ad_id.is_(None))
    if tope:
        sin_anuncio = sin_anuncio.filter(LeadAnswer.created_at <= tope)
    respuesta = sin_anuncio.order_by(LeadAnswer.created_at.desc()).first()
    if respuesta:
        respuesta.ad_id = anuncio.id
    else:
        db.session.add(LeadAnswer(lead_id=conversacion.id, ad_id=anuncio.id, keyword=KEYWORD_MANUAL,
                                  qualification='true', created_at=antes_de_todo, updated_at=antes_de_todo))


def _texto_del_registro(anuncio, setter):
    """Lo que dice el historial del lead. Simulando, quién lo hizo de verdad: el mismo sufijo que
    `BookingService.log_lead_event`, que no se usa porque hace su propio commit (este registro va en
    la misma transacción que la atribución) y deja la hora al default de la columna."""
    from flask import has_request_context
    from app.models import User, get_impersonation_state

    texto = f'Palabra clave del anuncio: {anuncio.keyword or anuncio.name}'
    simulando, original_id, _ = get_impersonation_state() if has_request_context() else (False, None, None)
    if simulando:
        original = db.session.get(User, original_id)
        quien = original.username if original else f'Usuario {original_id}'
        texto += f' (Acción ejecutada por {quien} actuando en nombre de {setter.username})'
    return texto
