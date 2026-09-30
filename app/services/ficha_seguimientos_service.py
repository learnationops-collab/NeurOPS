"""Los seguimientos de un lead, agendados y corregidos desde el historial de la ficha.

Pedido del usuario (29/09/2026): «En los seguimientos deberian poder crearse seguimientos y cambiar
el estado de los seguimientos».

El modelo, que es lo que decide todo lo de abajo: un seguimiento NO es una fila propia. Vive en
cinco columnas de `Appointment`, asi que hay uno por agenda:

  · `fecha_seguimiento`: el DIA del proximo contacto, texto 'AAAA-MM-DD'. Sin hora a proposito:
    media docena de consultas lo comparan como texto (`<= 'AAAA-MM-DD'`, `LIKE 'AAAA-MM-DD%'`).
  · `seguimiento_tipo`: el grupo de la pestaña Seguimientos del closer donde aparece. 'no_tomada'
    (no show, cancelo o reprogramo sin fecha), 'tomada' (asistio y quedo una decision o una 2ª
    llamada) o 'cerrada' (cliente que ya pago: cobranza, renovacion, upsell).
  · `seguimiento_sub`: el texto que el closer lee en la fila («No show: no contesto», «Seguimiento
    de cobro»). Aca es la nota.
  · `seguimiento_intento`: que contacto de la cadencia es (1 a 4, a los 0/3/7/14 dias).
  · `seguimiento_realizado`: cerrado. Ninguna pantalla lista como pendiente uno realizado.

Agendar un seguimiento sobre una agenda que ya tiene uno lo REEMPLAZA: la UI lo avisa antes y la
bitacora del lead guarda el que habia. Guardar varios por agenda pediria una tabla nueva, y la
leen la pestaña Seguimientos, el contador del dashboard, el bloqueo del reporte del dia y los
avisos por WhatsApp: no se inventa aca.

Quien lo lee, y por que lo que se escribe aca aparece bien ahi:

  · La pestaña Seguimientos del closer (`CloserFollowUpService.get_today_grouped` / `get_pool`):
    los pendientes del closer DUEÑO de la agenda (`Appointment.closer_id`), agrupados por tipo.
    Con fecha, en «Asignados para hoy» desde ese dia; sin fecha, en el pool.
  · El contador de pendientes del dashboard (`CloserPendingService._seguimientos`) y el bloqueo
    del reporte del dia (`CloserService.get_previous_days_pending`): un pendiente con la fecha
    pasada es un atrasado, y mientras exista el closer no puede mandar su reporte.
  · Los avisos por WhatsApp (`send_due_reminders`): solo si el closer los pidio para ESE
    seguimiento (`followup_reminder_enabled` + hora).

Lo que NO se toca, a proposito:

  · `closer_processed`, que es lo que saca la agenda del mazo. El guardado del mazo
    (`deck_escritura_service.aplicar_cambios`) lo prende con cualquier campo de seguimiento, y por
    eso aca no se pasa por ahi: agendarle un seguimiento a la llamada de la semana que viene la
    sacaria del mazo del closer antes de que ocurra.
  · `last_contact_outcome` / `last_contact_at`: son el registro de un contacto REAL, lo que el
    closer reporta al procesar una tarjeta de Seguimientos, y de ahi salen «seguimientos hechos
    hoy», la meta diaria y las tasas de respuesta. Marcar realizado desde el historial corrige el
    estado; no inventa un contacto que nadie hizo.
  · El espejo del Tablero de Agendas (`FinancialAgenda`): no guarda nada del seguimiento.
"""
from datetime import date

from app import db
from app.services.closer_followup_service import TIPOS_SEGUIMIENTO, CloserFollowUpService
from app.services.ficha_acciones_service import ErrorDeAccion
from app.services.ficha_agendas_service import PRIMER_ANIO
from app.services.ficha_lead_secciones import tiene_seguimiento

# `Appointment.seguimiento_sub` es String(255): en Postgres una nota mas larga no se trunca, falla.
LARGO_NOTA = 255


def _dia(valor):
    """'AAAA-MM-DD' -> el mismo dia normalizado, o `ErrorDeAccion`.

    Se exige el dia pelado, que es lo que da un `<input type="date">`: un instante con hora le
    agregaria a la columna una hora que las consultas por dia no esperan.
    """
    texto = valor.strip() if isinstance(valor, str) else ''
    if not texto:
        raise ErrorDeAccion('Falta el día del seguimiento.')
    try:
        dia = date.fromisoformat(texto) if len(texto) == 10 else None
    except ValueError:
        dia = None
    if dia is None:
        raise ErrorDeAccion('La fecha del seguimiento tiene que ser un día: «AAAA-MM-DD».')
    if not PRIMER_ANIO <= dia.year <= date.today().year + 2:
        raise ErrorDeAccion('Esa fecha no parece la de un seguimiento: revisá el año.')
    return dia.isoformat()


