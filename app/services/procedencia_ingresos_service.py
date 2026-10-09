"""De dónde entró la plata: el ingreso de Finanzas › Resumen abierto por procedencia.

Pedido del usuario (08/10/2026): ver cuánto del cash del período entró por el workshop, por
setting, por la VSL... La app ya sabe responder «de dónde salió esta venta» en tres piezas, y acá
se reusan tal cual, sin inventar una clasificación paralela:

  1. **Qué agenda originó cada pago**: `AttributionService.get_sales_attribution`. Une ventas y
     agendas por persona (Instagram y correo), toma la agenda del primer pago calificado (seña,
     parcial o completo) y le atribuye a ESA agenda los pagos siguientes de la persona. Por eso
     una cuota de alguien que entró por el workshop cuenta como workshop: la plata la trajo el
     mismo embudo que la venta. Se le pasan las ventas del período, como la nómina y el listado
     de ventas, para que «Setting · Elias» diga lo mismo que la columna Fuente y su comisión.
  2. **Cómo se llama esa fuente**: la agenda guarda en `nombre` la fuente o el setter
     ('workshop', 'workshop_landing', 'vsl', 'Elias'…). Se lee con la MISMA regla que la columna
     Fuente del listado (`sources_breakdown` de `financial_sales.py`), la nómina
     (`get_commissions_calculated`) y la comisión del setter (`commission_service`): manda el
     `nombre` de la agenda salvo que no sea una fuente de lead (vacío, 's/f', 'n/a', una entrevista
     o una diagnóstica), y si no hay, el `setter` escrito en la venta.
  3. **A qué embudo pertenece ese nombre**: `fuente_service`, el que ya separa el workshop en vivo
     de la grabación y reconoce la VSL y a los setters.

Los baldes:

  · **Workshop**: el vivo y la grabación juntos, con su detalle. Es lo que hace el tablero de
    talleres (`workshop_metrics_service`): las dos puertas son el MISMO workshop y suman, pero se
    muestran por separado para saber cuánto aporta cada una.
  · **Setting**: las agendas de un setter (Elias, Paula, Ivan… y cualquier usuario con rol setter),
    con el detalle por setter. 'setting' a secas es el link de un setter que no dejó el nombre
    (`fuente_service.FUENTES_SIN_DUENO`): es setting, «Sin identificar».
  · **VSL**.
  · **Fulfillment**: las renovaciones y los upsells van aparte, decida lo que decida la atribución.
    No los trae un embudo sino Fulfillment, que es quien cobra comisión por ellos
    (`fulfillment_commission_service`); por lo mismo la renovación no suma a lo de Marlon. Entran
    también los pagos atribuidos a una agenda de Fulfillment ('Fulfillment', 'Fulfilment', 'Fullfilment': en
    producción hay dos agendas ancla con ese nombre que se llevan renovaciones y alguna cuota). Una
    cuota de una venta del embudo, en cambio, es el resto de esa venta y sigue a su agenda.
  · **Sin procedencia**: los pagos sin agenda (o con la cita ancla «Venta histórica sin agenda»,
    que se crea justamente porque no había ninguna) y los de una fuente que no es ninguna de las
    de arriba ('Sin asignar', 'Desconocido', el nombre de un closer…).

Monto y ventas: los del ingreso del Resumen (`get_finance_summary`): ventas con fecha en el período
y estado vacío, «Completada» o «Confirmada», en cash NETO de la fee de Stripe/Hotmart
(`cash_neto_de`). La suma de los baldes es ese ingreso, al centavo (lo afirma un test).

Desde el 09/10/2026 el reparto también lo usa el dashboard comercial (Analizar › «Ingresos por
fuente», `comercial_analitica.fuentes_de`), con dos ajustes que se piden acá y no se copian allá:
una parte de las ventas (las de un closer) y la base BRUTA, que es la de su «Cash collected». Ver
`procedencia_de_ventas`.
"""
import re
from datetime import datetime, time

