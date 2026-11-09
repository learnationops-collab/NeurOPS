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
    # Misma base que el Resumen (`funnelMath.js`): las citas reportadas; sin ese dato, las agendas.
    _metrica('show_up_citas', 'Show up de citas', 'Agendas',
             lambda e: _ratio(e.show_up_sales_call,
                              e.citas_reportadas if e.citas_reportadas is not None else e.agendas_exitosas, 100),
             'pct', 'Asistentes a la llamada ÷ citas reportadas'),
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
    'ticket': ('cash_collected', 'ventas'), 'roas': ('cash_collected', 'inversion'),
}
# El cash crece con las ventas, así que lo que se arma con uno arrastra al otro.
LIGADAS_EXTRA = (('cash_collected', 'ventas'), ('roas', 'ventas'), ('close_rate', 'cash_collected'),
                 ('close_rate', 'roas'))

# Las cuotas de un taller se siguen cobrando semanas después: antes de esto, sus ventas y su cash
# todavía no están completos y arrastran a la baja todo lo que se compara con ellos.
MADUREZ_DIAS = 30
METRICAS_DE_VENTA = ('close_rate', 'ventas', 'ticket', 'cash_collected', 'roas')
# Corrección por comparaciones múltiples (Benjamini-Hochberg): el punto del mapa solo marca los pares
# que siguen sin explicarse por azar después de corregir por todos los que se comparan a la vez.
Q_FIRME = 0.10


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
    p, p_s = p_aproximado(r_p, n), p_aproximado(r_s, n)
    # Cada método con su propio p (antes la confianza usaba siempre el de Pearson). `q` y `firme`
    # los completa `corregir_por_azar` cuando ve todos los pares juntos.
    por_metodo = {
        'pearson': {'p': None if p is None else round(p, 4), 'q': None, 'firme': False, 'confianza': confianza(n, p)},
        'spearman': {'p': None if p_s is None else round(p_s, 4), 'q': None, 'firme': False, 'confianza': confianza(n, p_s)},
    }
    return {
        'n': n,
        'pearson': None if r_p is None else round(r_p, 3),
        'spearman': None if r_s is None else round(r_s, 3),
        'p': por_metodo['pearson']['p'],
        'confianza': por_metodo['pearson']['confianza'],
        'por_metodo': por_metodo,
        'intensidad': intensidad(r_p),
        'constante': constante,
    }


def benjamini_hochberg(ps):
    """q de cada p (mismo orden): el p corregido por la cantidad de comparaciones hechas a la vez."""
    m = len(ps)
    orden = sorted(range(m), key=lambda i: ps[i])
    qs = [0.0] * m
    minimo = 1.0
    for rango in range(m, 0, -1):
        i = orden[rango - 1]
        minimo = min(minimo, ps[i] * m / rango)
        qs[i] = minimo
    return qs


def corregir_por_azar(matriz, claves, ligadas):
    """Completa `q` y `firme` en cada celda: los pares de negocio (sin los «por construcción») se
    corrigen juntos, por método. La confianza pasa a leerse sobre el q, no sobre el p suelto."""
    for metodo in ('pearson', 'spearman'):
        pares = [(a, b) for i, a in enumerate(claves) for b in claves[i + 1:]
                 if frozenset((a, b)) not in ligadas and matriz[a][b]['por_metodo'][metodo]['p'] is not None]
        qs = benjamini_hochberg([matriz[a][b]['por_metodo'][metodo]['p'] for a, b in pares])
        for (a, b), q in zip(pares, qs):
            for x, y in ((a, b), (b, a)):
                celda = matriz[x][y]
                bloque = celda['por_metodo'][metodo]
                bloque['q'] = round(q, 4)
                bloque['firme'] = celda['n'] >= N_CONFIABLE and q < Q_FIRME
                bloque['confianza'] = confianza(celda['n'], q)
                if metodo == 'pearson':
                    celda['confianza'] = bloque['confianza']
    return matriz


def calcular(valores, claves=None):
    """`valores`: {clave: [valor por taller, None si no existe]}. Matriz simétrica de celdas."""
    claves = claves or list(valores)
    matriz = {a: {b: _par(valores[a], valores[b]) for b in claves} for a in claves}
    return corregir_por_azar(matriz, claves, {frozenset(p) for p in _ligadas()})


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


def _dia_mes(d):
    return d.strftime('%d/%m')


def _limpiar(valores, eventos, hoy):
    """Saca (deja en None) lo que no se puede comparar todavía y devuelve los avisos que lo explican:
    las ventas de los talleres sin madurar y los porcentajes imposibles (más de 100%)."""
    avisos = []
    jovenes = [i for i, e in enumerate(eventos) if (hoy - e.date).days < MADUREZ_DIAS]
    for clave in METRICAS_DE_VENTA:
        for i in jovenes:
            valores[clave][i] = None
    if jovenes:
        fechas = ', '.join(_dia_mes(eventos[i].date) for i in jovenes)
        avisos.append(f'Ventas, cash, ticket, close rate y ROAS no cuentan los talleres de menos de {MADUREZ_DIAS} '
                      f'días ({fechas}): sus cuotas todavía se están cobrando.')
    for m in METRICAS:
        if m['formato'] != 'pct':
            continue
        for i, v in enumerate(valores[m['key']]):
            if v is not None and v > 100:
                valores[m['key']][i] = None
                avisos.append(f'Se excluye {m["label"]} del {_dia_mes(eventos[i].date)} ({v:.0f}%): '
                              'pasa de 100%, falta un dato en la carga del taller.')
    return avisos


def armar(desde=None, hasta=None, objetivo=OBJETIVO_DEFECTO, ultimos=None, hoy=None):
    """Todo lo que pinta la pestaña: talleres con sus valores, matriz, ranking y advertencias."""
    if objetivo not in _POR_CLAVE:
        objetivo = OBJETIVO_DEFECTO
    eventos = _talleres_realizados(desde, hasta, hoy)
    if ultimos and ultimos > 0:
        eventos = eventos[-ultimos:]

    valores = {m['key']: [_redondear(m['fn'](e)) for e in eventos] for m in METRICAS}
    excluidos = _limpiar(valores, eventos, hoy or date.today())
    matriz = calcular(valores)
    n = len(eventos)
    avisos = []
    if n < MIN_N:
        avisos.append(f'Hay {n} talleres: con menos de {MIN_N} no se puede calcular ninguna correlación.')
    elif n < N_CONFIABLE:
        avisos.append(f'Solo {n} talleres: las correlaciones son muy inestables, un taller distinto las cambia.')
    avisos.append('Se comparan muchas parejas a la vez: el punto marca solo las que siguen sin explicarse '
                  'por azar después de corregir por todas.')
    avisos.extend(excluidos)

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

