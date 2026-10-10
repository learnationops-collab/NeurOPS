"""La lectura unica de la ficha del lead: todo lo que el modal muestra, en una sola respuesta.

Hoy el detalle de un lead esta repartido en cuatro modales que hablan con endpoints distintos (el
mazo del closer, el libro de la direccion, el wizard de venta y el cockpit de cobro), y ninguno
muestra el recorrido completo. Este servicio arma la ficha entera una sola vez.

Regla de oro: **no se reimplementa nada**. La deuda, la proxima cuota, la etapa de cobro, el estado
de la agenda, el cruce cliente-venta y los chips de estado ya existen con sus propias reglas y su
propia historia de bugs; aca se los llama. Si esta ficha recalculara la deuda por su cuenta,
mostraria un numero distinto al de la cola de cobro del closer para el mismo cliente.

Lo unico que si se resuelve aca es el cruce de ventas de UN cliente:
`CloserFollowUpService._resolve_sales_and_clients()` carga TODAS las ventas del sistema y resuelve
el cliente de cada una con varias consultas por fila. Para una ficha de un lead eso es
desproporcionado, asi que se usa el mismo criterio (email / instagram / ultimos 8 digitos del
telefono) en una sola consulta acotada a este cliente.
"""
from datetime import datetime

from sqlalchemy import func, or_

from app import db
from app.models import Appointment, Client, FinancialSale
from app.services import ficha_lead_secciones as secciones
from app.services import ficha_vocabulario as voc
from app.services.closer_followup_service import CloserFollowUpService
from app.services.comercial_service import ASISTIO, cerro_sin_venta, chip, post_call_de, pre_call_de
from app.services.estado_lead import estado_de_agenda, resolver_estado
from app.services.lead_cobro_service import UMBRAL_DEUDA, resolver_etapa

MESES = ('ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic')

ROLES_DIRECCION = ('admin', 'director_comercial')


# --- Formato ----------------------------------------------------------------------------------

def _fecha_larga(valor):
    """'25 sep 2026'. A mano y no con `strftime('%b')`, que depende del locale del servidor."""
    if not valor:
        return None
    return f'{valor.day} {MESES[valor.month - 1]} {valor.year}'


def _momento(dt):
    if not dt:
        return {'iso': None, 'fecha': None, 'hora': None}
    return {'iso': dt.isoformat(), 'fecha': _fecha_larga(dt), 'hora': dt.strftime('%H:%M')}


def _iso(valor):
    return valor.isoformat() if valor else None


# --- Identidad del lead -----------------------------------------------------------------------

def resolver_lead(appointment_id=None, client_id=None):
    """(appt, client) del lead que se pide, o (None, None) si no existe.

    Acepta las dos claves porque el estado operativo cuelga de `Appointment` y el cobro cuelga de
    `Client`, y segun de donde se abra la ficha se tiene una o la otra. Con `client_id` se elige la
    agenda mas reciente; si el cliente ya compro y nunca tuvo ninguna, se ancla una con
    `_ensure_appointment_for_client` — el mismo comportamiento que ya tienen
    `GET /closer/leads/<id>/stage` y `GET /comercial/clientes/<id>`, del que depende que las
    escrituras de cobro tengan un id donde guardar.
    """
    if appointment_id:
        appt = db.session.get(Appointment, appointment_id)
        return (appt, appt.client) if appt else (None, None)

    if not client_id:
        return None, None
    client = db.session.get(Client, client_id)
    if not client:
        return None, None
    appt = (Appointment.query.filter_by(client_id=client.id)
            .order_by(Appointment.start_time.desc()).first())
    if not appt and CloserFollowUpService._client_has_sale(client):
        appt = CloserFollowUpService._ensure_appointment_for_client(client)
    return appt, client


