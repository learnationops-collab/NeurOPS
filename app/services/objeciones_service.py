"""Las objeciones de las llamadas que se presentaron y no cerraron.

Pedido de Kerwin (09/10/2026): «si se marca como "No cerró" debe haber una entrada de texto
preguntando "¿Por qué no cerró? ¿Cuál es la objeción?" y eso debe quedar registrado en
comunicación», y «una opción en el historial para agregar objeciones [...] a leads que se
reportaron antes de ahora». Desde ese día la objeción es obligatoria al reportar «No cerró».

**Contrato** (lo lee el panel «No cerradas» del dashboard comercial; no cambiarlo sin avisar):

  · una objeción es una fila de `lead_event_logs` (`LeadEventLog`) con `action_type='objecion'`;
  · `appointment_id` es la agenda de la llamada que no cerró y `user_id` quien la escribió;
  · `description` es el texto TAL CUAL se escribió, sin espacios a los costados y nada más: ni un
    prefijo, ni el sufijo de suplantación que agrega `BookingService.log_lead_event` (por eso la
    fila se inserta directo y no por esa función). Quién la escribió ya está en `user_id`;
  · `created_at` es cuándo;
  · la objeción vigente de una agenda es su fila MÁS NUEVA: volver a cargarla no borra la anterior,
    la reemplaza. No hay columna nueva ni migración.

Además queda una nota del equipo en Comunicación (el hilo del cliente), que es donde el equipo la
lee. No avisa a nadie: es un registro, no un pedido.
"""
from datetime import datetime

import pytz

from app import db
from app.models import ClientComment, Comment, LeadEventLog

ACCION = 'objecion'
# Lo mismo que se le pide a «Qué le dijiste y qué respondió» en la cadencia de seguimiento: una
# objeción de dos palabras («Es caro») no le sirve a quien lo vuelva a llamar.
MINIMO = 10
# Un párrafo largo entra; un pegado de la transcripción entera de la llamada, no.
MAXIMO = 2000

# Los estados del libro de agendas (`derivar_estado`) en los que el lead estuvo en la llamada. El
# perdido entra solo si se le presentó la oferta: es lo que deja «No cerró → Lead perdido» del árbol
# de «Resultado», y los perdidos de un no show o de una cancelación no tuvieron objeción que contar.
_ASISTIO = 'show_up'
_PERDIDO = 'lead_perdido'


class ObjecionInvalida(ValueError):
    """El texto no alcanza para ser una objeción: vacío, muy corto o demasiado largo."""


def texto_valido(texto):
    """El texto listo para guardar, o `ObjecionInvalida` con el motivo en palabras."""
    if texto is not None and not isinstance(texto, str):
        raise ObjecionInvalida('La objeción tiene que ser texto.')
    limpio = (texto or '').strip()
    if not limpio:
        raise ObjecionInvalida('Falta la objeción: ¿por qué no cerró?')
    if len(limpio) < MINIMO:
        raise ObjecionInvalida(f'La objeción tiene que tener al menos {MINIMO} caracteres '
                               f'(tiene {len(limpio)}): contá por qué no cerró.')
    if len(limpio) > MAXIMO:
        raise ObjecionInvalida(f'La objeción es demasiado larga: el máximo es {MAXIMO} caracteres.')
    return limpio


def admite_objecion(appt, estado, cerro):
    """Si a esta agenda le corresponde una objeción: el lead asistió y no cerró.

    `estado` es el del libro de agendas (`derivar_estado`) y `cerro` dice si el cliente tiene una
    venta (pago completo o split pay) o una seña: es la misma cuenta con la que la ficha deriva su
    post call («Presentó, no cerró») y su hito de Cierre, que es por cliente porque una venta no
    guarda de qué agenda salió. Una agenda a la que se le dijo que NO se presentó la oferta no
    tiene objeción: el lead no llegó a decir que no.
    """
    if cerro or appt.offer_presented is False:
        return False
    return estado == _ASISTIO or (estado == _PERDIDO and appt.offer_presented is True)


