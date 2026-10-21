"""Vocabulario del dashboard comercial: roles, estados (pre call, post call, venta, cartera),
tipos de pago y los chips que el frontend muestra tal cual. Se re-exporta desde
`comercial_service.py`, que es de donde lo importa el resto del código.
"""

from app.services.closer_agendas_service import AYUDA_ESTADO, ARCHIVADA_SIN_REPORTE


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
# usa el mazo del closer (`closer_result`). El diseño original listaba además "Venta" y
# "Seguimiento" como opciones editables; acá no lo son a propósito:
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
    # Asistió y no compró ni dejó una seña: la venta sigue abierta. Hasta el 09/10/2026 la que no
    # tenía un seguimiento programado se mostraba aparte, como "Presentó, no cerró"; el usuario
    # pidió que se vean todas como "Seguimiento" (ver `cerro_sin_venta`, que guarda la diferencia
    # para las métricas y para la ficha).
    {'key': 'seguimiento', 'label': 'Seguimiento', 'tone': 'warning', 'editable': False},
    # Nadie la confirmó ni la reportó en 30 días y la archivó el barrido de mantenimiento: no es un
    # descarte del closer, aunque se trate igual (terminal, descartada, mismo grupo en Analizar).
    # Va antes de "Lead perdido" por la dona de Analizar: entre "Seguimiento" y "Lead perdido" no
    # queda pegada a otro arco gris. `ayuda` es el tooltip de su chip, y viaja con el vocabulario.
    {'key': 'archivada_sin_reporte', 'label': ARCHIVADA_SIN_REPORTE, 'tone': 'idle', 'editable': False,
     'ayuda': AYUDA_ESTADO['archivada_sin_reporte']},
    {'key': 'lead_perdido', 'label': 'Lead perdido', 'tone': 'error', 'editable': False,
     'ayuda': AYUDA_ESTADO['lead_perdido']},
    {'key': 'no_lead', 'label': 'No lead', 'tone': 'idle', 'editable': False},
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

# Lo que muestra la tarjeta "Payment types": los cuatro canónicos más las renovaciones y los
# upsells. Van aparte de `TIPOS_PAGO` porque ese vocabulario también alimenta los formularios de
# la ficha, donde una venta nueva no se carga como renovación. Sin estos dos, una renovación salía
# en la tabla de ventas pero no en ninguna tarjeta, y las partes no sumaban el total.
TIPOS_PAGO_COBROS = TIPOS_PAGO + [
    {'key': 'renovacion', 'label': 'Renovación', 'tone': 'info'},
    {'key': 'upsell', 'label': 'Upsell', 'tone': 'success'},
]

# Estado de un cobro (`FinancialSale.estado`). Cuenta como cash solo el completado: vacío,
# «Completada» o «Confirmada» (`ESTADOS_COMPLETADA`), que se muestran juntos como «Completada». Los
# demás —pendientes, reembolsados, cancelados— los ve solo quien opera los registros (admin y
# operador, 10/10/2026), para corregirlos desde Revisar: no suman a ningún número del tablero.
ESTADO_VENTA = [
    {'key': 'completada', 'label': 'Completada', 'tone': 'success'},
    {'key': 'pendiente', 'label': 'Pendiente', 'tone': 'warning'},
    {'key': 'reembolsada', 'label': 'Reembolsada', 'tone': 'error'},
    {'key': 'cancelada', 'label': 'Cancelada', 'tone': 'idle'},
]
ESTADOS_COMPLETADA = ('', 'completada', 'confirmada')

_LABELS = {'pre_call': {e['key']: e for e in PRE_CALL},
           'post_call': {e['key']: e for e in POST_CALL},
           'estado': {e['key']: e for e in ESTADO_LEAD},
           'estado_cartera': {e['key']: e for e in ESTADO_CARTERA},
           'estado_venta': {e['key']: e for e in ESTADO_VENTA},
           'tipo_pago': {e['key']: e for e in TIPOS_PAGO_COBROS}}

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
    # "Lead perdido" y "No lead" son lo que el closer reportó y se muestran con ese nombre (antes
    # caían en un "Otro estado" que no decía nada). Como "Canceló", son agendas DESCARTADAS: la
    # tabla las saca del listado por defecto (ver `DESCARTADAS`). No suman a las realizadas.
    'lead_perdido': 'lead_perdido',
    'no_lead': 'no_lead',
    # La que archivó el barrido de los 30 días (antes también decía "Lead perdido"): otro nombre,
    # mismo trato que las de arriba.
    'archivada_sin_reporte': 'archivada_sin_reporte',
}

# Valor que se escribe en la base al corregir el estado desde el modal.
PRE_CALL_A_RESULT = {'confirmada': 'Confirmado', 'sin_confirmar': 'Pendiente', 'cancelo': 'Cancelado'}
POST_CALL_A_CLOSER_RESULT = {'pendiente': 'Pendiente', 'asistio': 'Show up', 'no_show': 'No Show',
                             'reagendo': 'Reagendado', 'cancelo': 'Cancelado', 'segunda_llamada': '2da call'}

