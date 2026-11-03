"""El motivo obligatorio de «Reagendado», «No Show» y «Cancelado».

Pedido del director comercial (02/11/2026): cuando una persona del equipo marca A MANO una agenda con uno de
estos tres estados, tiene que escribir por qué («¿Por qué se reagenda?», «¿Por qué no asistió?», «¿Por qué se
canceló?»), y eso queda como nota en el hilo de la persona, donde el equipo lo lee.

**Contrato** (lo leen el hilo de Comunicación y quien analice los motivos; no cambiarlo sin avisar):

  · una fila de `lead_event_logs` con `action_type='nota'` (la nota del equipo), `origen='appointment'`,
    `origen_id` la agenda y `user_id` quien la escribió;
  · `payload = {'motivo_estado': 'no_show' | 'cancelado' | 'reagendado', 'motivo': <texto crudo>}` marca la
    nota como motivo, dice de qué estado es y trae lo escrito sin el prefijo (desde el 03/11/2026; las notas
    anteriores no traen `motivo` y `motivos_agenda` lo recorta de la descripción);
  · `description` empieza con el estado y con quién lo marcó, y termina con el texto TAL CUAL se escribió
    (ver `texto_nota`).

Alcance: SOLO el marcado manual. Las reagendas que llegan solas (el lead desde el link, el evento movido en
Google Calendar: `app/agendas_v2/reagenda.py`) ya dejan su nota automática y no pasan por acá. Las
cancelaciones automáticas (`agendas_v2/movidas.py`, el descarte de duplicadas) usan `process_agenda` con una
nota propia, que cumple el mínimo.
"""
from app.services import lead_log_service

# Lo mismo que se le pide a la objeción de un «No cerró»: un motivo de dos palabras no le sirve a quien
# lo lea después.
MINIMO = 10
# Un párrafo largo entra; un pegado de la transcripción entera de la llamada, no.
MAXIMO = 2000

NO_SHOW = 'no_show'
CANCELADO = 'cancelado'
REAGENDADO = 'reagendado'

# clave -> (estado como se guarda en `closer_result`, la pregunta que ve quien lo marca)
ESTADOS = {
    NO_SHOW: ('No Show', '¿Por qué no asistió?'),
    CANCELADO: ('Cancelado', '¿Por qué se canceló?'),
    REAGENDADO: ('Reagendado', '¿Por qué se reagenda?'),
}

# Cómo se llaman estos estados en cada pantalla y tabla: el mazo, la ficha, el tablero de agendas, el
# dashboard comercial y los resultados previos a la llamada.
_ALIAS = {
    'no show': NO_SHOW, 'no_show': NO_SHOW, 'noshow': NO_SHOW, 'no_asistio': NO_SHOW, 'no asistio': NO_SHOW,
    'no asistió': NO_SHOW,
    'cancelado': CANCELADO, 'cancelada': CANCELADO, 'cancelo': CANCELADO, 'canceló': CANCELADO,
    'reagendado': REAGENDADO, 'reagendada': REAGENDADO, 'reagendo': REAGENDADO, 'reagendó': REAGENDADO,
    'reagenda': REAGENDADO, 'reprogramado': REAGENDADO, 'reprogramada': REAGENDADO,
}


class MotivoInvalido(ValueError):
    """Falta el motivo de un estado que lo pide, o no alcanza. El mensaje se muestra tal cual."""

    def __init__(self, mensaje, campo='motivo'):
        super().__init__(mensaje)
        self.campo = campo


def clave_de(estado):
    """La clave del estado si es uno de los tres que piden motivo, o None."""
    return _ALIAS.get(' '.join(str(estado or '').split()).lower())


def pregunta(estado):
    """«¿Por qué se canceló?» y compañía, o None si el estado no pide motivo."""
    clave = clave_de(estado)
    return ESTADOS[clave][1] if clave else None


def texto_valido(estado, texto):
    """El motivo listo para guardar (sin espacios a los costados), o `MotivoInvalido` con el porqué en palabras."""
    clave = clave_de(estado)
    pide = ESTADOS[clave][1] if clave else 'Escribí el motivo.'
    if texto is not None and not isinstance(texto, str):
        raise MotivoInvalido('El motivo tiene que ser texto.')
    limpio = (texto or '').strip()
    if not limpio:
        raise MotivoInvalido(f'Falta el motivo: {pide}')
    if len(limpio) < MINIMO:
        raise MotivoInvalido(f'El motivo tiene que tener al menos {MINIMO} caracteres (tiene {len(limpio)}): '
                             f'{pide}')
    if len(limpio) > MAXIMO:
        raise MotivoInvalido(f'El motivo es demasiado largo: el máximo es {MAXIMO} caracteres.')
    return limpio


def exigir(estado, texto):
    """`texto_valido` solo si el estado es de los tres; si no, devuelve el texto como vino (puede ser None).

    Es lo que usan las puertas que reciben cualquier estado (`process_agenda`, la corrección de estado)."""
    if clave_de(estado) is None:
        return texto
    return texto_valido(estado, texto)


def para_correccion(anterior, nuevo, texto):
    """El motivo que pide corregir un estado a mano (el historial de la ficha, el modal del dashboard
    comercial), o None si no lo pide: el estado nuevo no es de los tres, o la agenda ya estaba así."""
    if clave_de(nuevo) is None or clave_de(nuevo) == clave_de(anterior):
        return None
    return texto_valido(nuevo, texto)


def texto_nota(estado, texto, quien, nueva_fecha=None):
    """Lo que se lee en el hilo. «Cancelado» y «Reagendado» conservan el formato que ya tenían sus notas."""
    clave = clave_de(estado)
    if clave == CANCELADO:
        return f'Cancelado por {quien}: {texto}'
    if clave == REAGENDADO:
        cita = f'. Nueva cita el {nueva_fecha}' if nueva_fecha else ''
        return f'Reagendado por {quien}. Razón: {texto}{cita}'
    return f'No Show marcado por {quien}. Motivo: {texto}'


def registrar_de_persona(person_uuid, usuario, estado, texto):
    """Lo mismo que `registrar` para una fila del Tablero de Agendas sin cita: la nota cuelga de la persona."""
    clave = clave_de(estado)
    if clave is None or not person_uuid:
        return None
    nombre = getattr(usuario, 'username', None) or 'el equipo'
    return lead_log_service.registrar(person_uuid, 'nota', texto_nota(clave, texto, nombre),
                                      user_id=lead_log_service._uid(usuario), payload={'motivo_estado': clave, 'motivo': texto})


def registrar(appt, usuario, estado, texto, quien=None, nueva_fecha=None):
    """Deja el motivo en el hilo de la persona (sin commit). `texto` ya validado con `texto_valido`.

    `quien` es el nombre que se lee en la nota (por defecto, el de `usuario`); `nueva_fecha` ya viene
    formateada («02/11/2026 15:00»). Devuelve la entrada, o None si el estado no pide motivo."""
    clave = clave_de(estado)
    if clave is None:
        return None
    nombre = quien or getattr(usuario, 'username', None) or 'el equipo'
    return lead_log_service.nota(texto_nota(clave, texto, nombre, nueva_fecha), usuario, appt=appt,
                                 payload={'motivo_estado': clave, 'motivo': texto})
