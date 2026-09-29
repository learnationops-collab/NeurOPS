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
import re
from datetime import datetime

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
    """Un pedido mal hecho del frontend: falta un dato o el valor no es admitido.

    `campo` es la clave del payload que lo causo, cuando hay una sola: el frontend pinta el error
    al lado de ese campo y no solo en el aviso general de la ficha.
    """
    codigo = 400

    def __init__(self, mensaje, campo=None):
        super().__init__(mensaje)
        self.campo = campo


class ChoqueDeContacto(ErrorDeAccion):
    """El correo, el instagram o el telefono nuevo ya son de OTRO cliente.

    409 y no 400: el pedido esta bien hecho, lo que pasa es que choca con lo que ya hay en la base.
    `choque` dice con quien, para que quien edita decida si son la misma persona.
    """
    codigo = 409

    def __init__(self, mensaje, campo, choque):
        super().__init__(mensaje, campo)
        self.choque = choque


def _iso_dt(valor):
    return valor.isoformat() if valor else None


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

# Del vocabulario de la ficha a las columnas del modelo. La escritura habla el MISMO idioma que
# la lectura (`confirmacion.etapa`, `.como_viene`, `.dolores`, `.nota`): que el GET devuelva un
# nombre y el PATCH exija otro es como se cuelan los errores que ninguna suite ve, porque cada
# lado se testea contra su propio vocabulario.
#
# La lista es cerrada a proposito: sin esto, el mismo endpoint aceptaria `result` y reportaria la
# llamada desde el paso de confirmacion, que es la confusion de superficies que esta ficha viene
# a resolver.
CAMPOS_CONFIRMACION = {
    'etapa': 'confirmation_stage',
    'como_viene': 'confirmation_contact_status',
    'dolores': 'confirmation_pain_points',
    'nota': 'closer_notes',
}

# Que grupo de vocabulario alimenta cada campo, para poder crear una opcion al vuelo.
GRUPO_DE_CAMPO = {'como_viene': 'como_viene', 'dolores': 'dolores'}


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


def _recordatorio(valor):
    """El checkbox y la fecha viajan juntos: apagarlo borra la fecha, no la deja huerfana."""
    if not isinstance(valor, dict):
        return valor or None
    return valor.get('cuando') if valor.get('activo') else None


def confirmacion(appt, datos, usuario):
    """Guarda la etapa, el «Cómo viene», los dolores, la nota y el recordatorio previo."""
    from app.services import ficha_vocabulario

    # Una opcion nueva escrita a mano en un grupo "Otros" llega junto con la seleccion: para quien
    # la escribe es un solo gesto, asi que se registra y se usa en la misma peticion.
    nueva = (datos.get('nueva_opcion') or '').strip() if isinstance(datos.get('nueva_opcion'), str) else ''

    payload = {}
    for campo, columna in CAMPOS_CONFIRMACION.items():
        if campo not in datos:
            continue
        valor = datos[campo]
        grupo = GRUPO_DE_CAMPO.get(campo)
        if nueva and grupo:
            opcion = ficha_vocabulario.agregar_opcion(grupo, nueva, usuario)
            if opcion:
                valor = ([v for v in valor if v != nueva] + [opcion['clave']]
                         if isinstance(valor, list) else opcion['clave'])
        payload[columna] = ','.join(valor) if isinstance(valor, list) else valor

    if 'recordatorio_previo' in datos:
        payload['pre_call_reminder_at'] = _recordatorio(datos['recordatorio_previo'])

    # "Listo · 100% confirmado": el unico lugar donde `Confirmado` se pone a mano.
    if datos.get('cerrada') is True:
        etapas = ficha_vocabulario.ETAPAS_CONFIRMACION
        payload['confirm_status'] = 'Confirmado'
        payload['confirmation_stage'] = etapas[-1]['clave'] if etapas else 'testimonio'

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


# --- Cancelacion ------------------------------------------------------------------------------

