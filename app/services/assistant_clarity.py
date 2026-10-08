"""Score ponderado de una postulación a Asistente Administrativa y Personal.

Análogo a `clarity.py` (Closer de ventas) pero con criterios de ESTE puesto.
La rúbrica sigue el formulario REAL de 35 preguntas (institute-site,
vacante-assistant/formulario) y se rediseñó el 07/10/2026 cuando el formulario
dejó de preguntar las pruebas de escritura largas (`instrucciones`, `martes`,
`monitor`) y sumó `aporte`, `ia_avanzado` de opción múltiple y los idiomas.

Qué mira cada criterio (peso por defecto entre paréntesis, suman 100):
  · criterio (20)      caso del atraso (`retraso`) + cómo maneja sus pendientes.
  · aporte (10)        qué aporta que casi nadie tenga (`aporte`): concreto y verificable.
  · experiencia (14)   años como asistente / administración / operaciones.
  · herramientas (14)  Sheets (doble), Notion, Meta, WhatsApp masivo, automatizaciones.
  · ia (16)            nivel declarado (35 %) y lo más avanzado que hizo (65 %).
  · digital (6)        negocio digital y trabajo 100 % remoto.
  · dinero (6)         manejo de dinero y coordinación de gente.
  · video (6)          video de presentación (verificado) y CV.
  · idiomas (4)        inglés (60 %) y segundo idioma, portugués o español (40 %).
  · pretension (4)     pretensión mensual dentro del rango del puesto.

Las respuestas llegan como el texto literal de la opción elegida (ver
`AssistantApplication`), así que cada escala mapea por expresión regular en vez
de por igualdad exacta: si el formulario reescribe una opción, el score no se
rompe en silencio. Las respuestas abiertas se leen con señales de texto
(largo, hechos concretos, acción inmediata y prevención): orientan el ranking,
no reemplazan leer la postulación.

Las postulaciones completas sin `aporte` guardado (formulario viejo, o contestadas
antes de que el backend guardara esa pregunta) no lo cuentan ni a favor ni en
contra, ver `aplica`.

Apagar una pregunta en el editor de formularios (Hiring → Forms) no le cuesta
puntos a nadie: si su formulario tiene apagadas TODAS las preguntas de un
criterio, el criterio no aplica; si apaga solo algunas, el criterio se calcula
con las que quedan, repartiendo el peso entre ellas (ver `PARTES`).

Cada `_valor_<criterio>` devuelve un float 0-1; `score_de` los pondera.
"""
import re

# Los 10 criterios ponderados. El peso efectivo (editable desde la pestaña
# Clarity del panel) vive en la tabla AssistantClarityWeight; `detalle` es lo
# que se muestra bajo cada barra para que se entienda qué se está pesando.
CLARITY_CRITERIA = [
    {"criterion": "criterio", "label": "Cómo resuelve: atraso y pendientes", "default_weight": 20,
     "detalle": "Qué haría con una entrega atrasada (acción inmediata y cómo evitar que se repita) y cómo maneja sus pendientes."},
    {"criterion": "aporte", "label": "Qué aporta que casi nadie tenga", "default_weight": 10,
     "detalle": "Una respuesta concreta y verificable (hechos, cifras, herramientas) vale más que una cualidad genérica."},
    {"criterion": "experiencia", "label": "Experiencia en operaciones", "default_weight": 14,
     "detalle": "Años como asistente, administración u operaciones."},
    {"criterion": "herramientas", "label": "Sheets, Notion, Meta, WhatsApp masivo y automatizaciones", "default_weight": 14,
     "detalle": "Sheets pesa el doble: ahí viven los reportes y las liquidaciones del puesto."},
    {"criterion": "ia", "label": "Nivel real de IA", "default_weight": 16,
     "detalle": "Pesa más lo más avanzado que hizo (de usarla para redactar a construir herramientas) que el nivel que se declara."},
    {"criterion": "digital", "label": "Negocio digital y trabajo remoto", "default_weight": 6,
     "detalle": "Años en infoproductos, agencias o e-commerce y en trabajo 100 % remoto."},
    {"criterion": "dinero", "label": "Dinero y coordinación de gente", "default_weight": 6,
     "detalle": "Si manejó pagos o comisiones y si coordinó a otras personas."},
    {"criterion": "video", "label": "Video de presentación y CV", "default_weight": 6,
     "detalle": "Video cargado y verificado, y link al CV."},
    {"criterion": "idiomas", "label": "Inglés y segundo idioma", "default_weight": 4,
     "detalle": "Inglés y portugués (o español, si es de Brasil)."},
    {"criterion": "pretension", "label": "Pretensión dentro del rango", "default_weight": 4,
     "detalle": "Hasta 400 USD por mes puntúa completo; por encima va bajando."},
]

