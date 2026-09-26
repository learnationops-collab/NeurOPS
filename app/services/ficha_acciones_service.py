"""Las escrituras de la ficha del lead: una funcion por accion, todas delegando.

Ninguna de estas funciones contiene logica de negocio propia. Cada una traduce el payload que manda
el modal al de un servicio que ya existe y lo llama:

  · confirmar, seguimiento y baja -> `deck_escritura_service.aplicar_cambios` (el write del mazo);
  · reportar, reprogramar y descartar -> `CloserService.process_agenda`;
  · la venta -> `SheetsService.post_to_sheets`, que es el UNICO camino real de una venta (crea el
    Client, valida la secuencia de pagos, crea la FinancialSale, espeja Enrollment/Payment, marca
    la agenda como Show up y dispara n8n);
  · el plan de cuotas -> `InstallmentService`.

Duplicar cualquiera de esas reglas seria garantizar que las dos superficies divergen: la ficha
diria una cosa y el mazo del closer otra sobre el mismo lead.

`ErrorDeAccion` es un pedido mal hecho (400). Lo que revienta adentro de un servicio se propaga.
"""
from app import db
from app.models import Appointment, ClientComment, Comment, Notification, User
from app.services.deck_escritura_service import aplicar_cambios

# Roles a los que `CloserService.process_agenda` no reconoce (su comprobacion interna solo acepta
# closer/admin/setter/call_confirmer/triage, y exige ser dueno de la agenda). La ficha ya resolvio
# el permiso con `permisos_de` antes de llegar aca, asi que se entra como admin para no volver a
# pedirle permiso a la puerta de atras — que es justamente la puerta que le cerraba el paso a la
# direccion comercial.
ROLES_SIN_ALCANCE_EN_EL_MAZO = ('admin', 'director_comercial')


class ErrorDeAccion(Exception):
    """Un pedido mal hecho del frontend: falta un dato o el valor no es admitido."""


def _texto(datos, clave, obligatorio=False):
    valor = (datos.get(clave) or '').strip()
    if obligatorio and not valor:
        raise ErrorDeAccion(f'Falta {clave}.')
    return valor or None


def _process_agenda(appt, usuario, payload):
    from app.services.closer_service import CloserService

    CloserService.process_agenda(usuario.id, appt.id, {'role': 'closer', **payload},
                                is_admin=usuario.role in ROLES_SIN_ALCANCE_EN_EL_MAZO)


# --- Confirmacion -----------------------------------------------------------------------------

# Lo que el paso de confirmacion puede tocar. La lista es cerrada a proposito: sin esto, el mismo
# endpoint aceptaria `result` y reportaria la llamada desde el paso de confirmacion, que es
# exactamente la confusion de superficies que esta ficha viene a resolver.
CLAVES_CONFIRMACION = ('confirmation_stage', 'confirmation_contact_status',
                       'confirmation_pain_points', 'confirm_status', 'closer_notes',
                       'pre_call_reminder_at')


def _confirm_status_de(appt, etapa):
    """El `result` de 3 valores que derivan el Kanban y los reportes, a partir de la etapa granular.

    Misma regla que el wizard del closer (`stageToConfirmStatus`): 'por_contactar' sigue siendo "por
    confirmar" y cualquier etapa intermedia ya es "conversando". 'Confirmado' no se deriva nunca de
    llegar a la ultima etapa: solo lo pone la accion explicita "Listo · 100% confirmado".
    """
    if (appt.result or '').strip().lower() == 'confirmado':
        # Editar una etapa de un lead ya confirmado no lo des-confirma.
        return appt.result
    return 'por_confirmar' if (etapa or 'por_contactar') == 'por_contactar' else 'conversando'


