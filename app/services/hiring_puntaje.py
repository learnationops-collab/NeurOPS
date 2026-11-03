"""Score por puntos de los formularios editables (Hiring → Forms).

Cada pregunta del formulario se puntúa en el editor, sin reglas escritas en
código:
  · opciones (una o varias): cada opción vale 0 a 3 puntos (`pts`). En las de
    varias opciones se suman las marcadas, con tope de 3 por pregunta.
  · número (la pretensión, la edad): tramos `[{hasta, pts}]`, en orden; el
    primero cuyo `hasta` alcanza al número da los puntos, y por encima del
    último vale 0.
  · párrafo o texto corto: hasta 3 según lo concreto que es (largo, cifras y
    hechos en primera persona, ver `assistant_clarity.valor_texto`).
  · link: 3 si lo cargó.
Y cada pregunta tiene una importancia (`peso`, 0 a 3; 0 no cuenta). Sin `peso`
guardado, las de opciones y las numéricas con puntos valen ×1 y las de texto o
link no cuentan.

Score = Σ peso × (puntos / máximo de la pregunta) / Σ peso, de 0 a 100. Solo
entran las preguntas prendidas que puntúan y que a la postulación le tocó ver
(su condición `si` se cumple); una que le tocó y no contestó suma 0.

Un formulario sin ninguna pregunta con puntos (o una postulación sin
formulario) sigue con la rúbrica de `assistant_clarity`.
"""
from app.services.assistant_clarity import valor_texto

PTS_MAX = 3
PESO_MAX = 3
TIPOS_TEXTO = ('parrafo', 'texto')


def pts_de(opcion):
    """Los puntos de una opción, 0..PTS_MAX. Las de formularios viejos llegan
    a 6 (techo de IA): se toman como el máximo."""
    if not isinstance(opcion, dict):
        return 0
    try:
        n = int(opcion.get('pts') or 0)
    except (TypeError, ValueError):
        return 0
    return max(0, min(PTS_MAX, n))


def _tramos(p):
    tramos = [t for t in (p.get('tramos') or []) if isinstance(t, dict) and isinstance(t.get('hasta'), (int, float))]
    return sorted(tramos, key=lambda t: t['hasta'])


def maximo(p):
    """Lo máximo que puede sumar la pregunta (0 = no puntúa)."""
    tipo = p.get('tipo')
    if tipo == 'radio':
        return max((pts_de(o) for o in p.get('o') or []), default=0)
    if tipo == 'check':
        return min(PTS_MAX, sum(pts_de(o) for o in p.get('o') or []))
    if tipo == 'numero':
        return max((pts_de(t) for t in _tramos(p)), default=0)
    if tipo in TIPOS_TEXTO or tipo == 'link':
        return PTS_MAX
    return 0


def peso_de(p):
    """Importancia de la pregunta, 0..PESO_MAX."""
    peso = p.get('peso')
    if peso is None:
        return 1 if p.get('tipo') in ('radio', 'check', 'numero') else 0
    try:
        return max(0, min(PESO_MAX, int(peso)))
    except (TypeError, ValueError):
        return 0


def puntua(p):
    return (isinstance(p, dict) and p.get('on') is not False and p.get('tipo') != 'intro'
            and peso_de(p) > 0 and maximo(p) > 0)


def _numero(valor):
    try:
        return float(str(valor).replace(',', '.').strip())
    except (TypeError, ValueError):
        return None


def _marcadas(valor):
    """Los textos elegidos: la respuesta entera y, si es de varias opciones
    (unidas por « | »), cada una."""
    if isinstance(valor, (list, tuple)):
        return {str(v).strip() for v in valor}
    texto = str(valor).strip()
    return {texto} | {t.strip() for t in texto.split('|') if t.strip()}


def obtenido(p, valor):
    """Los puntos que suma esta respuesta, 0..maximo(p)."""
    if valor is None or valor == '' or valor == []:
        return 0
    tipo = p.get('tipo')
    if tipo in ('radio', 'check'):
        marcadas = _marcadas(valor)
        pts = [pts_de(o) for o in p.get('o') or [] if isinstance(o, dict) and str(o.get('t') or '').strip() in marcadas]
        return max(pts, default=0) if tipo == 'radio' else min(PTS_MAX, sum(pts))
    if tipo == 'numero':
        n = _numero(valor)
        if n is None:
            return 0
        return next((pts_de(t) for t in _tramos(p) if n <= t['hasta']), 0)
    if tipo in TIPOS_TEXTO:
        return PTS_MAX * valor_texto(valor)
    if tipo == 'link':
        return PTS_MAX
    return 0


def preguntas_que_puntuan(form):
    return [p for p in (form.preguntas or []) if puntua(p)] if form is not None else []


def detalle(app, form=None):
    """[{id, t, bloque, peso, puntos, maximo}] de las preguntas que puntúan y le tocaron."""
    from app.models.assistant_application import _cumple_condicion
    form = form or app.formulario()
    filas = []
    for p in preguntas_que_puntuan(form):
        if not _cumple_condicion(app, form, p):
            continue
        tope = maximo(p)
        filas.append({
            "id": p['id'], "t": p.get('t') or p['id'], "bloque": p.get('bloque') or 'Otras', "peso": peso_de(p),
            "puntos": round(min(tope, obtenido(p, app.respuesta(p['id']))), 2), "maximo": tope,
        })
    return filas


def score(app, form=None):
    """0-100, o None si su formulario no tiene preguntas con puntos."""
    form = form or app.formulario()
    if not preguntas_que_puntuan(form):
        return None
    filas = detalle(app, form)
    total = sum(f['peso'] for f in filas)
    if not total:
        return 0
    return round(100 * sum(f['peso'] * f['puntos'] / f['maximo'] for f in filas) / total)
