"""Los pagos de un cliente, cargados, corregidos y borrados a mano desde el historial de la ficha.

Pedido del usuario (29/09/2026): «En los pagos tambien deberia ser facil crear y modificar pagos,
sin automatizaciones. Solo es para modificar en caso de haber algun error».

Un pago es una fila de `FinancialSale`, y `sale_service` lo ubica en su venta (`Sale`): de ahi salen
la lista de pagos, el «Pagado», el programa, la secuencia de pagos, la deuda (`deuda_service`: lo
acordado en cada venta menos lo cobrado) y las comisiones. El espejo en `Enrollment`/`Payment` que se
movia junto con cada correccion ya no existe (Etapa 2c de docs/plan_personas.md).

«Sin automatizaciones» es no pasar por `SheetsService.post_to_sheets`, que es el camino de una venta
DECLARADA. Eso deja afuera, a proposito:

  · el POST a Google Sheets y el webhook de n8n (los mensajes al cliente, el aviso a Discord);
  · el aviso de «seña convertida en venta» (`check_and_notify_down_payment_conversion`);
  · marcar la agenda como Show up (`mark_sale_appointment_as_show_up`);
  · pisar el total acordado de la venta (`Sale.agreed_total`);
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

from app import db
from app.models import FinancialSale
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

def _venta_elegida(valor, client_id, codigo):
    """La venta que se eligio a mano para el pago (`sale_service.venta_elegida`); None = automatica."""
    from app.services.sale_service import venta_elegida

    try:
        return venta_elegida(valor, client_id, codigo)
    except ValueError as e:
        raise ErrorDeAccion(str(e), 'sale_id')


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


# --- Fechas -------------------------------------------------------------------------------------

def _instante(valor):
    """La fecha como `datetime`: en los datos viejos la columna a veces guarda un `date`."""
    if isinstance(valor, datetime):
        return valor
    if isinstance(valor, date):
        return datetime.combine(valor, time())
    return None


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


# De dónde se hizo la corrección, para la bitácora: la ficha, o Finanzas › Diferencias (09/10/2026).
DESDE_LA_FICHA = 'el historial de la ficha'
DESDE_DIFERENCIAS = 'Finanzas › Diferencias'


def _anotar(appt, usuario, tipo_evento, accion, detalle, origen=DESDE_LA_FICHA):
    """Deja la entrada en la bitacora del lead, con la forma de la del resto del historial."""
    from app.services.booking_service import BookingService

    BookingService.log_lead_event(
        appt.id, usuario.id, tipo_evento,
        f'{usuario.username} {accion} desde {origen}: {detalle}.')


def _respuesta(appt, venta, **extra):
    return {'id': venta.id, 'deuda': CloserFollowUpService._client_debt(appt.client_id), **extra}


# --- Cargar un pago ---------------------------------------------------------------------------

def crear(appt, datos, usuario):
    """Carga a mano un pago que nunca se registro: la venta, y nada mas. `sale_service` la ubica en su
    venta (o en la elegida, `sale_id`), y la deuda la cuenta.

    Es lo que hace `scripts/registrar_pago_historico.py` desde la consola (09/08/2026, el caso de
    Andres Simon), con una puerta en la ficha. Lo que el camino de una venta declarada hace ademas
    (Sheets, n8n, avisos, Show up, total acordado) queda afuera: ver el encabezado.

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
    transferido_a = _transferido_a(datos.get('transferido_a'), medio, obligatorio=True)
    codigo = _programa(datos.get('programa_code'))
    tipo = _tipo(datos.get('tipo'))
    tipo_pago = f'{codigo} - {TIPOS[tipo]}'
    sale_id = _venta_elegida(datos.get('sale_id'), appt.client.id, codigo)

    cliente = appt.client
    vendedor = appt.closer.email if appt.closer else usuario.email
    # El pago es de la persona del cliente; su mail es el de pago si tiene uno distinto, si no el
    # principal (docs/plan_personas.md).
    from app.services import person_service
    persona = cliente.person
    mail = (person_service.dato(persona, 'email', uso='pago') if persona else None) or cliente.email
    venta = FinancialSale(
        client_id=cliente.id, person=persona, email_vendedor=vendedor, nombre_cliente=cliente.full_name,
        mail_cliente=mail, telefono=(cliente.phone or '').lstrip('+') or None,
        instagram=(cliente.instagram or '').lstrip('@') or None, examen=appt.examen or None,
        tipo_pago=tipo_pago, monto=monto, metodo_pago=medio, transferido_a=transferido_a,
        estado='Completada', sold_in_call=False, date=datetime.combine(dia, time()), sale_id=sale_id)
    db.session.add(venta)
    db.session.commit()

    # La Academia extiende el acceso solo si este pago lo alarga: cargar un pago viejo no lo acorta.
    from app.services.academy_payment_sync import notify_academy_of_payments
    notify_academy_of_payments([venta])

    _anotar(appt, usuario, 'pago_cargado', 'cargó a mano un pago', f'{_resumen(venta)} (pago #{venta.id})')
    return _respuesta(appt, venta, tipo_pago=tipo_pago, monto=monto, fecha=dia.isoformat())


# --- Corregir un pago -------------------------------------------------------------------------

