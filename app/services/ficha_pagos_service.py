"""Los pagos de un cliente, cargados y corregidos a mano desde el historial de la ficha.

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
que no escribe en la hoja.
"""
import math
from datetime import date, datetime, time, timedelta

from sqlalchemy import func

from app import db
from app.models import Enrollment, FinancialSale, Payment, PaymentMethod
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
    # `bool` es un `int` para Python: sin esto, `true` pasaria como un pago de $1.
    if valor in (None, '') or isinstance(valor, bool):
        raise ErrorDeAccion('Falta el monto del pago.')
    try:
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


def _espejo_de(appt, venta):
    """El `Payment` que refleja esta venta en la deuda del cliente, o None.

    Se empareja con TODAS las ventas del cliente y no con esta sola: si no, dos ventas iguales del
    mismo dia reclamarian el mismo espejo.
    """
    # `_ventas_del_cliente` es privada a proposito: es el mismo cruce cliente-ventas (email /
    # instagram / ultimos 8 del telefono) con el que la lectura armo la lista que se esta
    # corrigiendo. Rehacerlo aca con otro criterio dejaria pagos que la ficha muestra y esto no ve.
    from app.services.ficha_lead_service import _ventas_del_cliente

    if not appt.client_id:
        return None
    parejas = _emparejar(_ventas_del_cliente(appt.client), _pagos_del_cliente(appt.client_id))
    return parejas.get(venta.id)


# --- Bitacora ---------------------------------------------------------------------------------

def _plata(monto):
    return f'${float(monto or 0):.2f}'


