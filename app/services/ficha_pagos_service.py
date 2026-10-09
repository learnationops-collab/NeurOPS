"""Los pagos de un cliente, cargados, corregidos y borrados a mano desde el historial de la ficha.

Pedido del usuario (29/09/2026): «En los pagos tambien deberia ser facil crear y modificar pagos,
sin automatizaciones. Solo es para modificar en caso de haber algun error».

Un pago vive en DOS tablas, y la ficha lee de las dos:

  · `FinancialSale` (la venta): de ahi salen la lista de pagos y el «Pagado» del historial, el
    programa del cliente (el prefijo de `tipo_pago`), la secuencia de pagos
    (`SalesConsistencyService`), el libro comercial y las comisiones.
  · `Payment`, colgado de `Enrollment` (la inscripcion): el espejo que
    `SheetsService._sync_enrollment_payment` le crea a cada venta declarada. De ahi sale la DEUDA
    (`CloserFollowUpService._client_debt`: el total negociado menos los pagos completados) y la
    fecha de ingreso.

Tocar una sola dejaria al «Pagado» y al «Debe» de la misma ficha contando plata distinta, asi que
cada correccion mueve las dos. No hay FK entre ellas: el espejo se reconoce por cliente, monto y
fecha (ver `_emparejar`). Cuando no aparece —las ventas importadas de la hoja nunca tuvieron uno, y
en la base local hay 490 `Payment` cargados por otro lado, con otras fechas— se corrige la venta
sola y la respuesta lo dice (`espejo: False`): esa venta ya no entraba en la deuda antes de
tocarla, y crearle un espejo ahora podria contar dos veces una plata que ya esta en otro `Payment`.

«Sin automatizaciones» es no pasar por `SheetsService.post_to_sheets`, que es el camino de una venta
DECLARADA. Eso deja afuera, a proposito:

  · el POST a Google Sheets y el webhook de n8n (los mensajes al cliente, el aviso a Discord);
  · el aviso de «seña convertida en venta» (`check_and_notify_down_payment_conversion`);
  · marcar la agenda como Show up (`mark_sale_appointment_as_show_up`);
  · pisar el total negociado del cliente (`Client.total_amount`) con el de la venta;
  · marcar cuotas del plan como pagadas (`InstallmentPlan` no se toca) o dar acceso a la Academia.

Lo unico que corre solo es el listener de talleres (`workshop_live_sync`), que recalcula el
snapshot del taller al que cae la venta. Es una estadistica derivada —el mismo calculo del boton
«Resync»—, no algo que salga hacia afuera, y dejarla vieja seria peor.

Google Sheets: la sincronizacion hoja -> base de ventas esta apagada (`sync_from_sheets` contesta
'disabled' sin `force`), asi que ninguna sincronizacion automatica pisa lo que se carga aca. Una
resincronizacion FORZADA (`?force=true`) vacia `financial_sales` y la rehace desde la hoja: se
llevaria los pagos cargados aca, igual que las correcciones de cualquier otra pantalla de la app
que no escribe en la hoja. Borrar si deja la marca de exclusion (`ExcludedSale`) que ya usa el
borrado de Operaciones, para que esa resincronizacion no resucite el pago borrado.
"""
import math
from datetime import date, datetime, time, timedelta

from sqlalchemy import func

from app import db
from app.models import Enrollment, FinancialSale, Payment, PaymentMethod
from app.services import transferencias_service as transferencias
from app.services.closer_followup_service import PROGRAM_CODE_NAMES, CloserFollowUpService
from app.services.ficha_acciones_service import ErrorDeAccion
from app.services.ficha_agendas_service import PRIMER_ANIO
from app.services.ficha_vocabulario import MEDIOS_PAGO_VENTA, TIPOS_PAGO_VENTA
from app.services.sheets_service import SheetsService

# Tipo canonico -> como se escribe detras del programa: 'cuota' -> 'RR - Cuota'.
TIPOS = {t['clave']: t['label'] for t in TIPOS_PAGO_VENTA}
MEDIOS = {m['clave'] for m in MEDIOS_PAGO_VENTA}

# Dos montos que difieren en menos de medio centavo son el mismo: `monto` es un Float.
CENTAVO = 0.005


# --- Validacion -------------------------------------------------------------------------------