DEFAULT_WEIGHTS = {c['criterion']: c['default_weight'] for c in CLARITY_CRITERIA}

# Escalas 0-4 por pregunta cerrada. Se evalúan en orden: la primera regex que
# matchea gana, y `.` al final es el piso.
ESCALAS = {
    'experiencia': [(r'm[áa]s de 5', 4), (r'3 y 5', 3), (r'1 y 2', 2), (r'menos de 1', 1), (r'.', 0)],
    'digital': [(r'm[áa]s de 3', 4), (r'entre 1 y 3', 3), (r'menos de 1', 2), (r'.', 0)],
    'remoto': [(r'm[áa]s de 3', 4), (r'1 y 3', 3), (r'menos de 1', 2), (r'.', 0)],
    'dinero': [(r'control financiero', 4), (r'pagos|comisiones', 3), (r'cargaba datos', 2), (r'.', 0)],
    'pm': [(r'm[áa]s de 5 personas', 4), (r'2 a 5', 3), (r'informal', 2), (r'.', 0)],
    'meta': [(r'gestion', 4), (r'monto y publico', 3), (r'siguiendo instrucciones', 2), (r'entr[ée] pero', 1), (r'.', 0)],
    'notion': [(r'relacionadas', 4), (r'vistas|filtros', 3), (r'simples', 2), (r'bloc de notas', 1), (r'.', 0)],
    'wa_tools': [(r'flujos autom', 4), (r'difusiones|campañas simples', 3), (r'conozco', 1), (r'.', 0)],
    # Solo las postulaciones del formulario viejo (ya no se pregunta).
    'automatizaciones': [(r'varios pasos', 4), (r'simples', 3), (r'entiendo', 1), (r'.', 0)],
    # «¿Cómo manejás tus pendientes?»: un sistema propio que actualiza a diario
    # es lo que el puesto necesita; anotar «cuando me acuerdo» no es un sistema.
    'pendientes': [(r'sistema propio', 4), (r'lista de tareas simple', 3), (r'cuando me acuerdo', 1), (r'.', 0)],
}

# Lo más avanzado que hizo con IA: puntos de cada opción del formulario (el
# mismo `pts` de la opción, 0-6). Es de opción múltiple y las marcadas llegan
# unidas con « | »: cuenta la más alta. Las últimas tres son las opciones del
# formulario anterior (una sola respuesta), por si hay postulaciones viejas.
IA_TECHO_MAX = 6
IA_TECHO = [
    (r'construí herramientas o automatizaciones|construí algo funcional|agentes o flujos', 6),
    (r'mis propios GPTs|propios GPTs|asistentes personalizados', 5),
    (r'asistentes que ya existen con prompts propios|GPTs, proyectos o plugins|prompts con contexto', 4),
    (r'redactar, resumir', 2),
    (r'preguntas sueltas', 1),
    (r'casi no la uso', 0),
]

# Largo (caracteres) a partir del cual una respuesta abierta cuenta como
# desarrollada: min(1, len / N). El formulario topa `retraso` en 1200 y
# `aporte` en 500.
LARGO_COMPLETO = {
    'retraso': 420,
    'aporte': 200,
    'automatizacion_ejemplo': 60,
}

# Pretensión mensual (USD) del puesto: hasta el techo del rango puntúa entero y
# después baja por tramos. (tope, valor)
PRETENSION_TRAMOS = [(400, 1.0), (450, 0.7), (500, 0.4), (600, 0.2)]

# Señales de texto del caso del atraso. Lo que se pide es qué hace AHORA y qué
# haría para que NO SE REPITA: se busca cada mitad por separado.
_ACCION_INMEDIATA = re.compile(
    r'\b(le escribo|escribo|llamo|hablo|contacto|pregunto|le pregunto|le pido|le consulto|consulto|'
    r'reasign\w*|redistribu\w*|divido|priorizo|aviso|ofrezco|ayudo|cu[aá]nto falta|qu[eé] falta|'
    r'qu[eé] necesita|plan b|alternativa|avance|reviso|me fijo|averiguo)',
    re.IGNORECASE)