from app.models import FinancialAgenda, FinancialSale, User
from app.services.attribution_service import AttributionService
from app.services.commission_service import cash_neto_de
from app.services.fuente_service import (
    FUENTE_SETTING, SETTERS, es_vsl, es_workshop_landing, es_workshop_vivo, normalizar,
)
from app.services.sheets_service import SheetsService

# El estado de una venta que suma al ingreso: el mismo criterio que `get_finance_summary`.
ESTADOS_QUE_SUMAN = ('', 'completada', 'confirmada')

# Lo que hay en `agenda.nombre` y no es una fuente de lead: las exclusiones de la columna Fuente
# del listado de ventas y de la nómina, que se repiten así en cada uno de esos lugares.
_NO_ES_FUENTE = ('s/f', 'n/a', '')
_NO_ES_FUENTE_SI_CONTIENE = ('entrevista', 'diagnostica', 'diagnóstica')
_SETTER_DE_VENTA_VACIO = ('Sin Setter', 'Confirmada')

# El `origin` de la cita ancla que se crea para un cliente con ventas y sin ninguna agenda
# (`CloserFollowUpService._ensure_appointment_for_client`): no es una procedencia, es su ausencia.
_ANCLA_SIN_AGENDA = 'sin agenda'

# Los tipos de pago que trae Fulfillment y no un embudo (`SheetsService.parse_tipo_pago`).
TIPOS_FULFILLMENT = {'renovacion': 'Renovaciones', 'upsell': 'Upsells'}

PROCEDENCIAS = (
    {'key': 'workshop', 'label': 'Workshop', 'tone': 'cat-4'},
    {'key': 'setting', 'label': 'Setting', 'tone': 'cat-2'},
    {'key': 'vsl', 'label': 'VSL', 'tone': 'cat-1'},
    {'key': 'fulfillment', 'label': 'Fulfillment', 'tone': 'cat-3'},
    {'key': 'sin_procedencia', 'label': 'Sin procedencia', 'tone': 'idle'},
)

# El detalle de cada balde que no sale de los datos (el de setting es un setter por fila). El orden
# de esta lista es el de las filas cuando empatan en monto.
DETALLES = {
    'vivo': 'En vivo',
    'grabacion': 'Grabación',
    'sin_identificar': 'Sin identificar',
    'renovacion': TIPOS_FULFILLMENT['renovacion'],
    'upsell': TIPOS_FULFILLMENT['upsell'],
    'agenda_fulfillment': 'Otros pagos',
    'sin_agenda': 'Sin agenda',
    'otra': 'Otra fuente',
}


def es_fulfillment(normal):
    """True si la fuente (ya normalizada) es Fulfillment, con una o dos eles donde sea."""
    return re.sub(r'l+', 'l', normal).startswith('fulfil')


def fuente_de(venta, agenda):
    """La fuente de un pago tal como la muestran la columna Fuente y la nómina, o None si no hay.

    Es la regla de `sources_breakdown` (`financial_sales.py`) y de `get_commissions_calculated`:
    el `nombre` de la agenda que originó el pago, salvo que no sea una fuente de lead; si no, el
    `setter` escrito en la venta."""
    nombre = (agenda.nombre or '') if agenda else ''
    bajo = nombre.lower()
    if nombre.strip() and bajo not in _NO_ES_FUENTE and not any(p in bajo for p in _NO_ES_FUENTE_SI_CONTIENE):
        return nombre
    setter = venta.setter or ''
    if setter.strip() and setter not in _SETTER_DE_VENTA_VACIO:
        return setter
    return None


def setters_conocidos():
    """{nombre normalizado -> nombre a mostrar} de los setters: los de `fuente_service` y cualquier
    usuario con rol setter, para que uno nuevo no caiga en «Sin procedencia» hasta que alguien
    edite la lista."""
    nombres = list(SETTERS) + [u.username for u in User.query.filter(User.role == 'setter').all()
                               if u.username]
    conocidos = {}
    for nombre in nombres:
        conocidos.setdefault(normalizar(nombre), nombre.strip())
    return conocidos


