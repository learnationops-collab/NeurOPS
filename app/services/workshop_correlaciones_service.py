"""Correlaciones entre las métricas de los talleres (Workshop › Correlaciones).

Para cada taller realizado arma un valor por métrica (show up, close rate, cash collected,
gasto, CTR, costo por agenda...) y calcula la correlación de cada par de métricas a través de
los talleres. Solo lectura: usa lo que ya está en `WorkshopEvent` sin tocar `workshop_metrics_service`.

Honestidad estadística: son pocos talleres (n chico) y se comparan muchas parejas a la vez, así que
algo "se parece" por azar con facilidad. Una correlación NO es causalidad. Cada celda lleva su n y
una confianza (`baja` / `media` / `alta`) que el panel muestra junto al número.
"""
import math
from datetime import date

from app.models import WorkshopEvent

# Con menos talleres que esto la correlación no se calcula (dos puntos siempre dan ±1).
MIN_N = 3
# Por debajo de esto el número se muestra, pero con advertencia fuerte.
N_CONFIABLE = 8
N_SOLIDA = 15

OBJETIVO_DEFECTO = 'cash_collected'


def _ratio(num, den, factor=1.0):
    """None si no hay base: un 0% inventado distorsionaría la correlación."""
    if not den:
        return None
    return (num or 0) / den * factor


def _metrica(key, label, grupo, fn, formato='numero', tip=''):
    return {'key': key, 'label': label, 'grupo': grupo, 'fn': fn, 'formato': formato, 'tip': tip}


# Orden = el del embudo. `formato`: numero | pct | usd (lo usa el frontend para mostrar).
METRICAS = [
    _metrica('inversion', 'Gasto', 'Anuncios', lambda e: e.inversion_real, 'usd', 'Inversión en anuncios del taller'),
    _metrica('cpm', 'CPM', 'Anuncios', lambda e: e.cpm_real or None, 'usd', 'Costo por mil impresiones'),
    _metrica('ctr', 'CTR', 'Anuncios',
             lambda e: _ratio(e.clics_reales, e.impresiones, 100), 'pct', 'Clics sobre impresiones'),
    _metrica('leads', 'Leads', 'Anuncios', lambda e: e.leads_reales, 'numero', 'Leads de Meta (o cargados)'),
    _metrica('cpl', 'Costo por lead', 'Anuncios',
             lambda e: _ratio(e.inversion_real, e.leads_reales), 'usd', 'Gasto ÷ leads'),
    _metrica('tx_whatsapp', 'Entrada a WhatsApp', 'Embudo',
             lambda e: _ratio(e.whatsapp_leads, e.leads_reales, 100), 'pct', 'Leads que entraron al grupo'),
    _metrica('whatsapp_leads', 'Leads en WhatsApp', 'Embudo', lambda e: e.whatsapp_leads or 0, 'numero'),
    _metrica('show_up', 'Asistentes', 'Embudo', lambda e: e.show_up or 0, 'numero', 'Personas que entraron al taller'),
    _metrica('show_up_workshop', 'Show up del taller', 'Embudo',
             lambda e: _ratio(e.show_up, e.whatsapp_leads, 100), 'pct', 'Asistentes ÷ leads en WhatsApp'),
    _metrica('retencion_clase', 'Retención de la clase', 'Embudo',
             lambda e: _ratio(e.pitch_leads, e.show_up, 100), 'pct'),
    _metrica('retencion_pitch', 'Retención del pitch', 'Embudo',
             lambda e: _ratio(e.pitch_final_leads, e.pitch_leads, 100), 'pct'),
    _metrica('aplicaciones', 'Aplicaciones', 'Agendas', lambda e: e.aplicaciones_form or 0, 'numero'),
    _metrica('agendas', 'Agendas', 'Agendas', lambda e: e.agendas_exitosas or 0, 'numero'),
    _metrica('costo_agenda', 'Costo por agenda', 'Agendas',
             lambda e: _ratio(e.inversion_real, e.agendas_exitosas), 'usd', 'Gasto ÷ agendas'),
    _metrica('show_up_citas', 'Show up de citas', 'Agendas',
             lambda e: _ratio(e.show_up_sales_call, e.agendas_exitosas, 100), 'pct',
             'Agendas que asistieron a la llamada'),
    _metrica('close_rate', 'Close rate', 'Ventas',
             lambda e: _ratio(e.sales, e.show_up_sales_call, 100), 'pct', 'Ventas ÷ asistentes a la llamada'),
    _metrica('ventas', 'Ventas', 'Ventas', lambda e: e.sales or 0, 'numero'),
    _metrica('ticket', 'Ticket promedio', 'Ventas', lambda e: e.ticket_promedio or None, 'usd',
             'Solo ventas nuevas, sin señas'),
    _metrica('cash_collected', 'Cash collected', 'Ventas', lambda e: e.cash_collected or 0.0, 'usd'),
    _metrica('roas', 'ROAS', 'Ventas',
             lambda e: _ratio(e.cash_collected, e.inversion_real), 'numero', 'Cash collected ÷ gasto'),
]
_POR_CLAVE = {m['key']: m for m in METRICAS}