def confirmacion(appt, datos, usuario):
    """Guarda la etapa, el «Cómo viene», los dolores y la nota para la llamada."""
    payload = {k: datos[k] for k in CLAVES_CONFIRMACION if k in datos}
    if not payload:
        raise ErrorDeAccion('No hay nada que guardar.')
    # `confirm_status` viaja siempre, incluso cuando el modal no lo manda: sin el, la regla de
    # `closer_processed` del mazo cae en su caso general y este autoguardado sacaria la cita del
    # mazo antes de llegar a Testimonio (ver `deck_escritura_service._resolver_procesada`).
    payload.setdefault('confirm_status',
                       _confirm_status_de(appt, payload.get('confirmation_stage',
                                                            appt.confirmation_stage)))
    aplicar_cambios(appt, payload, usuario)
    db.session.commit()
    return {'id': appt.id, 'etapa': appt.confirmation_stage, 'cerrada': appt.result}


# --- Resultado de la llamada ------------------------------------------------------------------

# Resultado que elige el closer en el arbol -> lo que entiende `process_agenda`.
RESULTADOS = {'asistio': 'Show up', 'no_show': 'No Show', 'cancelo': 'Cancelado',
              'lead_perdido': 'Lead Perdido', 'no_lead': 'No Lead'}


def resultado(appt, datos, usuario):
    """Cierra el arbol de reporte de la llamada.

    El resultado va por `process_agenda` (que ademas borra el evento de Google Calendar cuando se
    cancela y deja el comentario del lead perdido) y los campos del arbol que no son un estado
    —decisor, oferta, notas, seguimiento— por el write del mazo.
    """
    clave = _texto(datos, 'resultado', obligatorio=True)
    if clave not in RESULTADOS:
        raise ErrorDeAccion(f'Resultado no admitido: {clave}.')
    status = RESULTADOS[clave]

    # El mazo PRIMERO, `process_agenda` despues. El log `show_up_reported` del mazo solo se escribe
    # si `closer_result` cambio en ESE guardado (es como "Cerrar el dia" distingue el trabajo de hoy
    # del de antes): si `process_agenda` corriera primero, ya habria dejado el campo en su valor
    # final y la llamada no quedaria contada como reportada hoy.
    extra = {k: datos[k] for k in ('closer_notes', 'fecha_seguimiento', 'seguimiento_tipo',
                                   'seguimiento_sub', 'seguimiento_intento',
                                   'seguimiento_realizado') if k in datos}
    if 'con_decisor' in datos:
        extra['with_decision_maker'] = datos['con_decisor']
    if 'oferta_presentada' in datos:
        extra['offer_presented'] = datos['oferta_presentada']
    aplicar_cambios(appt, {'result': status, **extra}, usuario)

    # `process_agenda` hace lo que el mazo no: borra el evento de Google Calendar cuando se cancela
    # y deja el comentario del lead perdido.
    _process_agenda(appt, usuario, {'status': status, 'note': datos.get('nota')})
    _guardar_respuestas_del_arbol(appt, datos.get('respuestas'), usuario)
    db.session.commit()
    return {'id': appt.id, 'closer_result': appt.closer_result}


def _guardar_respuestas_del_arbol(appt, respuestas, usuario):
    """Deja las respuestas crudas del arbol de reporte en la bitacora del lead.

    El arbol recoge mas datos de los que tienen columna (motivos, objeciones, angulos). Se guardan
    en `LeadEventLog` en vez de descartarse: simplificar es dejar de MOSTRAR lo que no hace falta, no
    dejar de guardarlo. La bitacora es texto libre y auditable, asi que no hace falta una columna
    nueva por cada pregunta que el arbol agregue.
    """
    if not respuestas:
        return
    import json

    from app.services.booking_service import BookingService
    try:
        detalle = json.dumps(respuestas, ensure_ascii=False, default=str)[:4000]
    except (TypeError, ValueError):
        detalle = str(respuestas)[:4000]
    BookingService.log_lead_event(appt.id, usuario.id, 'reporte_arbol',
                                  f'Respuestas del reporte de llamada: {detalle}')


