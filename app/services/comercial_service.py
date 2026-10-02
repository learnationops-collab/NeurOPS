"""Dashboard comercial — la analítica y el libro de registros de la dirección comercial, y el
mismo tablero acotado a una persona en "Mis datos" de closers y setters.

Por qué existe teniendo ya `CloserDashboardService`
---------------------------------------------------
Ese servicio arma el dashboard personal del closer y toma varios pasos del embudo de los
reportes diarios (`CloserDailyReport`/`CloserDailyStats`), que es la única fuente de los cupos.
Acá hace falta lo contrario: que **todo** salga del registro real (`Appointment` +
`FinancialSale`), porque el dashboard comercial pone al lado la tabla de agendas de Revisar y
los totales de esa tabla — si los KPIs de arriba se calcularan con otra fuente que las filas de
abajo, los números no cerrarían con el filtro aplicado, que es justamente el requisito del
diseño ("los números tienen que cerrar").

Para no inventar un tercer vocabulario de estados, la clasificación de cada agenda es la misma
que la del libro de agendas del closer: `derivar_estado` de `closer_agendas_service`. Así lo que
el director ve en Revisar es, fila por fila, lo mismo que el closer ve en "Mi cartera → Agendas".

Definiciones (una sola vez, acá)
--------------------------------
  · `realizadas`  agendas con resultado de asistencia (asistió + no show). NO incluye canceladas
                  ni reagendadas: esa llamada no ocurrió, y meterlas en el denominador diluye la
                  tasa. Mismo criterio que `CloserService.percentages.show_rate` ("sobre llamadas
                  concluidas"), para que el show up de este tablero y el de "Ver mis datos" den
                  el mismo número.
  · `show_up`     asistieron / realizadas.
  · `close_rate`  ventas / asistieron. "Venta" es una agenda cuyo lead tiene un pago completo o
                  un split pay (`REAL_SALE_TIPOS`). La seña NO: esa agenda queda como "Seña" y
                  solo suma en las tasas "con señas" (`close_rate_con_senas`, ver
                  `closer_service.matriz_de_cierres`).
  · `cash`        suma de `FinancialSale.monto` del período (incluye cuotas y señas: es cash
                  cobrado, no ventas nuevas).
  · `ventas`      solo las filas cuyo tipo canónico es una venta de verdad (completo/parcial);
                  la seña es una reserva y la cuota es el cobro de una venta anterior.
  · `ticket`      cash / ventas.
  · `comision`    cash neto (ya descontadas las fees) × la tasa de `CommissionService`.
  · `retraso`     días desde la reunión para una agenda que ya pasó y sigue sin resultado.
"""
from datetime import date, datetime, time

from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app import db
from app.models import Appointment, Client, FinancialSale, LeadAnswer, ManychatLead, User
from app.services.closer_agendas_service import CloserAgendasService, derivar_estado
from app.services.closer_dashboard_service import CloserDashboardService
from app.services.closer_name_service import resolver_nombre_closer
from app.services.commission_service import cash_neto_de
from app.services.setter_assignment_service import _variantes_guardadas, normalizar_nombre

ROL_CLOSERS = 'closers'
ROL_SETTERS = 'setters'
ROLES = (ROL_CLOSERS, ROL_SETTERS)

# Días que una seña puede quedar sin convertirse antes de que el tablero la cuente como caída en
# vez de "en espera". No hay ninguna columna que marque una seña perdida: la única señal real es
# que pasó el tiempo y el lead nunca completó el pago. 30 días es el mismo horizonte con el que
# `archive_stale_backlog` da por muerto un lead sin actividad.
DIAS_SENA_CAIDA = 30

# Valores de `LeadAnswer.qualification` que significan "el lead todavía no contestó". Misma lista
# que usa la bandeja del setter (`get_cualificacion_stats` en app/api/setter.py).
SIN_RESPUESTA = ('', 'null', 'none', 'undefined')

# --- Vocabulario de estados que muestra el dashboard ------------------------------------------
# `tone` es uno de los 5 estados del design system (success/warning/error/info/idle): el frontend
# no elige colores, los toma de acá.

PRE_CALL = [
    {'key': 'confirmada', 'label': 'Confirmada', 'tone': 'info'},
    {'key': 'sin_confirmar', 'label': 'Sin confirmar', 'tone': 'idle'},
    {'key': 'cancelo', 'label': 'Canceló', 'tone': 'error'},
]

# Los estados que un humano puede FIJAR a mano desde el modal salen del mismo vocabulario que ya
# usa el mazo del closer (`closer_result`). El diseño original listaba además "Venta",
# "Seguimiento" y "Presentó, no cerró" como opciones editables; acá no lo son a propósito:
#   · "Venta" no es un estado de la agenda sino la existencia de una `FinancialSale` cruzada por
#     contacto. Ponerlo a mano marcaría una venta que no existe en la contabilidad.
#   · "Seguimiento" lo escribe el flujo de seguimientos del closer, con su tipo y su fecha.
#   · "Seña" es lo mismo que "Venta" pero con una seña como único pago: tampoco es una columna.
# Todos se siguen MOSTRANDO (son estados derivados, ver `post_call_de`), solo que se corrigen
# donde se generan.
POST_CALL = [
    {'key': 'pendiente', 'label': 'Pendiente', 'tone': 'idle', 'editable': True},
    {'key': 'asistio', 'label': 'Asistió', 'tone': 'success', 'editable': True},
    {'key': 'no_show', 'label': 'No show', 'tone': 'error', 'editable': True},
    {'key': 'reagendo', 'label': 'Reagendó', 'tone': 'info', 'editable': True},
    {'key': 'cancelo', 'label': 'Canceló', 'tone': 'idle', 'editable': True},
    {'key': 'segunda_llamada', 'label': '2da llamada', 'tone': 'info', 'editable': True},
    {'key': 'venta', 'label': 'Venta', 'tone': 'success', 'editable': False},
    # El lead dejó una seña y todavía no tiene un pago completo ni un split pay. No es "Venta":
    # si lo fuera, la tabla, los totales y el close rate contarían una reserva como un cierre.
    {'key': 'sena', 'label': 'Seña', 'tone': 'warning', 'editable': False},
    {'key': 'seguimiento', 'label': 'Seguimiento', 'tone': 'warning', 'editable': False},
    {'key': 'presento_no_cerro', 'label': 'Presentó, no cerró', 'tone': 'warning', 'editable': False},
]

