"""A quién del equipo se le hizo un pago por transferencia (09/10/2026).

Pedido de Kerwin: «necesito que los pagos con el método de transferencia se les pueda marcar a quién
del equipo se le hizo la transferencia, las opciones son Pedro, Jean Carlo y otro. Y que se refleje
en finanzas: [...] se le pasó a Jean Carlo, entonces hay que marcarlo y que se refleje en finanzas y
payroll para descontárselo».

Una transferencia a la cuenta de alguien del equipo es plata de la empresa que quedó en manos de esa
persona, no en una cuenta de la empresa. La venta sigue siendo ingreso (Finanzas no cambia su total);
lo que cambia es DÓNDE está la plata, y que a esa persona hay que pagarle menos: lo que ya tiene se
le descuenta de lo que se le paga, no de lo que cuesta (sueldo y comisión quedan iguales).

El dato es `FinancialSale.transferido_a`: una de las claves de `TRANSFERIDO_A`, o NULL = «sin
marcar» (todos los pagos de antes). Solo tiene sentido si el medio es transferencia: con otro medio
se guarda NULL, también cuando un pago cambia de medio.

Todo lo que lee o escribe el dato pasa por acá: la lista de opciones (que la ficha recibe en su
vocabulario), qué medio es transferencia, qué se guarda, y las dos sumas: la de Finanzas (dónde está
la plata del período) y la de Payroll y la Nómina (lo que recibió cada persona, para descontárselo).
"""
import unicodedata

# Las opciones, en UN lugar. `nomina` es la clave de la persona en Payroll (`GRUPOS` de
# Payroll.jsx, `nomina_service.clave_de_nomina`): a quien la tiene se le descuenta lo que recibió.
# «Otro» no es nadie de la nómina y no descuenta a nadie: solo se ve en Finanzas.
TRANSFERIDO_A = [
    {'clave': 'pedro', 'label': 'Pedro', 'nomina': 'pedro'},
    {'clave': 'jean_carlo', 'label': 'Jean Carlo', 'nomina': 'jeancarlo'},
    {'clave': 'otro', 'label': 'Otro', 'nomina': None},
]
CLAVES = tuple(o['clave'] for o in TRANSFERIDO_A)
ETIQUETAS = {o['clave']: o['label'] for o in TRANSFERIDO_A}
NOMINA = {o['clave']: o['nomina'] for o in TRANSFERIDO_A if o['nomina']}

FALTA = '¿A quién se le hizo la transferencia? Elegí Pedro, Jean Carlo u Otro.'


def opciones():
    """La lista que ve la ficha: {clave, label}, en el orden en que se ofrecen."""
    return [{'clave': o['clave'], 'label': o['label']} for o in TRANSFERIDO_A]


def es_transferencia(metodo_pago):
    """Si el medio es una transferencia: 'Transferencia', 'Transferencia Bancaria' (los dos de la
    lista de la ficha) y cualquier variante escrita a mano ('transferencia bancaria', 'Transfer')."""
    texto = unicodedata.normalize('NFKD', str(metodo_pago or '')).encode('ascii', 'ignore').decode()
    return 'transfer' in texto.lower()


def clave_valida(valor):
    """La clave de la lista, o None si viene vacía. ValueError si no es una de las tres."""
    if valor is None or (isinstance(valor, str) and not valor.strip()):
        return None
    if not isinstance(valor, str) or valor.strip() not in CLAVES:
        raise ValueError(f'«{valor}» no es una de las opciones de a quién se le hizo la transferencia.')
    return valor.strip()


def para_guardar(valor, metodo_pago, obligatorio=False):
    """Lo que corresponde guardar en `transferido_a` para un pago con ese medio.

    Con un medio que no es transferencia, None: la plata no está en manos de nadie, y si el pago
    cambió de medio la marca vieja se limpia. Con transferencia, la clave elegida; sin ninguna,
    None («sin marcar»), salvo que sea `obligatorio` (el alta de un pago nuevo), que es ValueError.
    """
    if not es_transferencia(metodo_pago):
        return None
    clave = clave_valida(valor)
    if clave is None and obligatorio:
        raise ValueError(FALTA)
    return clave


