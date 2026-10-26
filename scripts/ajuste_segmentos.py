"""Ajuste mensual de los puntos del segmento A/B/C/D (docs/plan_segmentos_triage.md §8.9). Solo lectura.

Arma formulario → compra (venta nueva en `sales` o `financial_sales` dentro de VENTANA días de su primera
agenda), ajusta una logística penalizada (L2, λ por validación cruzada) y propone los puntos enteros: el
efecto de cada respuesta centrado en el lead promedio, a escala -3..+3. Después compara la segmentación
cargada en el formulario con la propuesta. Los puntos se cargan a mano en scripts/segmentos_formulario.py.

Uso (en el servidor):
  python scripts/ajuste_segmentos.py                       # leads desde el 01/06/2026
  python scripts/ajuste_segmentos.py --desde 2026-09-01
"""
import math
import os
import random
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'
os.environ['FOLLOWUP_REMINDERS_ENABLED'] = 'false'

from app import create_app, db  # noqa: E402
from app.agendas_v2.modelos import SchedFormulario  # noqa: E402
from app.agendas_v2.nucleo.normalizar import normal_form  # noqa: E402
from app.agendas_v2.nucleo.segmento import segmentar  # noqa: E402
from app.models.booking import Appointment  # noqa: E402
from app.models.client import Client  # noqa: E402
from app.models.financial import FinancialSale  # noqa: E402
from app.models.sale import Sale  # noqa: E402
from scripts.backfill_segmentos import FORM_ID, _de_thalamus, resp_de_form_data, resp_de_payload  # noqa: E402

INV, ETA, EXA, DEC = 'qglxqqlsgya', 'qg8xclvqc4c', 'qg6raaks2pe', 'qgnajtuxkuz'
VENTANA = 60
LAMBDAS = (1, 2, 4, 8, 16)
# Niveles del ajuste: las opciones con pocos datos se juntan con la más parecida.
NIVEL = {
    INV: {'ogmgmpvwtgt': 'inv500+', 'oa9pmy94tfg': 'inv500+', 'ogmdr0s275v': 'inv500+',
          'oglxqq0u44o': 'inv200-500', 'o8slpjgvje7': 'inv_no', 'oglxqqlugub': 'inv_no'},
    ETA: {'og8xclet205': 'estudiante', 'og8xclf4go4': 'rural', 'og94zlvu9m2': 'general',
          'og9azfspw7e': 'residente', 'og9ed3qtpzx': 'especialista'},
    EXA: {'og77bdut6ym': 'colombia', 'og6raas2nv9': 'peru', 'og7cr7tiwh9': 'mir', 'og7imnc8sh8': 'enarm',
          'og6raaoi8vy': 'usmle', 'og7nm9cskac': 'otro', 'og-ecuador': 'otro', 'og-chile': 'otro',
          'og-panama': 'otro', 'og7p4glxgce': 'no_examen'},
    DEC: {'ognajtws1ke': 'solo_yo', 'ognajtnj7rg': 'apoyo', 'og-pareja': 'apoyo', 'og-otra-persona': 'apoyo'},
}
QS = list(NIVEL)


def _ventas():
    v = defaultdict(list)
    for s in Sale.query.filter(Sale.kind == 'new').all():
        if s.status in ('cancelled', 'canceled', 'void', 'refunded'):
            continue
        for k in (('c', s.client_id), ('p', s.person_uuid)):
            if k[1]:
                v[k].append((s.sold_at, s.agreed_total or 0))
    for f in FinancialSale.query.all():
        if (f.estado or '').lower().startswith('cancel'):
            continue
        for k in (('c', f.client_id), ('p', f.person_uuid)):
            if k[1]:
                v[k].append((f.date or f.created_at, f.monto or 0))
    return v