def clasificar_pago(venta, agenda, setters):
    """(balde, clave del detalle, rótulo del detalle) de un pago. Ver el docstring del módulo."""
    tipo = SheetsService.parse_tipo_pago(venta.tipo_pago)[1]
    if tipo in TIPOS_FULFILLMENT:
        return 'fulfillment', tipo, DETALLES[tipo]

    fuente = fuente_de(venta, agenda)
    if not fuente:
        return 'sin_procedencia', 'sin_agenda', DETALLES['sin_agenda']
    if es_workshop_landing(fuente):
        return 'workshop', 'grabacion', DETALLES['grabacion']
    if es_workshop_vivo(fuente):
        return 'workshop', 'vivo', DETALLES['vivo']
    if es_vsl(fuente):
        return 'vsl', None, None

    normal = normalizar(fuente)
    if normal in setters:
        return 'setting', normal, setters[normal]
    if normal == FUENTE_SETTING:
        return 'setting', 'sin_identificar', DETALLES['sin_identificar']
    if es_fulfillment(normal):
        return 'fulfillment', 'agenda_fulfillment', DETALLES['agenda_fulfillment']
    if _ANCLA_SIN_AGENDA in normal:
        return 'sin_procedencia', 'sin_agenda', DETALLES['sin_agenda']
    return 'sin_procedencia', 'otra', DETALLES['otra']


def _centavos_que_cierran(montos, total):
    """Los `montos` redondeados al centavo de modo que sumen exactamente `total` (ya redondeado).

    Redondear cada balde por separado puede dar un centavo de más o de menos contra el ingreso del
    Resumen; el centavo que falta (o sobra) se le da a quien más perdió (o ganó) al redondear."""
    crudos = [m * 100 for m in montos]
    redondos = [round(c) for c in crudos]
    falta = round(total * 100) - sum(redondos)
    paso = 1 if falta > 0 else -1
    orden = sorted(range(len(crudos)), key=lambda i: (crudos[i] - redondos[i]) * paso, reverse=True)
    for i in orden[:abs(falta)]:
        redondos[i] += paso
    return [r / 100 for r in redondos]


def _porcentajes(montos, total):
    """El % de cada monto sobre `total`, con un decimal y por resto mayor para que sumen 100.0
    (como `repartir` del tablero). Sin total positivo, o con algún monto negativo (un reembolso que
    resta), cada uno se redondea solo: no hay un 100% que repartir."""
    if total <= 0:
        return [None] * len(montos)
    if any(m < 0 for m in montos):
        return [round(m / total * 100, 1) for m in montos]
    crudos = [m / total * 1000 for m in montos]
    pisos = [int(c) for c in crudos]
    falta = 1000 - sum(pisos)
    for i in sorted(range(len(crudos)), key=lambda i: (crudos[i] - pisos[i], -i), reverse=True)[:falta]:
        pisos[i] += 1
    return [p / 10 for p in pisos]


def ventas_que_suman(desde, hasta):
    """Las ventas del ingreso de [desde, hasta] (fechas, ambas incluidas): las del Resumen."""
    inicio = datetime.combine(desde, time.min)
    fin = datetime.combine(hasta, time.max)
    return [v for v in FinancialSale.query.filter(FinancialSale.date >= inicio, FinancialSale.date <= fin).all()
            if (v.estado or '').strip().lower() in ESTADOS_QUE_SUMAN]


# Con qué monto entra cada pago a su balde. Finanzas reparte el ingreso NETO de la fee de la
# pasarela, que es su «Ingresos»; el dashboard comercial, el cash BRUTO, que es el número grande de
# su «Cash collected» (`ComercialService.ventas` redondea cada fila al centavo y suma eso). Cada uno
# cierra con la cifra que tiene al lado.
BASES = {
    'neto': lambda venta: cash_neto_de(venta.monto, venta.metodo_pago),
    'bruto': lambda venta: round(float(venta.monto or 0.0), 2),
}