# Lo que se corrige de un pago, con los MISMOS nombres con los que lo lee y lo carga la ficha
# (`fecha`, `monto`, `metodo_pago`, `programa_code`, `tipo`, `transferido_a`): si el GET dijera una
# cosa y el PATCH pidiera otra, cada lado pasaria sus tests y en pantalla guardar no haria nada.
CAMPOS = ('fecha', 'monto', 'metodo_pago', 'programa_code', 'tipo', 'transferido_a', 'sale_id')

# El pago pedido no está entre las ventas del lead (`_venta_del_lead`).
NO_ES_DE_ESTE_LEAD = 'Ese pago no es de este lead.'


def _venta_del_lead(appt, pago_id):
    """La venta del pago pedido, si es de ESTE lead. `ErrorDeAccion` si no.

    Sin comprobar que la venta sea del lead, el id de la URL alcanzaria para corregir o borrar el
    pago de cualquier otro cliente con solo abrir una ficha cualquiera.
    """
    from app.services.ficha_lead_service import _ventas_del_cliente

    venta = db.session.get(FinancialSale, pago_id) if pago_id else None
    if not venta:
        raise ErrorDeAccion('Ese pago no existe.')
    ventas = _ventas_del_cliente(appt.client) if appt.client else []
    if venta.id not in {v.id for v in ventas}:
        raise ErrorDeAccion(NO_ES_DE_ESTE_LEAD)
    return venta


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


def corregir(appt, datos, usuario, pago_id=None, origen=DESDE_LA_FICHA):
    """Corrige la fecha, el monto, el medio, el programa, el tipo y/o a quién se le hizo la
    transferencia de UN pago del cliente.

    Solo se tocan los campos que vienen, y se validan todos antes de escribir ninguno. La fecha
    conserva la hora que tenia la venta: lo que se corrige es el dia. Si cambia el tipo o el programa,
    `sale_service` vuelve a ubicar el pago en su venta, y la deuda sale de ahi.

    A quién se le hizo la transferencia (`transferido_a`, 09/10/2026) se marca, se cambia o se
    vuelve a «sin marcar» (null) en un pago por transferencia; en uno que no lo es, marcarlo es un
    error. Un pago que pasa a transferencia lo pide, como el alta: es el momento de registrarlo. Uno
    que deja de serlo pierde la marca.

    No se propaga a Google Sheets, igual que la correccion de ventas del historial del mazo
    (`PUT /closer/sales/<id>`): la hoja conserva el valor viejo.
    """
    if not any(campo in datos for campo in CAMPOS):
        raise ErrorDeAccion('No hay nada que guardar.')
    venta = _venta_del_lead(appt, pago_id)
    cambios, bitacora = _aplicar(venta, datos)
    if not cambios:
        return _respuesta(appt, venta, cambios=[])
    db.session.commit()
    _anotar(appt, usuario, 'pago_corregido', f'corrigió el pago #{venta.id}', '; '.join(bitacora), origen)
    return _respuesta(appt, venta, cambios=sorted(cambios))


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
    # Mover el pago a otra venta (20/10/2026). Vacío no la cambia: si cambia el tipo o el programa,
    # el sistema lo vuelve a ubicar solo (`sale_service`).
    sale_id = (_venta_elegida(datos.get('sale_id'), venta.client_id,
                              SheetsService.parse_tipo_pago(tipo_pago or venta.tipo_pago)[0])
               if datos.get('sale_id') not in (None, '') else None)

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
    if sale_id and sale_id != venta.sale_id:
        bitacora.append(f'venta #{venta.sale_id or "sin venta"} → #{sale_id}')
        venta.sale_id = sale_id
        cambios.add('sale_id')
    return cambios, bitacora


def corregir_venta(venta, datos, usuario):
    """La misma corrección de un pago, pedida desde fuera de la ficha: Finanzas › Diferencias
    (09/10/2026) corrige la venta reportada contra lo que entró por la pasarela.

    Si la venta es de un cliente con ficha (el mismo cruce por contacto de la tabla Ventas,
    `clientes_de_ventas`), pasa por `corregir`: las mismas validaciones y la bitácora del lead, que
    dice que se corrigió desde Diferencias. Si no tiene a quién pertenecer —o el cruce no la reconoce
    como de ese lead—, se corrige la venta sola con las mismas validaciones (`_aplicar`): no hay
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
            return {**corregir(appt, datos, usuario, pago_id=venta.id, origen=DESDE_DIFERENCIAS), 'ficha': True}
        except ErrorDeAccion as error:
            if str(error) != NO_ES_DE_ESTE_LEAD:
                raise
            db.session.rollback()
    cambios, _ = _aplicar(venta, datos)
    if cambios:
        db.session.commit()
    return {'id': venta.id, 'ficha': False, 'cambios': sorted(cambios)}


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
    """Borra un pago cargado por error. Si su venta queda vacía, `sale_service` la borra.

    No se puede deshacer —no hay endpoint que devuelva una venta borrada—, y por eso la ficha
    difiere el pedido durante la ventana de «Deshacer» de `InlineConfirm`. La bitacora guarda el
    pago entero (tipo, monto, medio y fecha), que es lo que haria falta para volver a cargarlo.
    """
    venta = _venta_del_lead(appt, pago_id)
    resumen, borrado = _resumen(venta), venta.id

    _excluir_de_la_hoja(venta)
    db.session.delete(venta)
    db.session.commit()

    _anotar(appt, usuario, 'pago_borrado', f'borró el pago #{borrado}', resumen)
    return {'id': borrado, 'borrado': True, 'deuda': CloserFollowUpService._client_debt(appt.client_id)}