def _tipo(valor):
    # El `isinstance` va primero: una lista en el JSON haría fallar el `in` con un TypeError en
    # inglés en vez de este motivo.
    if not isinstance(valor, str) or valor not in TIPOS_SEGUIMIENTO:
        raise ErrorDeAccion('Elegí el tipo de seguimiento de la lista.')
    return valor


def _nota(valor):
    if valor is not None and not isinstance(valor, str):
        raise ErrorDeAccion('La nota del seguimiento tiene que ser texto.')
    texto = (valor or '').strip()
    if len(texto) > LARGO_NOTA:
        raise ErrorDeAccion(f'La nota es muy larga: hasta {LARGO_NOTA} caracteres.')
    return texto or None


def _etiqueta(tipo):
    return TIPOS_SEGUIMIENTO.get(tipo, {}).get('label', tipo or 'sin tipo')


def _resumen(appt):
    """El seguimiento que tiene la agenda, en una linea para la bitacora."""
    estado = 'realizado' if appt.seguimiento_realizado else 'pendiente'
    partes = [appt.fecha_seguimiento or 'sin fecha', estado, _etiqueta(appt.seguimiento_tipo)]
    if appt.seguimiento_sub:
        partes.append(f'«{appt.seguimiento_sub}»')
    return ' · '.join(partes)


def _anotar(appt, usuario, tipo_evento, accion, detalle):
    """Deja la entrada en la bitacora del lead, con la forma de la del resto del historial."""
    from app.services.booking_service import BookingService

    BookingService.log_lead_event(
        appt.id, usuario.id, tipo_evento,
        f'{usuario.username} {accion} desde el historial de la ficha: {detalle}.')


def agendar(appt, datos, usuario):
    """Agenda el seguimiento de ESTA agenda, o reemplaza el que tiene.

    La escritura es `CloserFollowUpService.schedule_followup`, la misma de «Programar seguimiento»
    de la pestaña del closer: tipo, nota, fecha, intento 1 y pendiente. Es un seguimiento nuevo,
    asi que arranca la cadencia desde el primer contacto aunque reemplace a uno que iba por el
    tercero.

    El aviso por WhatsApp se APAGA. Es opt-in por seguimiento —el closer elige si lo quiere y a
    que hora al programarlo— y este formulario no lo pregunta: heredar el del seguimiento anterior
    le mandaria al closer un aviso que nadie pidio para este. Se prende desde su pestaña.
    """
    fecha = _dia(datos.get('fecha'))
    tipo = _tipo(datos.get('tipo'))
    nota = _nota(datos.get('nota'))
    anterior = _resumen(appt) if tiene_seguimiento(appt) else None

    CloserFollowUpService.schedule_followup(appt, tipo=tipo, sub=nota, fecha_seguimiento=fecha,
                                            intento=1, reminder_enabled=False)
    db.session.commit()

    detalle = _resumen(appt)
    if anterior:
        detalle += f'; reemplaza al que tenía la agenda ({anterior})'
    _anotar(appt, usuario, 'seguimiento_agendado', 'agendó un seguimiento', detalle)

    return {'id': appt.id, 'fecha': appt.fecha_seguimiento, 'tipo': appt.seguimiento_tipo,
            'nota': appt.seguimiento_sub, 'reemplazado': anterior is not None}


# Lo que se corrige de un seguimiento, con los MISMOS nombres con los que lo lee el historial
# (`ficha_lead_secciones.historial`): si el GET dijera `nota` y el PATCH pidiera `sub`, cada lado
# pasaria sus tests y en pantalla guardar no haria nada.
CAMPOS = ('realizado', 'fecha', 'tipo', 'nota')


