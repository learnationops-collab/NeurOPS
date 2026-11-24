"""`GET /api/reporte/detalle`: el modal de cada número (valor, cómo se calcula y los registros que lo componen)."""
from datetime import datetime

from app.reporte_dia import closer_detalle, setter_detalle
from app.reporte_dia.comun import cierre_de, datos, hora_local
from app.reporte_dia.dia import armar, calcular, modulo
from app.services.user_time_service import hoy_del_usuario

COMO_MANO = 'Este dato no lo ve el sistema: lo cargaste a mano en «Antes de que se cierre». Lo podés cambiar ahí.'
SI = ('Asistió', 'Presentó', 'Confirmada', 'Cualificado', 'No show')
# Tasas cuya lista marca en la última columna si cada registro suma o no.
SI_NO = ('show_rate', 'no_show_rate', 'pitch_rate', 'confirm_today', 'confirm_future', 'cualificacion')


def _items(numeros, mano):
    """(clave, l, v, f, es_mano) de todos los números del día, como los ve la persona. Lo cargado a mano
    va primero: un kpi que repite un dato a mano (las recuperaciones del triage) abre su detalle de mano."""
    for m in mano:
        yield m['clave'], m['campo'], m['valor'], 'n', True
    for k in numeros.get('kpis') or []:
        yield k['clave'], k['l'], k['v'], k['f'], False
    emb = numeros.get('embudo') or {}
    for p in emb.get('pasos') or []:
        yield p['clave'], p['l'], p['v'], emb.get('unidad') or 'n', False
    for b in numeros.get('bloques') or []:
        if b['t'] == 'comparar':
            for fila in b['filas']:
                for col, c in zip(b['cols'], fila['celdas']):
                    yield c['clave'], f"{fila['l']} · {col}", c['v'], 'n', bool(c.get('mano'))
        elif b['t'] == 'mix':
            yield b['total']['clave'], b['tit'], b['total']['v'], b['f'], False
            for p in b['partes']:
                yield p['clave'], p['l'], p['v'], b['f'], False
            for p in b.get('pie') or []:
                yield p['clave'], p['l'], p['v'], p.get('f') or 'n', False
        elif b['t'] == 'pasos':
            for s in b['series']:
                for p in s['pasos']:
                    yield p['clave'], (f"{s['nombre']} · {p['l']}" if s['nombre'] else p['l']), p['v'], 'n', bool(p.get('mano'))
        elif b['t'] == 'cifras':
            for p in b['items']:
                yield p['clave'], p['l'], p['v'], 'n', bool(p.get('mano'))
    for t in numeros.get('tasas') or []:
        yield t['clave'], t['l'], t['v'], '%', False


def _buscar(numeros, mano, clave):
    for item in _items(numeros, mano):
        if item[0] == clave:
            return item
    return None


def _cuando(user, iso):
    try:
        return f"{datetime.fromisoformat(iso.replace('Z', '')).strftime('%d/%m')} {hora_local(user, iso)}"
    except (AttributeError, ValueError):
        return ''


def _registros(user, dia, rol, clave, ctx):
    if rol == 'closer':
        r = closer_detalle.registros(user, dia, clave)
        if r is not None:
            r.setdefault('como', closer_detalle.como(clave))
        return r
    if rol == 'setter':
        return setter_detalle.registros(user, dia, clave, ctx)
    return modulo(rol).registros(user, dia, clave, ctx)


def armar_detalle(user, dia, rol, clave):
    """El JSON del modal, o None si la clave no existe ese día."""
    m = modulo(rol)
    close = cierre_de(user, dia)
    calc = calcular(user, dia, rol, close)
    payload = armar(user, dia, rol, calc)
    item = _buscar(payload['numeros'], calc['mano'], clave)
    if item is None:
        return None
    _, l, v, f, es_mano = item
    fuente = getattr(m, 'FUENTE_DETALLE', '')
    if es_mano:
        meta = datos(close)['mano_meta'].get(clave) or {}
        filas = [[_cuando(user, meta.get('en')), meta.get('por') or 'Vos', str(v)]] if v is not None else []
        return {'l': l, 'v': v, 'f': f, 'como': COMO_MANO, 'cols': ['Cuándo', 'Quién', 'Valor'], 'filas': filas,
                'fuente': 'Cargado a mano', 'mano': True, 'vacio': 'Todavía no lo cargaste.'}
    r = _registros(user, dia, rol, clave, calc['ctx']) or {}
    como = r.get('como') or f'Cada registro del día que entra en «{l}».'
    cuando = 'Hoy' if dia == hoy_del_usuario(user) else 'Ese día'
    filas = r.get('filas') or []
    if clave in SI_NO and v is not None and filas:
        a = sum(1 for fila in filas if fila and fila[-1] in SI)
        como = f"{como} {cuando}: {a} de {len(filas)} = {v}%."
    corregido = datos(close)['correcciones'].get(clave)
    if corregido is not None and calc['auto'].get(clave) != corregido:
        como = f"{como} Lo corregiste a mano: el sistema contó {calc['auto'].get(clave)}."
    return {'l': l, 'v': v, 'f': f, 'como': como, 'cols': r.get('cols') or [], 'filas': filas,
            'fuente': fuente, 'mano': False}