def cancelar(appt, datos, usuario):
    """La llamada no va a ocurrir: el lead aviso que no puede.

    No es lo mismo que descartar. Descartar saca al lead del embudo —no califica o se perdio—;
    cancelar dice que ESTA cita no se hace, y el lead puede seguir vivo. Por eso admite dejar un
    seguimiento en la misma accion, que es lo que el closer hace el 90% de las veces.

    `process_agenda` con `Cancelado` ademas borra el evento de Google Calendar: si la cita no va a
    pasar, la agenda del closer tiene que quedar libre.
    """
    motivo = _texto(datos, 'motivo', obligatorio=True)
    _process_agenda(appt, usuario, {'status': 'Cancelado', 'note': motivo,
                                    'fecha_seguimiento': datos.get('fecha_seguimiento')})
    db.session.commit()
    return {'id': appt.id, 'status': 'Cancelado', 'motivo': motivo}


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
    """Arma o corrige el cronograma de cuotas del cliente.

    Admite dos formas del pedido, y la diferencia no es cosmetica:

      · `cuotas`: el cronograma explicito que manda el editor de la ficha, fila por fila con su
        id, su monto, su fecha y su estado. Se reconcilia (`sync_plan`), asi que un plan con
        cuotas ya cobradas se puede corregir sin perder el cobro.
      · `total` + `num_cuotas`: el reparto automatico de siempre (`create_plan`), que es lo que
        manda el wizard del closer al declarar una venta. Se deja intacto.
    """
    from app.services.installment_service import InstallmentService

    if not appt.client_id:
        raise ErrorDeAccion('Esta agenda no tiene cliente: no hay a quién armarle el plan.')

    programa_code = (datos.get('programa_code') or '').strip().upper() or None

    if isinstance(datos.get('cuotas'), list):
        filas = [c for c in datos['cuotas'] if isinstance(c, dict)]
        if not filas:
            raise ErrorDeAccion('El plan necesita al menos una cuota.')
        for c in filas:
            if not c.get('fecha_vencimiento') and not c.get('fecha'):
                raise ErrorDeAccion('Cada cuota necesita su fecha de cobro.')
        planes = InstallmentService.sync_plan(appt.client_id, appt.id, programa_code, filas)
        return {'id': appt.id, 'cuotas': [p.to_dict() for p in planes]}

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
        programa_code=programa_code)
    if planes is None:
        # Misma negativa que `POST /closer/installments`: un plan con pagos ya registrados no se
        # recrea desde cero, porque se perderia el rastro de lo cobrado.
        raise ErrorDeAccion('Este cliente ya tiene un plan de este programa con pagos registrados: '
                            'marcá la cuota que corresponde como pagada en vez de rehacer el plan.')
    return {'id': appt.id, 'cuotas': [p.to_dict() for p in planes]}


# --- Total a pagar ----------------------------------------------------------------------------

def total_a_pagar(appt, datos, usuario):
    """Corrige el total que este cliente negocio (`Client.total_amount`).

    Es el numero del que sale la deuda: `CloserFollowUpService._client_debt` lo prefiere al precio
    de lista del programa porque el de lista es igual para todos. Tenerlo mal cargado hacia que la
    ficha, la cola de cobro y la cartera mostraran una deuda que el closer sabia que no era —el
    caso que dejo escrito ese servicio: "dice que debe 400, pero en total debe 900"—, y hasta ahora
    solo se podia corregir desde el historial del mazo, no desde donde se mira la deuda.

    Misma escritura que `PATCH /closer/clients/<id>/total-amount`; lo que faltaba era la puerta.
    """
    from app.services.booking_service import BookingService

    if not appt.client:
        raise ErrorDeAccion('Esta agenda no tiene cliente: no hay a quién ponerle un total.')
    if datos.get('total') in (None, ''):
        raise ErrorDeAccion('Falta el total a pagar.')
    try:
        nuevo = round(float(datos['total']), 2)
    except (TypeError, ValueError):
        raise ErrorDeAccion('El total a pagar tiene que ser un número.') from None
    if nuevo < 0:
        raise ErrorDeAccion('El total a pagar no puede ser negativo.')

    anterior = appt.client.total_amount
    appt.client.total_amount = nuevo
    db.session.commit()

    # Un registro financiero no se cambia en silencio: queda quien lo toco y desde que valor.
    BookingService.log_lead_event(
        appt.id, usuario.id, 'total_amount_edited',
        f'{usuario.username} corrigió el total a pagar: {anterior!r} → {nuevo!r}')

    from app.services.closer_followup_service import CloserFollowUpService
    return {'id': appt.id, 'total': nuevo,
            'deuda': CloserFollowUpService._client_debt(appt.client_id)}