def objeciones_por_agenda(ids):
    """{appointment_id: {'texto', 'autor', 'fecha'}} con la objeción vigente de cada agenda.

    Solo aparecen las agendas que tienen alguna. `fecha` es ISO (UTC, como el resto de la API) y
    `autor` el nombre de usuario de quien la escribió.
    """
    ids = [i for i in (ids or []) if i is not None]
    if not ids:
        return {}
    filas = (LeadEventLog.query
             .filter(LeadEventLog.action_type == ACCION, LeadEventLog.appointment_id.in_(ids))
             .order_by(LeadEventLog.created_at.asc(), LeadEventLog.id.asc()).all())
    # En orden de antigüedad: cada agenda se queda con la última que se le escribió.
    return {e.appointment_id: {'texto': e.description,
                               'autor': e.user.username if e.user else 'Sistema',
                               'fecha': e.created_at.isoformat() if e.created_at else None}
            for e in filas}


def _dia_de_la_llamada(appt, usuario):
    """El día de la llamada en el reloj de quien escribe: `start_time` está en UTC, y una llamada de
    las 21 h en La Paz ya es el día siguiente en UTC."""
    if not appt.start_time:
        return None
    try:
        zona = pytz.timezone(getattr(usuario, 'timezone', None) or 'America/La_Paz')
    except pytz.UnknownTimeZoneError:
        zona = pytz.timezone('America/La_Paz')
    return pytz.utc.localize(appt.start_time).astimezone(zona).strftime('%d/%m/%Y')


def registrar_objecion(appt, usuario, texto):
    """Guarda la objeción de esta agenda y la deja anotada en Comunicación. Devuelve la fila.

    `texto` se valida con `texto_valido` (levanta `ObjecionInvalida`). NO comitea: quien la llama
    la guarda junto con el resto de lo suyo (el reporte de la llamada, o la acción del historial).
    """
    texto = texto_valido(texto)
    habia = (db.session.query(LeadEventLog.id)
             .filter_by(appointment_id=appt.id, action_type=ACCION).first() is not None)

    fila = LeadEventLog(appointment_id=appt.id, user_id=usuario.id, action_type=ACCION,
                        description=texto, created_at=datetime.utcnow())
    db.session.add(fila)

    dia = _dia_de_la_llamada(appt, usuario)
    nota = (f"{'Objeción actualizada' if habia else 'Objeción'}"
            f"{f' de la llamada del {dia}' if dia else ''} (no cerró): {texto}")
    if appt.client_id:
        # El hilo del CLIENTE y no el de la agenda: Comunicación muestra el de la agenda con la que
        # se abrió la ficha, y la objeción de una llamada vieja tiene que verse igual.
        db.session.add(ClientComment(client_id=appt.client_id, author_id=usuario.id, text=nota))
    else:
        db.session.add(Comment(author_id=usuario.id, text=nota[:500], comment_type='appointment',
                               associated_id=appt.id))
    db.session.flush()
    return fila


def _cliente_cerro(appt):
    """La misma cuenta que hace la ficha al leerse (`ficha_lead_service.ficha`): ¿el cliente de
    esta agenda tiene una venta de verdad o una seña?"""
    from app.services.ficha_lead_service import _que_compro, _ventas_del_cliente
    from app.services.sheets_service import SheetsService

    tipos = {SheetsService.parse_tipo_pago(v.tipo_pago)[1] for v in _ventas_del_cliente(appt.client)}
    con_venta, _ = _que_compro(tipos)
    return con_venta or 'seña' in tipos


def guardar_desde_el_historial(appt, datos, usuario):
    """«Agregar objeción» de una agenda del historial, para las que se reportaron antes de que la
    objeción fuera obligatoria. Reemplaza la que hubiera (la vigente es la más nueva).

    Solo en una agenda en la que el lead asistió y no cerró, o que ya tiene una objeción (una
    renovación que no cerró de alguien que ya compró la deja el reporte de la llamada, y tiene que
    poder corregirse aunque el cliente ya haya comprado antes).
    """
    from app.services.estado_lead import estado_de_agenda
    from app.services.ficha_acciones_service import ErrorDeAccion

    try:
        texto = texto_valido(datos.get('texto'))
    except ObjecionInvalida as e:
        raise ErrorDeAccion(str(e), 'texto') from None

    ya_tiene = appt.id in objeciones_por_agenda([appt.id])
    if not ya_tiene and not admite_objecion(appt, estado_de_agenda(appt), _cliente_cerro(appt)):
        raise ErrorDeAccion('Solo lleva objeción una llamada a la que el lead asistió y en la que '
                            'no cerró.')

    registrar_objecion(appt, usuario, texto)
    db.session.commit()
    return {'id': appt.id, 'objecion': objeciones_por_agenda([appt.id])[appt.id]}
