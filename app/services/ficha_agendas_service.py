"""Correcciones de una agenda desde el historial de la ficha: su fecha, su fuente y su closer.

Pedido del usuario (29/09/2026): «En las agendas deberia poder modificar lo que se ve de las
agendas: la fecha, la hora, los estados, la fuente...». Los estados ya se corrigen en la fila con
`ficha_acciones_service.estado_agenda`; esto es el resto de lo que la fila muestra.

Vive aparte de `ficha_acciones_service.py` porque mover una cita no es cambiar un campo suelto:
de `start_time` dependen el estado derivado de la agenda, el mazo del closer y el espejo en el
Tablero de Agendas, y lo que se decidio con cada uno queda escrito aca (ver `editar_agenda`).

Convencion horaria (la de todo el sistema, ver `agenda_time_service`): `start_time` se guarda en
UTC naive. El frontend convierte la hora local que la persona ve y escribe a un instante con zona,
y aca se lo pasa a UTC.
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, or_

from app import db
from app.models import Appointment, User
from app.services.ficha_acciones_service import ErrorDeAccion, closer_activo

# Los tres datos de la fila que se corrigen aca. La lista es cerrada: un PATCH que trae otra cosa
# no hace nada con ella.
CAMPOS = ('fecha', 'fuente', 'closer_id')

# A que distancia de la hora de la cita se busca su fila en el Tablero de Agendas: la misma
# ventana con la que `BookingService.sync_appointment_to_financial_agenda` decide que una fila ES
# esta cita y no otra agenda cualquiera del mismo lead.
VENTANA_ESPEJO = timedelta(hours=36)

# Primer año en el que puede caer una agenda de verdad. Un `datetime-local` con el año mal tipeado
# («0202») pasa cualquier parser y dejaria la llamada en otro siglo.
PRIMER_ANIO = 2020


def _instante_utc(valor):
    """'2026-10-01T14:00:00.000Z' -> datetime UTC naive, que es como se guarda `start_time`.

    Se exige la zona. El `datetime-local` del navegador da la hora LOCAL sin zona, y tomarla por
    UTC corre la llamada cuatro horas para todo el resto del sistema (el mazo, el contador, el
    calendario): prefiero un 400 que diga por que a una hora corrida en silencio.
    """
    texto = valor.strip() if isinstance(valor, str) else ''
    if not texto:
        raise ErrorDeAccion('Falta la fecha y la hora de la llamada.')
    try:
        instante = datetime.fromisoformat(texto.replace('Z', '+00:00'))
    except ValueError:
        raise ErrorDeAccion('La fecha no se entiende: tiene que ser "AAAA-MM-DDTHH:MM" con su '
                            'zona horaria.') from None
    if instante.tzinfo is None:
        raise ErrorDeAccion('La fecha llegó sin zona horaria, y sin ella no se sabe a qué hora '
                            'es la llamada. Volvé a elegirla.')
    utc = instante.astimezone(timezone.utc).replace(tzinfo=None)
    if not PRIMER_ANIO <= utc.year <= datetime.utcnow().year + 2:
        raise ErrorDeAccion('Esa fecha no parece la de una llamada: revisá el año.')
    return utc


def validar_fuente(valor, actual):
    """La fuente pedida si cambia, None si es la misma, `ErrorDeAccion` si no es de la lista.

    La lista es la que ofrece la ficha (`ficha_vocabulario.fuentes_elegibles`): el catalogo oficial
    del Tablero de Agendas sin la grabacion del workshop, el setting sin setter ni «Desconocido»
    (09/10/2026). Los valores que no estan en ella —historicos, o esos tres— se siguen aceptando
    SOLO si no cambian: la fila puede conservar su fuente, pero una fuente nueva sale de la lista.

    La usa tambien la cabecera de la ficha (`ficha_acciones_service.editar_datos`): el error dice
    que fue la `fuente`, para que se pinte al lado de ese campo.
    """
    from app.services.ficha_vocabulario import fuentes_elegibles

    fuente = valor.strip() if isinstance(valor, str) else ''
    if not fuente:
        raise ErrorDeAccion('Elegí la fuente de la lista.', 'fuente')
    if fuente == (actual or '').strip():
        return None
    if fuente not in fuentes_elegibles():
        raise ErrorDeAccion(f'«{fuente}» no es una fuente del catálogo: elegí una de la lista.',
                            'fuente')
    return fuente


def _setter_de_la_fuente(fuente):
    """El setter al que se le atribuye una agenda con esta fuente, o None.

    Misma regla que la edicion masiva del Tablero (`_sincronizar_fuente_con_cita`): si la fuente
    es un setter del equipo la agenda es suya, y si es un embudo no es de ningun setter. No es una
    preferencia de esta pantalla: el sync del tablero (`sync_financial_agenda_to_appointment`)
    recalcula `setter_id` desde la fuente cada vez que corre, asi que otra regla aca duraria hasta
    la proxima sincronizacion.
    """
    setter = User.query.filter(func.lower(User.username) == fuente.lower(),
                               User.role == 'setter').first()
    return setter.id if setter else None


def poner_fuente(appt, fuente, espejo):
    """Le pone a la agenda una fuente ya validada (`validar_fuente`): el `origin`, el setter al que
    se le atribuye y el nombre de su fila en el Tablero de Agendas (`espejo`), si tiene una.

    La comparten el historial (`editar_agenda`) y la cabecera de la ficha
    (`ficha_acciones_service.editar_datos`): corregida desde donde sea, la fuente tiene que dejar
    el mismo setter y el mismo espejo, o el proximo sync del tablero deshace la que quedo distinta.
    No hace commit.
    """
    appt.origin = fuente
    appt.setter_id = _setter_de_la_fuente(fuente)
    if espejo:
        espejo.nombre = fuente


def _choque(appt, closer_id, inicio):
    """Otra llamada SIN RESOLVER del mismo closer a esa misma hora, si la hay.

    Es el criterio de `BookingService.create_appointment` (y de `POST /closer/appointments`): una
    cita ya resuelta por el closer, cancelada o reprogramada no ocupa el horario.
    """
    return Appointment.query.filter(
        Appointment.id != appt.id,
        Appointment.closer_id == closer_id,
        Appointment.start_time == inicio,
        Appointment.closer_processed.is_(False),
        or_(Appointment.result.is_(None), Appointment.result == '',
            Appointment.result.notin_(['Cancelada', 'Reprogramada'])),
    ).first()


def espejo_en_el_tablero(appt):
    """La fila del Tablero de Agendas (`FinancialAgenda`) que refleja esta cita, o None.

    Se busca ANTES de mover la cita y con la hora vieja, que es la que la fila todavia tiene. El
    sync del tablero hacia las citas (`sync_financial_agenda_to_appointment`, que corre con cada
    webhook de n8n y con la resincronizacion masiva) busca la cita del lead a ±12 h de la fecha de
    la fila, y le pisa la hora, la fuente y el closer con los de la fila. Si la fila se quedara con
    la fecha vieja, la correccion duraria hasta la proxima sincronizacion — o, si la cita se movio
    mas de 12 horas, el sync no la encontraria y crearia una SEGUNDA cita a la hora vieja.

    Se busca con el mismo cruce que `sync_appointment_to_financial_agenda` (mail, instagram,
    telefono, nunca una fila marcada como repetida) y la misma ventana, pero SIN pasar por esa
    funcion: cuando no hay fila en la ventana, su respaldo es "la agenda mas reciente del lead",
    que es OTRA llamada, y le escribe el closer y el estado de esta antes de devolverla. Corregir
    una agenda vieja le ponia el No Show de la vieja a la fila de la llamada de mañana, y el sync
    tablero -> citas sacaba despues esa llamada del mazo antes de que ocurriera.

    Tampoco se crea una fila cuando no la hay: una cita sin fila no la pisa ningun sync, y dar de
    alta una agenda en el Tablero no es corregir esta. Por lo mismo no se usa el ultimo recurso de
    ese sync (una fila a la misma hora con un nombre compatible, que da por bueno cualquier nombre
    generico): el sync tablero -> citas llega a la cita por el contacto de la fila, y una fila que
    no comparte ninguno con este cliente no la va a pisar. Entre varias filas en la ventana gana la
    mas cercana a la hora de la cita.
    """
    from app.models.financial import FinancialAgenda
    from app.services.booking_service import BookingService

    if not appt.start_time or not appt.client:
        return None
    filtros = BookingService.filtros_de_agenda_del_cliente(appt.client)
    if not filtros:
        return None
    candidatas = FinancialAgenda.query.filter(
        FinancialAgenda.duplicada_de_id.is_(None), or_(*filtros),
        FinancialAgenda.date >= appt.start_time - VENTANA_ESPEJO,
        FinancialAgenda.date <= appt.start_time + VENTANA_ESPEJO).all()
    if not candidatas:
        return None
    return min(candidatas, key=lambda fila: abs(fila.date - appt.start_time))


def _en_la_zona(dt, zona):
    import pytz

    if not dt:
        return 'sin fecha'
    return pytz.UTC.localize(dt).astimezone(zona).strftime('%d/%m/%Y %H:%M')


def editar_agenda(appt, datos, usuario, *, desde='el historial de la ficha'):
    """Corrige la fecha y hora, la fuente y/o el closer de UNA agenda del cliente.

    Solo se tocan los campos que vienen en el pedido. Lo que se decidio con lo que depende de
    `start_time`:

      · El estado de la agenda no se guarda: lo deriva `derivar_estado` de los resultados y de la
        hora. Mover al futuro una llamada sin resultado la vuelve «Por confirmar» sola.
      · `closer_processed`, en cambio, es una marca guardada: es lo que saca la cita del mazo del
        closer. Si la llamada queda en el futuro y sin resultado, se apaga — una llamada que no
        ocurrio no puede estar reportada, y con la marca prendida la cita quedaria «Por confirmar»
        en la ficha pero fuera del mazo, que es el bug del 08/sep/2026 que `deck_escritura_service`
        ya arreglo para el reagendado. Una llamada CON resultado conserva su marca: corregirle la
        fecha no la des-reporta.
      · Los avisos por WhatsApp no dependen de esta hora: `followup_reminder_sent_at` y
        `followup_reminder_time` son del SEGUIMIENTO (`fecha_seguimiento`), y
        `pre_call_reminder_at` es una fecha que el closer elige a mano. No hay bandera que resetear.
      · El espejo en el Tablero de Agendas se mueve con la cita, si la cita tiene uno; la fila de
        otra llamada del mismo lead no se toca (ver `espejo_en_el_tablero`).
      · El evento de Google Calendar NO se mueve: no hay una funcion que lo actualice, y el evento
        vive en el calendario de quien lo creo. Es lo mismo que hace el reagendado del closer
        (`PATCH /closer/appointments/<id>`).
      · No se marca `is_rescheduled`: esto corrige un dato mal cargado, no reprograma la llamada.
        Reprogramar crea otra agenda y tiene su propia accion.

    Queda una entrada en la bitacora del lead con cada valor anterior, con las horas en la zona de
    quien corrigio. `desde` dice en esa entrada de donde vino la correccion: la edicion en lote de
    Revisar (10/10/2026) corrige cada agenda con esta misma funcion, y la bitacora no puede decir
    «el historial de la ficha» de algo que se hizo sobre doce agendas a la vez.
    """
    from app.services.closer_agendas_service import derivar_estado
    from app.services.user_time_service import zona_del_usuario

    if not any(campo in datos for campo in CAMPOS):
        raise ErrorDeAccion('No hay nada que guardar.')

    inicio = _instante_utc(datos.get('fecha')) if 'fecha' in datos else appt.start_time
    fuente = validar_fuente(datos.get('fuente'), appt.origin) if 'fuente' in datos else None
    closer = appt.closer
    pedido = datos.get('closer_id')
    # El mismo closer que ya tiene no se valida: una agenda vieja de un closer que ya no está
    # activo tiene que poder corregirse de fecha sin que su propio closer la haga rebotar.
    if pedido not in (None, '') and str(pedido) != str(appt.closer_id):
        closer = closer_activo(pedido)

    cambia_fecha = inicio != appt.start_time
    cambia_closer = closer is not None and closer.id != appt.closer_id
    if not (cambia_fecha or fuente or cambia_closer):
        return {'id': appt.id, 'cambios': []}

    if (cambia_fecha or cambia_closer) and inicio is not None:
        otra = _choque(appt, closer.id, inicio)
        if otra:
            nombre = otra.client.full_name if otra.client else 'otro lead'
            raise ErrorDeAccion(f'{closer.username} ya tiene una llamada sin resolver con '
                                f'{nombre} a esa misma hora.')

    espejo = espejo_en_el_tablero(appt)
    zona = zona_del_usuario(usuario)
    cambios, bitacora = [], []

    if cambia_fecha:
        bitacora.append(f'fecha {_en_la_zona(appt.start_time, zona)} → '
                        f'{_en_la_zona(inicio, zona)} ({zona.zone})')
        appt.start_time = inicio
        cambios.append('fecha')
        if derivar_estado(appt, datetime.utcnow()) in ('por_confirmar', 'confirmada'):
            appt.closer_processed = False
        if espejo:
            espejo.date = inicio
            espejo.fecha_meet = inicio.isoformat()

    if fuente:
        bitacora.append(f'fuente {appt.origin or "sin fuente"} → {fuente}')
        poner_fuente(appt, fuente, espejo)
        cambios.append('fuente')

    if cambia_closer:
        anterior = appt.closer.username if appt.closer else 'sin asignar'
        bitacora.append(f'closer {anterior} → {closer.username}')
        appt.closer_id = closer.id
        cambios.append('closer')
        if espejo:
            espejo.closer = closer.username

    db.session.commit()

    from app.services.booking_service import BookingService
    BookingService.log_lead_event(
        appt.id, usuario.id, 'agenda_corregida',
        f'{usuario.username} corrigió la agenda desde {desde}: '
        + '; '.join(bitacora) + '.')

    return {'id': appt.id, 'cambios': cambios, 'fecha': appt.start_time.isoformat(),
            'fuente': appt.origin, 'closer_id': appt.closer_id}