def _resumen(venta):
    """El pago en una linea para la bitacora: 'RR - Cuota · $300.00 · Stripe · 2026-09-15'."""
    cuando = _instante(venta.date)
    return ' · '.join([venta.tipo_pago or 'sin tipo', _plata(venta.monto),
                       venta.metodo_pago or 'sin medio',
                       cuando.date().isoformat() if cuando else 'sin fecha'])


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
    Andres Simon), con una puerta en la ficha: el espejo lo arma `_sync_enrollment_payment`, la
    MISMA funcion del camino de una venta declarada, para que el pago cargado aca entre a la deuda
    con el mismo `payment_type`, la misma inscripcion y la misma fecha de ingreso que uno
    declarado. Lo que ese camino hace ademas (Sheets, n8n, avisos, Show up, total negociado) queda
    afuera: ver el encabezado.

    El vendedor es el closer DUEÑO de la agenda y no quien carga el pago, igual que en la venta
    declarada desde la ficha: la atribucion de un pago —y su comision— es por ese email.

    No se valida la secuencia de pagos (Seña -> Parcial -> Cuota...): corregir es justamente
    cargar lo que falta en un historial que no cierra, y la validacion leeria ese historial roto.
    """
    if not appt.client:
        raise ErrorDeAccion('Esta agenda no tiene cliente: no hay a quién cargarle un pago.')
    dia = _dia(datos.get('fecha'))
    monto = _monto(datos.get('monto'))
    medio = _medio(datos.get('metodo_pago'))
    codigo = _programa(datos.get('programa_code'))
    tipo_pago = f'{codigo} - {TIPOS[_tipo(datos.get("tipo"))]}'

    cliente = appt.client
    vendedor = appt.closer.email if appt.closer else usuario.email
    venta = FinancialSale(
        client_id=cliente.id, email_vendedor=vendedor, nombre_cliente=cliente.full_name,
        mail_cliente=cliente.email, telefono=(cliente.phone or '').lstrip('+') or None,
        instagram=(cliente.instagram or '').lstrip('@') or None, examen=appt.examen or None,
        tipo_pago=tipo_pago, monto=monto, metodo_pago=medio, estado='Completada',
        sold_in_call=False, date=datetime.combine(dia, time()))
    db.session.add(venta)
    db.session.flush()
    SheetsService._sync_enrollment_payment(
        {'tipo_pago': tipo_pago, 'monto': monto, 'metodo_pago': medio, 'email_vendedor': vendedor},
        venta, cliente)
    db.session.commit()

    espejo = _espejo_de(appt, venta)
    # Sin espejo es porque no hay un `Program` activo para ese codigo: la venta queda, pero la
    # deuda no la cuenta, y eso tiene que quedar escrito.
    _anotar(appt, usuario, 'pago_cargado', 'cargó a mano un pago',
            f'{_resumen(venta)} (pago #{venta.id}); '
            + ('también en inscripciones, así que la deuda lo cuenta' if espejo
               else 'sin registro en inscripciones: la deuda no lo cuenta'))
    return _respuesta(appt, venta, espejo, tipo_pago=tipo_pago, monto=monto,
                      fecha=dia.isoformat())


# --- Corregir un pago -------------------------------------------------------------------------

# Lo que se corrige de un pago, con los MISMOS nombres con los que lo lee y lo carga la ficha
# (`fecha`, `monto`, `metodo_pago`, `programa_code`, `tipo`): si el GET dijera una cosa y el PATCH
# pidiera otra, cada lado pasaria sus tests y en pantalla guardar no haria nada.
CAMPOS = ('fecha', 'monto', 'metodo_pago', 'programa_code', 'tipo')


def _venta_y_espejo(appt, pago_id):
    """(venta, espejo) del pago pedido, si es de ESTE lead. `ErrorDeAccion` si no.

    Sin comprobar que la venta sea del lead, el id de la URL alcanzaria para corregir o borrar el
    pago de cualquier otro cliente con solo abrir una ficha cualquiera.
    """
    from app.services.ficha_lead_service import _ventas_del_cliente

    venta = db.session.get(FinancialSale, pago_id) if pago_id else None
    if not venta:
        raise ErrorDeAccion('Ese pago no existe.')
    ventas = _ventas_del_cliente(appt.client) if appt.client else []
    if venta.id not in {v.id for v in ventas}:
        raise ErrorDeAccion('Ese pago no es de este lead.')
    parejas = _emparejar(ventas, _pagos_del_cliente(appt.client_id))
    return venta, parejas.get(venta.id)


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


def _inscripcion(client_id, codigo, closer_id):
    """La inscripcion del cliente a ese programa, creandola si no existe (como el espejo de una
    venta declarada). None si no hay un `Program` activo para el codigo."""
    programa = SheetsService.resolve_program(codigo)
    if not programa:
        return None
    inscripcion = Enrollment.query.filter_by(client_id=client_id, program_id=programa.id).first()
    if not inscripcion:
        inscripcion = Enrollment(client_id=client_id, program_id=programa.id, closer_id=closer_id)
        db.session.add(inscripcion)
        db.session.flush()
    return inscripcion


def _soltar_si_quedo_vacia(inscripcion):
    """Borra una inscripcion que se quedo sin ningun pago.

    Una inscripcion sin pagos no es «inscripto que no pago»: `_client_debt` la cobra entera (el
    total negociado, o el precio de lista, menos cero), y la ficha pasaria a mostrar como deudor
    de todo el programa a quien no compro nada. Solo se llega aca cuando la inscripcion se vacia
    por esta correccion: una que ya estaba vacia no se toca.
    """
    if inscripcion is not None and inscripcion.payments.count() == 0:
        db.session.delete(inscripcion)


def _ingreso_desde(espejo):
    """La fecha de ingreso sigue al primer pago completado de la inscripcion.

    Misma regla que la correccion de un pago del historial del mazo (`CloserService.
    update_payment`): corregir la fecha de un primer pago mal cargado corrige tambien desde cuando
    el cliente es alumno.
    """
    inscripcion = espejo.enrollment
    if inscripcion is None:
        return
    primero = (inscripcion.payments.filter_by(status='completed')
               .order_by(Payment.date.asc()).first())
    if primero is not None and primero.id == espejo.id:
        inscripcion.enrollment_date = espejo.date


def _mover_espejo(espejo, venta, cambios, appt):
    """Lleva al espejo lo que cambio en la venta, y solo eso.

    Un campo que no cambio no se reescribe: un `Payment` historico con el tipo en castellano
    ('Primer Pago') se queda como esta si lo que se corrigio fue el monto.
    """
    if 'monto' in cambios:
        espejo.amount = venta.monto
    if 'metodo_pago' in cambios:
        metodo = PaymentMethod.query.filter(
            func.lower(PaymentMethod.name) == (venta.metodo_pago or '').strip().lower()).first()
        espejo.payment_method_id = metodo.id if metodo else None
    if 'tipo_pago' in cambios:
        codigo, tipo = SheetsService.parse_tipo_pago(venta.tipo_pago)
        if tipo:
            espejo.payment_type = SheetsService.PAYMENT_TYPE_MAP[tipo]
        # Otro programa es otra inscripcion: la deuda se calcula por inscripcion cuando el cliente
        # no tiene total negociado, y el pago tiene que restar de la del programa que pago.
        origen = espejo.enrollment
        destino = _inscripcion(appt.client_id, codigo, origen.closer_id if origen else None) \
            if codigo else None
        if destino is not None and destino.id != espejo.enrollment_id:
            espejo.enrollment = destino
            db.session.flush()
            _soltar_si_quedo_vacia(origen)
    if 'fecha' in cambios:
        espejo.date = venta.date
    if cambios & {'fecha', 'tipo_pago'}:
        db.session.flush()
        _ingreso_desde(espejo)


def corregir(appt, datos, usuario, pago_id=None):
    """Corrige la fecha, el monto, el medio, el programa y/o el tipo de UN pago del cliente.

    Solo se tocan los campos que vienen, y se validan todos antes de escribir ninguno. La fecha
    conserva la hora que tenia la venta: lo que se corrige es el dia. Lo que cambia en la venta se
    lleva a su espejo en la deuda (`_mover_espejo`); sin espejo, se corrige la venta sola y la
    respuesta lo dice.

    No se propaga a Google Sheets, igual que la correccion de ventas del historial del mazo
    (`PUT /closer/sales/<id>`): la hoja conserva el valor viejo.
    """
    if not any(campo in datos for campo in CAMPOS):
        raise ErrorDeAccion('No hay nada que guardar.')
    venta, espejo = _venta_y_espejo(appt, pago_id)

    dia = _dia(datos.get('fecha')) if 'fecha' in datos else None
    monto = _monto(datos.get('monto')) if 'monto' in datos else None
    medio = _medio(datos.get('metodo_pago'), venta.metodo_pago) if 'metodo_pago' in datos else None
    tipo_pago = (_tipo_pago_corregido(venta.tipo_pago, datos)
                 if 'programa_code' in datos or 'tipo' in datos else None)

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

    if not cambios:
        return _respuesta(appt, venta, espejo, cambios=[])

    if espejo is not None:
        _mover_espejo(espejo, venta, cambios, appt)
    db.session.commit()

    _anotar(appt, usuario, 'pago_corregido', f'corrigió el pago #{venta.id}',
            '; '.join(bitacora) + ('; su registro en inscripciones se corrigió igual' if espejo
                                   else '; sin registro en inscripciones: la deuda no cambió'))
    return _respuesta(appt, venta, espejo, cambios=sorted(cambios))