# --- Datos del cliente ------------------------------------------------------------------------
#
# Nombre, telefono, correo e instagram son del CLIENTE (los comparten todas sus agendas); el
# examen es de la AGENDA —el examen al que se presenta, texto libre que escribe el formulario de
# origen o el setter— y se corrige en la que la ficha tiene abierta, que es la que muestra la
# cabecera. No hay vocabulario de examenes: en la base local hay 'enarm', 'ENARM', 'enarm peru',
# 'Step 1', 'colombia'... y cerrarlo a una lista dejaria sin poder guardar la mitad de lo que ya hay.
#
# La normalizacion es la de `CloserService.update_client` (ver `closer_service.normalizar_*`), para
# que el mazo y la ficha guarden lo mismo. Lo que esta puerta agrega:
#   · un correo sin arroba se RECHAZA; `update_client` lo vacia en silencio;
#   · un correo, un instagram o un telefono que ya son de OTRO cliente se rechazan con el nombre de
#     ese cliente. `BookingService.create_or_update_client` cruza por esos tres datos (correo ->
#     instagram -> ultimos 8 digitos del telefono) y FUSIONA lo que encuentra: guardarlo callado
#     dejaria a los dos clientes pegados en la proxima agenda que entre, sin que nadie lo decidiera;
#   · las ventas que hoy son del cliente solo porque coinciden por contacto (el 79% no tiene
#     `client_id`) y que el cambio le haria perder se atan por id ANTES del cambio: si no,
#     corregirle el correo a quien ya compro le haria perder sus ventas, su programa y su deuda en
#     la ficha y en la cola de cobro. Solo las que son suyas con el criterio estricto de los pagos
#     (ver `_atar_ventas_que_se_perderian`): la de otra persona que coincidia por el dato mal
#     cargado se suelta, que es lo que se buscaba al corregirlo;
#   · una linea en la bitacora del lead con lo que cambio, antes -> despues.
#
# Lo que NO se toca, y queda con el dato viejo: las ventas en Google Sheets, el `Lead` del pipeline
# (que se cruza por correo e instagram al crear la proxima agenda) y la cuenta de la Academia, que
# se busca por el id guardado (`learnation_user_id`) y conserva el correo con el que se creo.

# clave de la lectura (`identidad.*`) -> (columna del cliente, como se nombra, largo de la columna).
# El largo se comprueba aca porque Postgres rechaza el UPDATE de un valor mas largo y SQLite —los
# tests, la base local— lo guarda callado. Los cinco nombres son masculinos: los mensajes les
# anteponen "el".
CAMPOS_DEL_CLIENTE = {
    'nombre': ('full_name', 'nombre', 120),
    'telefono': ('phone', 'teléfono', 20),
    'email': ('email', 'correo', 120),
    'instagram': ('instagram', 'instagram', 64),
}
EXAMEN = ('examen', 255)

# Algo@algo.algo, sin espacios. No valida un correo de verdad —nadie puede sin mandarle uno—, pero
# frena el 'ana@gmail' y el 'ana @gmail.com' que se cuelan al tipear rapido.
_FORMA_DE_CORREO = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')


def _valor_nuevo(campo, crudo):
    """Lo que se guardaria en `campo` para lo que se escribio, o `ErrorDeAccion` con el motivo."""
    from app.services.closer_service import (
        SIN_DATO, normalizar_email, normalizar_instagram, normalizar_telefono,
    )

    rotulo, largo = CAMPOS_DEL_CLIENTE[campo][1:] if campo in CAMPOS_DEL_CLIENTE else EXAMEN
    if crudo is not None and not isinstance(crudo, str):
        raise ErrorDeAccion(f'El {rotulo} tiene que ser texto.', campo)
    texto = (crudo or '').strip()

    if campo == 'nombre':
        if not texto:
            raise ErrorDeAccion('El nombre no puede quedar vacío.', campo)
        valor = texto
    elif campo == 'email':
        valor = normalizar_email(texto)
        # Vacio o "n/a" es borrar el correo, que se puede. Lo que no se puede es escribir uno que
        # no es un correo y que se guarde vacio creyendo que se guardo.
        if texto.lower() not in SIN_DATO and not (valor and _FORMA_DE_CORREO.match(valor)):
            raise ErrorDeAccion(f'«{texto}» no es un correo válido.', campo)
    elif campo == 'telefono':
        valor = normalizar_telefono(texto)
        if valor and not any(c.isdigit() for c in valor):
            raise ErrorDeAccion(f'«{texto}» no es un teléfono: no tiene ningún número.', campo)
    elif campo == 'instagram':
        valor = normalizar_instagram(texto)
    else:
        valor = texto or None

    if valor and len(valor) > largo:
        raise ErrorDeAccion(f'El {rotulo} es demasiado largo: el máximo es {largo} caracteres.',
                            campo)
    return valor