# --- Las sumas ------------------------------------------------------------------------------------

def _transferencias_del_rango(desde, hasta):
    """Las ventas completadas por transferencia entre dos fechas (`date`, inclusive; None = sin
    límite). Completadas con la misma regla que el ingreso de Finanzas y la nómina
    (`nomina_service.venta_completada`): una venta cancelada no dejó plata en ningún lado."""
    from sqlalchemy import func

    from app.models import FinancialSale
    from app.services.nomina_service import _fin, _inicio, venta_completada

    query = FinancialSale.query.filter(func.lower(FinancialSale.metodo_pago).like('%transfer%'))
    if desde:
        query = query.filter(FinancialSale.date >= _inicio(desde))
    if hasta:
        query = query.filter(FinancialSale.date <= _fin(hasta))
    return [v for v in query.order_by(FinancialSale.date.asc(), FinancialSale.id.asc()).all()
            if venta_completada(v) and es_transferencia(v.metodo_pago)]


def _monto(venta):
    # La misma cuenta que el ingreso (una transferencia no paga fee de pasarela: es el monto).
    from app.services.commission_service import cash_neto_de

    return round(cash_neto_de(venta.monto, venta.metodo_pago), 2)


def recibidas_por_persona(desde=None, hasta=None):
    """{clave de Payroll -> {'total', 'pagos'}} de lo que cada persona de la nómina recibió por
    transferencia en el rango (la fecha del pago), para descontárselo de lo que se le paga.

    Es LA cuenta de Payroll (`payroll_del_rango`) y de la Nómina de Finanzas (`nomina_del_mes`, el
    rango de un mes): las dos dicen lo mismo. Están las personas con una opción propia (Pedro, Jean
    Carlo), aunque en el rango no hayan recibido nada; «otro» no es nadie. Una venta sacada de la
    nómina (`is_excluded_from_payroll`) no le paga comisión a nadie, pero la plata la tiene igual:
    se descuenta.
    """
    recibidas = {clave: {'total': 0.0, 'pagos': []} for clave in NOMINA.values()}
    for venta in _transferencias_del_rango(desde, hasta):
        clave = NOMINA.get(venta.transferido_a)
        if not clave:
            continue
        monto = _monto(venta)
        recibidas[clave]['pagos'].append({
            'id': venta.id, 'date': venta.date.isoformat() if venta.date else None,
            'nombre_cliente': venta.nombre_cliente, 'tipo_pago': venta.tipo_pago,
            'metodo_pago': venta.metodo_pago, 'monto': monto,
        })
        recibidas[clave]['total'] += monto
    for datos in recibidas.values():
        datos['total'] = round(datos['total'], 2)
    return recibidas


def resumen_del_periodo(desde=None, hasta=None):
    """Para el Resumen de Finanzas: cuánto entró por transferencia en el período y a quién.

    {'total', 'ventas', 'destinos': [{clave, label, total, ventas, descuenta}], 'sin_marcar':
    {total, ventas}}. Los destinos van siempre los tres, aunque en 0. `descuenta` dice si se le
    descuenta a alguien de la nómina (Pedro y Jean Carlo sí, «otro» no). El total es parte del
    ingreso del período, no algo aparte: suma lo mismo que las filas de transferencia de «Ingresos
    por medio de pago».
    """
    destinos = {o['clave']: {'clave': o['clave'], 'label': o['label'], 'total': 0.0, 'ventas': 0,
                             'descuenta': bool(o['nomina'])} for o in TRANSFERIDO_A}
    sin_marcar = {'total': 0.0, 'ventas': 0}
    total, ventas = 0.0, 0
    for venta in _transferencias_del_rango(desde, hasta):
        monto = _monto(venta)
        fila = destinos.get(venta.transferido_a, sin_marcar)
        fila['total'] += monto
        fila['ventas'] += 1
        total += monto
        ventas += 1
    for fila in [*destinos.values(), sin_marcar]:
        fila['total'] = round(fila['total'], 2)
    return {'total': round(total, 2), 'ventas': ventas, 'destinos': list(destinos.values()),
            'sin_marcar': sin_marcar}
