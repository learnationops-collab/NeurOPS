"""Los vocabularios de la ficha del lead, con sus grupos y sus tonos, servidos por el backend.

Las etapas de confirmacion, el «Cómo viene» y los dolores vivian SOLO en el JS
(`CloserWorkflowPage.jsx`, 60-88) aunque los tres se guardan en columnas de `Appointment`: el
frontend era el unico que sabia qué valores son legales y qué dice cada slug. Con dos superficies
(el mazo del closer y la ficha unificada, que abre tambien la direccion comercial) eso ya no se
sostiene: dos copias del vocabulario se desincronizan y la segunda pantalla muestra slugs crudos.

`tono` es uno de los 5 del design system (success/warning/error/info/idle). El frontend no elige
colores: los toma de aca, igual que con el vocabulario del dashboard comercial.

Los grupos "Otros" nacen vacios y se llenan a mano desde la UI. Esas opciones se persisten en
`FichaOpcion` (tabla `ficha_opciones`) y vuelven en la lectura siguiente, para todo el equipo.
"""
import re
import unicodedata

from app import db
from app.models import FichaOpcion

# Grupos que aceptan opciones nuevas creadas desde la ficha.
GRUPOS_ABIERTOS = ('como_viene', 'dolores', 'motivos_descarte', 'motivos_cancelacion',
                   'motivos_baja')

# `Appointment.confirmation_contact_status` es String(20): una clave mas larga se truncaria en la
# base y la opcion dejaria de coincidir con su propia lista al volver a leerla.
LARGO_CLAVE = {'como_viene': 20}
LARGO_CLAVE_POR_DEFECTO = 60

# --- Vocabularios de fabrica ------------------------------------------------------------------

ETAPAS_CONFIRMACION = [
    {'clave': 'por_contactar', 'label': 'Por contactar'},
    {'clave': 'contactado', 'label': 'Contactado'},
    {'clave': 'horario', 'label': 'Horario'},
    {'clave': 'videoask', 'label': 'VideoAsk'},
    {'clave': 'testimonio', 'label': 'Testimonio'},
]

# «Cómo viene» — `Appointment.confirmation_contact_status`. Las tres primeras son los valores que
# ya existen en la base; el resto son los que agrega el diseño nuevo.
COMO_VIENE = [
    {'titulo': 'Respuesta', 'tono': 'info', 'opciones': [
        {'clave': 'pendiente', 'label': 'Pendiente'},
        {'clave': 'espera_respuesta', 'label': 'A la espera de respuesta'},
        {'clave': 'no_contesta', 'label': 'No contesta'},
    ]},
    {'titulo': 'Disposición', 'tono': 'success', 'opciones': [
        {'clave': 'confirmo_asiste', 'label': 'Confirmó asistencia'},
        {'clave': 'muy_interesado', 'label': 'Muy interesado'},
        {'clave': 'con_dudas', 'label': 'Con dudas'},
    ]},
    {'titulo': 'Alertas', 'tono': 'warning', 'opciones': [
        {'clave': 'pide_reprogramar', 'label': 'Pidió reprogramar'},
        {'clave': 'dudas_plata', 'label': 'Dudas con la plata'},
        {'clave': 'posible_no_show', 'label': 'Posible no show'},
    ]},
]

# «Dolores que contó» — `Appointment.confirmation_pain_points` (slugs separados por coma). Las 8
# claves que ya se guardan en produccion se conservan tal cual; agrupadas es como se muestran.
DOLORES = [
    {'titulo': 'Emocionales', 'tono': 'error', 'opciones': [
        {'clave': 'ansiedad', 'label': 'Ansiedad'},
        {'clave': 'estres', 'label': 'Estrés'},
        {'clave': 'miedo_fracasar', 'label': 'Miedo a fracasar'},
    ]},
    {'titulo': 'Hábitos', 'tono': 'warning', 'opciones': [
        {'clave': 'procrastinacion', 'label': 'Procrastinación'},
        {'clave': 'se_distrae', 'label': 'Se distrae'},
        {'clave': 'desorganizacion', 'label': 'Desorganización'},
    ]},
    {'titulo': 'Método', 'tono': 'info', 'opciones': [
        {'clave': 'sin_metodo', 'label': 'Sin método'},
        {'clave': 'intentos_previos', 'label': 'Intentos previos'},
        {'clave': 'no_retiene', 'label': 'No retiene lo que estudia'},
    ]},
]