def _ventas_del_cliente(client):
    """Las ventas de este cliente, con el mismo cruce por contacto que usa el resto del sistema.

    Una sola consulta: `_resolve_sales_and_clients()` da lo mismo pero cargando todas las ventas de
    la base y resolviendo el cliente de cada una con varias consultas por fila.
    """
    if not client:
        return []
    filtros = [FinancialSale.client_id == client.id]
    email = (client.email or '').strip().lower()
    if email and '@' in email:
        filtros.append(func.lower(FinancialSale.mail_cliente) == email)
    ig = (client.instagram or '').strip().lstrip('@').lower()
    if ig and ig != 'n/a':
        filtros.append(func.lower(func.replace(FinancialSale.instagram, '@', '')) == ig)
    telefono = (client.phone or '').strip()
    if len(telefono) >= 8:
        filtros.append(FinancialSale.telefono.like(f'%{telefono[-8:]}%'))

    ventas = FinancialSale.query.filter(
        or_(*filtros),
        or_(FinancialSale.estado.in_(('Completada', 'Confirmada')),
            FinancialSale.estado.is_(None), FinancialSale.estado == ''),
    ).order_by(FinancialSale.date.asc(), FinancialSale.id.asc()).all()
    return ventas


def _identidad(appt, client, programa_nombre, ingreso, baja=None):
    return {
        'client_id': client.id if client else None,
        'appointment_id': appt.id if appt else None,
        'nombre': (client.full_name or client.email or 'Sin nombre') if client else 'Sin cliente',
        'email': (client.email or None) if client else None,
        'telefono': (client.phone or None) if client else None,
        'instagram': (client.instagram or None) if client else None,
        'examen': (appt.examen or None) if appt else None,
        'programa': programa_nombre,
        'grupo': (client.grupo or None) if client else None,
        'ingreso': ingreso,
        'llamada': _momento(appt.start_time if appt else None),
        'fuente': (appt.origin or None) if appt else None,
        # Como se lee la fuente en la cabecera: la misma etiqueta que el desplegable del historial,
        # para que 'workshop_landing' no aparezca escrito como un nombre de variable.
        'fuente_label': voc.etiqueta_de_fuente(appt.origin) if appt else None,
        # El link de Fathom de ESTA llamada (ver `ficha_grabacion_service`): lo abre la cabecera y
        # lo edita la pestaña Resultado.
        'fathom_url': (appt.fathom_url or None) if appt else None,
        # El email del closer viaja porque es el `email_vendedor` con el que se declara la venta: la
        # atribucion de una venta (y por lo tanto la comision) es por email y no por FK.
        'closer': ({'id': appt.closer_id,
                    'nombre': appt.closer.username if appt.closer else None,
                    'email': appt.closer.email if appt.closer else None}
                   if appt else None),
        'setter': ({'id': appt.setter_id, 'nombre': appt.setter.username if appt.setter else None}
                   if appt and appt.setter_id else None),
        # `{fecha, fecha_legible, motivo, por}` si el cliente se dio de baja, o None. Va en la
        # identidad y no en el cobro porque la cabecera la muestra en todas las pestañas.
        'baja': baja,
    }


# --- Confirmacion -----------------------------------------------------------------------------

def _confirmacion(appt):
    if not appt:
        return {'etapa': None, 'cerrada': False, 'como_viene': None, 'dolores': [],
                'nota': None, 'recordatorio_previo': None}
    como = appt.confirmation_contact_status or 'pendiente'
    dolores = [d.strip() for d in (appt.confirmation_pain_points or '').split(',') if d.strip()]
    return {
        # `None` en la columna significa la primera etapa (ver `Appointment.confirmation_stage`).
        'etapa': appt.confirmation_stage or 'por_contactar',
        # Solo la accion explicita "Listo · 100% confirmado" escribe 'Confirmado' en `result`.
        'cerrada': (appt.result or '').strip().lower() == 'confirmado',
        'como_viene': {'clave': como, 'label': voc.etiqueta_de('como_viene', como)},
        'dolores': [{'clave': d, 'label': voc.etiqueta_de('dolores', d)} for d in dolores],
        'nota': appt.closer_notes or None,
        'recordatorio_previo': _iso(appt.pre_call_reminder_at),
    }