# Post call que cuentan como "la llamada ocurrió y el lead estaba del otro lado".
ASISTIO = ('asistio', 'venta', 'sena', 'seguimiento', 'segunda_llamada')
# Post call que implican que la oferta se presentó aunque nadie haya tildado el campo: no se puede
# comprar ni dejar una seña sin haber visto el precio. La llamada que terminó sin venta y sin un
# seguimiento abierto también cuenta (`cerro_sin_venta`), aunque se muestre como "Seguimiento".
PRESENTO = ('venta', 'sena')
# Post call con resultado de asistencia: el denominador del show up (ver el docstring del módulo).
REALIZADAS = ASISTIO + ('no_show',)
# Post call con los que una llamada cerró: una venta o una seña. Una llamada con show up que no
# terminó en ninguno de los dos es una «No cerrada» (panel Cierre, pedido del usuario del
# 09/10/2026). Se define por lo que NO es —asistió y no cerró— y no listando los estados de "abierta"
# (seguimiento, segunda llamada, presentó sin cerrar…), que cambian de nombre y se reparten: así
# ventas + señas + no cerradas suman siempre las que asistieron.
CERRO = ('venta', 'sena')
# Agendas que salieron del trabajo del equipo: el lead canceló, el closer lo descartó o el sistema la
# archivó porque nadie la reportó. Siguen en los números del período, pero las listas las esconden
# detrás de su propio filtro («Descartadas»): pedido del usuario, 02/10/2026, «que desaparezcan y
# queden en otro lugar aparte».
DESCARTADAS = ('cancelo', 'lead_perdido', 'no_lead', 'archivada_sin_reporte')


def pre_call_de(appt):
    """Etapa de confirmación de la agenda, a partir de `Appointment.result`."""
    res = (appt.result or '').strip().lower()
    if res in ('cancelado', 'cancelada'):
        return 'cancelo'
    if res == 'confirmado':
        return 'confirmada'
    return 'sin_confirmar'


def post_call_de(estado, con_venta, con_sena=False):
    """Resultado de la llamada. `estado` es el del libro de agendas (`derivar_estado`).

    Los estados derivados salen de acá y no de una columna: una agenda con asistencia es "Venta"
    si el lead tiene un pago completo o un split pay cruzado, "Seña" si lo único que dejó es una
    seña, y si no, "Seguimiento": la venta sigue abierta.

    "Seguimiento" es la misma etiqueta con o sin un seguimiento programado. Hasta el 09/10/2026 la
    que no tenía ninguno se mostraba aparte, como "Presentó, no cerró", y el usuario pidió que se
    vean todas como "Seguimiento". Lo que esa diferencia decía de la llamada no se perdió:
    `cerro_sin_venta` lo sigue sabiendo, y con eso cuentan las presentaciones y la ficha.

    La seña va antes que el seguimiento porque dice más: quien dejó una seña casi siempre tiene
    además un seguimiento abierto (para completar el pago), y "Seguimiento" escondería que ya
    hubo un compromiso de compra."""
    if estado == 'show_up':
        if con_venta:
            return 'venta'
        if con_sena:
            return 'sena'
        return 'seguimiento'
    return _ESTADO_A_POST_CALL.get(estado, 'pendiente')


def cerro_sin_venta(estado, con_venta, con_seguimiento, con_sena=False):
    """¿La llamada ocurrió y terminó sin venta, sin seña y sin ningún seguimiento abierto?

    Es lo que antes era el estado "Presentó, no cerró". Ya no se muestra (es un "Seguimiento" más,
    ver `post_call_de`), pero dice dos cosas que se siguen usando:

      · la oferta se presentó aunque nadie haya tildado el campo — así se contaba y así se sigue
        contando en las presentaciones del embudo, en la tasa de presentación y en el cierre por
        presentación: cambiar la etiqueta no puede mover esos números;
      · en la ficha, el cierre de esa llamada es "No cerró" y no "Pendiente": no hay nada
        programado que lo vaya a resolver.
    """
    return estado == 'show_up' and not (con_venta or con_sena or con_seguimiento)


def chip(grupo, key):
    """{key, label, tone} para que el frontend no tenga su propia copia del vocabulario. Más
    `ayuda`, el tooltip, en los estados que lo tienen (los que hay que explicar: ver `POST_CALL`)."""
    dato = _LABELS[grupo].get(key) or {'key': key, 'label': str(key), 'tone': 'idle'}
    salida = {'key': dato['key'], 'label': dato['label'], 'tone': dato['tone']}
    if dato.get('ayuda'):
        salida['ayuda'] = dato['ayuda']
    return salida


def venta_completada(venta):
    """¿Este cobro cuenta como cash? Es el único criterio del tablero: las filas de Ventas, sus
    totales, el cash de Analizar y sus fuentes salen de los cobros que lo cumplen."""
    return (venta.estado or '').strip().lower() in ESTADOS_COMPLETADA


def estado_de_venta(venta):
    """{key, label, tone} del estado de un cobro (ver `ESTADO_VENTA`). Uno escrito a mano que no está
    en el vocabulario se muestra como vino, en amarillo: no es cash y alguien lo tiene que mirar."""
    if venta_completada(venta):
        return chip('estado_venta', 'completada')
    crudo = (venta.estado or '').strip()
    if crudo.lower() in _LABELS['estado_venta']:
        return chip('estado_venta', crudo.lower())
    return {'key': crudo.lower(), 'label': crudo, 'tone': 'warning'}


def pct(numerador, denominador):
    """Porcentaje con un decimal, o None si no hay denominador. None se muestra como "—": un 0%
    inventado sobre cero casos es una afirmación falsa sobre el rendimiento."""
    return round(numerador / denominador * 100, 1) if denominador else None
