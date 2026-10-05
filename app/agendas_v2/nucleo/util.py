"""Utilidades sin dependencias, compartidas por el núcleo. Port de core/util.js.

Además de las funciones del JS trae los ayudantes que imitan la semántica de JavaScript donde el
resultado tiene que dar igual en los dos lados: Math.round, Number(), String(), truthiness, trim,
`\\s` de las regex y largo de strings en unidades UTF-16 (lo que cuenta `.slice` en JS).
"""

import copy
import json
import math
import random
import re
import string
import time
import unicodedata

# `\s` de JavaScript. El de Python suma \x1c-\x1f y \x85 y no tiene ﻿.
WS = '\t\n\v\f\r    -     　﻿'
_WS_CHARS = '\t\n\v\f\r   ' + ''.join(chr(c) for c in range(0x2000, 0x200B)) + '    　﻿'
_RE_WS = re.compile('[' + WS + ']+')


# --- Semántica de JavaScript ------------------------------------------------------------------


def js_round(x):
    """Math.round: .5 redondea hacia +infinito (el round de Python es al par)."""
    return math.floor(x + 0.5)


def js_truthy(v):
    """Verdad de JS: {} y [] son verdaderos; 0, NaN, '' y None no."""
    if v is None or v is False:
        return False
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        return v == v and v != 0
    if isinstance(v, str):
        return v != ''
    return True


def num(x):
    """Número de JS a Python: entero si no tiene decimales (así el JSON sale igual: 3 y no 3.0)."""
    if isinstance(x, float) and x.is_integer():
        return int(x)
    return x


def js_number(v):
    """Number(v). Devuelve float('nan') donde JS da NaN."""
    if v is None:
        return math.nan  # undefined; los llamadores tratan null antes cuando importa
    if isinstance(v, bool):
        return 1 if v else 0
    if isinstance(v, (int, float)):
        return v
    if isinstance(v, list):
        return js_number(js_str(v)) if len(v) < 2 else math.nan
    if not isinstance(v, str):
        return math.nan
    s = js_trim(v)
    if s == '':
        return 0
    if s in ('Infinity', '+Infinity'):
        return math.inf
    if s == '-Infinity':
        return -math.inf
    m = re.fullmatch(r'0([xob])([0-9a-f]+)', s, re.I)
    if m:
        base = {'x': 16, 'o': 8, 'b': 2}[m.group(1).lower()]
        try:
            return int(m.group(2), base)
        except ValueError:
            return math.nan
    if not re.fullmatch(r'[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?', s, re.I):
        return math.nan
    return num(float(s))


def _num_txt(n):
    """String(n) de un número de JS (casos comunes: enteros, decimales cortos, NaN, Infinity)."""
    if isinstance(n, float):
        if n != n:
            return 'NaN'
        if n in (math.inf, -math.inf):
            return 'Infinity' if n > 0 else '-Infinity'
        if n.is_integer() and abs(n) < 1e21:
            return str(int(n))
        r = repr(n)
        if 'e' in r:  # 1e-07 → 1e-7, 1e+21 → 1e+21
            mant, exp = r.split('e')
            sig = '-' if exp.startswith('-') else '+'
            r = mant + 'e' + sig + exp.lstrip('+-').lstrip('0')
        return r
    return str(n)


def js_str(v):
    """String(v)."""
    if v is None:
        return 'null'
    if v is True:
        return 'true'
    if v is False:
        return 'false'
    if isinstance(v, str):
        return v
    if isinstance(v, (int, float)):
        return _num_txt(v)
    if isinstance(v, (list, tuple)):
        return ','.join('' if x is None else js_str(x) for x in v)
    if isinstance(v, dict):
        return '[object Object]'
    return str(v)


def txt(v, default=''):
    """El patrón `String(v || default)`."""
    return js_str(v) if js_truthy(v) else default


def js_trim(s):
    return s.strip(_WS_CHARS)


def largo16(s):
    """Largo en unidades UTF-16, como `.length` en JS."""
    return len(s) + sum(1 for c in s if ord(c) > 0xFFFF)