# --- Resultado de la llamada ------------------------------------------------------------------

def _que_compro(tipos_vendidos):
    """(con_venta, solo_sena) de un cliente, por los tipos canónicos de sus pagos vigentes.

    Venta es un pago completo o un split pay (`REAL_SALE_TIPOS`): la misma regla del close rate y
    de la tabla Agendas del dashboard comercial. Una seña es una reserva — si es lo único que pagó,
    la ficha no puede decir «Venta cerrada» donde el dashboard dice «Seña».
    """
    from app.services.closer_service import REAL_SALE_TIPOS

    con_venta = any(t in REAL_SALE_TIPOS for t in tipos_vendidos)
    return con_venta, (not con_venta and 'seña' in tipos_vendidos)


def _hitos(confirmada, post, venta, deuda, tipos_vendidos, baja=None, no_cerro=False):
    """Los 5 hitos del stepper de la pestana Resultado, con su subtitulo en vivo.

    `estado` es el vocabulario de `StepperFicha`: 'hecho' (verde), 'alerta' (ambar: se alcanzo pero
    salio mal), 'actual' y 'pendiente'. Un hito malo no es un hito pendiente: el closer tiene que
    ver de un golpe que la llamada ocurrio y salio mal.

    `no_cerro` es `cerro_sin_venta`: la llamada termino sin venta, sin sena y sin un seguimiento
    abierto. El post call de esa llamada dice "Seguimiento" como el de cualquier otra que no cerro,
    pero su cierre es "No cerro" y no "Pendiente": no hay nada programado que lo vaya a resolver.
    """
    clave_post = post['key']
    asistio = clave_post in ASISTIO
    reportado = clave_post != 'pendiente'
    # `venta` es el último pago, de cualquier tipo: dice si hay un cliente con deuda que mirar. Si
    # la llamada CERRÓ lo dicen los tipos de pago: una seña sola no es una venta.
    es_cliente = bool(venta)
    con_venta, solo_sena = _que_compro(tipos_vendidos)

    hitos = [{'clave': 'confirmado', 'label': 'Confirmado',
              'sub': 'Agenda confirmada' if confirmada else 'Sin confirmar',
              'estado': 'hecho' if confirmada else 'pendiente'}]

    if not reportado:
        sub, estado = 'Sin reportar', 'actual'
    elif asistio:
        sub, estado = post['label'], 'hecho'
    else:
        sub, estado = post['label'], 'alerta'
    hitos.append({'clave': 'resultado', 'label': 'Resultado', 'sub': sub, 'estado': estado})

    if con_venta:
        cierre = ('Venta cerrada', 'hecho')
    elif solo_sena:
        # Hubo compromiso, pero el cierre es completar el pago: es el paso en curso, no uno hecho.
        cierre = ('Seña · falta completar', 'actual')
    elif not asistio:
        cierre = ('Pendiente', 'pendiente')
    elif no_cerro:
        cierre = ('No cerró', 'alerta')
    else:
        cierre = ('Pendiente', 'actual')
    hitos.append({'clave': 'cierre', 'label': 'Cierre', 'sub': cierre[0], 'estado': cierre[1]})

    if not es_cliente:
        deuda_hito = ('Pendiente', 'pendiente')
    elif baja:
        # No debe nada, pero no es «Sin deuda» en verde: no terminó de pagar, se fue.
        deuda_hito = ('Dado de baja', 'alerta')
    elif deuda > UMBRAL_DEUDA:
        deuda_hito = ('Con deuda', 'alerta')
    elif solo_sena:
        # Con una seña y sin deuda cargada (nadie puso el total) no está saldado: falta el resto.
        deuda_hito = ('Falta completar', 'pendiente')
    else:
        deuda_hito = ('Sin deuda', 'hecho')
    hitos.append({'clave': 'deuda', 'label': 'Deuda', 'sub': deuda_hito[0], 'estado': deuda_hito[1]})

    if 'renovacion' in tipos_vendidos and 'upsell' in tipos_vendidos:
        upsell = ('Renovación y upsell', 'hecho')
    elif 'renovacion' in tipos_vendidos:
        upsell = ('Renovación', 'hecho')
    elif 'upsell' in tipos_vendidos:
        upsell = ('Upsell', 'hecho')
    elif con_venta:
        upsell = ('Ninguno', 'pendiente')
    else:
        upsell = ('Renovación o upsell', 'pendiente')
    hitos.append({'clave': 'upsell', 'label': 'Upsell', 'sub': upsell[0], 'estado': upsell[1]})
    return hitos