MOTIVOS_DESCARTE = [
    {'titulo': 'Económicos', 'tono': 'error', 'opciones': [
        {'clave': 'no_puede_pagar', 'label': 'No puede pagar'},
        {'clave': 'le_parece_caro', 'label': 'Le parece caro'},
    ]},
    {'titulo': 'Tiempo y examen', 'tono': 'warning', 'opciones': [
        {'clave': 'no_tiene_tiempo', 'label': 'No tiene tiempo'},
        {'clave': 'posterga_examen', 'label': 'Posterga el examen'},
    ]},
    {'titulo': 'Interés', 'tono': 'info', 'opciones': [
        {'clave': 'no_era_lo_que_buscaba', 'label': 'No era lo que buscaba'},
        {'clave': 'eligio_otro_programa', 'label': 'Eligió otro programa'},
        {'clave': 'dejo_de_responder', 'label': 'Dejó de responder'},
    ]},
    {'titulo': 'Personales', 'tono': 'success', 'opciones': [
        {'clave': 'salud', 'label': 'Salud'},
        {'clave': 'motivos_familiares', 'label': 'Motivos familiares'},
    ]},
]

MOTIVOS_CANCELACION = [
    {'titulo': 'Se le cruzo algo', 'tono': 'warning', 'opciones': [
        {'clave': 'sin_tiempo_imprevisto', 'label': 'Sin tiempo o imprevisto'},
        {'clave': 'problema_de_salud', 'label': 'Problema de salud'},
    ]},
    {'titulo': 'Interés', 'tono': 'info', 'opciones': [
        {'clave': 'ya_no_le_interesa', 'label': 'Ya no le interesa'},
        {'clave': 'lo_va_a_pensar', 'label': 'Lo va a pensar'},
    ]},
    {'titulo': 'Económicos', 'tono': 'error', 'opciones': [
        {'clave': 'problema_economico', 'label': 'Problema económico'},
    ]},
    {'titulo': 'Sin motivo', 'tono': 'idle', 'opciones': [
        {'clave': 'no_dio_motivo', 'label': 'No dio motivo'},
    ]},
]

MOTIVOS_BAJA = [
    {'titulo': 'Económicos', 'tono': 'error', 'opciones': [
        {'clave': 'no_puede_pagar', 'label': 'No puede pagar'},
        {'clave': 'perdio_ingresos', 'label': 'Perdió ingresos'},
        {'clave': 'le_parece_caro', 'label': 'Le parece caro'},
    ]},
    {'titulo': 'Tiempo y examen', 'tono': 'warning', 'opciones': [
        {'clave': 'no_tiene_tiempo', 'label': 'No tiene tiempo para estudiar'},
        {'clave': 'posterga_examen', 'label': 'Posterga el examen'},
        {'clave': 'ya_rindio', 'label': 'Ya rindió el examen'},
    ]},
    {'titulo': 'Programa', 'tono': 'info', 'opciones': [
        {'clave': 'no_ve_resultados', 'label': 'No ve resultados'},
        {'clave': 'se_va_a_otro', 'label': 'Se va a otro programa'},
        {'clave': 'no_le_sirve_formato', 'label': 'No le sirve el formato'},
    ]},
    {'titulo': 'Personales', 'tono': 'success', 'opciones': [
        {'clave': 'salud', 'label': 'Salud'},
        {'clave': 'motivos_familiares', 'label': 'Motivos familiares'},
        {'clave': 'se_muda', 'label': 'Se muda'},
    ]},
]

# Medios de pago del paso "Registrar pago" de la ficha. Es una lista mas corta que la del wizard
# de venta (`DeclararVentaWizard.METHODS`) a proposito: son los cuatro con los que el equipo cobra
# una cuota. El wizard sigue ofreciendo los seis para declarar una venta nueva.
MEDIOS_PAGO = [
    {'clave': 'Stripe', 'label': 'Stripe'},
    {'clave': 'Transferencia', 'label': 'Transferencia'},
    {'clave': 'PayPal', 'label': 'PayPal'},
    {'clave': 'Efectivo', 'label': 'Efectivo'},
]