def dataset(desde):
    hasta = datetime.utcnow() - timedelta(days=VENTANA // 2)
    ventas = _ventas()
    primera = {}
    for a in Appointment.query.filter(Appointment.created_at >= desde).all():
        if a.client_id not in primera or a.created_at < primera[a.client_id]:
            primera[a.client_id] = a.created_at
    filas = []
    for c in Client.query.filter((Client.formulario_payload.isnot(None)) | (Client.form_data.isnot(None))).all():
        if _de_thalamus(c.formulario_payload):
            resp, fuente = resp_de_payload(c.formulario_payload), 'thalamus'
        elif isinstance(c.form_data, dict) and c.form_data:
            resp, fuente = resp_de_form_data(c.form_data), 'viejo'
        else:
            continue
        fecha = primera.get(c.id) or c.created_at
        if not fecha or not (desde <= fecha <= hasta):
            continue
        vs = ventas.get(('c', c.id), []) + (ventas.get(('p', c.person_uuid), []) if c.person_uuid else [])
        vs = [m for d, m in vs if d and fecha - timedelta(days=3) <= d <= fecha + timedelta(days=VENTANA)]
        filas.append({'resp': resp, 'fuente': fuente, 'y': 1 if vs else 0, 'ticket': max(vs, default=0)})
    return filas


# --- logística penalizada por Newton (sin numpy: el servidor no lo garantiza) ---
def _resolver(A, b):
    n = len(b)
    M = [fila[:] + [b[i]] for i, fila in enumerate(A)]
    for i in range(n):
        p = max(range(i, n), key=lambda r: abs(M[r][i]))
        M[i], M[p] = M[p], M[i]
        for r in range(n):
            if r != i and M[i][i]:
                f = M[r][i] / M[i][i]
                for k in range(i, n + 1):
                    M[r][k] -= f * M[i][k]
    return [M[i][n] / M[i][i] for i in range(n)]


def _sig(z):
    return 1 / (1 + math.exp(-max(-30, min(30, z))))


def ajustar(X, y, lam):
    p = len(X[0])
    w = [0.0] * p
    w[0] = math.log((sum(y) + .5) / (len(y) - sum(y) + .5))
    for _ in range(50):
        g = [0.0] * p
        H = [[0.0] * p for _ in range(p)]
        for xi, yi in zip(X, y):
            mu = _sig(sum(a * b for a, b in zip(w, xi)))
            idx = [j for j, v in enumerate(xi) if v]
            for j in idx:
                g[j] += yi - mu
                for k in idx:
                    H[j][k] += mu * (1 - mu)
        for j in range(1, p):
            g[j] -= lam * w[j]
            H[j][j] += lam
        paso = _resolver(H, g)
        w = [a + b for a, b in zip(w, paso)]
        if max(abs(s) for s in paso) < 1e-7:
            break
    return w


def auc(s, y):
    pares = sorted(zip(s, y))
    rangos, i = [0.0] * len(pares), 0
    while i < len(pares):
        j = i
        while j < len(pares) and pares[j][0] == pares[i][0]:
            j += 1
        for k in range(i, j):
            rangos[k] = (i + j + 1) / 2
        i = j
    n1 = sum(y)
    n0 = len(y) - n1
    r1 = sum(r for r, (_, yy) in zip(rangos, pares) if yy)
    return (r1 - n1 * (n1 + 1) / 2) / (n1 * n0) if n1 and n0 else float('nan')


NIVELES = [(q, n) for q in QS for n in sorted(set(NIVEL[q].values()))]
COL = {qn: i + 1 for i, qn in enumerate(NIVELES)}


def _x(f):
    x = [0.0] * (len(NIVELES) + 1)
    x[0] = 1.0
    for q in QS:
        n = NIVEL[q].get(f['resp'].get(q))
        if n:
            x[COL[(q, n)]] = 1.0
    return x


def efectos(filas, lam):
    """Efecto de cada nivel centrado en el promedio de su pregunta (una pregunta sin responder suma 0)."""
    w = ajustar([_x(f) for f in filas], [f['y'] for f in filas], lam)
    cuenta = Counter((q, NIVEL[q].get(f['resp'].get(q))) for f in filas for q in QS)
    out = {}
    for q in QS:
        ns = sorted(set(NIVEL[q].values()))
        media = sum(w[COL[(q, n)]] * cuenta[(q, n)] for n in ns) / (sum(cuenta[(q, n)] for n in ns) or 1)
        out.update({(q, n): w[COL[(q, n)]] - media for n in ns})
    return out, cuenta


def elegir_lambda(filas):
    y = [f['y'] for f in filas]
    X = [_x(f) for f in filas]
    mejor = None
    for lam in LAMBDAS:
        perdida, aucs = 0.0, []
        for rep in range(3):
            idx = list(range(len(y)))
            random.Random(rep).shuffle(idx)
            for k in range(5):
                te = set(idx[k::5])
                w = ajustar([X[i] for i in idx if i not in te], [y[i] for i in idx if i not in te], lam)
                s = [sum(a * b for a, b in zip(w, X[i])) for i in te]
                perdida += sum(-math.log(_sig(z) if y[i] else 1 - _sig(z)) for z, i in zip(s, te))
                aucs.append(auc(s, [y[i] for i in te]))
        print(f'  λ {lam:>3}: log-loss {perdida / 3:.1f} · AUC fuera de muestra {sum(aucs) / len(aucs):.3f}')
        if mejor is None or perdida < mejor[0]:
            mejor = (perdida, lam)
    return mejor[1]


def tabla_segmentos(filas, segs, titulo):
    t = defaultdict(lambda: [0, 0, 0.0])
    for f, s in zip(filas, segs):
        t[s][0] += 1
        t[s][1] += f['y']
        t[s][2] += f['ticket']
    print(titulo)
    for s in ('A', 'B', 'C', 'D', None):
        n, k, plata = t[s]
        if n:
            print(f'  {s or "sin":>3}: {n:4d} leads ({n / len(filas) * 100:4.1f}%) · compra {k / n * 100:5.1f}% · ${plata / n:.0f} por lead')


def main(desde):
    app = create_app()
    with app.app_context():
        fila = db.session.get(SchedFormulario, FORM_ID)
        form = normal_form(FORM_ID, fila.datos if fila else {})
        filas = dataset(desde)
        db.session.rollback()
    y = [f['y'] for f in filas]
    print(f'{len(filas)} leads desde {desde.date()} · {sum(y)} compras a {VENTANA} días ({sum(y) / max(len(y), 1) * 100:.1f}%) · '
          f'{Counter(f["fuente"] for f in filas)}')
    if sum(y) < 30:
        raise SystemExit('Menos de 30 compras: no alcanza para ajustar.')
    lam = elegir_lambda(filas)
    beta, cuenta = efectos(filas, lam)
    unidad = max(abs(b) for b in beta.values()) / 3
    print(f'\nλ elegido {lam} · un punto = {unidad:.3f} de log-odds')
    for q in QS:
        print(f'  {q} (sin responder: {cuenta[(q, None)]})')
        for (qq, n), b in sorted(beta.items(), key=lambda kv: -kv[1]):
            if qq == q:
                print(f'    {n:14s} {cuenta[(q, n)]:4d} leads · efecto {b:+.2f} · propuesta {max(-3, min(3, round(b / unidad))):+d}')

    hoy = [(segmentar(form, f['resp']) or {}).get('segmento') for f in filas]
    puntos = [(segmentar(form, f['resp']) or {}).get('puntos') or 0 for f in filas]
    print(f'\nAUC de los puntos cargados en el formulario: {auc(puntos, y):.3f} (versión {(form.get("segmento") or {}).get("version")})')
    tabla_segmentos(filas, hoy, 'Segmentación cargada:')


if __name__ == '__main__':
    arg = sys.argv[sys.argv.index('--desde') + 1] if '--desde' in sys.argv else '2026-06-01'
    main(datetime.fromisoformat(arg))