def _dia(valor):
    """'AAAA-MM-DD' -> date, o `ErrorDeAccion`.

    El dia pelado, que es lo que da un `<input type="date">` y lo que el closer sabe de un pago: la
    hora de un pago nunca se pidio en ninguna pantalla.
    """
    texto = valor.strip() if isinstance(valor, str) else ''
    if not texto:
        raise ErrorDeAccion('Falta la fecha del pago.')
    try:
        dia = date.fromisoformat(texto) if len(texto) == 10 else None
    except ValueError:
        dia = None
    if dia is None:
        raise ErrorDeAccion('La fecha del pago tiene que ser un día: «AAAA-MM-DD».')
    if dia.year < PRIMER_ANIO:
        raise ErrorDeAccion('Esa fecha no parece la de un pago: revisá el año.')
    # Un dia de margen: el servidor esta en UTC, y quien carga de noche en Europa ya esta en el
    # dia siguiente. Mas alla de eso es un año mal tipeado o un pago que todavia no entro.
    if dia > date.today() + timedelta(days=1):
        raise ErrorDeAccion('Un pago no puede tener fecha futura: ese día todavía no llegó.')
    return dia


def _monto(valor):
    if valor in (None, ''):
        raise ErrorDeAccion('Falta el monto del pago.')
    try:
        # `bool` es un `int` para Python: sin esto, `true` pasaria como un pago de $1.
        if isinstance(valor, bool):
            raise TypeError
        monto = round(float(valor), 2)
    except (TypeError, ValueError):
        raise ErrorDeAccion('El monto del pago tiene que ser un número.') from None
    if not math.isfinite(monto) or monto <= 0:
        raise ErrorDeAccion('El monto del pago tiene que ser mayor que cero.')
    return monto


def _medio(valor, actual=None):
    """El medio pedido. Uno historico fuera de la lista se acepta SOLO si no cambia.

    Mismo criterio que la fuente de una agenda: la fila puede conservar el valor viejo que tiene
    ('Binance', 'Tarjeta'), pero uno nuevo sale de la lista.
    """
    medio = valor.strip() if isinstance(valor, str) else ''
    if not medio:
        raise ErrorDeAccion('Elegí el medio de pago de la lista.')
    if medio != (actual or '').strip() and medio not in MEDIOS:
        raise ErrorDeAccion(f'«{medio}» no es un medio de pago de la lista.')
    return medio


def _transferido_a(valor, medio, obligatorio=False):
    """A quién del equipo se le hizo el pago si es por transferencia (ver `transferencias_service`).

    Un pago nuevo por transferencia lo pide (`obligatorio`): es el momento de registrarlo. Con otro
    medio no se guarda nadie, y la marca de un pago que deja de ser transferencia se limpia.
    """
    try:
        return transferencias.para_guardar(valor, medio, obligatorio=obligatorio)
    except ValueError as e:
        raise ErrorDeAccion(str(e), 'transferido_a') from None


def _programa(valor):
    codigo = valor.strip().upper() if isinstance(valor, str) else ''
    if codigo not in PROGRAM_CODE_NAMES:
        raise ErrorDeAccion('Elegí uno de los programas de la lista.')
    return codigo


def _tipo(valor):
    # El `isinstance` va primero: una lista en el JSON haria fallar el `in` con un TypeError en
    # ingles en vez de este motivo.
    if not isinstance(valor, str) or valor not in TIPOS:
        raise ErrorDeAccion('Elegí el tipo de pago de la lista.')
    return valor


# --- El espejo en Enrollment/Payment ----------------------------------------------------------

def _instante(valor):
    """La fecha como `datetime`: en los datos viejos la columna a veces guarda un `date`."""
    if isinstance(valor, datetime):
        return valor
    if isinstance(valor, date):
        return datetime.combine(valor, time())
    return None


def _pagos_del_cliente(client_id):
    return (Payment.query.join(Enrollment, Payment.enrollment_id == Enrollment.id)
            .filter(Enrollment.client_id == client_id)
            .order_by(Payment.id.asc()).all())