# Los medios de pago que se le pueden poner a un pago al corregirlo desde el historial. Es la union
# de los dos que escriben ventas: los seis del wizard de venta (`DeclararVentaWizard.METHODS`) y los
# cuatro de "Registrar pago" de arriba. Corregir es arreglar lo que ya esta en la base, y ahi hay de
# los dos: con la lista corta, un pago de Hotmart —al que Operaciones le descuenta su comision por
# este texto— no se podria corregir sin pasarlo a otro medio.
MEDIOS_PAGO_VENTA = [
    {'clave': 'Stripe', 'label': 'Stripe'},
    {'clave': 'Hotmart', 'label': 'Hotmart'},
    {'clave': 'PayPal', 'label': 'PayPal'},
    {'clave': 'Transferencia Bancaria', 'label': 'Transferencia bancaria'},
    {'clave': 'Transferencia', 'label': 'Transferencia'},
    {'clave': 'Binance / USDT', 'label': 'Binance / USDT'},
    {'clave': 'Efectivo', 'label': 'Efectivo'},
    {'clave': 'Otro', 'label': 'Otro'},
]

# Los seis tipos de pago de una venta. La clave es la palabra canonica a la que
# `SheetsService._extract_tipo_keyword` reduce cualquier variante historica ('Con Seña', 'PARCIAL',
# 'Renovacion'), y la etiqueta es como se escribe detras del programa en `tipo_pago`: 'RR - Cuota'.
# Es la grafia del wizard de venta y del script de pagos historicos, asi que un pago corregido desde
# la ficha se lee igual que uno declarado.
TIPOS_PAGO_VENTA = [
    {'clave': 'completo', 'label': 'Completo'},
    {'clave': 'parcial', 'label': 'Parcial'},
    {'clave': 'seña', 'label': 'Seña'},
    {'clave': 'cuota', 'label': 'Cuota'},
    {'clave': 'renovacion', 'label': 'Renovación'},
    {'clave': 'upsell', 'label': 'Upsell'},
]

CANALES_SEGUIMIENTO = [
    {'clave': 'whatsapp', 'label': 'WhatsApp'},
    {'clave': 'llamada', 'label': 'Llamada'},
    {'clave': 'email', 'label': 'Email'},
]

_DE_FABRICA = {
    'como_viene': COMO_VIENE,
    'dolores': DOLORES,
    'motivos_descarte': MOTIVOS_DESCARTE,
    'motivos_cancelacion': MOTIVOS_CANCELACION,
    'motivos_baja': MOTIVOS_BAJA,
}

TITULO_OTROS = 'Otros'


# --- Opciones que el equipo agrega a mano -----------------------------------------------------

def slug(texto, grupo=None):
    """Clave estable a partir de la etiqueta que escribio la persona.

    Sin acentos ni espacios, y recortada al largo de la columna donde se va a guardar: una clave
    truncada por la base no volveria a coincidir con su propia lista.
    """
    limpio = unicodedata.normalize('NFKD', str(texto or '')).encode('ascii', 'ignore').decode()
    limpio = re.sub(r'[^a-zA-Z0-9]+', '_', limpio).strip('_').lower()
    return limpio[:LARGO_CLAVE.get(grupo, LARGO_CLAVE_POR_DEFECTO)]


def _extra_por_grupo():
    """{grupo: [opcion]} con todo lo que el equipo agrego, en una sola consulta."""
    extras = {}
    for opcion in FichaOpcion.query.order_by(FichaOpcion.id).all():
        extras.setdefault(opcion.grupo, []).append(opcion.to_dict())
    return extras


def grupos_de(grupo, extras=None):
    """Los grupos de un vocabulario abierto, con "Otros" al final.

    "Otros" existe siempre, incluso vacio: es el boton "+ Agregar" de la UI. Si no estuviera, no
    habria donde crear la primera opcion.
    """
    if extras is None:
        extras = _extra_por_grupo()
    base = [{'titulo': g['titulo'], 'tono': g['tono'], 'opciones': list(g['opciones'])}
            for g in _DE_FABRICA.get(grupo, [])]
    return base + [{'titulo': TITULO_OTROS, 'tono': 'idle', 'opciones': extras.get(grupo, [])}]


def agregar_opcion(grupo, label, usuario=None):
    """Guarda una opcion nueva de un grupo "Otros" y la devuelve. None si el grupo no es abierto.

    Volver a agregar la misma opcion no la duplica ni falla: la ficha la reusa. Tampoco se crea
    una que ya existe de fabrica, para que no aparezca dos veces en el desplegable.
    """
    if grupo not in GRUPOS_ABIERTOS:
        return None
    clave = slug(label, grupo)
    if not clave:
        return None

    de_fabrica = {o['clave'] for g in _DE_FABRICA.get(grupo, []) for o in g['opciones']}
    if clave in de_fabrica:
        return next(o for g in _DE_FABRICA[grupo] for o in g['opciones'] if o['clave'] == clave)

    existente = FichaOpcion.query.filter_by(grupo=grupo, clave=clave).first()
    if existente:
        return existente.to_dict()

    opcion = FichaOpcion(grupo=grupo, clave=clave, label=str(label).strip()[:120],
                         creada_por_id=usuario.id if usuario else None)
    db.session.add(opcion)
    db.session.commit()
    return opcion.to_dict()