ESTADO_LEAD = [
    {'key': 'agendo', 'label': 'Agendó', 'tone': 'success'},
    # Reservó, pero no con el setter que se está mirando: con otro setter, en un taller o por un
    # closer (ver `ComercialService.leads`). No suma en "Agendaron" y tampoco es "Sin respuesta":
    # el setter tiene que poder ver por qué un lead que sabe que agendó no le cuenta.
    {'key': 'agendo_otra_via', 'label': 'Agendó por otra vía', 'tone': 'idle'},
    {'key': 'en_conversacion', 'label': 'En conversación', 'tone': 'info'},
    {'key': 'sin_respuesta', 'label': 'Sin respuesta', 'tone': 'warning'},
    {'key': 'descartado', 'label': 'Descartado', 'tone': 'error'},
]

# Estado de un cliente de la cartera. No sale de una columna: se deriva de la deuda y de la
# proxima cuota, con el mismo orden de urgencia con el que `_sort_by_urgency` ordena la cartera
# del closer (vencida primero, despues por vencer, despues deuda sin plan armado, despues al dia).
ESTADO_CARTERA = [
    {'key': 'vencida', 'label': 'Cuota vencida', 'tone': 'error'},
    {'key': 'por_vencer', 'label': 'Con deuda', 'tone': 'warning'},
    # "Sin cronograma" y no "Debe, sin plan": es el mismo nombre con el que ya aparece en el panel
    # de cuotas (`Analizar.jsx`) y en el dashboard del closer, y es un estado distinto de "Con
    # deuda" — el que debe y tiene cuotas hay que cobrarlo, el que debe y no tiene cronograma
    # primero hay que armárselo. Confundirlos deja plata sin agenda de cobro.
    {'key': 'sin_plan', 'label': 'Sin cronograma', 'tone': 'warning'},
    {'key': 'al_dia', 'label': 'Al día', 'tone': 'success'},
    # Se fue del programa (`baja_service`): no debe nada y no se le cobra, pero lo que pagó es de la
    # cartera. No es "Al día" —no terminó de pagar— y la tabla lo saca del listado por defecto:
    # se lo ve en su propio filtro.
    {'key': 'baja', 'label': 'Dado de baja', 'tone': 'idle'},
]

TIPOS_PAGO = [
    {'key': 'completo', 'label': 'Pago completo', 'tone': 'success'},
    {'key': 'parcial', 'label': 'Split Pay', 'tone': 'info'},
    {'key': 'cuota', 'label': 'Cuotas', 'tone': 'idle'},
    {'key': 'seña', 'label': 'Depósitos', 'tone': 'warning'},
]

_LABELS = {'pre_call': {e['key']: e for e in PRE_CALL},
           'post_call': {e['key']: e for e in POST_CALL},
           'estado': {e['key']: e for e in ESTADO_LEAD},
           'estado_cartera': {e['key']: e for e in ESTADO_CARTERA},
           'tipo_pago': {e['key']: e for e in TIPOS_PAGO}}

# Estado del libro de agendas -> estado post call de este tablero, para los que no dependen de si
# hubo venta o seguimiento (esos se resuelven en `post_call_de`).
_ESTADO_A_POST_CALL = {
    'no_show': 'no_show',
    'segunda_llamada': 'segunda_llamada',
    'reagendada': 'reagendo',
    'cancelada': 'cancelo',
    'por_confirmar': 'pendiente',
    'confirmada': 'pendiente',
    'sin_reportar': 'pendiente',
    'reportada_sin_resultado': 'pendiente',
    # "Lead perdido" y "No lead" se mostraban como "Otro estado", un rótulo que no decía nada.
    # Desde el 02/10/2026 (pedido del usuario) cuentan como pendientes: en el panel y en la tabla
    # caen en "Sin reporte" si la llamada ya pasó. No suman a las realizadas, igual que antes.
    'lead_perdido': 'pendiente',
    'no_lead': 'pendiente',
}

# Valor que se escribe en la base al corregir el estado desde el modal.
PRE_CALL_A_RESULT = {'confirmada': 'Confirmado', 'sin_confirmar': 'Pendiente', 'cancelo': 'Cancelado'}
POST_CALL_A_CLOSER_RESULT = {'pendiente': 'Pendiente', 'asistio': 'Show up', 'no_show': 'No Show',
                             'reagendo': 'Reagendado', 'cancelo': 'Cancelado', 'segunda_llamada': '2da call'}

# Post call que cuentan como "la llamada ocurrió y el lead estaba del otro lado".
ASISTIO = ('asistio', 'venta', 'sena', 'seguimiento', 'presento_no_cerro', 'segunda_llamada')
# Post call que implican que la oferta se presentó aunque nadie haya tildado el campo: no se puede
# comprar ni dejar una seña sin haber visto el precio.
PRESENTO = ('venta', 'sena', 'presento_no_cerro')
# Post call con resultado de asistencia: el denominador del show up (ver el docstring del módulo).
REALIZADAS = ASISTIO + ('no_show',)


def no_es_marcador():
    """Condición SQL: la cita NO es el marcador que deja cualificar un lead en el mazo del setter.

    Confirmar un lead de ManyChat como cualificado (`/setter/deck/confirm-qualified` y sus dos
    hermanas en app/api/setter.py) crea un `Appointment` con `result='Cualificado'`, el
    `setter_id` del setter y la hora del clic como reunión, sin ninguna reserva detrás: es lo que
    `setter_agendas.py` ya documenta como placeholder. Contarlo haría de cada lead cualificado una
    "agenda generada" y un "Agendó". `coalesce` porque un `result` vacío es una agenda de verdad.
    """
    return func.lower(func.coalesce(Appointment.result, '')) != 'cualificado'


def _limpiar_email(valor):
    v = (valor or '').strip().lower()
    return v if v and v != 'n/a' and '@' in v else None


def _limpiar_ig(valor):
    v = (valor or '').strip().lstrip('@').lower()
    return v if v and v != 'n/a' else None


def _ultimos8(valor):
    digitos = ''.join(c for c in str(valor or '') if c.isdigit())
    return digitos[-8:] if len(digitos) >= 8 else None


