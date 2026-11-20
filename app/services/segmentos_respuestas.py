"""El corte «Respuesta» del panel Segmentos (ADR-W187): cuánto compra cada opción del formulario de agenda.

Mismo criterio que el ajuste de los puntos del segmento (`scripts/ajuste_segmentos.py`, que importa `ventas_nuevas`
de acá): una persona con formulario cuya primera agenda es desde `DESDE`, y «compró» si tiene una venta nueva entre
3 días antes y `VENTANA` días después de esa agenda (puede incluir señas: es la medida del experimento). Las de los
últimos `VENTANA // 2` días no entran: no tuvieron tiempo de comprar. Por eso este corte no sigue el período del
dashboard: con un mes no hay datos que digan algo.

Para cada opción: cuántos la eligieron, cuántos compraron, la mezcla de segmentos y los puntos que hoy le da al
segmento, con una marca cuando los puntos van para un lado y la compra para el otro (`revisar`).
"""
from collections import defaultdict
from datetime import datetime, timedelta

from app import db
from app.agendas_v2.modelos import SchedFormulario
from app.models.booking import Appointment
from app.models.client import Client
from app.models.financial import FinancialSale
from app.models.sale import Sale
from app.services import formulario_respuestas as fr

DESDE = datetime(2026, 6, 1)
VENTANA = 60
POCOS = 40
SEGMENTOS = ('A', 'B', 'C', 'D')


def ventas_nuevas():
    """{('c', client_id) | ('p', person_uuid): [(fecha, monto)]} de las ventas nuevas no canceladas."""
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


def personas(desde=DESDE, ahora=None):
    """Una fila por cliente con formulario: {id, nombre, resp, compro, segmento, fecha}."""
    hasta = (ahora or datetime.utcnow()) - timedelta(days=VENTANA // 2)
    ventas = ventas_nuevas()
    primera = {}
    for cid, creada in db.session.query(Appointment.client_id, Appointment.created_at).filter(
            Appointment.created_at >= desde):
        if cid and (cid not in primera or creada < primera[cid]):
            primera[cid] = creada
    filas = []
    for c in Client.query.filter((Client.formulario_payload.isnot(None)) | (Client.form_data.isnot(None))):
        resp = fr.de_cliente(c)
        if resp is None:
            continue
        fecha = primera.get(c.id) or c.created_at
        if not fecha or not (desde <= fecha <= hasta):
            continue
        vs = ventas.get(('c', c.id), []) + (ventas.get(('p', c.person_uuid), []) if c.person_uuid else [])
        compro = any(d and fecha - timedelta(days=3) <= d <= fecha + timedelta(days=VENTANA) for d, _ in vs)
        filas.append({'id': c.id, 'nombre': c.full_name, 'email': c.email, 'resp': resp, 'compro': compro,
                      'segmento': c.segmento if c.segmento in SEGMENTOS else 'sin',
                      'fecha': fecha.date().isoformat()})
    return filas


def _pct(a, b):
    return round(a * 100 / b, 1) if b else None


def _revisar(puntos, pct, prom, n):
    """Los puntos van para un lado y la compra para el otro (solo con datos suficientes)."""
    if puntos is None or pct is None or n < POCOS:
        return False
    if puntos > 0:
        return pct < prom * 0.9
    if puntos < 0:
        return pct > prom * 0.9
    return abs(pct - prom) > prom * 0.3


def _preguntas_del_formulario():
    fila = db.session.get(SchedFormulario, fr.FORM_ID)
    preguntas = {q['id']: q for q in ((fila.datos or {}).get('preguntas') or [])} if fila else {}
    return preguntas


def resumen(ahora=None):
    filas = personas(ahora=ahora)
    total, compraron = len(filas), sum(1 for f in filas if f['compro'])
    prom = _pct(compraron, total) or 0
    preguntas = _preguntas_del_formulario()
    salida = []
    for qid in fr.PREGUNTAS:
        q = preguntas.get(qid, {})
        cuenta = defaultdict(lambda: {'n': 0, 'compraron': 0, 'mezcla': dict.fromkeys(SEGMENTOS + ('sin',), 0)})
        for f in filas:
            op = f['resp'].get(qid) or 'sin_respuesta'
            c = cuenta[op]
            c['n'] += 1
            c['compraron'] += 1 if f['compro'] else 0
            c['mezcla'][f['segmento']] += 1
        opciones = []
        for o in (q.get('opciones') or []):
            if o['id'] in cuenta:
                opciones.append((o['id'], o.get('corto') or o.get('texto') or o['id'], o.get('puntosSeg')))
        opciones += [(k, 'Sin respuesta' if k == 'sin_respuesta' else k, None)
                     for k in cuenta if k not in {x[0] for x in opciones}]
        filas_q = []
        for oid, texto, puntos in opciones:
            c = cuenta[oid]
            pct = _pct(c['compraron'], c['n'])
            filas_q.append({'id': oid, 'texto': texto, 'n': c['n'], 'compraron': c['compraron'], 'pct': pct,
                            'mezcla': c['mezcla'], 'puntos': puntos, 'pocos': c['n'] < POCOS,
                            'revisar': _revisar(puntos, pct, prom, c['n'])})
        salida.append({'id': qid, 'titulo': q.get('titulo') or qid, 'opciones': filas_q})
    return {'desde': DESDE.date().isoformat(), 'ventana': VENTANA, 'total': total, 'compraron': compraron,
            'pct': prom, 'preguntas': salida, 'cruce': _cruce(filas)}


def _cruce(filas):
    """Quién decide × si puede invertir: el mejor y el peor par, para la conclusión del panel «Por qué compran»."""
    puede = {'oglxqq0u44o', 'ogmdr0s275v', 'oa9pmy94tfg'}
    solo = {'ognajtws1ke'}
    celdas = defaultdict(lambda: [0, 0])
    for f in filas:
        d, i = f['resp'].get(fr.DECIDE), f['resp'].get(fr.INVERSION)
        if not d or not i:
            continue
        k = ('solo' if d in solo else 'apoyo', 'puede' if i in puede else 'no_puede')
        celdas[k][0] += 1
        celdas[k][1] += 1 if f['compro'] else 0
    return [{'decide': d, 'invierte': i, 'n': n, 'compraron': y, 'pct': _pct(y, n)}
            for (d, i), (n, y) in sorted(celdas.items())]


def personas_de(qid, opcion):
    """Las personas de una opción, para la lista del panel: las que compraron primero."""
    filas = [f for f in personas() if (f['resp'].get(qid) or 'sin_respuesta') == opcion]
    filas.sort(key=lambda f: (not f['compro'], f['fecha']), reverse=False)
    return [{k: f[k] for k in ('id', 'nombre', 'email', 'compro', 'segmento', 'fecha')} for f in filas]