def procedencia_de_ventas(ventas, contexto=None, base='neto', agendas=None):
    """`ventas` repartidas por procedencia, con el monto de `base` ('neto' o 'bruto').

    Devuelve `total` y `cantidad` (lo que suman y cuántos pagos son) y `procedencias`: los cinco
    baldes SIEMPRE, también en cero, para que el panel no cambie de forma de un período a otro. Cada
    uno con `monto`, `cantidad` (pagos), `pct` (del total) y su `detalle`, ordenado de mayor a menor
    (solo lo que tuvo pagos).

    `contexto` son las ventas sobre las que se calcula la atribución cuando `ventas` es una parte de
    ellas (las de un closer, en el dashboard comercial): todas las del período. La agenda de un pago
    depende de los OTROS pagos de la misma persona —manda el primero calificado—, así que con solo
    los de un closer una cuota podía cambiar de agenda según quién mirara. Con el período entero,
    cada pago cae en el mismo balde en «Mis datos», en el equipo y en Finanzas. Sin `contexto`, la
    atribución es sobre las mismas `ventas`.

    `agendas` (opcional) son las `FinancialAgenda` ya leídas, para quien reparte dos períodos seguidos
    —el actual y el comparado— y no quiere leerlas dos veces."""
    monto_de = BASES[base]
    contexto = ventas if contexto is None else contexto
    if ventas:
        agendas = FinancialAgenda.query.all() if agendas is None else agendas
        atribucion = AttributionService.get_sales_attribution(sales=contexto, agendas=agendas)
    else:
        atribucion = {}
    setters = setters_conocidos()

    baldes = {p['key']: {'monto': 0.0, 'cantidad': 0, 'detalle': {}} for p in PROCEDENCIAS}
    total = 0.0
    for venta in ventas:
        monto = monto_de(venta)
        total += monto
        clave, sub, rotulo = clasificar_pago(venta, atribucion.get(venta.id), setters)
        balde = baldes[clave]
        balde['monto'] += monto
        balde['cantidad'] += 1
        if sub:
            fila = balde['detalle'].setdefault(sub, {'key': sub, 'label': rotulo, 'monto': 0.0, 'cantidad': 0})
            fila['monto'] += monto
            fila['cantidad'] += 1

    total = round(total, 2)
    montos = _centavos_que_cierran([baldes[p['key']]['monto'] for p in PROCEDENCIAS], total)
    pcts = _porcentajes(montos, total)
    orden_fijo = list(DETALLES)

    procedencias = []
    for p, monto, pct in zip(PROCEDENCIAS, montos, pcts):
        balde = baldes[p['key']]
        filas = sorted(balde['detalle'].values(),
                       key=lambda f: (-f['monto'], orden_fijo.index(f['key']) if f['key'] in orden_fijo else 0,
                                      f['label']))
        montos_det = _centavos_que_cierran([f['monto'] for f in filas], monto)
        detalle = [{**f, 'monto': m, 'pct': round(m / total * 100, 1) if total > 0 else None}
                   for f, m in zip(filas, montos_det)]
        procedencias.append({**p, 'monto': monto, 'cantidad': balde['cantidad'], 'pct': pct,
                             'detalle': detalle})

    return {'base': base, 'total': total, 'cantidad': len(ventas), 'procedencias': procedencias}


def procedencia_de_ingresos(desde, hasta):
    """El ingreso de [desde, hasta] (fechas, ambas incluidas) repartido por procedencia: el panel de
    Finanzas › Resumen, en neto. La forma es la de `procedencia_de_ventas`, con el período."""
    return {'desde': desde.isoformat(), 'hasta': hasta.isoformat(),
            **procedencia_de_ventas(ventas_que_suman(desde, hasta))}