_PREVENCION = re.compile(
    r'(para que no se repita|que no vuelva|no se repita|a futuro|en adelante|de ahora en m[aá]s|'
    r'pr[oó]xima vez|pr[oó]ximas veces|proceso|checklist|recordatorio|check-?in|seguimiento|'
    r'entregas? parciales?|avances? intermedios?|fecha l[ií]mite|deadline|anticip\w*|margen|'
    r'buffer|retro\w*|capacit\w*|document\w*|plantilla|sistema|acuerdo|expectativas)',
    re.IGNORECASE)

# Señales de un aporte concreto: hechos en primera persona y pasado, y
# cualidades genéricas que, sin un dato que las respalde, no dicen nada.
_HECHO = re.compile(
    r'\b(arm[ée]|constru[ií]|gestion[ée]|cre[ée]|automatic[ée]|implement[ée]|manej[ée]|'
    r'coordin[ée]|dirig[ií]|lider[ée]|lanc[ée]|redu[jx]e|aument[ée]|logr[ée]|dise[ñn][ée]|'
    r'program[ée]|escrib[ií]|traduj\w*|organic[ée]|administr[ée]|trabaj[ée]|ocup[ée]|'
    r'domino|hablo|manejo|s[ée] (usar|armar|hacer))',
    re.IGNORECASE)
_GENERICO = re.compile(
    r'(responsable|proactiv\w*|comprometid\w*|compromiso|puntual\w*|dedicad\w*|trabajo en equipo|'
    r'ganas de aprender|buena actitud|din[aá]mic\w*|honest\w*|organizad[ao]|perseveran\w*|'
    r'flexib\w*|esfuerz\w*)',
    re.IGNORECASE)


def _escala(campo, valor):
    """Devuelve 0-4 según la escala del campo."""
    texto = str(valor or '')
    for patron, n in ESCALAS.get(campo, []):
        if re.search(patron, texto, re.IGNORECASE):
            return n
    return 0


def _nivel(valor):
    """Escala de «tu nivel de X» (NIVEL5 del formulario: Sheets e IA), 0-4."""
    t = str(valor or '').lower()
    if 'expert' in t:
        return 4
    if 'avanzad' in t:
        return 3
    if 'intermedio' in t:
        return 2
    if 'básico' in t or 'basico' in t:
        return 1
    return 0


def _idioma(valor):
    """Escala de idiomas (IDIOMA4 del formulario), 0-3: «Avanzado o nativo» es el techo."""
    t = str(valor or '').lower()
    if 'avanzad' in t or 'nativo' in t:
        return 3
    if 'intermedio' in t:
        return 2
    if 'básico' in t or 'basico' in t:
        return 1
    return 0


def _techo_ia(valor):
    """0..IA_TECHO_MAX: la opción más avanzada de las marcadas."""
    mejor = 0
    for opcion in str(valor or '').split('|'):
        for patron, n in IA_TECHO:
            if re.search(patron, opcion, re.IGNORECASE):
                mejor = max(mejor, n)
                break
    return mejor


def _largo(texto, n):
    if not texto:
        return 0.0
    return min(1.0, len(str(texto).strip()) / n)


def _numero(valor):
    try:
        return int(float(str(valor).replace(',', '.')))
    except (TypeError, ValueError):
        return None


def _valor_experiencia(app):
    return _escala('experiencia', app.experiencia) / 4


def _valor_digital(app):
    return (_escala('digital', app.digital) + _escala('remoto', app.remoto)) / 8


def _valor_automatizacion(app):
    """Una automatización contada en una línea (opcional en el formulario nuevo);
    en las postulaciones viejas, el nivel que declaraban."""
    ejemplo = _largo(app.automatizacion_ejemplo, LARGO_COMPLETO['automatizacion_ejemplo'])
    return max(ejemplo, _escala('automatizaciones', getattr(app, 'automatizaciones', None)) / 4)


def _valor_herramientas(app):
    partes = [
        _nivel(app.sheets) / 4,
        _escala('notion', app.notion) / 4,
        _escala('meta', app.meta) / 4,
        _escala('wa_tools', app.wa_tools) / 4,
        _valor_automatizacion(app),
    ]
    # Sheets pesa el doble que el resto: es donde viven los reportes, las
    # liquidaciones y el seguimiento diario del puesto.
    return (partes[0] * 2 + sum(partes[1:])) / 6