def _emparejar(ventas, pagos):
    """{id de venta: su `Payment` espejo}, sin darle el mismo espejo a dos ventas.

    Dos pasadas. Primero el mismo instante y el mismo monto, que es exactamente lo que deja
    `_sync_enrollment_payment` (copia `sale.date` y el monto). Despues el mismo DIA y el mismo
    monto, que es lo que dejan las cargas con fecha sin hora (el script de pagos historicos, un
    pago cargado a mano en el historial del mazo). Sin la primera, dos cuotas iguales del mismo dia
    podrian quedar cruzadas; sin la segunda, esas cargas no tendrian espejo.

    Cualquier otra coincidencia (otro monto, otro dia) no se toma: es preferible no mover la deuda
    y decirlo que mover un pago que no era.
    """
    libres = list(pagos)
    parejas = {}
    for mismo in (lambda a, b: a == b, lambda a, b: a.date() == b.date()):
        for venta in ventas:
            cuando = _instante(venta.date)
            if venta.id in parejas or cuando is None:
                continue
            espejo = next((p for p in libres
                           if _instante(p.date) is not None and mismo(_instante(p.date), cuando)
                           and abs((p.amount or 0) - (venta.monto or 0)) < CENTAVO), None)
            if espejo is not None:
                parejas[venta.id] = espejo
                libres.remove(espejo)
    return parejas


def _sin_espejo(ventas, parejas, excepto=None):
    """Las ventas del cliente que no tienen espejo en la deuda, sin contar `excepto`."""
    return [v for v in ventas if v.id not in parejas and v.id != excepto]


def _inscripcion(client_id, codigo, closer_id, abrir=True):
    """La inscripcion a la que va el espejo de un pago de ese programa, o None.

    La que el cliente YA tiene en ese programa, de cualquier version, y solo si no tiene ninguna
    —y `abrir` lo permite—, una a la version activa (creandola), como el espejo de una venta
    declarada.

    Primero la que ya tiene porque es contra la que su deuda ya se calcula. El camino de una venta
    declarada (`_sync_enrollment_payment`) busca solo en la version ACTIVA del programa, y a un
    cliente inscripto en una version vieja le abre una segunda inscripcion, que `_client_debt`
    cobra al precio de lista entero: probado contra la base local, cargar una cuota de $50 a un
    cliente de Residency Roadmap v1 le subia la deuda de $400 a $1.850. Para cargar lo que falto,
    eso es exactamente lo contrario de corregir.

    `abrir=False` es para el cliente con ventas sin espejo (ver `crear`): una inscripcion nueva la
    cobraria entera sin restarle esa plata ya pagada.
    """
    from app.models import Program

    clave = SheetsService.PROGRAM_KEYWORDS.get(codigo)
    if not clave:
        return None
    ya_tiene = (Enrollment.query.join(Program, Enrollment.program_id == Program.id)
                .filter(Enrollment.client_id == client_id, Program.name.ilike(f'%{clave}%'))
                .order_by(Enrollment.enrollment_date.desc(), Enrollment.id.desc()).first())
    if ya_tiene is not None:
        return ya_tiene
    if not abrir:
        return None
    programa = SheetsService.resolve_program(codigo)
    if not programa:
        return None
    nueva = Enrollment(client_id=client_id, program_id=programa.id, closer_id=closer_id)
    db.session.add(nueva)
    db.session.flush()
    return nueva


def _id_del_medio(medio):
    """El `PaymentMethod` del medio, por nombre, como lo resuelve el espejo de una venta
    declarada. None para los que no tienen fila ('Transferencia', 'Efectivo')."""
    metodo = PaymentMethod.query.filter(
        func.lower(PaymentMethod.name) == (medio or '').strip().lower()).first()
    return metodo.id if metodo else None


def _ingreso_desde(espejo):
    """La fecha de ingreso sigue al primer pago completado de la inscripcion.

    Misma regla que la correccion de un pago del historial del mazo (`CloserService.
    update_payment`): cargar o corregir la fecha de un primer pago corrige tambien desde cuando el
    cliente es alumno.
    """
    inscripcion = espejo.enrollment
    if inscripcion is None:
        return
    primero = (inscripcion.payments.filter_by(status='completed')
               .order_by(Payment.date.asc()).first())
    if primero is not None and primero.id == espejo.id:
        inscripcion.enrollment_date = espejo.date


def _soltar_si_quedo_vacia(inscripcion):
    """Borra una inscripcion que se quedo sin ningun pago.

    Una inscripcion sin pagos no es «inscripto que no pago»: `_client_debt` la cobra entera (el
    total negociado, o el precio de lista, menos cero), y la ficha pasaria a mostrar como deudor
    de todo el programa a quien no compro nada. Solo se llega aca cuando la inscripcion se vacia
    por esta correccion: una que ya estaba vacia no se toca.
    """
    if inscripcion is not None and inscripcion.payments.count() == 0:
        db.session.delete(inscripcion)