def _otro_cliente_con(cliente, campo, valor):
    """El OTRO cliente al que ya pertenece ese contacto, o None.

    El mismo cruce que `create_or_update_client` y `comercial_service.clientes_de_ventas`: correo
    e instagram sin mayusculas (y el instagram sin la '@'), y el telefono por sus ultimos 8
    DIGITOS, sin mirar como esta escrito —'+591 7123-4567' y '59171234567' son el mismo—. Ante dos
    candidatos gana el mas viejo, que es el que esas funciones encuentran primero.
    """
    from sqlalchemy import func

    from app.models import Client
    from app.services.comercial_service import _ultimos8

    otros = Client.query.filter(Client.id != cliente.id).order_by(Client.id)
    if campo == 'email':
        return otros.filter(func.lower(Client.email) == valor.lower()).first()
    if campo == 'instagram':
        ig = valor.lstrip('@').lower()
        return otros.filter(func.lower(func.replace(Client.instagram, '@', '')) == ig).first()
    ultimos = _ultimos8(valor)
    if not ultimos:
        return None
    # En memoria y no con un LIKE: el LIKE sobre el texto crudo no ve el mismo numero escrito con
    # otros espacios. Son unas miles de filas de tres columnas, una vez por edicion.
    return next((c for c in otros.filter(Client.phone.isnot(None)).all()
                 if _ultimos8(c.phone) == ultimos), None)


def _contacto(cliente, **cambios):
    """El cliente como lo miran las señales de `SalesConsistencyService`, con `cambios` (columna ->
    valor nuevo) aplicados encima. No toca la fila: es para preguntar "¿y despues del cambio?"."""
    from types import SimpleNamespace

    datos = {'full_name': cliente.full_name, 'email': cliente.email,
             'instagram': cliente.instagram, 'phone': cliente.phone}
    datos.update(cambios)
    return SimpleNamespace(**datos)


def _atar_ventas_que_se_perderian(cliente, nuevos):
    """Ata por id las ventas sueltas de este cliente que el cambio de contacto le haria perder.

    Atar es para siempre: una venta con `client_id` cuenta como del cliente por si sola en todas
    partes (`get_client_payment_state` no le vuelve a mirar el contacto) y `clientes_de_ventas` ya
    no se la da a nadie mas. Por eso se ata SOLO la que cumple las tres:

      · es de este cliente y no de otro, con `clientes_de_ventas`: una que coincide con este por
        telefono pero con otro por correo es del otro, y atarla aca se la robaria;
      · es suya con el criterio estricto de `SalesConsistencyService._contact_match_suffices` (2
        señales, o 1 corroborada por el nombre). Con una sola señal y otro nombre NO se ata: es
        justo el caso de corregir un telefono mal cargado —la venta de otra persona que coincidia
        por ese telefono tiene que dejar de ser de este cliente, no quedarle pegada—. En la base
        local son la mayoria de las coincidencias por correo solo (479 de 681 sueltas resueltas:
        la venta a nombre de una persona y el cliente a nombre de otra) y dos por telefono o
        instagram; el caso Kervin Calderon fue un correo compartido;
      · el cambio le quita una señal con la que hoy coincide. La que sigue coincidiendo igual
        despues (se corrigio el telefono y cruzaba por correo e instagram) no necesita atarse.

    `nuevos` es {columna del cliente -> valor nuevo} de los contactos que cambian.
    """
    from app.services.comercial_service import clientes_de_ventas
    from app.services.ficha_lead_service import _ventas_del_cliente
    from app.services.sales_consistency_service import SalesConsistencyService

    sueltas = [v for v in _ventas_del_cliente(cliente) if not v.client_id]
    if not sueltas:
        return 0
    duenos = clientes_de_ventas(sueltas)
    antes, despues = _contacto(cliente), _contacto(cliente, **nuevos)
    atadas = 0
    for venta in sueltas:
        if duenos.get(venta.id) != cliente.id:
            continue
        if not SalesConsistencyService._contact_match_suffices(antes, venta):
            continue
        pierde = (SalesConsistencyService._matching_signals(antes, venta)
                  - SalesConsistencyService._matching_signals(despues, venta))
        if pierde:
            venta.client_id = cliente.id
            atadas += 1
    return atadas