# Parejas que se parecen por cómo se calculan, no porque pase algo en el negocio: una tasa contra su
# numerador o su denominador, y el cash contra lo que lo compone. Se marcan en la vista.
DERIVADAS = {
    'cpm': ('inversion',), 'ctr': (), 'cpl': ('inversion', 'leads'),
    'tx_whatsapp': ('whatsapp_leads', 'leads'), 'show_up_workshop': ('show_up', 'whatsapp_leads'),
    'retencion_clase': ('show_up',), 'costo_agenda': ('inversion', 'agendas'),
    'show_up_citas': ('agendas',), 'close_rate': ('ventas',),
    'ticket': ('cash_collected',), 'roas': ('cash_collected', 'inversion'),
}
LIGADAS_EXTRA = (('cash_collected', 'ventas'),)


def _ligadas():
    pares = {frozenset((k, d)) for k, ds in DERIVADAS.items() for d in ds}
    pares |= {frozenset(p) for p in LIGADAS_EXTRA}
    return sorted(sorted(p) for p in pares)


NOTAS = [
    'Una correlación no prueba que una cosa cause la otra: solo que se mueven parecido entre talleres.',
    'Las parejas marcadas "por construcción" (por ejemplo ROAS y cash collected) se parecen por cómo se calculan.',
    'No hay un show up separado de la llamada del setter por taller: "Show up de citas" es el de la '
    'llamada de ventas (agendas que asistieron).',
]


# --- Estadística pura (sin base de datos) ---

def _media(xs):
    return sum(xs) / len(xs)


def pearson(xs, ys):
    """r de Pearson, o None si hay menos de MIN_N puntos o alguna serie es constante."""
    n = len(xs)
    if n < MIN_N or n != len(ys):
        return None
    mx, my = _media(xs), _media(ys)
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx <= 1e-12 or syy <= 1e-12:
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return max(-1.0, min(1.0, sxy / math.sqrt(sxx * syy)))


def _rangos(xs):
    """Rangos 1..n; los empates reciben el promedio de sus posiciones."""
    orden = sorted(range(len(xs)), key=lambda i: xs[i])
    rangos = [0.0] * len(xs)
    i = 0
    while i < len(orden):
        j = i
        while j + 1 < len(orden) and xs[orden[j + 1]] == xs[orden[i]]:
            j += 1
        promedio = (i + j) / 2 + 1
        for k in range(i, j + 1):
            rangos[orden[k]] = promedio
        i = j + 1
    return rangos


def spearman(xs, ys):
    """Pearson sobre los rangos: detecta relaciones que suben juntas aunque no sean una recta."""
    if len(xs) < MIN_N or len(xs) != len(ys):
        return None
    return pearson(_rangos(xs), _rangos(ys))


def p_aproximado(r, n):
    """p de dos colas por la transformación de Fisher (aproximada; necesita n > 3)."""
    if r is None or n <= 3:
        return None
    if abs(r) >= 1:
        return 0.0
    z = math.atanh(r) * math.sqrt(n - 3)
    return math.erfc(abs(z) / math.sqrt(2))


def confianza(n, p):
    """Qué tanto creerle al número: depende de cuántos talleres hay y de si el azar lo explica."""
    if n < MIN_N or p is None:
        return 'insuficiente'
    if n < N_CONFIABLE:
        return 'baja'
    if p < 0.05 and n >= N_SOLIDA:
        return 'alta'
    return 'media' if p < 0.1 else 'baja'