def _resultado(appt, ventas, estado_libro, confirmada, deuda, tipos_vendidos, con_seguimiento,
               baja=None):
    if not appt:
        vacio = chip('post_call', 'pendiente')
        return {'pre_call': chip('pre_call', 'sin_confirmar'), 'post_call': vacio,
                'con_decisor': None, 'oferta_presentada': None, 'reportada': False,
                'venta': None, 'hitos': _hitos(False, vacio, None, deuda, tipos_vendidos, baja),
                'seguimiento_activo': False, 'seguimiento_intento': 1, 'seguimiento_tipo': None}

    con_venta, _ = _que_compro(tipos_vendidos)
    con_sena = 'seña' in tipos_vendidos
    post = chip('post_call', post_call_de(estado_libro, con_venta, con_sena=con_sena))
    no_cerro = cerro_sin_venta(estado_libro, con_venta, con_seguimiento, con_sena=con_sena)
    ultima = ventas[-1] if ventas else None
    venta = None
    if ultima:
        from app.services.comercial_service import ComercialService
        programa, _, _ = ComercialService.clasificar_venta(ultima)
        venta = {'id': ultima.id, 'programa': programa, 'tipo_pago': ultima.tipo_pago,
                 'monto': float(ultima.monto or 0.0), 'metodo': ultima.metodo_pago,
                 'fecha': _iso(ultima.date), 'estado': ultima.estado}
    return {
        'pre_call': chip('pre_call', pre_call_de(appt)),
        'post_call': post,
        'con_decisor': appt.with_decision_maker,
        'oferta_presentada': appt.offer_presented,
        'reportada': bool(appt.closer_processed),
        'venta': venta,
        'hitos': _hitos(confirmada, post, venta, deuda, tipos_vendidos, baja, no_cerro=no_cerro),
        # El lead puede entrar a la pestana Resultado por dos caminos distintos: una llamada sin
        # reportar (se elige entre las 4 tarjetas) o la cadencia de seguimiento, que ya tiene un
        # resultado y lo que pide es el proximo contacto. Sin esto la pestana no sabe cual es y
        # entra siempre por las tarjetas.
        'seguimiento_activo': con_seguimiento,
        'seguimiento_intento': appt.seguimiento_intento or 1,
        'seguimiento_tipo': appt.seguimiento_tipo or None,
    }


# --- Cobro ------------------------------------------------------------------------------------