def _para_la_bitacora(valor):
    return repr(valor) if valor else 'vacío'


def editar_datos(appt, datos, usuario):
    """Corrige los datos de contacto del cliente de esta agenda, y el examen de la agenda.

    Llegan solo los campos que se tocaron; los que llegan pero quedan igual despues de normalizar
    (un '@ana' sobre un 'ana') no cuentan como cambio. Se valida TODO antes de escribir nada: un
    choque en el telefono no puede dejar el nombre guardado a medias.
    """
    from sqlalchemy.exc import IntegrityError

    from app.services.booking_service import BookingService

    pedidos = [c for c in (*CAMPOS_DEL_CLIENTE, 'examen') if c in datos]
    if not pedidos:
        raise ErrorDeAccion('No hay nada que guardar.')

    cliente = appt.client
    cambios = {}
    for campo in pedidos:
        nuevo = _valor_nuevo(campo, datos[campo])
        if campo == 'examen':
            antes = appt.examen
        elif cliente is None:
            raise ErrorDeAccion('Esta agenda no tiene cliente: no hay a quién corregirle los datos '
                                'de contacto.', campo)
        else:
            antes = getattr(cliente, CAMPOS_DEL_CLIENTE[campo][0])
        if (antes or None) != nuevo:
            cambios[campo] = (antes, nuevo)

    if not cambios:
        return {'id': appt.id, 'cambios': {}, 'ventas_atadas': 0}

    # En el orden del cruce de `create_or_update_client`: si chocan dos, se nombra el que ese cruce
    # usaria primero para fusionar.
    for campo in ('email', 'instagram', 'telefono'):
        nuevo = cambios.get(campo, (None, None))[1]
        otro = _otro_cliente_con(cliente, campo, nuevo) if nuevo else None
        if otro:
            nombre = otro.full_name or otro.email or f'cliente #{otro.id}'
            raise ChoqueDeContacto(
                f'El {CAMPOS_DEL_CLIENTE[campo][1]} «{nuevo}» ya es de otro cliente: {nombre} '
                f'(#{otro.id}). '
                'No se fusionan solos: si son la misma persona hay que unir los dos clientes; si '
                'no, revisá el dato.', campo, {'id': otro.id, 'nombre': nombre})

    contactos = {CAMPOS_DEL_CLIENTE[c][0]: nuevo for c, (_, nuevo) in cambios.items()
                 if c in ('email', 'instagram', 'telefono')}
    atadas = _atar_ventas_que_se_perderian(cliente, contactos) if contactos else 0

    for campo, (_, nuevo) in cambios.items():
        if campo == 'examen':
            appt.examen = nuevo
        else:
            setattr(cliente, CAMPOS_DEL_CLIENTE[campo][0], nuevo)
    try:
        db.session.commit()
    except IntegrityError:
        # `Client.email` es `unique`: solo pasa si otro guardo ese correo entre la comprobacion de
        # arriba y este commit.
        db.session.rollback()
        raise ErrorDeAccion('Ese correo se lo acaban de poner a otro cliente. Volvé a abrir la '
                            'ficha para ver con quién choca.', 'email') from None

    rotulos = {**{c: v[1] for c, v in CAMPOS_DEL_CLIENTE.items()}, 'examen': EXAMEN[0]}
    detalle = '; '.join(f'{rotulos[c]}: {_para_la_bitacora(a)} → {_para_la_bitacora(n)}'
                        for c, (a, n) in cambios.items())
    extra = (f' {atadas} venta(s) quedaron atadas al cliente por id, para no perderlas con el '
             'cambio de contacto.' if atadas else '')
    BookingService.log_lead_event(appt.id, usuario.id, 'datos_editados',
                                  f'{usuario.username} corrigió los datos del lead: {detalle}.{extra}')

    return {'id': appt.id, 'cambios': {c: n for c, (_, n) in cambios.items()},
            'ventas_atadas': atadas}