def etiqueta_de(grupo, clave):
    """La etiqueta legible de un slug guardado, o el slug si nadie lo conoce.

    Devolver el slug crudo es a proposito: es la unica forma de que un valor historico que ya no
    esta en ninguna lista se siga viendo en la ficha en vez de desaparecer.
    """
    if not clave:
        return None
    for g in grupos_de(grupo):
        for opcion in g['opciones']:
            if opcion['clave'] == clave:
                return opcion['label']
    return clave


def programas_disponibles():
    """Los programas a los que se puede asignar un cliente.

    Salen de `PROGRAM_CODE_NAMES`, que es el mismo mapa con el que `_client_program_code` traduce
    el prefijo de `tipo_pago` a un nombre. Dos listas de programas se desincronizan: el
    desplegable ofreceria un codigo que la lectura no sabe traducir y la ficha mostraria el
    codigo crudo.
    """
    from app.services.closer_followup_service import PROGRAM_CODE_NAMES

    return [{'clave': codigo, 'label': nombre} for codigo, nombre in PROGRAM_CODE_NAMES.items()]


# Como se lee cada fuente de embudo en el desplegable. El valor que se guarda es la clave tal cual
# (`Appointment.origin`), que es lo que leen el Tablero de Agendas, el embudo del workshop y el
# sync con n8n: la etiqueta es solo para que 'workshop_landing' no se lea como un nombre de
# variable. «Workshop» a secas desde el 09/10/2026 (antes «Workshop en vivo»): es el único workshop
# que la ficha ofrece.
ETIQUETAS_FUENTE = {
    'workshop': 'Workshop',
    'workshop_landing': 'Workshop · grabación',
    'vsl': 'VSL',
    'setting': 'Setting · sin setter identificado',
    'Desconocido': 'Desconocido',
}

# Las del catalogo oficial que la ficha NO ofrece para elegir (pedido del usuario, 09/10/2026:
# «quita las opciones de workshop grabación, setting sin setter asignado, desconocido»). Quien
# corrige una agenda a mano sabe de donde vino: un setter con nombre o un embudo concreto, no "no
# se sabe". Siguen en `FUENTES_CANONICAS` —las ponen el sync con n8n y el Tablero de Agendas, y el
# embudo del workshop cuenta la grabacion— y una agenda que ya tiene una la conserva mientras no
# se la cambie (`ficha_agendas_service.validar_fuente`).
FUENTES_QUE_LA_FICHA_NO_OFRECE = frozenset({'workshop_landing', 'setting', 'Desconocido'})


def etiqueta_de_fuente(fuente):
    """Como se lee una fuente guardada (`Appointment.origin`), o None si no hay ninguna.

    Las del catalogo salen con su etiqueta; un setter o un valor historico fuera del catalogo
    ('workshop manychat', 'Entrevista Diagnóstica Gratuita') se muestran tal cual, como en el
    historial.
    """
    texto = (fuente or '').strip()
    return ETIQUETAS_FUENTE.get(texto, texto) if texto else None


def fuentes_disponibles():
    """Las fuentes que se le pueden poner a una agenda desde la ficha (cabecera e historial), en
    dos grupos.

    Salen del catalogo oficial (`fuente_service.FUENTES_CANONICAS`, 20/08/2026) que ofrecen el
    selector del Tablero de Agendas y su edicion masiva, y no de una lista propia: dos catalogos de
    fuentes se desincronizan y el embudo del workshop, que clasifica por este texto, contaria
    distinto segun desde donde se corrigio la agenda. La ficha ofrece un recorte de ese catalogo
    (sin `FUENTES_QUE_LA_FICHA_NO_OFRECE`): un recorte no inventa claves, asi que no desincroniza.
    Los setters van aparte porque una agenda con su nombre de fuente se les atribuye (ver
    `ficha_agendas_service._setter_de_la_fuente`).
    """
    from app.services.fuente_service import FUENTES_CANONICAS, SETTERS

    embudos = [{'clave': f, 'label': ETIQUETAS_FUENTE.get(f, f)}
               for f in FUENTES_CANONICAS
               if f not in SETTERS and f not in FUENTES_QUE_LA_FICHA_NO_OFRECE]
    setters = [{'clave': s, 'label': s} for s in SETTERS]
    return [{'titulo': 'Embudos', 'tono': 'info', 'opciones': embudos},
            {'titulo': 'Setters', 'tono': 'success', 'opciones': setters}]