# --- Bitacora ---------------------------------------------------------------------------------

def _plata(monto):
    return f'${float(monto or 0):.2f}'


def _resumen(venta):
    """El pago en una linea para la bitacora: 'RR - Cuota · $300.00 · Stripe · 2026-09-15'."""
    cuando = _instante(venta.date)
    partes = [venta.tipo_pago or 'sin tipo', _plata(venta.monto), venta.metodo_pago or 'sin medio',
              cuando.date().isoformat() if cuando else 'sin fecha']
    if venta.transferido_a:
        partes.append(f'transferido a {_a_quien(venta.transferido_a)}')
    return ' · '.join(partes)


def _a_quien(clave):
    """'jean_carlo' -> 'Jean Carlo'; sin marca, «sin marcar»."""
    return transferencias.ETIQUETAS.get(clave, clave) if clave else 'sin marcar'


def _anotar(appt, usuario, tipo_evento, accion, detalle):
    """Deja la entrada en la bitacora del lead, con la forma de la del resto del historial."""
    from app.services.booking_service import BookingService

    BookingService.log_lead_event(
        appt.id, usuario.id, tipo_evento,
        f'{usuario.username} {accion} desde el historial de la ficha: {detalle}.')


def _respuesta(appt, venta, espejo, **extra):
    return {'id': venta.id, 'espejo': espejo is not None,
            'deuda': CloserFollowUpService._client_debt(appt.client_id), **extra}


# --- Cargar un pago ---------------------------------------------------------------------------

def crear(appt, datos, usuario):
    """Carga a mano un pago que nunca se registro: la venta y su espejo, y nada mas.

    Es lo que hace `scripts/registrar_pago_historico.py` desde la consola (09/08/2026, el caso de
    Andres Simon), con una puerta en la ficha. El espejo se arma como el de una venta declarada
    —mismo `payment_type` (`PAYMENT_TYPE_MAP`), mismo medio, completado, con la fecha de la venta—
    con una diferencia a proposito: va a la inscripcion que el cliente ya tiene en ese programa
    aunque sea de una version vieja (ver `_inscripcion`). Lo que el camino de una venta declarada
    hace ademas (Sheets, n8n, avisos, Show up, total negociado) queda afuera: ver el encabezado.

    El vendedor es el closer DUEÑO de la agenda y no quien carga el pago, igual que en la venta
    declarada desde la ficha: la atribucion de un pago —y su comision— es por ese email.

    No se valida la secuencia de pagos (Seña -> Parcial -> Cuota...): corregir es justamente
    cargar lo que falta en un historial que no cierra, y la validacion leeria ese historial roto.

    Si el cliente no tiene inscripcion a ese programa y tiene ventas sin espejo —las importadas de
    la hoja: en la base local, 87 de los 150 clientes con ventas vinculadas no tienen ninguna
    inscripcion—, NO se le abre una. `_client_debt` le cobraria el programa entero menos este pago,
    sin restar lo que ya pago en esas ventas: probado contra una copia de la base, una renovacion de
    $100 a una clienta al dia le subia la deuda de $0 a $1.400. Es el mismo criterio de `corregir`
    con una venta sin espejo: la venta queda, la deuda no se mueve, y la respuesta lo dice.
    """
    from app.services.ficha_lead_service import _ventas_del_cliente

    if not appt.client:
        raise ErrorDeAccion('Esta agenda no tiene cliente: no hay a quién cargarle un pago.')
    dia = _dia(datos.get('fecha'))
    monto = _monto(datos.get('monto'))
    medio = _medio(datos.get('metodo_pago'))
    transferido_a = _transferido_a(datos.get('transferido_a'), medio, obligatorio=True)
    codigo = _programa(datos.get('programa_code'))
    tipo = _tipo(datos.get('tipo'))
    tipo_pago = f'{codigo} - {TIPOS[tipo]}'

    cliente = appt.client
    # Antes de agregar la venta nueva: todavia no tiene espejo y se contaria a si misma.
    previas = _ventas_del_cliente(cliente)
    huerfanas = _sin_espejo(previas, _emparejar(previas, _pagos_del_cliente(cliente.id)))
    vendedor = appt.closer.email if appt.closer else usuario.email
    venta = FinancialSale(
        client_id=cliente.id, email_vendedor=vendedor, nombre_cliente=cliente.full_name,
        mail_cliente=cliente.email, telefono=(cliente.phone or '').lstrip('+') or None,
        instagram=(cliente.instagram or '').lstrip('@') or None, examen=appt.examen or None,
        tipo_pago=tipo_pago, monto=monto, metodo_pago=medio, transferido_a=transferido_a,
        estado='Completada', sold_in_call=False, date=datetime.combine(dia, time()))
    db.session.add(venta)

    espejo = None
    inscripcion = _inscripcion(cliente.id, codigo, appt.closer_id, abrir=not huerfanas)
    if inscripcion is not None:
        espejo = Payment(enrollment_id=inscripcion.id, payment_method_id=_id_del_medio(medio),
                         amount=monto, payment_type=SheetsService.PAYMENT_TYPE_MAP[tipo],
                         status='completed', date=venta.date)
        db.session.add(espejo)
        db.session.flush()
        _ingreso_desde(espejo)
    db.session.commit()

    # Sin espejo es porque el cliente no tiene inscripcion a ese programa y no se le abrio una:
    # tiene pagos anteriores sin registro, o no hay un `Program` activo. La venta queda, pero la
    # deuda no la cuenta, y eso queda escrito con el motivo.
    if espejo:
        destino = 'también en inscripciones, así que la deuda lo cuenta'
    elif huerfanas:
        destino = ('sin registro en inscripciones: la deuda no lo cuenta, porque sus pagos '
                   'anteriores tampoco están ahí y abrirle una inscripción le cobraría el '
                   'programa entero')
    else:
        destino = 'sin registro en inscripciones: la deuda no lo cuenta'
    _anotar(appt, usuario, 'pago_cargado', 'cargó a mano un pago',
            f'{_resumen(venta)} (pago #{venta.id}); {destino}')
    return _respuesta(appt, venta, espejo, tipo_pago=tipo_pago, monto=monto,
                      fecha=dia.isoformat())