def intensidad(r):
    if r is None:
        return None
    a = abs(r)
    if a >= 0.7:
        return 'fuerte'
    if a >= 0.4:
        return 'moderada'
    if a >= 0.2:
        return 'débil'
    return 'nula'


def _par(xs_all, ys_all):
    """Correlaciona solo los talleres donde ambas métricas existen. Devuelve la celda lista para el JSON."""
    pares = [(x, y) for x, y in zip(xs_all, ys_all) if x is not None and y is not None]
    n = len(pares)
    xs, ys = [p[0] for p in pares], [p[1] for p in pares]
    constante = n >= MIN_N and (len(set(xs)) == 1 or len(set(ys)) == 1)
    r_p, r_s = pearson(xs, ys), spearman(xs, ys)
    p = p_aproximado(r_p, n)
    return {
        'n': n,
        'pearson': None if r_p is None else round(r_p, 3),
        'spearman': None if r_s is None else round(r_s, 3),
        'p': None if p is None else round(p, 4),
        'confianza': confianza(n, p),
        'intensidad': intensidad(r_p),
        'constante': constante,
    }


def calcular(valores, claves=None):
    """`valores`: {clave: [valor por taller, None si no existe]}. Matriz simétrica de celdas."""
    claves = claves or list(valores)
    return {a: {b: _par(valores[a], valores[b]) for b in claves} for a in claves}


def ranking(matriz, objetivo, metodo='pearson'):
    """Las demás métricas ordenadas por |r| contra `objetivo` (las sin cálculo van al final)."""
    filas = []
    for clave, celda in matriz[objetivo].items():
        if clave == objetivo:
            continue
        filas.append({'key': clave, **celda})
    filas.sort(key=lambda f: (f[metodo] is None, -abs(f[metodo] or 0)))
    return filas


# --- Armado desde la base ---

def _talleres_realizados(desde=None, hasta=None, hoy=None):
    """Los que ya ocurrieron y tienen algo cargado (un taller programado está todo en cero)."""
    hoy = hoy or date.today()
    consulta = WorkshopEvent.query.filter(WorkshopEvent.date <= hoy)
    if desde:
        consulta = consulta.filter(WorkshopEvent.date >= desde)
    if hasta:
        consulta = consulta.filter(WorkshopEvent.date <= hasta)
    eventos = consulta.order_by(WorkshopEvent.date.asc()).all()
    return [e for e in eventos if (e.leads_reales or e.whatsapp_leads or e.show_up or e.aplicaciones_form)]


def _redondear(v):
    return None if v is None else round(float(v), 4)


def armar(desde=None, hasta=None, objetivo=OBJETIVO_DEFECTO, ultimos=None, hoy=None):
    """Todo lo que pinta la pestaña: talleres con sus valores, matriz, ranking y advertencias."""
    if objetivo not in _POR_CLAVE:
        objetivo = OBJETIVO_DEFECTO
    eventos = _talleres_realizados(desde, hasta, hoy)
    if ultimos and ultimos > 0:
        eventos = eventos[-ultimos:]

    valores = {m['key']: [_redondear(m['fn'](e)) for e in eventos] for m in METRICAS}
    matriz = calcular(valores)
    n = len(eventos)
    avisos = []
    if n < MIN_N:
        avisos.append(f'Hay {n} talleres: con menos de {MIN_N} no se puede calcular ninguna correlación.')
    elif n < N_CONFIABLE:
        avisos.append(f'Solo {n} talleres: las correlaciones son muy inestables, un taller distinto las cambia.')
    avisos.append('Se comparan muchas parejas a la vez: algunas salen "fuertes" solo por azar.')

    return {
        'n_talleres': n,
        'objetivo': objetivo,
        'avisos': avisos,
        'notas': NOTAS,
        'ligadas': _ligadas(),
        'metricas': [{k: m[k] for k in ('key', 'label', 'grupo', 'formato', 'tip')} for m in METRICAS],
        'talleres': [{'id': e.id, 'date': e.date.isoformat(), 'name': e.name,
                      'valores': {k: valores[k][i] for k in valores}} for i, e in enumerate(eventos)],
        'matriz': matriz,
        'ranking': ranking(matriz, objetivo) if n else [],
    }


def parse_fecha(texto):
    """'YYYY-MM-DD' -> date, o None si viene vacío o mal escrito."""
    try:
        return date.fromisoformat(texto) if texto else None
    except ValueError:
        return None