# --- Venta ------------------------------------------------------------------------------------

# Claves del payload de venta que son instrucciones para esta capa y NO campos de la venta: no
# pueden viajar a Sheets ni a n8n.
CLAVES_NO_DE_VENTA = ('liquidar_saldo', 'respuestas')


def _payload_de_venta(appt, usuario, datos):
    cliente = appt.client
    return {
        # El vendedor es el closer DUENO de la agenda, no quien aprieta el boton: la comision y la
        # atribucion de la venta son suyas aunque la declare la direccion comercial.
        'email_vendedor': (appt.closer.email if appt.closer else usuario.email),
        'nombre_cliente': (cliente.full_name if cliente else None),
        'mail_cliente': (cliente.email if cliente else None),
        'telefono': (cliente.phone or '').lstrip('+') if cliente else None,
        'instagram': (cliente.instagram or '').lstrip('@') if cliente else None,
        'examen': appt.examen or None,
        'appointment_id': appt.id,
        'estado': 'Completada',
        **{k: v for k, v in datos.items() if k not in CLAVES_NO_DE_VENTA},
    }


def venta(appt, datos, usuario):
    """Declara una venta o cobra una cuota.

    Pasa por `SheetsService.post_to_sheets('Ventas_DB', ...)` y no por un atajo propio porque ese es
    el unico camino que hace TODO lo que una venta implica (Client, validacion de secuencia,
    FinancialSale, espejo a Enrollment/Payment, marcar la agenda como Show up, webhook a n8n). Una
    segunda via crearia ventas a medias.

    `liquidar_saldo` es el saldo de una venta anterior que se cobra junto con esta (renovacion o
    upsell de un cliente que todavia debia). Se manda PRIMERO y como una venta aparte de tipo Cuota,
    y si falla no se declara la venta nueva: es el orden que ya tiene el wizard del closer, y
    darlo vuelta dejaria la renovacion registrada con el saldo viejo sin cobrar — es decir, la
    validacion de secuencia de pagos leyendo un historial que no cierra.

    Devuelve la respuesta de Sheets tal cual (`status`, `warning`, `client_id`): el `warning` es el
    aviso de la validacion de secuencia, que el closer ve en pantalla, y comerselo aca seria
    esconderle que la venta quedo con una secuencia rara.
    """
    from app.services.sheets_service import SheetsService

    if not datos.get('tipo_pago'):
        raise ErrorDeAccion('Falta tipo_pago (ej. "RR - Parcial").')
    if not datos.get('monto'):
        raise ErrorDeAccion('Falta el monto cobrado.')

    liquidacion = None
    saldo = datos.get('liquidar_saldo')
    if saldo:
        if not isinstance(saldo, dict) or not saldo.get('monto'):
            raise ErrorDeAccion('`liquidar_saldo` necesita al menos un monto.')
        programa = (saldo.get('programa_code')
                    or str(datos['tipo_pago']).split('-')[0].strip().upper())
        liquidacion = SheetsService.post_to_sheets('Ventas_DB', _payload_de_venta(appt, usuario, {
            'tipo_pago': f'{programa} - Cuota',
            'monto': saldo['monto'],
            'metodo_pago': saldo.get('metodo_pago') or datos.get('metodo_pago'),
            'enviar_webhook': False,
        }))

    resultado_sheets = SheetsService.post_to_sheets('Ventas_DB',
                                                   _payload_de_venta(appt, usuario, datos)) or {}
    return {'id': appt.id, 'liquidacion': liquidacion, **resultado_sheets}


# --- Reprogramar ------------------------------------------------------------------------------

