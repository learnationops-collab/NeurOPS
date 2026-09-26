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
GRUPOS_ABIERTOS = ('como_viene', 'dolores', 'motivos_descarte', 'motivos_baja')

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

CANALES_SEGUIMIENTO = [
    {'clave': 'whatsapp', 'label': 'WhatsApp'},
    {'clave': 'llamada', 'label': 'Llamada'},
    {'clave': 'email', 'label': 'Email'},
]

_DE_FABRICA = {
    'como_viene': COMO_VIENE,
    'dolores': DOLORES,
    'motivos_descarte': MOTIVOS_DESCARTE,
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


def vocabulario(closers=None):
    """El bloque `vocabulario` completo de `GET /api/ficha/lead`.

    Se arma con UNA consulta a `ficha_opciones` para los cuatro grupos abiertos, en vez de una por
    grupo. Los estados de pre call / post call y los tipos de pago se reusan del dashboard
    comercial: son los mismos chips, con los mismos tonos, en las dos pantallas.
    """
    from app.services.comercial_service import POST_CALL, PRE_CALL, TIPOS_PAGO

    extras = _extra_por_grupo()
    return {
        'etapas_confirmacion': list(ETAPAS_CONFIRMACION),
        'como_viene': grupos_de('como_viene', extras),
        'dolores': grupos_de('dolores', extras),
        'motivos_descarte': grupos_de('motivos_descarte', extras),
        'motivos_baja': grupos_de('motivos_baja', extras),
        'pre_call': list(PRE_CALL),
        'post_call': list(POST_CALL),
        'tipos_pago': list(TIPOS_PAGO),
        'medios_pago': list(MEDIOS_PAGO),
        'canales_seguimiento': list(CANALES_SEGUIMIENTO),
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
