"""Proyección con tendencia del Simulador (06/11/2026, ADR-W111).

La Proyección del Simulador (`modelo.js`) multiplica el ritmo por día hábil de una ventana por los
días que faltan: no ve si una cifra viene subiendo o bajando ni que los días de la semana rinden
distinto. Acá se proyecta el resto del mes con modelos ENTRENADOS sobre los datos diarios y se elige,
cifra por cifra, el que menos se equivocó en una prueba hacia atrás:

  · «Ritmo 30 días» y «Ritmo 60 días»: el cálculo de siempre (lo que hoy hace el Simulador);
  · «Día de la semana»: regresión de Poisson con el día de la semana (últimos 90 días);
  · «Tendencia + día»: la misma con una tendencia, amortiguada para no estirar una recta un mes;
  · «Combinado»: el promedio de «Ritmo 30 días» y «Tendencia + día».

Las regresiones se ajustan minimizando el error de Poisson con Newton (IRLS) y una penalización
ridge. La red neuronal se probó y se descartó: con ~14 ventas por mes aprende el ruido y se equivoca
más (prueba del 06/11/2026).

La prueba hacia atrás: desde cada lunes con al menos 60 días de historia, cada modelo proyecta los
28 días siguientes con lo anterior y se compara con lo que pasó (error = suma de |proyectado − real|
sobre la suma de lo real). Ese error es también el rango que se muestra. Las cifras salen de las
mismas fuentes que la línea base (`comercial_simulador`): agendas, ventas y generadas de
`ComercialService`, entrantes y agendas de anuncios del tablero de Marketing.
"""
import calendar
import logging
from datetime import date, timedelta

import numpy as np

from app.services import anuncios_service
from app.services.comercial_service import ComercialService
from app.services.comercial_simulador import _dia

logger = logging.getLogger(__name__)

DIAS_HISTORIA = 200
H_PRUEBA = 28
MINIMO_HISTORIA = 60
VENTANA_GLM = 90

CIFRAS = (
    ('generadas', 'Agendas generadas', False),
    ('asistieron', 'Asistieron', False),
    ('agendas_ads', 'Agendas de anuncios', False),
    ('entrantes_ads', 'Entrantes de anuncios', False),
    ('ventas', 'Ventas', False),
    ('cash_nuevas', 'Cash de ventas nuevas', True),
)

_cache = {}


def _series(desde, hasta):
    """{cifra: np.array diaria} de `desde` a `hasta`, ambos incluidos."""
    n = (hasta - desde).days + 1
    iso = [(desde + timedelta(i)).isoformat() for i in range(n)]
    pos = {f: i for i, f in enumerate(iso)}
    s = {c: np.zeros(n) for c, _, _ in CIFRAS}

    def por_dia(filas, campo):
        grupos = {}
        for f in filas:
            d = _dia(f.get(campo))
            if d in pos:
                grupos.setdefault(d, []).append(f)
        return grupos

    for d, fs in por_dia(ComercialService.agendas(desde, hasta), 'fecha').items():
        t = ComercialService.totales_agendas(fs)
        s['asistieron'][pos[d]] = t['asistieron']
        s['ventas'][pos[d]] = t['ventas']
    for d, fs in por_dia(ComercialService.generadas(desde, hasta), 'creada').items():
        s['generadas'][pos[d]] = len(fs)
    for d, fs in por_dia(ComercialService.ventas(desde, hasta), 'fecha').items():
        s['cash_nuevas'][pos[d]] = sum(f['monto'] for f in fs if f['es_venta'])
    for fila in anuncios_service.tablero(desde, hasta)['filas']:
        for f, v in fila['dias'].items():
            if f in pos:
                s['entrantes_ads'][pos[f]] += v[0]
                s['agendas_ads'][pos[f]] += v[3]
    return s


# --- Modelos ------------------------------------------------------------------------------------

def _ritmo(y, hab, o, h, ventana):
    a = max(0, o - ventana)
    dias = hab[a:o].sum()
    return y[a:o].sum() / dias * hab[o:o + h].sum() if dias else None


def _poisson(X, y, l2=1.0, pasos=25):
    """Pesos que minimizan el error de Poisson (Newton/IRLS) con ridge, sin penalizar el intercepto."""
    w = np.zeros(X.shape[1])
    w[0] = np.log(y.mean() + 1e-3)
    pen = np.full(X.shape[1], l2)
    pen[0] = 0.0
    for _ in range(pasos):
        lam = np.exp(np.clip(X @ w, -20, 20))
        grad = X.T @ (lam - y) + pen * w
        hess = (X * lam[:, None]).T @ X + np.diag(pen) + 1e-6 * np.eye(len(w))
        paso = np.linalg.solve(hess, grad)
        w -= paso
        if np.abs(paso).max() < 1e-6:
            break
    return w


def _X(dow, idx, a, tendencia):
    cols = [np.ones(len(idx))]
    if tendencia:
        cols.append((idx - a) / 90.0)
    cols += [(dow[idx] == k).astype(float) for k in range(6)]
    return np.column_stack(cols)


