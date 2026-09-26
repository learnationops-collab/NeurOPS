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
from app.services.comercial_service import chip, post_call_de, pre_call_de
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


def _identidad(appt, client, programa_nombre, ingreso):
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
        # El email del closer viaja porque es el `email_vendedor` con el que se declara la venta: la
        # atribucion de una venta (y por lo tanto la comision) es por email y no por FK.
        'closer': ({'id': appt.closer_id,
                    'nombre': appt.closer.username if appt.closer else None,
                    'email': appt.closer.email if appt.closer else None}
                   if appt else None),
        'setter': ({'id': appt.setter_id, 'nombre': appt.setter.username if appt.setter else None}
                   if appt and appt.setter_id else None),
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

def _hitos(confirmada, post, venta, deuda, tipos_vendidos):
    """Los 5 hitos del stepper de la pestana Resultado, con su subtitulo en vivo.

    `estado` es el vocabulario de `StepperFicha`: 'hecho' (verde), 'alerta' (ambar: se alcanzo pero
    salio mal), 'actual' y 'pendiente'. Un hito malo no es un hito pendiente: el closer tiene que
    ver de un golpe que la llamada ocurrio y salio mal.
    """
    clave_post = post['key']
    asistio = clave_post in ('asistio', 'venta', 'seguimiento', 'presento_no_cerro', 'segunda_llamada')
    reportado = clave_post != 'pendiente'
    con_venta = bool(venta)

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
    elif not asistio:
        cierre = ('Pendiente', 'pendiente')
    elif clave_post == 'presento_no_cerro':
        cierre = ('No cerró', 'alerta')
    else:
        cierre = ('Pendiente', 'actual')
    hitos.append({'clave': 'cierre', 'label': 'Cierre', 'sub': cierre[0], 'estado': cierre[1]})

    if not con_venta:
        deuda_hito = ('Pendiente', 'pendiente')
    elif deuda > UMBRAL_DEUDA:
        deuda_hito = ('Con deuda', 'alerta')
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


def _resultado(appt, ventas, estado_libro, confirmada, deuda, tipos_vendidos, con_seguimiento):
    if not appt:
        vacio = chip('post_call', 'pendiente')
        return {'pre_call': chip('pre_call', 'sin_confirmar'), 'post_call': vacio,
                'con_decisor': None, 'oferta_presentada': None, 'reportada': False,
                'venta': None, 'hitos': _hitos(False, vacio, None, deuda, tipos_vendidos),
                'seguimiento_activo': False, 'seguimiento_intento': 1, 'seguimiento_tipo': None}

    post = chip('post_call', post_call_de(estado_libro, bool(ventas), con_seguimiento))
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
        'hitos': _hitos(confirmada, post, venta, deuda, tipos_vendidos),
        # El lead puede entrar a la pestana Resultado por dos caminos distintos: una llamada sin
        # reportar (se elige entre las 4 tarjetas) o la cadencia de seguimiento, que ya tiene un
        # resultado y lo que pide es el proximo contacto. Sin esto la pestana no sabe cual es y
        # entra siempre por las tarjetas.
        'seguimiento_activo': con_seguimiento,
        'seguimiento_intento': appt.seguimiento_intento or 1,
        'seguimiento_tipo': appt.seguimiento_tipo or None,
    }


# --- Cobro ------------------------------------------------------------------------------------

def _cobro(client, ventas, deuda, programa_code, programa_nombre, enrollment_dt):
    from app.models import InstallmentPlan
    from app.services.sales_consistency_service import SalesConsistencyService
    from app.services.sheets_service import SheetsService

    client_id = client.id if client else None
    proxima = CloserFollowUpService._proxima_cuota(client_id, deuda)
    cuotas = []
    if client_id:
        cuotas = [c.to_dict() for c in InstallmentPlan.query.filter_by(client_id=client_id)
                  .order_by(InstallmentPlan.fecha_vencimiento.asc()).all()]

    pagos = []
    for v in ventas:
        _, tipo = SheetsService.parse_tipo_pago(v.tipo_pago)
        pagos.append({'fecha': _iso(v.date or v.created_at), 'medio': v.metodo_pago,
                      'monto': float(v.monto or 0.0), 'tipo': tipo})
    pagado = round(sum(p['monto'] for p in pagos), 2)
    fechas = [p['fecha'] for p in pagos if p['fecha']]

    return {
        'deuda': deuda,
        'pagado': pagado,
        'ultimo_pago': max(fechas) if fechas else None,
        'programa_code': programa_code,
        'programa_nombre': programa_nombre,
        'proxima_cuota': proxima,
        'etapa': resolver_etapa(deuda, proxima, enrollment_dt),
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
    otra. Borrar queda solo en la direccion, por la misma razon que en `DELETE /comercial/agendas`:
    corregir un estado y borrar la fila no son la misma responsabilidad.
    """
    rol = getattr(usuario, 'role', None)
    direccion = rol in ROLES_DIRECCION
    setter_dueno = rol == 'setter' and appt is not None and appt.setter_id == getattr(usuario, 'id', None)
    return {
        'confirmar': direccion or rol in ('closer', 'triage') or setter_dueno,
        'reportar': direccion or rol == 'closer',
        'cobrar': direccion or rol == 'closer',
        'eliminar': direccion,
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

    estado = resolver_estado(estado_agenda=estado_libro,
                             etapa_confirmacion=appt.confirmation_stage if appt else None,
                             tiene_venta=bool(ventas), deuda=deuda)

    return {
        'identidad': _identidad(appt, client, programa_nombre, _iso(enrollment_dt)),
        'estado': estado,
        'confirmacion': confirmacion,
        'resultado': _resultado(appt, ventas, estado_libro, confirmacion['cerrada'], deuda,
                                tipos_vendidos, con_seguimiento),
        'cobro': _cobro(client, ventas, deuda, programa_code, programa_nombre, enrollment_dt),
        'historial': secciones.historial(appts, ahora),
        'formulario': secciones.formulario(client),
        'comunicacion': {'notas': secciones.notas(client, appt), 'equipo': secciones.equipo()},
        'permisos': permisos_de(usuario, appt),
        'vocabulario': voc.vocabulario(),
    }
