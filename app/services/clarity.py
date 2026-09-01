"""Cálculo del score "Clarity" para postulaciones de Closer de ventas.

Reglas por respuesta (no hay paso de calificación manual por criterio en el
panel: el revisor solo vota pre/des). Todo queda aislado acá a propósito para
poder ajustar los heurísticos sin tocar modelos ni endpoints. Cada función
`_valor_<criterio>` devuelve un float 0-1.
"""

# --- Mapeos de opción cerrada -> valor 0-1 ---
INGLES_VALORES = {'Fluido': 1.0, 'Intermedio': 0.6, 'Básico': 0.3, 'Nada': 0.0}

CONOCIMIENTO_VALORES = {
    'Tengo formación + experiencia': 1.0,
    'Tengo experiencia': 0.75,
    'Tengo formación': 0.45,
}

# Herramientas "de valor" para un closer de alto rendimiento pesan más que las
# genéricas de oficina. Cualquier opción no listada suma el peso mínimo.
HERRAMIENTA_PESO = {
    'CRM (HubSpot, Pipedrive, Close, GoHighLevel, Kommo)': 3,
    'Grabación y análisis de llamadas (Fathom, Fireflies, tl;dv, Otter)': 3,
    'Herramientas de IA (ChatGPT, Claude, Gemini)': 2,
    'Calendly u otro agendador automático': 2,
    'Notion / ClickUp / Trello': 1,
    'WhatsApp Business / Manychat': 1,
    'Google Workspace (Sheets, Docs, Drive, Calendar)': 0.5,
    'Slack / Discord': 0.5,
    'Zoom / Google Meet': 0.5,
    'Otra': 0.5,
}
HERRAMIENTA_PESO_MAX = sum(HERRAMIENTA_PESO.values())

# Largo de texto (caracteres) que se considera respuesta "completa" para cada
# pregunta abierta: min(1, len(texto) / N).
LARGO_COMPLETO = {
    'formacion': 280,
    'dedicacion': 150,
    'obstaculo': 220,
    'objetivos': 220,
}


def _largo(texto, n):
    if not texto:
        return 0.0
    return min(1.0, len(texto.strip()) / n)


def _valor_formacion(app):
    return _largo(app.formacion, LARGO_COMPLETO['formacion'])


def _valor_experiencia(app):
    base = CONOCIMIENTO_VALORES.get(app.conocimiento, 0.2)
    extra = _largo(app.dedicacion, LARGO_COMPLETO['dedicacion'])
    return round(base * 0.8 + extra * 0.2, 4)


def _valor_cierre(app):
    v = app.cierre
    if v is None or v == '' or v == 'nada':
        return 0.25
    try:
        pct = float(v)
    except (TypeError, ValueError):
        return 0.25
    if pct >= 30:
        return 1.0
    if pct >= 20:
        return 0.75
    if pct >= 10:
        return 0.5
    if pct > 0:
        return 0.3
    return 0.25


def _valor_ingles(app):
    return INGLES_VALORES.get(app.ingles, 0.0)


def _valor_herramientas(app):
    seleccionadas = app.herramientas or []
    total = sum(HERRAMIENTA_PESO.get(h, 0.5) for h in seleccionadas)
    if HERRAMIENTA_PESO_MAX == 0:
        return 0.0
    return round(min(1.0, total / HERRAMIENTA_PESO_MAX), 4)


def _es_link(v):
    return bool(v) and (str(v).startswith('http://') or str(v).startswith('https://'))


def _valor_video(app):
    puntos = (1 if _es_link(app.video) else 0) + (1 if _es_link(app.llamada) else 0)
    return puntos / 2


def _valor_obstaculo(app):
    return _largo(app.obstaculo, LARGO_COMPLETO['obstaculo'])


def _valor_objetivos(app):
    return _largo(app.objetivos, LARGO_COMPLETO['objetivos'])


_REGLAS = {
    'formacion': _valor_formacion,
    'experiencia': _valor_experiencia,
    'cierre': _valor_cierre,
    'ingles': _valor_ingles,
    'herramientas': _valor_herramientas,
    'video': _valor_video,
    'obstaculo': _valor_obstaculo,
    'objetivos': _valor_objetivos,
}


def compute_criteria_values(app):
    """Devuelve {criterio: valor 0-1} para las 8 claves de CLARITY_CRITERIA."""
    return {criterio: round(fn(app), 4) for criterio, fn in _REGLAS.items()}


def score_de(app, weights):
    """weights: dict {criterio: peso}. Fórmula del handoff:
    round( Σ(peso_i · valor_i) / Σ(peso_i) × 100 ). Los pesos se normalizan
    solos (no hace falta que sumen 100)."""
    valores = compute_criteria_values(app)
    num = 0.0
    den = 0.0
    for criterio, peso in (weights or {}).items():
        num += (peso or 0) * valores.get(criterio, 0.0)
        den += (peso or 0)
    if den == 0:
        return 0
    return round((num / den) * 100)