# --- Corregir un pago -------------------------------------------------------------------------

# Lo que se corrige de un pago, con los MISMOS nombres con los que lo lee y lo carga la ficha
# (`fecha`, `monto`, `metodo_pago`, `programa_code`, `tipo`, `transferido_a`): si el GET dijera una
# cosa y el PATCH pidiera otra, cada lado pasaria sus tests y en pantalla guardar no haria nada.
CAMPOS = ('fecha', 'monto', 'metodo_pago', 'programa_code', 'tipo', 'transferido_a')

# Lo que no es la plata ni su registro: cambiarlo no toca el espejo en la deuda.
SOLO_DE_LA_VENTA = {'transferido_a'}


# El pago pedido no está entre las ventas del lead (`_venta_y_espejo`).
NO_ES_DE_ESTE_LEAD = 'Ese pago no es de este lead.'


def _venta_y_espejo(appt, pago_id):
    """(venta, espejo, otras ventas sin espejo) del pago pedido, si es de ESTE lead.
    `ErrorDeAccion` si no.

    Sin comprobar que la venta sea del lead, el id de la URL alcanzaria para corregir o borrar el
    pago de cualquier otro cliente con solo abrir una ficha cualquiera. Las otras ventas sin
    espejo se cuentan ANTES de tocar nada: con la venta ya corregida, el emparejamiento por fecha y
    monto dejaria de reconocer su propio espejo.
    """
    from app.services.ficha_lead_service import _ventas_del_cliente

    venta = db.session.get(FinancialSale, pago_id) if pago_id else None
    if not venta:
        raise ErrorDeAccion('Ese pago no existe.')
    ventas = _ventas_del_cliente(appt.client) if appt.client else []
    if venta.id not in {v.id for v in ventas}:
        raise ErrorDeAccion(NO_ES_DE_ESTE_LEAD)
    parejas = _emparejar(ventas, _pagos_del_cliente(appt.client_id))
    return venta, parejas.get(venta.id), _sin_espejo(ventas, parejas, excepto=venta.id)