def fuentes_elegibles():
    """Las claves que `fuentes_disponibles` ofrece: lo unico que la ficha acepta como fuente NUEVA."""
    return {o['clave'] for grupo in fuentes_disponibles() for o in grupo['opciones']}


def tipos_seguimiento():
    """Los tres tipos de seguimiento, con el nombre y la explicacion de la pestaña del closer.

    Salen de `CloserFollowUpService.TIPOS_SEGUIMIENTO`, que es de donde la pestaña Seguimientos
    saca el titulo de cada grupo: el tipo que se elige en la ficha ES el grupo en el que el closer
    va a ver el seguimiento, y con dos listas uno de los dos terminaria llamandolo distinto.
    """
    from app.services.closer_followup_service import TIPOS_SEGUIMIENTO

    return [{'clave': clave, 'label': tipo['label'], 'desc': tipo['desc']}
            for clave, tipo in TIPOS_SEGUIMIENTO.items()]


def vocabulario(closers=None):
    """El bloque `vocabulario` completo de `GET /api/ficha/lead`.

    Se arma con UNA consulta a `ficha_opciones` para los cuatro grupos abiertos, en vez de una por
    grupo. Los estados de pre call / post call y los tipos de pago se reusan del dashboard
    comercial: son los mismos chips, con los mismos tonos, en las dos pantallas.
    """
    from app.services.comercial_service import POST_CALL, PRE_CALL, TIPOS_PAGO
    from app.services.transferencias_service import opciones as transferido_a

    extras = _extra_por_grupo()
    return {
        'etapas_confirmacion': list(ETAPAS_CONFIRMACION),
        'como_viene': grupos_de('como_viene', extras),
        'dolores': grupos_de('dolores', extras),
        'motivos_descarte': grupos_de('motivos_descarte', extras),
        'motivos_cancelacion': grupos_de('motivos_cancelacion', extras),
        'motivos_baja': grupos_de('motivos_baja', extras),
        'pre_call': list(PRE_CALL),
        'post_call': list(POST_CALL),
        'tipos_pago': list(TIPOS_PAGO),
        'medios_pago': list(MEDIOS_PAGO),
        # Los dos de la correccion de un pago desde la seccion Pagos del historial.
        'medios_pago_venta': list(MEDIOS_PAGO_VENTA),
        'tipos_pago_venta': list(TIPOS_PAGO_VENTA),
        # A quién del equipo se le hizo un pago por transferencia: se pregunta al registrarlo y se
        # marca en la sección Pagos (ver `transferencias_service`).
        'transferido_a': transferido_a(),
        'programas': programas_disponibles(),
        'canales_seguimiento': list(CANALES_SEGUIMIENTO),
        'tipos_seguimiento': tipos_seguimiento(),
        'fuentes': fuentes_disponibles(),
        'closers': closers if closers is not None else closers_disponibles(),
    }


def closers_disponibles():
    """Los closers a los que se le puede pasar el lead, con la pista que muestra el desplegable.

    La pista es cuántas llamadas tiene hoy: es lo que el closer necesita para decidir a quién
    pasarle un lead sin abrir otra pantalla.
    """
    from datetime import date, datetime, time

    from sqlalchemy import func

    from app.models import Appointment, User
    from app.models.user import ROLE_CLOSER

    usuarios = User.query.filter_by(role=ROLE_CLOSER, is_active=True).order_by(User.username).all()
    if not usuarios:
        return []
    hoy = date.today()
    conteo = dict(db.session.query(Appointment.closer_id, func.count(Appointment.id))
                  .filter(Appointment.start_time >= datetime.combine(hoy, time.min),
                          Appointment.start_time <= datetime.combine(hoy, time.max))
                  .group_by(Appointment.closer_id).all())
    salida = []
    for u in usuarios:
        n = conteo.get(u.id, 0)
        pista = 'Libre' if not n else ('1 llamada hoy' if n == 1 else f'{n} llamadas hoy')
        salida.append({'id': u.id, 'nombre': u.username, 'pista': pista})
    return salida