def clientes_de_ventas(ventas):
    """{id de venta -> client_id}, cruzando por contacto las ventas que no lo tienen guardado.

    `FinancialSale.client_id` existe desde que `SheetsService.post_to_sheets` resuelve el Client
    antes de guardar la venta, pero las anteriores quedaron sin él: en la base local son 711 de
    897 (79%). Sin cruzarlas, la fila de la tabla Ventas no sabe a quién abrirle la ficha y cae
    al modal viejo — o sea que el modal nuevo no se vería casi nunca desde Ventas.

    El cruce es el MISMO que usa `BookingService.create_or_update_client` para decidir a qué
    cliente pertenece un contacto, y en el mismo orden de precedencia: email, después instagram,
    después los últimos 8 dígitos del teléfono. Inventar acá otro criterio haría que la ficha
    abriera un cliente distinto del que el resto del sistema considera dueño de esa venta.

    **Un índice, no una consulta por fila.** `ventas()` devuelve cientos de filas por período y
    esto corre en cada pedido de la tabla: buscar el cliente de cada venta por separado sería el
    N+1 que ya hace lento a `_resolve_sales_and_clients`. Se leen las tres columnas de contacto
    de todos los clientes UNA vez (5.638 filas en la base local) y se arma el índice en memoria.

    `order_by(Client.id)` + `setdefault` reproduce el `.first()` de `create_or_update_client`
    cuando dos clientes comparten un contacto: gana el más viejo, que es el que esa función
    encuentra primero.

    Las que no se cruzan por ninguna de las tres vías no entran en el mapa (30 de 897 en la base
    local): esa fila se queda con el modal viejo, que es lo único honesto — no hay cliente al que
    abrirle la ficha.
    """
    mapa = {v.id: v.client_id for v in ventas if v.client_id}
    pendientes = [v for v in ventas if not v.client_id]
    if not pendientes:
        return mapa

    por_email, por_ig, por_tel = {}, {}, {}
    for cid, email, ig, telefono in (db.session.query(
            Client.id, Client.email, Client.instagram, Client.phone)
            .order_by(Client.id).all()):
        # El correo sintético que inventa `BookingService` cuando el lead llegó sin ninguno no
        # identifica a nadie: dos clientes distintos jamás comparten uno, pero tampoco sirve
        # para reconocer a este.
        limpio = _limpiar_email(email)
        if limpio and 'no-email-' not in limpio:
            por_email.setdefault(limpio, cid)
        ig_limpio = _limpiar_ig(ig)
        if ig_limpio:
            por_ig.setdefault(ig_limpio, cid)
        tel = _ultimos8(telefono)
        if tel:
            por_tel.setdefault(tel, cid)

    for v in pendientes:
        tel = _ultimos8(v.telefono)
        encontrado = (por_email.get(_limpiar_email(v.mail_cliente) or '')
                      or por_ig.get(_limpiar_ig(v.instagram) or '')
                      or (por_tel.get(tel) if tel else None))
        if encontrado:
            mapa[v.id] = encontrado
    return mapa


def pre_call_de(appt):
    """Etapa de confirmación de la agenda, a partir de `Appointment.result`."""
    res = (appt.result or '').strip().lower()
    if res in ('cancelado', 'cancelada'):
        return 'cancelo'
    if res == 'confirmado':
        return 'confirmada'
    return 'sin_confirmar'


def post_call_de(estado, con_venta, con_seguimiento, con_sena=False):
    """Resultado de la llamada. `estado` es el del libro de agendas (`derivar_estado`).

    Los estados derivados salen de acá y no de una columna: una agenda con asistencia es "Venta"
    si el lead tiene un pago completo o un split pay cruzado, "Seña" si lo único que dejó es una
    seña, "Seguimiento" si quedó un seguimiento abierto, y si no, "Presentó, no cerró" — que es
    lo que efectivamente pasó cuando alguien asistió y no hay ni venta ni seguimiento.

    La seña va antes que el seguimiento porque dice más: quien dejó una seña casi siempre tiene
    además un seguimiento abierto (para completar el pago), y "Seguimiento" escondería que ya
    hubo un compromiso de compra."""
    if estado == 'show_up':
        if con_venta:
            return 'venta'
        if con_sena:
            return 'sena'
        if con_seguimiento:
            return 'seguimiento'
        return 'presento_no_cerro'
    return _ESTADO_A_POST_CALL.get(estado, 'pendiente')


def chip(grupo, key):
    """{key, label, tone} para que el frontend no tenga su propia copia del vocabulario."""
    dato = _LABELS[grupo].get(key) or {'key': key, 'label': str(key), 'tone': 'idle'}
    return {'key': dato['key'], 'label': dato['label'], 'tone': dato['tone']}


def pct(numerador, denominador):
    """Porcentaje con un decimal, o None si no hay denominador. None se muestra como "—": un 0%
    inventado sobre cero casos es una afirmación falsa sobre el rendimiento."""
    return round(numerador / denominador * 100, 1) if denominador else None