def _tipo_pago_corregido(crudo, datos):
    """El `tipo_pago` que queda al cambiar el programa y/o el tipo de un pago.

    Solo el programa: se reetiqueta conservando el texto del tipo tal cual esta escrito, con la
    misma regla que la asignacion de programa de la ficha ('Parcial' -> 'RR - Parcial',
    'Desconocido - Seña' -> 'AL - Seña'). Con el tipo, se escribe con la grafia de la lista
    ('RR - Cuota'), y hace falta un programa: el del pedido o el que ya tenia.
    """
    # Privada a proposito, como `_ventas_del_cliente`: es la regla con la que la ficha ya
    # reetiqueta ventas al asignar el programa, y dos reglas darian dos grafias para lo mismo.
    from app.services.ficha_acciones_service import _tipo_pago_con_programa

    actual, _ = SheetsService.parse_tipo_pago(crudo)
    codigo = _programa(datos.get('programa_code')) if 'programa_code' in datos else actual
    if 'tipo' in datos:
        tipo = _tipo(datos.get('tipo'))
        if not codigo:
            raise ErrorDeAccion('Este pago no tiene programa: elegilo junto con el tipo, que se '
                                'escribe «programa - tipo».')
        return f'{codigo} - {TIPOS[tipo]}'
    nuevo = _tipo_pago_con_programa(crudo, codigo)
    if not nuevo:
        raise ErrorDeAccion('Este pago no tiene escrito el tipo: elegilo junto con el programa.')
    return nuevo


def _es_del_programa(inscripcion, codigo):
    """Si la inscripcion es a ese programa, en cualquiera de sus versiones."""
    clave = SheetsService.PROGRAM_KEYWORDS.get(codigo)
    programa = inscripcion.program if inscripcion is not None else None
    return bool(clave and programa and clave in (programa.name or '').lower())


def _mover_espejo(espejo, venta, cambios, appt, abrir=True):
    """Lleva al espejo lo que cambio en la venta, y solo eso. Devuelve una nota para la bitacora
    cuando el espejo NO pudo seguir a la venta a otro programa, o None.

    Un campo que no cambio no se reescribe: un `Payment` historico con el tipo en castellano
    ('Primer Pago') se queda como esta si lo que se corrigio fue el monto.
    """
    nota = None
    if 'monto' in cambios:
        espejo.amount = venta.monto
    if 'metodo_pago' in cambios:
        espejo.payment_method_id = _id_del_medio(venta.metodo_pago)
    if 'tipo_pago' in cambios:
        codigo, tipo = SheetsService.parse_tipo_pago(venta.tipo_pago)
        if tipo:
            espejo.payment_type = SheetsService.PAYMENT_TYPE_MAP[tipo]
        # Otro programa es otra inscripcion: la deuda se calcula por inscripcion cuando el cliente
        # no tiene total negociado, y el pago tiene que restar de la del programa que pago. Si
        # solo cambio el tipo, el espejo se queda donde esta, aunque el cliente tenga otra
        # inscripcion al mismo programa en otra version.
        origen = espejo.enrollment
        if codigo and not _es_del_programa(origen, codigo):
            destino = _inscripcion(appt.client_id, codigo, origen.closer_id if origen else None,
                                   abrir=abrir)
            if destino is not None:
                espejo.enrollment = destino
                db.session.flush()
                _soltar_si_quedo_vacia(origen)
            else:
                # Sin inscripcion a donde llevarlo, el espejo se queda donde estaba: la deuda no se
                # mueve. Es el criterio de siempre: no mover un pago que no era, y decirlo.
                donde = (origen.program.name if origen is not None and origen.program
                         else 'la inscripción que tenía')
                nota = (f'su registro en inscripciones se quedó en {donde}, porque el cliente no '
                        f'tiene inscripción a {PROGRAM_CODE_NAMES.get(codigo, codigo)}'
                        + ('' if abrir else ' y tiene pagos sin registro: abrirle una le '
                                            'cobraría el programa entero'))
    if 'fecha' in cambios:
        espejo.date = venta.date
    if cambios & {'fecha', 'tipo_pago'}:
        db.session.flush()
        _ingreso_desde(espejo)
    return nota