def _cobro(client, ventas, deuda, programa_code, programa_nombre, enrollment_dt, baja=None):
    from app.models import InstallmentPlan
    from app.services.sales_consistency_service import SalesConsistencyService
    from app.services.sheets_service import SheetsService
    from app.services.transferencias_service import es_transferencia

    client_id = client.id if client else None
    proxima = CloserFollowUpService._proxima_cuota(client_id, deuda)
    cuotas = []
    if client_id:
        cuotas = [c.to_dict() for c in InstallmentPlan.query.filter_by(client_id=client_id)
                  .order_by(InstallmentPlan.fecha_vencimiento.asc()).all()]

    pagos = []
    for v in ventas:
        programa, tipo = SheetsService.parse_tipo_pago(v.tipo_pago)
        # El id es la venta: con el se corrige o se borra ESE pago desde el historial. El
        # `tipo_pago` crudo y el programa son con lo que arranca su editor; `tipo` sigue siendo la
        # palabra canonica ('cuota', 'seña'...) y `None` cuando el texto no dice ninguna. En un pago
        # por transferencia, `transferido_a` es a quién del equipo se le hizo (None = sin marcar).
        pagos.append({'id': v.id, 'fecha': _iso(v.date or v.created_at), 'medio': v.metodo_pago,
                      'monto': float(v.monto or 0.0), 'tipo': tipo,
                      'tipo_pago': v.tipo_pago or None, 'programa_code': programa,
                      'es_transferencia': es_transferencia(v.metodo_pago),
                      'transferido_a': v.transferido_a})
    pagado = round(sum(p['monto'] for p in pagos), 2)
    fechas = [p['fecha'] for p in pagos if p['fecha']]

    # El total que ESTE cliente negocio (`Client.total_amount`), que es el que manda sobre el
    # precio de lista en `_client_debt`: el de lista es igual para todos y no refleja descuentos
    # ni planes a medida. Viaja crudo —`None` cuando nadie lo cargo— y aparte, el numero que
    # daria deducirlo de lo cobrado mas lo que se debe. La ficha propone ese segundo al editarlo,
    # pero no lo hace pasar por un dato declarado: deducido y declarado no son lo mismo.
    total = float(client.total_amount) if client and client.total_amount is not None else None

    return {
        'deuda': deuda,
        'pagado': pagado,
        'total': total,
        'total_sugerido': round(pagado + deuda, 2),
        'ultimo_pago': max(fechas) if fechas else None,
        'programa_code': programa_code,
        'programa_nombre': programa_nombre,
        'proxima_cuota': proxima,
        'etapa': resolver_etapa(deuda, proxima, enrollment_dt, baja=baja),
        # El cronograma se muestra entero aunque el cliente esté de baja: quedó como estaba por
        # si la baja se revierte. Lo que dice que no se cobra es la etapa y la marca de la baja.
        'cuotas': cuotas,
        'pagos': pagos,
        'estado_pagos': (SalesConsistencyService.get_client_payment_state(client_id, programa_code)
                         if client_id else None),
    }



# --- Permisos ---------------------------------------------------------------------------------

def permisos_de(usuario, appt=None):
    """Que puede HACER este rol en esta ficha. Las rutas no se esconden: se comprueban.

    El frontend obedece este bloque para deshabilitar botones, y cada ruta de escritura lo vuelve a
    comprobar — esconder un boton no protege nada.

    Un `setter` solo confirma la agenda que el genero: es el mismo criterio que `_puede_corregir`
    del dashboard comercial, donde un setter corrige el pre call de sus propias filas y de ninguna
    otra.

    Borrar una agenda lo puede la direccion y CUALQUIER closer, sea o no el de la agenda. Antes el
    closer solo borraba la suya; el pedido del usuario (29/09/2026), al pedir borrar agendas desde
    el historial, fue que "eso tambien debe poder hacerlo cualquiera": el que limpia una agenda
    duplicada o cargada por error suele ser el closer que esta trabajando el lead, no el que la
    tenia asignada. Setter y triage no borran. Lo que protege de un borrado con consecuencias no
    es el permiso sino el borrado mismo: el plan de cuotas no se va con la agenda (ver
    `BookingService.eliminar_agenda`) y la ficha pide confirmacion en un modal.

    Corregir los datos del cliente (`editar_datos`) lo puede la direccion y CUALQUIER closer, sea
    o no el de la agenda, como reportar o cobrar. Es una decision explicita del usuario (bitacora,
    5 de agosto de 2026: "cualquier closer puede editar cualquier lead", bloquear por dueno solo
    generaba friccion) y lo que ya permitia el lapiz del mazo por `PATCH /closer/customers/<id>`:
    un closer que cubre a un companero, que trabaja un lead de la busqueda global o un huerfano del
    pool de cobro (anclado a 'otro' o a un closer inactivo) tiene que poder arreglarle el telefono.
    Un setter o triage no: confirman la agenda, los datos no son suyos.
    """
    rol = getattr(usuario, 'role', None)
    direccion = rol in ROLES_DIRECCION
    uid = getattr(usuario, 'id', None)
    setter_dueno = rol == 'setter' and appt is not None and appt.setter_id == uid
    return {
        'confirmar': direccion or rol in ('closer', 'triage') or setter_dueno,
        'reportar': direccion or rol == 'closer',
        'cobrar': direccion or rol == 'closer',
        'eliminar': direccion or rol == 'closer',
        'editar_datos': direccion or rol == 'closer',
        'reasignar': direccion or rol == 'closer',
        'comentar': True,
    }