# --- Registro de eventos ----------------------------------------------------------------------
#
# Decision explicita del usuario (29/09/2026), tomada sabiendo lo que cuesta: el registro DEJA de
# ser una auditoria. Una descripcion se puede reescribir y una fila se puede borrar, incluidas las
# que dejan las correcciones de la propia ficha —el total a pagar, el programa, el estado de una
# agenda—, asi que el rastro de un cambio se puede hacer desaparecer desde la misma pantalla que
# lo produjo. Queda escrito aca porque es lo que alguien se va a preguntar dentro de seis meses,
# cuando un evento no cuadre con lo que dice la base.
#
# Lo que si se comprueba: que el evento sea de ESTE lead. Sin eso, el id de la URL alcanzaria para
# borrar el registro de cualquier otro.


def _evento_del_lead(appt, evento_id):
    """El evento pedido, si pertenece a alguna agenda de este cliente. `ErrorDeAccion` si no."""
    from app.models import LeadEventLog

    evento = db.session.get(LeadEventLog, evento_id)
    if not evento:
        raise ErrorDeAccion('Ese evento no existe.')

    if appt.client_id:
        propias = {a.id for a in Appointment.query.filter_by(client_id=appt.client_id).all()}
    else:
        propias = {appt.id}
    if evento.appointment_id not in propias:
        raise ErrorDeAccion('Ese evento no es de este lead.')
    return evento


def editar_evento(appt, datos, usuario):
    """Reescribe el texto de un evento del registro."""
    texto = _texto(datos, 'detalle', obligatorio=True)
    evento = _evento_del_lead(appt, datos.get('evento_id'))
    evento.description = texto
    db.session.commit()
    return {'id': evento.id, 'detalle': evento.description}


def borrar_evento(appt, datos, usuario):
    """Saca una fila del registro. No se puede deshacer: la fila se borra, no se marca."""
    evento = _evento_del_lead(appt, datos.get('evento_id'))
    borrado = evento.id
    db.session.delete(evento)
    db.session.commit()
    return {'id': borrado, 'borrado': True}


# --- Estado de una agenda ---------------------------------------------------------------------

def estado_agenda(appt, datos, usuario):
    """Corrige el pre call o el post call de UNA agenda.

    Es la misma escritura que `PATCH /comercial/agendas/<id>` —los mismos dos mapas, la misma
    marca de reportada y la misma entrada en la bitacora—, con la diferencia de que se llega por
    la ficha. Existe porque el historial lista TODAS las agendas del cliente y desde ahi hay que
    poder corregir cualquiera, no solo la que la ficha tiene abierta: la ruta ya recibe el id de
    la agenda y `permisos_de` la comprueba contra esa, asi que corregir la de hace tres meses pasa
    por el mismo permiso que corregir la de hoy.
    """
    from app.services.booking_service import BookingService
    from app.services.comercial_service import POST_CALL_A_CLOSER_RESULT, PRE_CALL_A_RESULT

    campo, valor = datos.get('campo'), datos.get('valor')
    if campo == 'pre_call' and valor in PRE_CALL_A_RESULT:
        anterior, columna, nuevo = appt.result, 'result', PRE_CALL_A_RESULT[valor]
        appt.result = nuevo
    elif campo == 'post_call' and valor in POST_CALL_A_CLOSER_RESULT:
        anterior, columna, nuevo = appt.closer_result, 'closer_result', POST_CALL_A_CLOSER_RESULT[valor]
        appt.closer_result = nuevo
        # Darle un resultado a la llamada es reportarla: sin esto la agenda seguiria apareciendo
        # en el mazo del closer como pendiente de reportar.
        appt.closer_processed = valor != 'pendiente'
    else:
        raise ErrorDeAccion('Ese campo o ese valor no se pueden corregir.')

    db.session.commit()
    BookingService.log_lead_event(
        appt.id, usuario.id, 'status_changed',
        f'{usuario.username} corrigió {columna} desde el historial de la ficha: '
        f'{anterior!r} -> {nuevo!r}.')
    return {'id': appt.id, 'campo': campo, 'valor': valor, 'anterior': anterior}


