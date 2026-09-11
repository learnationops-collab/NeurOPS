"""Score ponderado de una postulación a Asistente Administrativa y Personal.

Análogo a `clarity.py` (Closer de ventas) pero con criterios de ESTE puesto:
no hay porcentaje de cierre ni formación como closer, hay nivel real de IA,
Sheets, criterio operativo y prueba de escritura.

Las respuestas llegan como el texto literal de la opción elegida (ver
`AssistantApplication`), así que cada escala mapea por expresión regular en vez
de por igualdad exacta: si el formulario reescribe una opción, el score no se
rompe en silencio.

Cada `_valor_<criterio>` devuelve un float 0-1; `score_de` los pondera.
"""
import re

# Los 8 criterios ponderados, con el peso por defecto que siembra la migración.
# El peso efectivo (editable desde la pestaña Clarity del panel) vive en la
# tabla AssistantClarityWeight.
CLARITY_CRITERIA = [
    {"criterion": "criterio", "label": "Cómo resuelve: retraso, compra, martes", "default_weight": 18},
    {"criterion": "experiencia", "label": "Experiencia en operaciones", "default_weight": 16},
    {"criterion": "escritura", "label": "Instrucciones para delegar", "default_weight": 14},
    {"criterion": "herramientas", "label": "Sheets, Notion, Meta, automatizaciones", "default_weight": 14},
    {"criterion": "ia", "label": "Nivel real de IA", "default_weight": 14},
    {"criterion": "digital", "label": "Negocio digital y trabajo remoto", "default_weight": 10},
    {"criterion": "video", "label": "Video de presentación y CV", "default_weight": 10},
    {"criterion": "dinero", "label": "Dinero y coordinación de gente", "default_weight": 4},
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
    'automatizaciones': [(r'varios pasos', 4), (r'simples', 3), (r'entiendo', 1), (r'.', 0)],
    # "¿Qué hacés si te pido un monitor?": mide criterio de compra, no de precio.
    'monitor': [(r'pagar menos|cupones|negociar', 4), (r'para qu[ée] lo vas a usar', 3), (r'relaci[óo]n calidad', 2), (r'.', 1)],
}

# Techo real de uso de IA, de la pregunta "¿qué es lo más avanzado que hiciste?".
IA_TECHO = [
    (r'construí algo funcional|agentes o flujos', 4),
    (r'propios GPTs|asistentes personalizados', 3),
    (r'GPTs, proyectos o plugins|prompts con contexto', 2),
    (r'redactar, resumir', 1),
    (r'preguntas sueltas', 1),
    (r'casi no la uso', 0),
]

# Largo (caracteres) a partir del cual una respuesta abierta se considera
# completa: min(1, len / N). Los topes del propio formulario son 1200 para
# instrucciones y retraso, 600 para martes.
LARGO_COMPLETO = {
    'instrucciones': 600,
    'retraso': 420,
    'martes': 380,
}


def _escala(campo, valor):
    """Devuelve 0-4 según la escala del campo."""
    texto = str(valor or '')
    for patron, n in ESCALAS.get(campo, []):
        if re.search(patron, texto, re.IGNORECASE):
            return n
    return 0


def _nivel(valor):
    """Escala genérica de las preguntas «tu nivel de X» (NIVEL5 / IDIOMA4)."""
    t = str(valor or '').lower()
    if 'expert' in t:
        return 4
    if 'avanzad' in t or 'nativo' in t:
        return 3
    if 'intermedio' in t:
        return 2
    if 'básico' in t or 'basico' in t:
        return 1
    return 0


def _techo_ia(valor):
    texto = str(valor or '')
    for patron, n in IA_TECHO:
        if re.search(patron, texto, re.IGNORECASE):
            return n
    return 0


def _largo(texto, n):
    if not texto:
        return 0.0
    return min(1.0, len(str(texto).strip()) / n)


def _valor_experiencia(app):
    return _escala('experiencia', app.experiencia) / 4


def _valor_digital(app):
    return (_escala('digital', app.digital) + _escala('remoto', app.remoto)) / 8


def _valor_herramientas(app):
    partes = [
        _nivel(app.sheets) / 4,
        _escala('notion', app.notion) / 4,
        _escala('meta', app.meta) / 4,
        _escala('wa_tools', app.wa_tools) / 4,
        _escala('automatizaciones', app.automatizaciones) / 4,
    ]
    # Sheets pesa el doble que el resto: es donde viven los reportes, las
    # liquidaciones y el seguimiento diario del puesto.
    return (partes[0] * 2 + sum(partes[1:])) / 6


def _valor_ia(app):
    """Lo que declara que sabe pesa menos que lo más avanzado que hizo: el
    techo es verificable con la repregunta abierta, el nivel autodeclarado no."""
    return (_nivel(app.ia_nivel) / 4) * 0.35 + (_techo_ia(app.ia_avanzado) / 4) * 0.65


def _valor_escritura(app):
    return _largo(app.instrucciones, LARGO_COMPLETO['instrucciones'])


def _valor_criterio(app):
    return (
        _largo(app.retraso, LARGO_COMPLETO['retraso']) * 0.4
        + _largo(app.martes, LARGO_COMPLETO['martes']) * 0.35
        + (_escala('monitor', app.monitor) / 4) * 0.25
    )


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


_REGLAS = {
    'criterio': _valor_criterio,
    'experiencia': _valor_experiencia,
    'escritura': _valor_escritura,
    'herramientas': _valor_herramientas,
    'ia': _valor_ia,
    'digital': _valor_digital,
    'video': _valor_video,
    'dinero': _valor_dinero,
}


def compute_criteria_values(app):
    """{criterio: valor 0-1} para las 8 claves de CLARITY_CRITERIA."""
    return {criterio: round(fn(app), 4) for criterio, fn in _REGLAS.items()}


def score_de(app, weights=None):
    """weights: {criterio: peso}; se normalizan solos (no hace falta que sumen
    100). Sin `weights` usa los pesos por defecto."""
    pesos = weights or DEFAULT_WEIGHTS
    valores = compute_criteria_values(app)
    num = 0.0
    den = 0.0
    for criterio, peso in pesos.items():
        num += (peso or 0) * valores.get(criterio, 0.0)
        den += (peso or 0)
    if den == 0:
        return 0
    return round((num / den) * 100)