class ComercialService:

    # --- Período y alcance --------------------------------------------------------------------

    @staticmethod
    def rango(period, start_date=None, end_date=None):
        """Mismos ids de período que "Ver mis datos" y el libro de agendas, a propósito: "Este
        mes" tiene que significar lo mismo en las tres pantallas."""
        return CloserDashboardService._range_for_period(period, start_date, end_date)

    @staticmethod
    def rango_comparado(start, end, compare, compare_start=None, compare_end=None):
        return CloserDashboardService._comparison_range(start, end, compare, compare_start, compare_end)

    @staticmethod
    def miembros(rol):
        """Las personas del equipo que el selector muestra, en orden alfabético."""
        role = 'closer' if rol == ROL_CLOSERS else 'setter'
        usuarios = User.query.filter_by(role=role, is_active=True).order_by(User.username).all()
        return [{'id': u.id, 'nombre': u.username, 'rol': role} for u in usuarios]

    @staticmethod
    def fecha_o_hoy(valor):
        """Una fecha ISO del request, o hoy. Un valor que no parsea cae a hoy en vez de romper:
        el peor caso es que el director vea el día equivocado, no un 500."""
        try:
            return date.fromisoformat(str(valor)[:10]) if valor else date.today()
        except (TypeError, ValueError):
            return date.today()

    @staticmethod
    def nombre_de(miembro_id):
        """El username de una persona del equipo, o None. Es con lo que se acotan las ventas y
        los leads, que se guardan por nombre y no por id."""
        miembro = User.query.get(miembro_id) if miembro_id else None
        return miembro.username if miembro else None

    @staticmethod
    def _limites(start, end):
        return datetime.combine(start, time.min), datetime.combine(end, time.max)

    # --- Agendas ------------------------------------------------------------------------------

    @staticmethod
    def agendas(start, end, closer_id=None, setter_id=None, basis='meet', de_setters=False):
        """Filas de la tabla "Agendas" (y de "Agendas generadas" cuando se acota por setter).

        `basis='creacion'` filtra por cuándo se creó la agenda en vez de por cuándo cae la
        reunión — es el toggle "Fecha meet / F. creación" de la barra de Revisar.

        `de_setters=True` deja solo las agendas que generó un setter: es "Agendas generadas" del
        equipo de setting. Sin eso, "Todo el equipo" con Setters contaba TODAS las agendas del
        período, también las de taller, VSL o landing que no generó ningún setter (en septiembre
        de 2026, 237 contra 129 de verdad). Con un `setter_id` no cambia nada: ya es suya. Tampoco
        entra el marcador que deja cualificar un lead, que no es una reserva (`no_es_marcador`).
        """
        desde, hasta = ComercialService._limites(start, end)
        columna = Appointment.created_at if basis == 'creacion' else Appointment.start_time

        q = Appointment.query.options(
            joinedload(Appointment.client), joinedload(Appointment.closer), joinedload(Appointment.setter)
        ).filter(columna >= desde, columna <= hasta)
        if closer_id:
            q = q.filter(Appointment.closer_id == closer_id)
        if setter_id:
            q = q.filter(Appointment.setter_id == setter_id)
        elif de_setters:
            q = q.filter(Appointment.setter_id.in_(
                db.session.query(User.id).filter(User.role == 'setter')))
        if de_setters:
            q = q.filter(no_es_marcador())

        appts = q.order_by(Appointment.start_time.desc(), Appointment.id.desc()).all()
        if not appts:
            return []

        # Cruce agenda -> venta en una sola pasada (mismo criterio que el libro de agendas del
        # closer: email o instagram del cliente contra FinancialSale, más las ventas atadas al
        # cliente por id), pero sabiendo el TIPO de cada pago: "Venta" es solo un pago completo o
        # un split pay. Antes cualquier fila cruzada la marcaba como venta, así que un lead que
        # solo había dejado una seña (o una cuota, o una renovación) contaba como cierre en la
        # tabla, en los totales y en el close rate.
        from app.services.closer_service import REAL_SALE_TIPOS
        tipos_email, tipos_ig, tipos_id = CloserAgendasService._tipos_por_contacto(appts)

        hoy = date.today()
        ahora = datetime.utcnow()
        filas = []
        for a in appts:
            cliente = a.client
            mail = _limpiar_email(cliente.email) if cliente else None
            ig = _limpiar_ig(cliente.instagram) if cliente else None
            tipos = tipos_email.get(mail, set()) | tipos_ig.get(ig, set()) | tipos_id.get(a.client_id, set())
            con_venta = any(t in REAL_SALE_TIPOS for t in tipos)
            # Qué venta es, para el desglose pago completo / split pay del panel Cierre. Una agenda
            # cuenta UNA venta aunque el lead tenga las dos (dos programas): manda el pago
            # completo, y así completo + split siempre suma las agendas en "Venta".
            venta_tipo = ('completo' if 'completo' in tipos else 'parcial') if con_venta else None
            con_sena = 'seña' in tipos
            con_seguimiento = bool(a.seguimiento_tipo or a.fecha_seguimiento) and not a.seguimiento_realizado

            estado = derivar_estado(a, ahora)
            post = post_call_de(estado, con_venta, con_seguimiento, con_sena=con_sena)
            pre = pre_call_de(a)

            # Días sin reportar: solo para una llamada que ya pasó y sigue sin resultado.
            retraso = 0
            if post == 'pendiente' and a.start_time and a.start_time.date() < hoy:
                retraso = (hoy - a.start_time.date()).days

            filas.append({
                'id': a.id,
                'tipo': 'agenda',
                'creada': a.created_at.isoformat() if a.created_at else None,
                'fecha': a.start_time.isoformat() if a.start_time else None,
                'cliente': (cliente.full_name or cliente.email or 'Sin nombre') if cliente else 'Sin cliente',
                'ig': (cliente.instagram or '') if cliente else '',
                'email': (cliente.email or '') if cliente else '',
                'telefono': (cliente.phone or '') if cliente else '',
                'client_id': a.client_id,
                'fuente': a.origin or 'Sin fuente',
                'closer': a.closer.username if a.closer else 'Sin closer',
                'closer_id': a.closer_id,
                'setter': a.setter.username if a.setter else '',
                'setter_id': a.setter_id,
                'pre_call': chip('pre_call', pre),
                'post_call': chip('post_call', post),
                'estado_libro': estado,
                'asistio': post in ASISTIO,
                'realizada': post in REALIZADAS,
                'presento': post in PRESENTO or bool(a.offer_presented),
                'retraso_dias': retraso,
                # `con_venta`: pago completo o split pay. `con_sena`: dejó una seña (tenga o no,
                # además, una venta: la seña que después se completó sigue siendo una seña).
                'con_venta': con_venta,
                'venta_tipo': venta_tipo,
                'con_sena': con_sena,
            })
        return filas

    @staticmethod
    def generadas(start, end, setter_id=None, basis='creacion'):
        """Filas de "Agendas generadas": el trabajo de un setter (o del equipo de setting).

        Se cuentan por la fecha en que se CREÓ la agenda, no por la de la reunión: lo que hizo el
        setter en el período es reservarla, y la reunión puede caer semanas después. Por fecha de
        reunión, una agenda reservada el 28/09 para el 03/10 no le contaba a nadie en septiembre
        y sí en octubre, cuando el setter ya no hizo nada (septiembre de 2026: Paula 51 por
        reunión contra 59 por creación). `basis='meet'` queda para el toggle de Revisar.

        Es la única puerta a estas filas: el bloque de Analizar, la serie de Variabilidad y la
        tabla de Revisar la usan las tres, así que el número y la lista no pueden divergir.

        **Una persona cuenta una vez por setter** (ver `_una_por_persona`): el total, el show up y
        las ventas originadas salen de las filas ya depuradas, y la tabla devuelve esas mismas.
        """
        filas = ComercialService.agendas(start, end, setter_id=setter_id, basis=basis, de_setters=True)
        return ComercialService._una_por_persona(filas)

    @staticmethod
    def _una_por_persona(filas):
        """Deja UNA agenda por lead y por setter: la más reciente.

        Un lead que reagenda tiene dos o tres agendas del mismo setter en el período, y cada una
        sumaba como una agenda generada más: el setter consiguió UNA persona, no tres (septiembre
        de 2026, por fecha de creación: 136 agendas del equipo eran 124 personas). Se queda la
        más reciente porque su resultado es el vigente; las anteriores son la historia de esa
        misma persona.

        "Más reciente" es la de la reunión más reciente, no la última que se creó: la
        sincronización crea a veces de una vez agendas de reuniones ya pasadas, y en producción
        hay dos del mismo lead creadas en el mismo minuto para el 24/08 y el 27/08. El resultado
        vigente es el de la última llamada.

        **Salvo que una de ellas sea la venta (o la seña):** esa gana aunque haya otra más nueva.
        La persona compró, y eso es lo que el setter originó; una agenda posterior que nadie
        reportó no puede borrarlo. En producción (septiembre de 2026) un lead de Elias compró en
        la llamada del 07/09 y tenía otra agenda del 15/09 sin resultado: quedándose con la más
        reciente, sus ventas originadas bajaban de 5 a 4 sin que nadie hubiera dejado de comprar.

        La clave es (setter, cliente) y no solo el cliente: un lead que agendaron dos setters
        distintos les cuenta a los dos, y así el total del equipo es la suma de sus setters.
        """
        def persona(fila):
            return (fila['setter_id'], fila['client_id'])

        cierre = {'venta': 2, 'sena': 1}

        def reciente(fila):
            return (cierre.get(fila['post_call']['key'], 0),
                    fila['fecha'] or '', fila['creada'] or '', fila['id'])

        ultima = {}
        for fila in filas:
            vigente = ultima.get(persona(fila))
            if vigente is None or reciente(fila) > reciente(vigente):
                ultima[persona(fila)] = fila
        # Se filtra la lista original en vez de devolver `ultima`: así queda el orden de la tabla.
        return [f for f in filas if ultima[persona(f)] is f]

    # --- Ventas -------------------------------------------------------------------------------

    @staticmethod
    def clasificar_venta(venta):
        """(programa, tipo canónico, es_venta_real) de una fila de `FinancialSale`, con el mismo
        parseo que usa el resto del sistema (`SheetsService.parse_tipo_pago`)."""
        from app.services.closer_service import PROGRAM_LABELS, REAL_SALE_TIPOS, _program_from_examen
        from app.services.sheets_service import SheetsService

        codigo, tipo = SheetsService.parse_tipo_pago(venta.tipo_pago)
        programa = PROGRAM_LABELS.get(codigo) or _program_from_examen(venta.examen) or 'Sin programa'
        return programa, (tipo or 'otro'), (tipo in REAL_SALE_TIPOS)

    @staticmethod
    def ventas(start, end, closer_nombre=None):
        """Filas de la tabla "Ventas". El cash del período sale de estas mismas filas."""
        desde, hasta = ComercialService._limites(start, end)
        q = FinancialSale.query.filter(FinancialSale.date >= desde, FinancialSale.date <= hasta)

        # El cliente de cada venta, para que la fila pueda abrir la ficha unificada. Se resuelve
        # en bloque ANTES del bucle: adentro sería una consulta por fila.
        del_periodo = [v for v in q.order_by(FinancialSale.date.desc(), FinancialSale.id.desc()).all()
                       if (v.estado or '').strip().lower() in ('', 'completada', 'confirmada')]
        clientes = clientes_de_ventas(del_periodo)

        filas = []
        for v in del_periodo:
            nombre = resolver_nombre_closer(v.email_vendedor)
            if closer_nombre and normalizar_nombre(nombre) != normalizar_nombre(closer_nombre):
                continue
            programa, tipo, es_venta = ComercialService.clasificar_venta(v)
            monto = float(v.monto or 0.0)
            filas.append({
                'id': v.id,
                'tipo': 'venta',
                # `None` cuando la venta no se pudo cruzar con ningún cliente: esa fila sigue
                # abriendo el modal viejo, porque no hay ficha que abrir.
                'client_id': clientes.get(v.id),
                'fecha': v.date.isoformat() if v.date else None,
                'creada': v.created_at.isoformat() if v.created_at else None,
                'cliente': v.nombre_cliente or 'Sin nombre',
                'ig': v.instagram or '',
                'email': v.mail_cliente or '',
                'telefono': v.telefono or '',
                'programa': programa,
                'tipo_pago': chip('tipo_pago', tipo),
                'tipo_pago_raw': (v.tipo_pago or '').strip() or 'Sin tipo',
                'es_venta': es_venta,
                'monto': round(monto, 2),
                'monto_neto': round(cash_neto_de(monto, v.metodo_pago), 2),
                'metodo': v.metodo_pago or 'Sin método',
                'closer': nombre,
                'setter': v.setter or '',
                # Se completa abajo: en qué terminó esta seña. `None` en cualquier fila que no sea
                # una seña, para que la clave no falte nunca y el frontend no tenga que preguntar.
                'sena_estado': None,
            })

        # En qué terminó cada seña, con la MISMA función que cuenta el panel Señas. Sin esto la
        # tabla Ventas no sabía cortar por eso: el panel decía "3 caídas" y no había forma de ver
        # cuáles eran. Se resuelve acá y no en el frontend porque hace falta buscar la venta
        # posterior del mismo contacto, que el frontend no tiene.
        from app.services.comercial_analitica import clasificar_senas
        filas_por_id = {f['id']: f for f in filas}
        for fila_id, dato in clasificar_senas(filas).items():
            filas_por_id[fila_id]['sena_estado'] = dato['estado']
        ComercialService._con_academia(filas)
        return filas

    @staticmethod
    def _con_academia(filas):
        """Le agrega a cada fila la foto de la Academia de su cliente (`fila['academia']`).

        Es lo que deja filtrar y ordenar Clientes y Ventas por lo que el alumno hace en la Academia
        (ver `academy_snapshot_service`). Se lee de la foto guardada, nunca de la Academia en vivo,
        y en UNA consulta para todas las filas. Una venta que no se cruza con ningun cliente queda
        en None: no hay alumno que buscar.
        """
        from app.services.academy_snapshot_service import bloques_por_cliente

        bloques = bloques_por_cliente([f['client_id'] for f in filas if f.get('client_id')])
        for fila in filas:
            fila['academia'] = bloques.get(fila.get('client_id'))

    # --- Leads entrantes del setter -----------------------------------------------------------

    @staticmethod
    def _setter_id_de(nombre):
        """El id del usuario setter que se llama `nombre`, comparando normalizado.

        Los leads se atribuyen por NOMBRE (`ManychatLead.setter`, lo escribe ManyChat) y las
        agendas por id (`Appointment.setter_id`): esto es el puente, para quien pida los leads de
        un setter con el nombre solo.
        """
        buscado = normalizar_nombre(nombre)
        return next((u.id for u in User.query.filter_by(role='setter').order_by(User.id).all()
                     if normalizar_nombre(u.username) == buscado), None)

    @staticmethod
    def leads(start, end, setter_nombre=None, setter_id=None):
        """Filas de la tabla "Leads entrantes": los prospectos de ManyChat del período.

        El estado no es una columna: se deriva de lo que hizo el lead, con el mismo orden de
        prioridad con el que lo lee la bandeja del setter — agendó (tiene una cita), lo
        descartaron (su cualificación dio que no), viene conversando (contestó al menos una
        pregunta) o no contestó nunca.

        **"Agendó" es agendar con ESE setter** (decisión del 01/10/2026): el lead del período
        cuyo instagram es el de un cliente con una cita que generó ese setter (`setter_id`). Con
        el equipo entero, una cita que generó cualquier setter. Antes alcanzaba con CUALQUIER
        cita, así que a un setter le contaban como suyos los leads que reservaron con otro setter,
        en un taller o por un closer. Esos quedan como "Agendó por otra vía": reservaron, pero no
        le cuentan.

        `setter_id` es la persona de la que se miden las citas; si no viene, sale del nombre.
        """
        desde, hasta = ComercialService._limites(start, end)
        q = ManychatLead.query.filter(ManychatLead.created_at >= desde, ManychatLead.created_at <= hasta)
        if setter_nombre:
            variantes = _variantes_guardadas(setter_nombre)
            if not variantes:
                return []
            q = q.filter(ManychatLead.setter.in_(variantes))

        leads = q.order_by(ManychatLead.created_at.desc()).all()
        if not leads:
            return []

        ids = [l.id for l in leads]
        # Respuestas por lead: cuántas interacciones tiene, si contestó alguna de verdad, y si
        # alguna lo cualificó (o lo descartó).
        #
        # "Respondió" NO es "tiene una interacción registrada": todo lead de ManyChat nace con
        # una, así que con ese criterio la tasa de respuesta daba 100% siempre y no informaba
        # nada. Se usa el mismo que la bandeja del setter (`get_cualificacion_stats`): una
        # cualificación vacía —'null', '' o 'undefined'— es justamente un lead que no contestó.
        respuestas = {}
        for lead_id, qualification in db.session.query(LeadAnswer.lead_id, LeadAnswer.qualification) \
                .filter(LeadAnswer.lead_id.in_(ids)).all():
            datos = respuestas.setdefault(
                lead_id, {'total': 0, 'respondio': False, 'cualificado': False, 'descartado': False})
            datos['total'] += 1
            valor = (qualification or '').strip().lower()
            if valor not in SIN_RESPUESTA:
                datos['respondio'] = True
            if valor in ('yes', 'true'):
                datos['cualificado'] = True
            elif valor in ('no', 'false'):
                datos['descartado'] = True

        # Leads que llegaron a agendar: se cruzan por instagram contra los clientes con cita, y de
        # cada cita se mira quién la generó. `con_cita` es cualquier cita; `agendados`, solo las
        # que cuentan para quien se está mirando (ver el docstring).
        if setter_nombre and setter_id is None:
            setter_id = ComercialService._setter_id_de(setter_nombre)
        if setter_nombre or setter_id:
            propios = {setter_id} if setter_id else set()
        else:
            propios = {uid for (uid,) in db.session.query(User.id).filter(User.role == 'setter')}

        igs = sorted({ig for ig in (_limpiar_ig(l.ig) for l in leads) if ig})
        con_cita, agendados = set(), set()
        if igs:
            ig_cliente = func.lower(func.replace(Client.instagram, '@', ''))
            for ig, generada_por in db.session.query(ig_cliente, Appointment.setter_id).join(
                    Appointment, Appointment.client_id == Client.id).filter(
                    ig_cliente.in_(igs), no_es_marcador()).distinct():
                con_cita.add(ig)
                if generada_por in propios:
                    agendados.add(ig)

        salida = []
        vacio = {'total': 0, 'respondio': False, 'cualificado': False, 'descartado': False}
        for l in leads:
            ig = _limpiar_ig(l.ig)
            datos = respuestas.get(l.id, vacio)
            agendo = ig in agendados
            if agendo:
                estado = 'agendo'
            elif ig in con_cita:
                estado = 'agendo_otra_via'
            elif datos['descartado']:
                estado = 'descartado'
            elif datos['respondio']:
                estado = 'en_conversacion'
            else:
                estado = 'sin_respuesta'
            salida.append({
                'id': l.id,
                'tipo': 'lead',
                'fecha': l.created_at.isoformat() if l.created_at else None,
                'creada': l.created_at.isoformat() if l.created_at else None,
                'cliente': l.name or 'Sin nombre',
                'ig': l.ig or '',
                'email': '',
                'telefono': '',
                'fuente': 'ManyChat',
                'setter': l.setter or 'Sin asignar',
                'estado': chip('estado', estado),
                'mensajes': datos['total'],
                'respondio': datos['respondio'],
                'cualificado': datos['cualificado'],
                'agendo': agendo,
                'ultimo': l.updated_at.isoformat() if l.updated_at else None,
            })
        return salida

    # --- Totales de lo filtrado ---------------------------------------------------------------

    @staticmethod
    def totales_agendas(filas):
        """Las 6 tarjetas de "Totales de lo filtrado". Se calcula sobre las filas que el usuario
        está viendo, no sobre todo el período: es el requisito de que los números cierren con el
        filtro aplicado."""
        realizadas = [f for f in filas if f['realizada']]
        asistieron = [f for f in filas if f['asistio']]
        ventas = [f for f in filas if f['post_call']['key'] == 'venta']
        # Asistieron y dejaron una seña, sin pago completo ni split pay. No son ventas: entran
        # solo en `close_rate_con_senas`.
        senas = [f for f in filas if f['post_call']['key'] == 'sena']
        seguimiento = [f for f in filas if f['post_call']['key'] in ('seguimiento', 'presento_no_cerro')]
        no_show = [f for f in filas if f['post_call']['key'] == 'no_show']
        pendientes = [f for f in filas if f['post_call']['key'] == 'pendiente']
        con_retraso = [f for f in pendientes if f['retraso_dias'] > 0]

        return {
            'agendas': len(filas),
            'realizadas': len(realizadas),
            'asistieron': len(asistieron),
            'show_up': pct(len(asistieron), len(realizadas)),
            'ventas': len(ventas),
            # El desglose de esas ventas (ver `venta_tipo` en `agendas`): suman `ventas` exacto.
            'ventas_completo': sum(1 for f in ventas if f.get('venta_tipo') == 'completo'),
            'ventas_split': sum(1 for f in ventas if f.get('venta_tipo') != 'completo'),
            'close_rate': pct(len(ventas), len(asistieron)),
            'senas': len(senas),
            'close_rate_con_senas': pct(len(ventas) + len(senas), len(asistieron)),
            'seguimiento': len(seguimiento),
            'no_show': len(no_show),
            'no_show_pct': pct(len(no_show), len(realizadas)),
            'pendientes': len(pendientes),
            'pendientes_con_retraso': len(con_retraso),
            'retraso_max': max((f['retraso_dias'] for f in con_retraso), default=0),
        }

    # --- Clientes (cartera) -------------------------------------------------------------------

    @staticmethod
    def _atribucion_de_ventas(closer_id=None):
        """(de_quien, pedido) para atribuir cada venta a un closer.

        `de_quien` mapea email del vendedor -> nombre del closer, para no volver a consultar por
        cada fila; un email que no sea de ningún closer del sistema queda fuera, porque sin dueño
        la fila no se puede filtrar ni sumar a nadie.

        `pedido` es None cuando NO se acota a nadie, y un conjunto —posiblemente vacío— cuando sí.
        La distinción importa: un closer sin ninguna venta reconocible se acota a un conjunto
        vacío, no a "todas". Escrito como `pedido or de_quien`, un conjunto vacío es falsy y caía
        en la cartera completa del equipo, así que un closer recién entrado veía los clientes de
        todos con nombre y deuda.

        Vive aparte porque la tabla Clientes y el detalle de un cliente tienen que atribuir con
        exactamente la misma regla: si divergen, un closer podría abrir la ficha de un cliente
        que su propia tabla no le muestra.

        Los identificadores son los de `CloserService._resolve_sale_identifiers` (los de
        `identificadores_de_closer` para su username), pero leídos para todos de una vez: de a
        un closer era una consulta por cada uno, y cada una traía la lista entera de vendedores."""
        from app.models.user import ROLE_CLOSER
        from app.services.closer_name_service import identificadores_por_nombre

        por_nombre = identificadores_por_nombre()

        def identificadores(usuario):
            return por_nombre.get(usuario.username, []) if usuario and usuario.username else []

        de_quien = {}
        for usuario in User.query.filter(User.role == ROLE_CLOSER).all():
            for identificador in identificadores(usuario):
                de_quien[identificador.lower()] = usuario.username

        pedido = None
        if closer_id:
            usuario = User.query.get(closer_id)
            pedido = {e.lower() for e in identificadores(usuario)} if usuario else set()
        return de_quien, pedido

    @staticmethod
    def _vendedores_permitidos(de_quien, pedido):
        """Contra qué conjunto de emails se decide si una venta es "de quien pregunta"."""
        return de_quien if pedido is None else pedido

    @staticmethod
    def cliente(client_id, closer_id=None):
        """La ficha de cobro de UN cliente: lo mismo que su fila en la tabla Clientes, más su
        plan de cuotas completo y su historial de pagos.

        Existe para que el setter y la dirección comercial puedan ver en qué momento del cobro
        está un cliente sin pasar por los endpoints del closer, que además de exigir rol closer
        son los que además lo modifican. Acá no se escribe nada.

        La atribución es la misma que la de la tabla (ver `clientes`): a un closer solo se le
        deja abrir un cliente al que él le vendió. Devuelve None si el cliente no existe, no
        compró nada, o no es de quien pregunta."""
        from app.models import InstallmentPlan
        from app.services.closer_followup_service import CloserFollowUpService

        de_quien, pedido = ComercialService._atribucion_de_ventas(closer_id)
        permitidos = ComercialService._vendedores_permitidos(de_quien, pedido)

        ventas_por_cliente = CloserFollowUpService._resolve_sales_and_clients()
        ventas = ventas_por_cliente.get(client_id)
        if not ventas:
            return None
        if not [v for v in ventas if (v.email_vendedor or '').strip().lower() in permitidos]:
            return None

        cliente = Client.query.get(client_id)
        if not cliente:
            return None
        appt = (Appointment.query.filter_by(client_id=client_id)
                .order_by(Appointment.start_time.desc()).first())
        if not appt:
            appt = CloserFollowUpService._ensure_appointment_for_client(cliente)
        if not appt:
            return None

        item = CloserFollowUpService._build_cartera_item(client_id, cliente, appt, ventas_por_cliente)
        cuotas = (InstallmentPlan.query.filter_by(client_id=client_id)
                  .order_by(InstallmentPlan.fecha_vencimiento.asc()).all())
        return {'cliente': item, 'cuotas': [c.to_dict() for c in cuotas]}

    @staticmethod
    def clientes(closer_id=None):
        """Filas de la tabla "Clientes": todo cliente que el equipo ya vendió, con su programa,
        lo pagado, lo que debe y su próxima cuota.

        NO está acotada al período, y no puede estarlo sin cambiar de pregunta — es el mismo caso
        que `por_cobrar_de`: la cartera es un SALDO, no un flujo. "A quién le vendí" y "qué cobré
        del 1 al 30" son dos cosas distintas, y acotar la primera al período dejaría afuera
        justamente a los clientes que arrastran deuda de meses anteriores, que son los que hay que
        ir a cobrar. La tabla lo dice en su ayuda y los totales van rotulados "a hoy".

        La atribución es por QUIÉN VENDIÓ (`FinancialSale.email_vendedor`), no por quién tiene hoy
        la cita más reciente del cliente: es la misma regla que "Mi cartera" del closer, y existe
        porque la otra producía que closers activos vieran clientes de closers dados de baja
        (ver `CloserFollowUpService._cartera_items`, que arregló ese bug). Se reusan sus piezas en
        vez de rearmar el cálculo: la deuda, la próxima cuota y el desglose de pagos de un cliente
        tienen que dar lo mismo en las dos pantallas.

        **Todo en lote.** Esas piezas consultaban cliente por cliente: 5.682 consultas y 8,3 s
        para los 520 clientes de la base local, y la tabla "se queda pegada" (pedido del usuario,
        29/sep/2026). Ahora se leen de una `CarteraEnLote` —las mismas piezas, leyendo de otro
        lado— y la cantidad de consultas ya no depende de cuántos clientes haya.
        """
        from app.services.closer_followup_service import CarteraEnLote, CloserFollowUpService

        de_quien, pedido = ComercialService._atribucion_de_ventas(closer_id)
        permitidos = ComercialService._vendedores_permitidos(de_quien, pedido)

        ventas_por_cliente = CloserFollowUpService._resolve_sales_and_clients()
        propias_de = {}
        for cid, ventas in ventas_por_cliente.items():
            propias = [v for v in ventas
                       if (v.email_vendedor or '').strip().lower() in permitidos]
            if propias:
                propias_de[cid] = propias

        # El cliente comprado que nunca tuvo cita recibe su ancla, como siempre; se crean antes de
        # leer el lote porque cada una hace commit (ver `_anclar_clientes_sin_cita`).
        CloserFollowUpService._anclar_clientes_sin_cita(list(propias_de), ventas_por_cliente)
        # `cita_exacta=False`: la tabla no muestra nada de la cita, la necesita solo para armar el
        # item, así que entre dos citas empatadas en `start_time` da igual cuál.
        lote = CarteraEnLote(list(propias_de), cita_exacta=False)

        filas = []
        for cid, propias in propias_de.items():
            cliente = lote.clientes.get(cid)
            if not cliente:
                continue
            # `appt` es solo para los campos de display; cualquier cita del cliente sirve.
            appt = lote.ultima_cita.get(cid)
            if not appt:
                appt = CloserFollowUpService._ensure_appointment_for_client(cliente)
            item = CloserFollowUpService._build_cartera_item(cid, cliente, appt, ventas_por_cliente, lote=lote)

            propias.sort(key=lambda v: v.date or v.created_at or datetime.min)
            vendedor = de_quien.get((propias[0].email_vendedor or '').strip().lower())
            cuota = item['proxima_cuota']
            filas.append({
                'id': item['client_id'],
                'tipo': 'cliente',
                'client_id': item['client_id'],
                'cliente': item['lead_name'],
                'ig': item['instagram'],
                'email': cliente.email or '',
                'telefono': item['phone'],
                'fecha': item['enrollment_date'],
                'closer': vendedor or 'Sin closer',
                'programa': item['programa_nombre'] or 'Sin programa',
                'pagado': round(sum(pago['monto'] for pago in item['pagos']), 2),
                'deuda': round(item['deuda'], 2),
                'cobros': len(item['pagos']),
                'estado': chip('estado_cartera', ComercialService._estado_cartera(item)),
                'cuota_monto': cuota['monto'] if cuota else None,
                'cuota_fecha': cuota['fecha_vencimiento'] if cuota else None,
                'cuota_vencida': bool(cuota and cuota['vencida']),
                'cuota_numero': cuota['numero_cuota'] if cuota else None,
                # `{fecha, fecha_legible, motivo, por}` o None. La fila viaja igual —lo que pagó es
                # de la cartera y la tabla tiene un filtro "Dados de baja"—, pero el listado por
                # defecto la deja afuera (ver `tablasDef.js`).
                'baja': item['baja'],
            })

        ComercialService._con_academia(filas)
        filas.sort(key=lambda f: (-f['deuda'], f['cliente'].lower()))
        return filas

    @staticmethod
    def _estado_cartera(item):
        if item.get('baja'):
            return 'baja'
        cuota = item['proxima_cuota']
        if not cuota:
            return 'al_dia'
        if cuota['sin_plan']:
            return 'sin_plan'
        return 'vencida' if cuota['vencida'] else 'por_vencer'

    @staticmethod
    def totales_clientes(filas):
        """Los totales van rotulados "a hoy" en la pantalla: son un saldo, no un flujo del
        período (ver `clientes`).

        Un dado de baja no debe nada, pero tampoco está "al día": se cuenta aparte. Lo que pagó sí
        entra en `pagado`, que es plata cobrada."""
        con_deuda = [f for f in filas if f['deuda'] > 0.01]
        vencidas = [f for f in filas if f['cuota_vencida']]
        bajas = [f for f in filas if f.get('baja')]
        return {
            'clientes': len(filas),
            'al_dia': len(filas) - len(con_deuda) - len(bajas),
            'bajas': len(bajas),
            'con_deuda': len(con_deuda),
            'deuda': round(sum(f['deuda'] for f in filas), 2),
            'vencidas': len(vencidas),
            'deuda_vencida': round(sum(f['cuota_monto'] or 0 for f in vencidas), 2),
            'pagado': round(sum(f['pagado'] for f in filas), 2),
        }

    @staticmethod
    def totales_ventas(filas):
        cash = sum(f['monto'] for f in filas)
        ventas = [f for f in filas if f['es_venta']]
        # El ticket es lo que entró POR CADA VENTA NUEVA (pago completo o split pay), igual que
        # en el dashboard del closer (`general_average_ticket`). Antes dividía TODO el cash del
        # período —cuotas y señas incluidas— por las ventas: un mes con una venta de $250 y
        # cuotas viejas cobradas mostraba un ticket de $1.200.
        cash_ventas = sum(f['monto'] for f in ventas)
        return {
            'filas': len(filas),
            'ventas': len(ventas),
            'cash': round(cash, 2),
            'cash_neto': round(sum(f['monto_neto'] for f in filas), 2),
            'ticket': round(cash_ventas / len(ventas), 2) if ventas else None,
        }

    @staticmethod
    def totales_leads(filas):
        respondieron = [f for f in filas if f['respondio']]
        cualificados = [f for f in filas if f['cualificado']]
        # Solo los que agendaron con quien se mira: "Agendó por otra vía" no suma (ver `leads`).
        agendaron = [f for f in filas if f['agendo']]
        return {
            'leads': len(filas),
            'respondieron': len(respondieron),
            'respuesta': pct(len(respondieron), len(filas)),
            'cualificados': len(cualificados),
            'cualificacion': pct(len(cualificados), len(respondieron)),
            'agendas': len(agendaron),
            'conversion': pct(len(agendaron), len(filas)),
            'mensajes': sum(f['mensajes'] for f in filas),
        }