def reprogramar(appt, datos, usuario):
    """Mueve la llamada. `segunda_llamada` crea una agenda nueva marcada como 2ª call."""
    fecha = _texto(datos, 'fecha', obligatorio=True)
    status = '2da call' if datos.get('segunda_llamada') else 'Reagendado'
    _process_agenda(appt, usuario, {'status': status, 'reschedule_date': fecha,
                                    'note': datos.get('motivo')})
    db.session.commit()
    return {'id': appt.id, 'status': status, 'fecha': fecha}


# --- Descartar --------------------------------------------------------------------------------

def descartar(appt, datos, usuario):
    """Saca el lead del embudo.

    `No Lead` es el que nunca califico y `Lead Perdido` el que si calificaba y se perdio: son dos
    cosas distintas para el embudo, asi que la decision viaja en el payload y no se adivina.
    """
    status = 'Lead Perdido' if datos.get('califico') else 'No Lead'
    motivo = _texto(datos, 'motivo', obligatorio=True)
    _process_agenda(appt, usuario, {'status': status, 'note': motivo,
                                    'fecha_seguimiento': datos.get('fecha_seguimiento')})
    db.session.commit()
    return {'id': appt.id, 'status': status, 'motivo': motivo}


# --- Reasignar el closer ----------------------------------------------------------------------

def reasignar(appt, datos, usuario):
    nuevo_id = datos.get('closer_id')
    nuevo = User.query.filter_by(id=nuevo_id, role='closer').first() if nuevo_id else None
    if not nuevo or nuevo.is_active is False:
        raise ErrorDeAccion('El closer elegido no existe o no está activo.')
    if appt.closer_id == nuevo.id:
        raise ErrorDeAccion('Este lead ya es de ese closer.')

    anterior = appt.closer.username if appt.closer else 'sin asignar'
    appt.closer_id = nuevo.id
    if appt.client_id:
        db.session.add(ClientComment(
            client_id=appt.client_id, author_id=usuario.id,
            text=f'Lead reasignado de {anterior} a {nuevo.username} (por {usuario.username}).'))
    db.session.commit()
    return {'id': appt.id, 'closer_id': nuevo.id, 'closer_name': nuevo.username}


# --- Seguimiento ------------------------------------------------------------------------------

def seguimiento(appt, datos, usuario):
    """Agenda el proximo contacto. El canal y la nota se guardan juntos en `seguimiento_sub`.

    No hay columna de canal en `Appointment`: meterlo en el texto del seguimiento es lo que ya hace
    el flujo del closer ("No show: ...", "Seguimiento de cobro"), y agregar una columna solo para
    esto obligaria a una migracion que no cambia ninguna consulta.
    """
    fecha = _texto(datos, 'fecha', obligatorio=True)
    canal = _texto(datos, 'canal')
    nota = _texto(datos, 'nota')
    sub = ' · '.join(p for p in (canal, nota) if p) or 'Seguimiento'
    aplicar_cambios(appt, {
        'fecha_seguimiento': fecha,
        'seguimiento_tipo': datos.get('tipo') or 'cerrada',
        'seguimiento_sub': sub,
        'seguimiento_realizado': False,
        'seguimiento_intento': datos.get('intento') or (appt.seguimiento_intento or 1),
    }, usuario)
    db.session.commit()
    return {'id': appt.id, 'fecha_seguimiento': appt.fecha_seguimiento, 'seguimiento_sub': sub}


# --- Plan de cuotas ---------------------------------------------------------------------------