def _glm(y, dow, o, h, inicio, tendencia):
    a = max(inicio, o - VENTANA_GLM)
    idx, fut = np.arange(a, o), np.arange(o, o + h)
    if y[idx].sum() == 0:
        return 0.0
    w = _poisson(_X(dow, idx, a, tendencia), y[idx])
    Xf = _X(dow, fut, a, tendencia)
    if tendencia:
        # Amortiguada: la tendencia sigue a lo sumo dos semanas más allá del último dato.
        Xf[:, 1] = np.minimum(Xf[:, 1], (o - a + 14) / 90.0)
    return float(np.exp(np.clip(Xf @ w, -20, 20)).sum())


def _modelos(y, dow, hab, o, h, inicio):
    r30 = _ritmo(y, hab, o, h, 30)
    tend = _glm(y, dow, o, h, inicio, True)
    return {
        'Ritmo 30 días': r30,
        'Ritmo 60 días': _ritmo(y, hab, o, h, 60),
        'Día de la semana': _glm(y, dow, o, h, inicio, False),
        'Tendencia + día': tend,
        'Combinado': None if r30 is None else (r30 + tend) / 2,
    }


def _prueba(y, dow, hab, inicio, fin):
    """{modelo: error %} proyectando 28 días desde cada lunes con historia suficiente."""
    err, real_tot = {}, 0.0
    for o in range(inicio + MINIMO_HISTORIA, fin - H_PRUEBA + 1):
        if dow[o] != 0:
            continue
        real = y[o:o + H_PRUEBA].sum()
        real_tot += real
        for nombre, v in _modelos(y, dow, hab, o, H_PRUEBA, inicio).items():
            if v is not None:
                err[nombre] = err.get(nombre, 0.0) + abs(v - real)
    if not real_tot:
        return {}
    return {k: round(v / real_tot * 100, 1) for k, v in err.items()}


# --- Proyección del mes -------------------------------------------------------------------------

def proyeccion(hoy=None, clave_cache=None):
    """El resto del mes de cada cifra: lo que ya pasó, lo proyectado con el mejor modelo, su rango
    (± el error de la prueba), el mes anterior y el cálculo de siempre (ritmo de 30 días)."""
    hoy = hoy or date.today()
    clave = (hoy.isoformat(), clave_cache)
    if clave in _cache:
        return _cache[clave]
    ayer = hoy - timedelta(days=1)
    desde = hoy - timedelta(days=DIAS_HISTORIA)
    primero = hoy.replace(day=1)
    ultimo = hoy.replace(day=calendar.monthrange(hoy.year, hoy.month)[1])
    series = _series(desde, ayer)
    n_hist = (ayer - desde).days + 1
    n = n_hist + (ultimo - ayer).days
    dow = np.array([(desde + timedelta(i)).weekday() for i in range(n)])
    hab = (dow < 5).astype(float)
    o, h = n_hist, (ultimo - ayer).days
    i_mes = (primero - desde).days
    ant_fin = primero - timedelta(days=1)
    i_ant = (ant_fin.replace(day=1) - desde).days
    cifras = []
    for clave_c, titulo, es_dinero in CIFRAS:
        y = np.r_[series[clave_c], np.zeros(h)]
        nz = np.flatnonzero(y[:n_hist])
        inicio = int(nz[0]) if len(nz) else n_hist
        hecho = float(y[i_mes:o].sum())
        anterior = float(y[i_ant:i_mes].sum()) if i_ant >= inicio else None
        errores = _prueba(y, dow, hab, inicio, n_hist)
        modelos = _modelos(y, dow, hab, o, h, inicio) if o - inicio >= MINIMO_HISTORIA else {}
        candidatos = [m for m in errores if modelos.get(m) is not None]
        if not candidatos:
            cifras.append({'clave': clave_c, 'titulo': titulo, 'dinero': es_dinero, 'hecho': hecho,
                           'total': None, 'anterior': anterior})
            continue
        mejor = min(candidatos, key=lambda m: errores[m])
        e = errores[mejor] / 100
        resto, actual = modelos[mejor], modelos['Ritmo 30 días']
        cifras.append({
            'clave': clave_c, 'titulo': titulo, 'dinero': es_dinero,
            'hecho': round(hecho, 2),
            'total': round(hecho + resto, 2),
            'bajo': round(hecho + resto * (1 - e), 2),
            'alto': round(hecho + resto * (1 + e), 2),
            'modelo': mejor, 'error': errores[mejor],
            'actual': {'total': round(hecho + actual, 2), 'bajo': round(hecho + actual * (1 - errores['Ritmo 30 días'] / 100), 2),
                       'alto': round(hecho + actual * (1 + errores['Ritmo 30 días'] / 100), 2),
                       'error': errores['Ritmo 30 días']},
            'anterior': anterior,
            'errores': errores,
        })
    res = {'hoy': hoy.isoformat(), 'mes': primero.isoformat()[:7], 'hasta': ayer.isoformat(),
           'dias_restantes': h, 'cifras': cifras}
    _cache.clear()
    _cache[clave] = res
    return res