# --- Agenda nueva -----------------------------------------------------------------------------

def crear_agenda(appt, datos, usuario):
    """Agenda otra llamada con el MISMO cliente, desde el historial.

    Pasa por `BookingService.create_appointment` y no por un `Appointment(...)` propio porque esa
    funcion hace ademas todo lo que una agenda implica y que no se ve: la notificacion al closer,
    el espejo al `Lead` del pipeline y su cambio de etapa. Crear la fila a mano dejaria una agenda
    que no existe para ninguna de las otras pantallas.

    El closer por defecto es el de la agenda desde la que se abre la ficha, no quien aprieta el
    boton: la direccion comercial agenda PARA el closer del lead, no para si misma.
    """
    from app.services.booking_service import BookingService

    if not appt.client_id:
        raise ErrorDeAccion('Esta agenda no tiene cliente: no hay a quién agendarle.')

    cuando = _texto(datos, 'fecha', obligatorio=True)
    try:
        inicio = datetime.fromisoformat(cuando.replace('Z', ''))
    except ValueError:
        raise ErrorDeAccion('La fecha tiene que ser "AAAA-MM-DDTHH:MM".') from None

    closer_id = datos.get('closer_id') or appt.closer_id
    if not closer_id:
        raise ErrorDeAccion('Falta el closer al que se le agenda la llamada.')

    nueva = BookingService.create_appointment(
        appt.client_id, closer_id, inicio,
        origin=(datos.get('fuente') or appt.origin or 'ficha'),
        setter_id=appt.setter_id)
    if not nueva:
        # `create_appointment` devuelve None cuando ese closer ya tiene una cita sin resolver a
        # esa misma hora. Es una guarda, no un fallo: se dice cual es.
        raise ErrorDeAccion('Ese closer ya tiene una llamada sin resolver a esa misma hora.')

    db.session.commit()
    return {'id': nueva.id, 'fecha': _iso_dt(nueva.start_time)}


# --- Programa del cliente ---------------------------------------------------------------------

# El prefijo de programa de un `tipo_pago` ("RR - Parcial"), y el hueco que dejan los datos
# historicos cuando ese prefijo nunca se escribio ("Desconocido - Seña").
_PREFIJO_PROGRAMA = re.compile(r'^\s*[A-Za-z]{2,3}\s*-\s*')
_PREFIJO_VACIO = re.compile(r'^\s*desconocido\s*-\s*', re.IGNORECASE)


def _tipo_pago_con_programa(crudo, codigo):
    """`tipo_pago` reetiquetado con otro programa, conservando el tipo de pago escrito.

    'Parcial' -> 'RR - Parcial'; 'Desconocido - Seña' -> 'RR - Seña'; 'AL - Cuota' -> 'RR - Cuota'.
    `None` cuando no hay ningun tipo de pago que conservar: inventarle uno ("Cuota") le daria de
    comer un dato falso a la validacion de secuencia de pagos, que es peor que no arreglar nada.
    """
    from app.services.sheets_service import SheetsService

    texto = (crudo or '').strip()
    if SheetsService.parse_tipo_pago(texto)[0]:
        texto = _PREFIJO_PROGRAMA.sub('', texto, count=1)
    else:
        texto = _PREFIJO_VACIO.sub('', texto, count=1)
    texto = texto.strip()
    return f'{codigo} - {texto}' if texto else None