def plan_cuotas(appt, datos, usuario):
    from app.services.installment_service import InstallmentService

    if not appt.client_id:
        raise ErrorDeAccion('Esta agenda no tiene cliente: no hay a quién armarle el plan.')
    try:
        total = float(datos.get('total') or 0)
        cobrado_hoy = float(datos.get('cobrado_hoy') or 0)
        num_cuotas = int(datos.get('num_cuotas') or 0)
    except (TypeError, ValueError):
        raise ErrorDeAccion('Total, cobrado y cantidad de cuotas tienen que ser números.') from None
    if num_cuotas < 1:
        raise ErrorDeAccion('El plan necesita al menos una cuota.')

    planes = InstallmentService.create_plan(
        appt.client_id, appt.id, total, cobrado_hoy, num_cuotas,
        fechas=datos.get('fechas') if isinstance(datos.get('fechas'), list) else None,
        montos=datos.get('montos') if isinstance(datos.get('montos'), list) else None,
        programa_code=(datos.get('programa_code') or '').strip().upper() or None)
    if planes is None:
        # Misma negativa que `POST /closer/installments`: un plan con pagos ya registrados no se
        # recrea desde cero, porque se perderia el rastro de lo cobrado.
        raise ErrorDeAccion('Este cliente ya tiene un plan de este programa con pagos registrados: '
                            'marcá la cuota que corresponde como pagada en vez de rehacer el plan.')
    return {'id': appt.id, 'cuotas': [p.to_dict() for p in planes]}


# --- Baja del cliente -------------------------------------------------------------------------

def baja(appt, datos, usuario):
    """Da de baja a un cliente que ya compro.

    No se toca `closer_result`: la llamada ocurrio y fue una venta, y reescribirla como "Lead
    Perdido" falsearia el historial de la agenda y el embudo. La baja queda como seguimiento
    cerrado mas un comentario en el hilo del cliente, que es donde el equipo la lee.
    """
    motivo = _texto(datos, 'motivo', obligatorio=True)
    aplicar_cambios(appt, {
        'seguimiento_tipo': 'cerrada',
        'seguimiento_sub': f'Baja: {motivo}',
        'seguimiento_realizado': not datos.get('fecha_seguimiento'),
        'fecha_seguimiento': datos.get('fecha_seguimiento'),
    }, usuario)
    if appt.client_id:
        db.session.add(ClientComment(
            client_id=appt.client_id, author_id=usuario.id,
            text=f'Cliente dado de baja por {usuario.username}. Motivo: {motivo}.'))
    db.session.commit()
    return {'id': appt.id, 'motivo': motivo}


# --- Nota del equipo --------------------------------------------------------------------------

def nota(appt, datos, usuario):
    """Suma una nota al hilo de la agenda y avisa a quien corresponda.

    Mismo comportamiento que `POST /closer/deck/comments/<id>`: el comentario, su entrada en la
    bitacora y la notificacion dirigida al setter del lead (o al rol entero si el lead es de
    ManyChat y no tiene setter concreto).
    """
    from app.services.booking_service import BookingService

    texto = _texto(datos, 'texto', obligatorio=True)
    comentario = Comment(author_id=usuario.id, text=texto[:500], comment_type='appointment',
                         associated_id=appt.id, parent_id=datos.get('parent_id'))
    db.session.add(comentario)
    BookingService.log_lead_event(appt.id, usuario.id, 'comment',
                                  f'{usuario.username} comentó: "{texto[:60]}"')

    destinatarios = datos.get('notificar')
    if not isinstance(destinatarios, list) or not destinatarios:
        destinatarios = [appt.setter_id] if (appt.origin != 'ManyChat' and appt.setter_id) \
            else 'role:setter'
    nombre = appt.client.full_name if appt.client else 'Sin Nombre'
    db.session.add(Notification(subject=f'💬 Lead: {nombre}',
                                content=f'"{texto}" - de {usuario.username}',
                                associated_id=appt.id, associated_type='deck_comment',
                                target_users=destinatarios))
    db.session.commit()
    return comentario.to_dict()


# --- Eliminar ---------------------------------------------------------------------------------

def eliminar(appt, usuario):
    from app.services.booking_service import BookingService

    ok, error = BookingService.eliminar_agenda(appt)
    if not ok:
        raise ErrorDeAccion(error or 'No se pudo eliminar la agenda.')
    return {'message': 'Agenda eliminada'}


def buscar_agenda(appt_id):
    return db.session.get(Appointment, appt_id)