# --- La ficha completa ------------------------------------------------------------------------

def ficha(appointment_id=None, client_id=None, usuario=None, ahora=None):
    """El JSON completo de la ficha, o None si el lead no existe.

    Todo campo que pueda faltar viaja en `null` o en lista vacia, nunca ausente: el frontend no
    tiene que preguntar si la clave existe.
    """
    appt, client = resolver_lead(appointment_id, client_id)
    if not appt and not client:
        return None

    ahora = ahora or datetime.utcnow()
    client_id = client.id if client else None
    ventas = _ventas_del_cliente(client)
    deuda = CloserFollowUpService._client_debt(client_id)
    enrollment_dt = CloserFollowUpService._client_enrollment_date(client_id)
    programa_code = CloserFollowUpService._client_program_code(client_id)
    from app.services.closer_followup_service import PROGRAM_CODE_NAMES
    programa_nombre = PROGRAM_CODE_NAMES.get(programa_code)

    appts = (Appointment.query.filter_by(client_id=client_id)
             .order_by(Appointment.start_time.desc()).all() if client_id else ([appt] if appt else []))
    estado_libro = estado_de_agenda(appt, ahora)
    confirmacion = _confirmacion(appt)
    con_seguimiento = bool(appt and (appt.seguimiento_tipo or appt.fecha_seguimiento)
                           and not appt.seguimiento_realizado)

    from app.services.sheets_service import SheetsService
    tipos_vendidos = {SheetsService.parse_tipo_pago(v.tipo_pago)[1] for v in ventas}

    from app.services import baja_service
    baja = baja_service.descriptor(client)

    estado = resolver_estado(estado_agenda=estado_libro,
                             etapa_confirmacion=appt.confirmation_stage if appt else None,
                             tiene_venta=bool(ventas), deuda=deuda, baja=bool(baja),
                             solo_sena=_que_compro(tipos_vendidos)[1])

    return {
        'identidad': _identidad(appt, client, programa_nombre, _iso(enrollment_dt), baja),
        'estado': estado,
        'confirmacion': confirmacion,
        'resultado': _resultado(appt, ventas, estado_libro, confirmacion['cerrada'], deuda,
                                tipos_vendidos, con_seguimiento, baja),
        'cobro': _cobro(client, ventas, deuda, programa_code, programa_nombre, enrollment_dt,
                        baja),
        'historial': secciones.historial(appts, ahora, tiene_venta=bool(ventas),
                                         cerro=_que_compro(tipos_vendidos)[0]
                                         or 'seña' in tipos_vendidos),
        'formulario': secciones.formulario(client),
        'comunicacion': {'notas': secciones.notas(client, appt), 'equipo': secciones.equipo()},
        'permisos': permisos_de(usuario, appt),
        'vocabulario': voc.vocabulario(),
    }