def corregir(appt, datos, usuario):
    """Corrige el estado, el día, el tipo y/o la nota del seguimiento de ESTA agenda.

    Solo se tocan los campos que vienen, y se validan todos antes de escribir ninguno. Lo que se
    decidió con cada uno:

      · `realizado`: cierra o reabre el seguimiento, y nada más. La fecha se CONSERVA al cerrarlo
        —el mazo la borra, pero ninguna pantalla lista un realizado por su fecha—, así que
        reabrirlo por error de dedo no pierde el dato. Reabierto con la fecha pasada, vuelve como
        atrasado: es lo que es.
      · `fecha`: se mueve, no se borra (sin día el seguimiento pasaría al pool «Asignar fecha»
        del closer, que es otra cosa que corregirlo). Mover el día rearma el aviso por WhatsApp si
        el closer lo tenía pedido —se borra la marca de «ya avisé hoy», igual que al reprogramar
        desde su pestaña—; no lo prende si no lo tenía.
      · `tipo`: lo cambia de grupo en la pestaña del closer.
      · `nota`: vacía la borra.

    El intento no se corrige: es la cuenta de contactos de la cadencia y lo lleva el closer al
    procesar cada uno.
    """
    if not any(campo in datos for campo in CAMPOS):
        raise ErrorDeAccion('No hay nada que guardar.')
    if not tiene_seguimiento(appt):
        raise ErrorDeAccion('Esta agenda no tiene ningún seguimiento que corregir: agendale uno.')

    realizado = datos.get('realizado')
    if 'realizado' in datos and not isinstance(realizado, bool):
        raise ErrorDeAccion('El estado del seguimiento es pendiente o realizado.')
    fecha = _dia(datos.get('fecha')) if 'fecha' in datos else None
    tipo = _tipo(datos.get('tipo')) if 'tipo' in datos else None
    nota = _nota(datos.get('nota')) if 'nota' in datos else None

    cambios, bitacora = [], []
    if 'realizado' in datos and realizado != bool(appt.seguimiento_realizado):
        antes, ahora = ('pendiente', 'realizado') if realizado else ('realizado', 'pendiente')
        bitacora.append(f'estado {antes} → {ahora}')
        appt.seguimiento_realizado = realizado
        cambios.append('realizado')
    if fecha and fecha != (appt.fecha_seguimiento or ''):
        bitacora.append(f'fecha {appt.fecha_seguimiento or "sin fecha"} → {fecha}')
        appt.fecha_seguimiento = fecha
        appt.followup_reminder_sent_at = None
        cambios.append('fecha')
    if tipo and tipo != appt.seguimiento_tipo:
        bitacora.append(f'tipo {_etiqueta(appt.seguimiento_tipo)} → {_etiqueta(tipo)}')
        appt.seguimiento_tipo = tipo
        cambios.append('tipo')
    if 'nota' in datos and nota != (appt.seguimiento_sub or None):
        bitacora.append(f'nota «{appt.seguimiento_sub or ""}» → «{nota or ""}»')
        appt.seguimiento_sub = nota
        cambios.append('nota')

    if not cambios:
        return {'id': appt.id, 'cambios': []}

    db.session.commit()
    _anotar(appt, usuario, 'seguimiento_corregido', 'corrigió el seguimiento', '; '.join(bitacora))
    return {'id': appt.id, 'cambios': cambios, 'realizado': bool(appt.seguimiento_realizado),
            'fecha': appt.fecha_seguimiento, 'tipo': appt.seguimiento_tipo,
            'nota': appt.seguimiento_sub}


def borrar(appt, datos, usuario):
    """Saca el seguimiento de ESTA agenda: deja de verse en el historial y en la pestaña
    Seguimientos del closer.

    Pedido del usuario (29/09/2026): "que los demás datos de las pestañas de historial también se
    puedan eliminar o crear nuevos".

    No alcanza con vaciar las columnas, y es lo que no se ve leyendo este archivo: la pestaña del
    closer también DEDUCE seguimientos (`CloserFollowUpService._effective_tipo`). Una agenda con
    `closer_result` 'No Show' o 'Canceló', o una vencida que nadie reportó, aparece como «no
    tomada» aunque no tenga tipo guardado. Vaciar el tipo y la fecha la dejaría volver sola, así
    que además se marca realizado: lo único que ninguna consulta lista como pendiente
    (`_base_query` filtra por `seguimiento_realizado`). Agendarle uno nuevo después lo reabre, como
    siempre (`schedule_followup`).

    El aviso por WhatsApp se apaga con él, y la bitácora guarda el que había.
    """
    if not tiene_seguimiento(appt):
        raise ErrorDeAccion('Esta agenda no tiene ningún seguimiento que borrar.')
    anterior = _resumen(appt)

    appt.fecha_seguimiento = None
    appt.seguimiento_tipo = None
    appt.seguimiento_sub = None
    appt.seguimiento_intento = 1
    appt.seguimiento_realizado = True
    appt.followup_reminder_enabled = False
    appt.followup_reminder_sent_at = None
    db.session.commit()

    _anotar(appt, usuario, 'seguimiento_borrado', 'borró el seguimiento', anterior)
    return {'id': appt.id, 'borrado': True}