def corregir(appt, datos, usuario, pago_id=None):
    """Corrige la fecha, el monto, el medio, el programa, el tipo y/o a quién se le hizo la
    transferencia de UN pago del cliente.

    Solo se tocan los campos que vienen, y se validan todos antes de escribir ninguno. La fecha
    conserva la hora que tenia la venta: lo que se corrige es el dia. Lo que cambia en la venta se
    lleva a su espejo en la deuda (`_mover_espejo`); sin espejo, se corrige la venta sola y la
    respuesta lo dice.

    A quién se le hizo la transferencia (`transferido_a`, 09/10/2026) se marca, se cambia o se
    vuelve a «sin marcar» (null) en un pago por transferencia; en uno que no lo es, marcarlo es un
    error. Un pago que pasa a transferencia lo pide, como el alta: es el momento de registrarlo. Uno
    que deja de serlo pierde la marca.

    No se propaga a Google Sheets, igual que la correccion de ventas del historial del mazo
    (`PUT /closer/sales/<id>`): la hoja conserva el valor viejo.
    """
    if not any(campo in datos for campo in CAMPOS):
        raise ErrorDeAccion('No hay nada que guardar.')
    venta, espejo, sin_espejo = _venta_y_espejo(appt, pago_id)
    cambios, bitacora = _aplicar(venta, datos)

    if not cambios:
        return _respuesta(appt, venta, espejo, cambios=[])

    nota = None
    if cambios <= SOLO_DE_LA_VENTA:
        # Solo cambió a quién se le hizo la transferencia: la plata y su registro son los mismos.
        db.session.commit()
        _anotar(appt, usuario, 'pago_corregido', f'corrigió el pago #{venta.id}', '; '.join(bitacora))
        return _respuesta(appt, venta, espejo, cambios=sorted(cambios))
    if espejo is not None:
        # Mismo criterio que `crear`: a un cliente con otras ventas sin espejo no se le abre una
        # inscripcion para llevar ahi este pago.
        nota = _mover_espejo(espejo, venta, cambios, appt, abrir=not sin_espejo)
    db.session.commit()

    if espejo is None:
        destino = 'sin registro en inscripciones: la deuda no cambió'
    else:
        destino = nota or 'su registro en inscripciones se corrigió igual'
    _anotar(appt, usuario, 'pago_corregido', f'corrigió el pago #{venta.id}',
            '; '.join(bitacora) + f'; {destino}')
    return _respuesta(appt, venta, espejo, cambios=sorted(cambios))


def _aplicar(venta, datos):
    """Valida lo pedido para UN pago y lo escribe en la venta, sin guardar: (cambios, bitácora).

    Se validan todos los campos antes de escribir ninguno. Es el corazón de `corregir`, y también
    de `corregir_venta` cuando la venta no tiene un lead donde anotarlo.
    """
    dia = _dia(datos.get('fecha')) if 'fecha' in datos else None
    monto = _monto(datos.get('monto')) if 'monto' in datos else None
    medio = _medio(datos.get('metodo_pago'), venta.metodo_pago) if 'metodo_pago' in datos else None
    tipo_pago = (_tipo_pago_corregido(venta.tipo_pago, datos)
                 if 'programa_code' in datos or 'tipo' in datos else None)
    medio_final = medio or venta.metodo_pago
    marca = datos.get('transferido_a')
    if marca not in (None, '') and not transferencias.es_transferencia(medio_final):
        raise ErrorDeAccion('Este pago no es por transferencia: no hay a quién marcarle que se la '
                            'hicieron.', 'transferido_a')
    pasa_a_transferencia = (transferencias.es_transferencia(medio_final)
                            and not transferencias.es_transferencia(venta.metodo_pago))
    transferido_a = _transferido_a(datos.get('transferido_a', venta.transferido_a), medio_final,
                                   obligatorio=pasa_a_transferencia)

    cambios, bitacora = set(), []
    antes = _instante(venta.date)
    if dia and (antes is None or dia != antes.date()):
        bitacora.append(f'fecha {antes.date().isoformat() if antes else "sin fecha"} → '
                        f'{dia.isoformat()}')
        venta.date = datetime.combine(dia, antes.time() if antes else time())
        cambios.add('fecha')
    if monto is not None and abs(monto - (venta.monto or 0)) >= CENTAVO:
        bitacora.append(f'monto {_plata(venta.monto)} → {_plata(monto)}')
        venta.monto = monto
        cambios.add('monto')
    if medio and medio != (venta.metodo_pago or ''):
        bitacora.append(f'medio {venta.metodo_pago or "sin medio"} → {medio}')
        venta.metodo_pago = medio
        cambios.add('metodo_pago')
    if tipo_pago and tipo_pago != (venta.tipo_pago or ''):
        bitacora.append(f'tipo {venta.tipo_pago or "sin tipo"} → {tipo_pago}')
        venta.tipo_pago = tipo_pago
        cambios.add('tipo_pago')
    if transferido_a != venta.transferido_a:
        bitacora.append(f'transferido a {_a_quien(venta.transferido_a)} → {_a_quien(transferido_a)}')
        venta.transferido_a = transferido_a
        cambios.add('transferido_a')
    return cambios, bitacora