def _valor_ia(app):
    """Lo que declara que sabe pesa menos que lo más avanzado que hizo: el
    techo es verificable en la postulación, el nivel autodeclarado no."""
    return (_nivel(app.ia_nivel) / 4) * 0.35 + (_techo_ia(app.ia_avanzado) / IA_TECHO_MAX) * 0.65


def _valor_retraso(app):
    """El caso del atraso: largo (30 %), qué hace ahora (35 %) y qué haría para
    que no se repita (35 %). Las dos mitades son lo que el enunciado pide."""
    texto = str(app.retraso or '').strip()
    if not texto:
        return 0.0
    return (
        _largo(texto, LARGO_COMPLETO['retraso']) * 0.30
        + (0.35 if _ACCION_INMEDIATA.search(texto) else 0.0)
        + (0.35 if _PREVENCION.search(texto) else 0.0)
    )


def _valor_criterio(app):
    return _valor_retraso(app) * 0.7 + (_escala('pendientes', app.pendientes) / 4) * 0.3


def _valor_aporte(app):
    """Un aporte concreto y verificable: largo (40 %), una cifra o un dato (35 %)
    y hechos en primera persona (25 %). Si es todo cualidades genéricas sin una
    cifra, no pasa de 0.4."""
    texto = str(app.aporte or '').strip()
    if not texto:
        return 0.0
    con_dato = bool(re.search(r'\d', texto))
    valor = (
        _largo(texto, LARGO_COMPLETO['aporte']) * 0.40
        + (0.35 if con_dato else 0.0)
        + (0.25 if _HECHO.search(texto) else 0.0)
    )
    if not con_dato and len(_GENERICO.findall(texto)) >= 2:
        valor = min(valor, 0.4)
    return valor


def _valor_video(app):
    # Un link sin verificar es media respuesta: el formulario avisa que un link
    # que no abre es una postulación descartada.
    puntos = 0.0
    if app.video:
        puntos += 0.35
    if app.video_ok():
        puntos += 0.3
    if app.cv:
        puntos += 0.35
    return puntos


def _valor_dinero(app):
    return (_escala('dinero', app.dinero) + _escala('pm', app.pm)) / 8


def _valor_idiomas(app):
    return (_idioma(app.ingles) / 3) * 0.6 + (_idioma(app.idioma2) / 3) * 0.4


def _valor_pretension(app):
    pide = _numero(app.remuneracion)
    if pide is None or pide <= 0:
        return 0.0
    for tope, valor in PRETENSION_TRAMOS:
        if pide <= tope:
            return valor
    return 0.0


def _valor_pendientes(app):
    return _escala('pendientes', app.pendientes) / 4


# Las preguntas (columnas) de las que sale cada criterio. Si el formulario de la
# postulación las tiene todas apagadas, el criterio no aplica.
CAMPOS_DE_CRITERIO = {
    'criterio': ('retraso', 'pendientes'),
    'aporte': ('aporte',),
    'experiencia': ('experiencia',),
    'herramientas': ('sheets', 'notion', 'meta', 'wa_tools', 'automatizacion_ejemplo'),
    'ia': ('ia_nivel', 'ia_avanzado'),
    'digital': ('digital', 'remoto'),
    'dinero': ('dinero', 'pm'),
    'video': ('video', 'video_verificado', 'cv'),
    'idiomas': ('ingles', 'idioma2'),
    'pretension': ('remuneracion',),
}