def cortar(s, n):
    """`.slice(0, n)` contando unidades UTF-16. Si el corte parte un emoji, lo deja afuera entero."""
    if len(s) <= n // 2 or largo16(s) <= n:
        return s
    u = 0
    for i, c in enumerate(s):
        u += 2 if ord(c) > 0xFFFF else 1
        if u > n:
            return s[:i]
    return s


def obj(v):
    """`v || {}` para algo que tiene que ser un objeto."""
    return v if isinstance(v, dict) else {}


def lista(v):
    """`Array.isArray(v) ? v : []`."""
    return v if isinstance(v, list) else []


def js_json(o):
    """JSON.stringify(o) byte a byte: mismas claves en el mismo orden, sin espacios, 3 y no 3.0."""
    return json.dumps(_para_json(o), ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def _es_indice(k):
    s = str(k)
    return s.isdigit() and s.isascii() and (s == '0' or not s.startswith('0')) and int(s) < 4294967295


def _para_json(o):
    if isinstance(o, dict):
        # En un objeto de JS las claves numéricas van primero y en orden; el resto, como se insertaron.
        idx = sorted((k for k in o if _es_indice(k)), key=lambda k: int(k))
        resto = [k for k in o if not _es_indice(k)]
        return {str(k): _para_json(o[k]) for k in idx + resto}
    if isinstance(o, (list, tuple)):
        return [_para_json(x) for x in o]
    if isinstance(o, float):
        if o != o or o in (math.inf, -math.inf):
            return None
        return num(o)
    return o


# --- Port de util.js --------------------------------------------------------------------------

_ALFABETO = string.digits + string.ascii_lowercase


def _base36(n):
    out = ''
    while True:
        n, r = divmod(n, 36)
        out = _ALFABETO[r] + out
        if not n:
            return out


def uid(p=''):
    return (p or '') + _base36(int(time.time() * 1000))[-5:] + ''.join(random.choices(_ALFABETO, k=5))


def clonar(o):
    return copy.deepcopy(o)


def letra(j):
    return chr(65 + (j % 26))


def pad(n):
    return ('0' if n < 10 else '') + str(n)


def mayus(t):
    t = txt(t)
    return t[:1].upper() + t[1:]


def en_lista(a):
    return ''.join(a) if len(a) < 2 else ', '.join(a[:-1]) + ' y ' + a[-1]


def entero(v, mn, mx, default):
    """Entero acotado; '' y None dan el valor por defecto, igual que lo que no es número."""
    if v == '' or v is None:
        return default
    n = js_number(v)
    if not isinstance(n, (int, float)) or n != n or n in (math.inf, -math.inf):
        return default
    return min(mx, max(mn, js_round(n)))


def fmt(n, d=0):
    k = 10**d
    return js_str(num(js_round(n * k) / k)).replace('.', ',', 1)


def slugify(t):
    s = unicodedata.normalize('NFD', txt(t))
    s = re.sub('[̀-ͯ]', '', s).lower()
    s = re.sub('[^a-z0-9]+', '-', s)
    return re.sub('^-+|-+$', '', s)[:60]


def iniciales(n):
    p = _RE_WS.split(js_trim(txt(n)))
    a = p[0] if p[0] else '?'
    b = p[1] if len(p) > 1 else ''
    return (a[:1] + b[:1]).upper()


def abrev_de(n):
    w = [x for x in _RE_WS.split(js_trim(txt(n))) if x]
    r = ''.join(x[0] for x in w[:3]) if len(w) > 1 else (w[0] if w else '?')[:3]
    return r.upper()


def hash_txt(s):
    h, b = 0, s.encode('utf-16-le', 'surrogatepass')
    for u in range(0, len(b), 2):
        h = (h * 31 + int.from_bytes(b[u : u + 2], 'little')) & 0xFFFFFFFF
    if h >= 0x80000000:
        h -= 0x100000000
    return abs(h)


_ESC = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}


def esc(v):
    return re.sub('[&<>"\']', lambda m: _ESC[m.group(0)], '' if v is None else js_str(v))


def por_ids(arr, ids, clave=None):
    out = []
    for i in ids:
        x = next((x for x in arr if (x.get(clave) if clave else x) == i), None)
        if x is not None:
            out.append(x)
    return out