def corregir_venta(venta, datos, usuario):
    """La misma corrección de un pago, pedida desde fuera de la ficha: Finanzas › Diferencias
    (09/10/2026) corrige la venta reportada contra lo que entró por la pasarela.

    Si la venta es de un cliente con ficha (el mismo cruce por contacto de la tabla Ventas,
    `clientes_de_ventas`), pasa por `corregir`: las mismas validaciones, el espejo en la deuda y la
    bitácora del lead. Si no tiene a quién pertenecer —o el cruce no la reconoce como de ese lead—,
    se corrige la venta sola con las mismas validaciones (`_aplicar`): no hay deuda que mover ni
    bitácora donde anotarlo, y la respuesta lo dice (`ficha: False`).
    """
    from app.services.comercial_service import clientes_de_ventas
    from app.services.ficha_lead_service import resolver_lead

    if not any(campo in datos for campo in CAMPOS):
        raise ErrorDeAccion('No hay nada que guardar.')
    cliente_id = clientes_de_ventas([venta]).get(venta.id)
    appt = resolver_lead(client_id=cliente_id)[0] if cliente_id else None
    if appt is not None:
        try:
            return {**corregir(appt, datos, usuario, pago_id=venta.id), 'ficha': True}
        except ErrorDeAccion as error:
            if str(error) != NO_ES_DE_ESTE_LEAD:
                raise
            db.session.rollback()
    cambios, _ = _aplicar(venta, datos)
    if cambios:
        db.session.commit()
    return {'id': venta.id, 'espejo': False, 'ficha': False, 'cambios': sorted(cambios)}


# --- Borrar un pago ---------------------------------------------------------------------------

def _excluir_de_la_hoja(venta):
    """Marca la fila de la hoja como excluida, para que una resincronizacion forzada no la traiga
    de vuelta. Es lo que ya hace el borrado de Operaciones (`DELETE /public/financial-sales/<id>`).

    La exclusion es por `marca_temporal` y la resincronizacion saca de la hoja TODAS las filas con
    esa marca: si otra venta que sigue viva la comparte, excluirla se llevaria tambien a esa. En
    ese caso no se marca, y lo peor que pasa es que una resincronizacion forzada resucite esta.
    Una venta cargada desde la ficha no tiene marca (nunca estuvo en la hoja) y no hay nada que
    excluir.
    """
    from app.models import ExcludedSale

    marca = (venta.marca_temporal or '').strip()
    if not marca:
        return
    compartida = FinancialSale.query.filter(FinancialSale.marca_temporal == venta.marca_temporal,
                                            FinancialSale.id != venta.id).first()
    if compartida is None and not ExcludedSale.query.filter_by(
            marca_temporal=venta.marca_temporal).first():
        db.session.add(ExcludedSale(marca_temporal=venta.marca_temporal))


def borrar(appt, datos, usuario, pago_id=None):
    """Borra un pago cargado por error: la venta y su espejo en la deuda.

    No se puede deshacer —no hay endpoint que devuelva una venta borrada—, y por eso la ficha
    difiere el pedido durante la ventana de «Deshacer» de `InlineConfirm`. La bitacora guarda el
    pago entero (tipo, monto, medio y fecha), que es lo que haria falta para volver a cargarlo.

    Si la inscripcion del espejo queda sin pagos, se borra con el: dejarla haria que la ficha
    mostrara como deudor de todo el programa a quien no pago nada (ver `_soltar_si_quedo_vacia`).
    Sin espejo, se borra la venta sola y la deuda no cambia; la respuesta lo dice.
    """
    venta, espejo, _ = _venta_y_espejo(appt, pago_id)
    resumen, borrado = _resumen(venta), venta.id

    _excluir_de_la_hoja(venta)
    if espejo is not None:
        inscripcion = espejo.enrollment
        db.session.delete(espejo)
        db.session.flush()
        _soltar_si_quedo_vacia(inscripcion)
    db.session.delete(venta)
    db.session.commit()

    _anotar(appt, usuario, 'pago_borrado', f'borró el pago #{borrado}',
            resumen + ('; también su registro en inscripciones' if espejo
                       else '; no tenía registro en inscripciones: la deuda no cambió'))
    return {'id': borrado, 'borrado': True, 'espejo': espejo is not None,
            'deuda': CloserFollowUpService._client_debt(appt.client_id)}