def programa(appt, datos, usuario):
    """Asigna (o corrige) el programa del cliente que ya compro.

    El programa de un cliente no es una columna suya: esta escrito en el prefijo de
    `FinancialSale.tipo_pago`, que es de donde lo leen `_client_program_code`, la clasificacion
    de ventas del libro comercial, el espejo a Enrollment/Payment y la validacion de secuencia de
    pagos. Por eso asignarlo es reetiquetar sus ventas —lo mismo que hace la edicion en lote de
    Operaciones— y no escribir un dato nuevo en paralelo que despues diga otra cosa.

    Existe por los datos historicos: 281 de las 897 ventas de la base local llegan sin prefijo
    ('Parcial', 'Cuota') o con uno que no es un codigo ('Desconocido - Parcial'). Son los que el
    libro comercial agrupa bajo "Sin programa", y hasta ahora el closer los veia en la lista y no
    tenia desde donde arreglarlos. El texto detras del prefijo se conserva tal cual: es el tipo de
    pago, y no es lo que se esta corrigiendo.

    Con ventas de MAS DE UN programa se niega. Cual de los dos vale no lo puede decidir un
    desplegable, y pisar el otro seria borrar una compra: eso se corrige venta por venta desde el
    historial del cliente.

    **No se propaga a Google Sheets**, igual que `PUT /closer/sales/<id>`, que es la correccion de
    ventas que el closer ya tenia. La hoja conserva el valor viejo.
    """
    # `_ventas_del_cliente` es privada a proposito: es el mismo cruce cliente-ventas (email /
    # instagram / ultimos 8 del telefono) con el que la lectura de la ficha resolvio las ventas
    # que se estan mostrando. Rehacerlo aca con otro criterio dejaria ventas sin reetiquetar que
    # la ficha si cuenta.
    from app.models import InstallmentPlan
    from app.services.closer_followup_service import PROGRAM_CODE_NAMES
    from app.services.ficha_lead_service import _ventas_del_cliente
    from app.services.sheets_service import SheetsService

    codigo = (datos.get('programa_code') or '').strip().upper()
    if codigo not in PROGRAM_CODE_NAMES:
        raise ErrorDeAccion('Elegí uno de los programas de la lista.')
    if not appt.client:
        raise ErrorDeAccion('Esta agenda no tiene cliente: no hay a quién ponerle un programa.')

    ventas = _ventas_del_cliente(appt.client)
    if not ventas:
        raise ErrorDeAccion('Este cliente todavía no tiene ninguna venta, y el programa sale de '
                            'la venta: primero hay que declararla.')

    codigos = {SheetsService.parse_tipo_pago(v.tipo_pago)[0] for v in ventas} - {None}
    if len(codigos) > 1:
        nombres = ', '.join(sorted(PROGRAM_CODE_NAMES.get(c, c) for c in codigos))
        raise ErrorDeAccion(f'Este cliente tiene ventas de más de un programa ({nombres}): cuál '
                            'vale no lo puede decidir un desplegable. Corregí la venta que esté '
                            'mal desde el historial del cliente.')
    anterior = next(iter(codigos), None)

    reetiquetadas = 0
    for v in ventas:
        nuevo = _tipo_pago_con_programa(v.tipo_pago, codigo)
        if nuevo and nuevo != v.tipo_pago:
            v.tipo_pago = nuevo
            reetiquetadas += 1
    if not reetiquetadas and anterior != codigo:
        raise ErrorDeAccion('Ninguna venta de este cliente tiene escrito el tipo de pago, así que '
                            'no hay dónde anotar el programa. Corregí la venta desde el historial '
                            'del cliente.')

    # El plan de cuotas cuelga del par (cliente, programa). Sin mover tambien el plan, el
    # cronograma que ya existia quedaria colgado de un programa que este cliente ya no tiene y la
    # ficha lo mostraria vacio.
    InstallmentPlan.query.filter(
        InstallmentPlan.client_id == appt.client_id,
        InstallmentPlan.programa_code.is_(None) if anterior is None
        else InstallmentPlan.programa_code.in_([anterior, None]),
    ).update({'programa_code': codigo}, synchronize_session=False)

    db.session.commit()

    from app.services.booking_service import BookingService
    BookingService.log_lead_event(
        appt.id, usuario.id, 'programa_asignado',
        f'{usuario.username} puso el programa {PROGRAM_CODE_NAMES[codigo]} '
        f'(antes: {PROGRAM_CODE_NAMES.get(anterior) or "sin programa"}). '
        f'{reetiquetadas} venta(s) reetiquetada(s).')

    return {'id': appt.id, 'programa_code': codigo,
            'programa_nombre': PROGRAM_CODE_NAMES[codigo], 'ventas': reetiquetadas}


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