# Los criterios de varias preguntas, partidos en (pregunta, peso, valor 0-1). Son
# las mismas cuentas que `_valor_<criterio>`; solo se usan cuando el formulario
# apaga ALGUNAS de esas preguntas, para promediar entre las que quedan.
PARTES = {
    'criterio': [('retraso', 0.7, _valor_retraso), ('pendientes', 0.3, _valor_pendientes)],
    'herramientas': [
        ('sheets', 2, lambda a: _nivel(a.sheets) / 4),
        ('notion', 1, lambda a: _escala('notion', a.notion) / 4),
        ('meta', 1, lambda a: _escala('meta', a.meta) / 4),
        ('wa_tools', 1, lambda a: _escala('wa_tools', a.wa_tools) / 4),
        ('automatizacion_ejemplo', 1, _valor_automatizacion),
    ],
    'ia': [
        ('ia_nivel', 0.35, lambda a: _nivel(a.ia_nivel) / 4),
        ('ia_avanzado', 0.65, lambda a: _techo_ia(a.ia_avanzado) / IA_TECHO_MAX),
    ],
    'digital': [
        ('digital', 1, lambda a: _escala('digital', a.digital) / 4),
        ('remoto', 1, lambda a: _escala('remoto', a.remoto) / 4),
    ],
    'dinero': [
        ('dinero', 1, lambda a: _escala('dinero', a.dinero) / 4),
        ('pm', 1, lambda a: _escala('pm', a.pm) / 4),
    ],
    'video': [
        ('video', 0.35, lambda a: 1.0 if a.video else 0.0),
        ('video_verificado', 0.3, lambda a: 1.0 if a.video_ok() else 0.0),
        ('cv', 0.35, lambda a: 1.0 if a.cv else 0.0),
    ],
    'idiomas': [
        ('ingles', 0.6, lambda a: _idioma(a.ingles) / 3),
        ('idioma2', 0.4, lambda a: _idioma(a.idioma2) / 3),
    ],
}


def _apagados(app):
    """Columnas apagadas en el formulario de la postulación (vacío si no tiene)."""
    fn = getattr(app, 'campos_apagados', None)
    return fn() if fn else frozenset()


def _sin_apagadas(criterio, fn, app, apagados):
    """El valor del criterio contando solo las preguntas que se hicieron."""
    campos = CAMPOS_DE_CRITERIO.get(criterio, ())
    if not apagados or criterio not in PARTES or not apagados.intersection(campos):
        return fn(app)
    partes = [(peso, valor) for campo, peso, valor in PARTES[criterio] if campo not in apagados]
    total = sum(peso for peso, _ in partes)
    if not total:
        return 0.0
    return sum(peso * valor(app) for peso, valor in partes) / total


_REGLAS = {
    'criterio': _valor_criterio,
    'aporte': _valor_aporte,
    'experiencia': _valor_experiencia,
    'herramientas': _valor_herramientas,
    'ia': _valor_ia,
    'digital': _valor_digital,
    'dinero': _valor_dinero,
    'video': _valor_video,
    'idiomas': _valor_idiomas,
    'pretension': _valor_pretension,
}


def aplica(app, criterio):
    """Si el criterio cuenta para esta postulación (y entra al promedio del score).

    `aporte` no cuenta cuando la postulación está COMPLETA y no tiene la respuesta
    guardada: o es del formulario viejo (que no lo preguntaba) o el backend todavía
    no guardaba esa pregunta cuando la contestó (hasta el 07/10/2026 se descartaba).
    En los dos casos no es que haya contestado mal, es que no hay dato: no suma ni
    resta. Una postulación incompleta sí lo cuenta en cero, como a cualquier
    pregunta que todavía no contestó.

    Tampoco cuenta un criterio cuyas preguntas están TODAS apagadas en el
    formulario de la postulación: no se le preguntaron."""
    campos = CAMPOS_DE_CRITERIO.get(criterio)
    if campos:
        apagados = _apagados(app)
        if apagados and apagados.issuperset(campos):
            return False
    if criterio == 'aporte':
        return bool(app.aporte) or not app.completo
    return True


def compute_criteria_values(app):
    """{criterio: valor 0-1} para las claves de CLARITY_CRITERIA. Las preguntas
    apagadas en su formulario no entran en la cuenta (ver `PARTES`)."""
    apagados = _apagados(app)
    return {criterio: round(_sin_apagadas(criterio, fn, app, apagados), 4) for criterio, fn in _REGLAS.items()}


def score_de(app, weights=None):
    """weights: {criterio: peso}; se normalizan solos (no hace falta que sumen
    100). Sin `weights` usa los pesos por defecto. Los criterios que no aplican a
    la postulación (ver `aplica`) quedan fuera del promedio."""
    pesos = weights or DEFAULT_WEIGHTS
    valores = compute_criteria_values(app)
    num = 0.0
    den = 0.0
    for criterio, peso in pesos.items():
        if criterio not in valores or not aplica(app, criterio):
            continue
        num += (peso or 0) * valores[criterio]
        den += (peso or 0)
    if den == 0:
        return 0
    return round((num / den) * 100)
