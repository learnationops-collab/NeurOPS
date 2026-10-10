"""Migra colores literales a roles de tema, con respaldo = el valor de hoy.

- color de la paleta            -> var(--rol, color)
- rgba de un color de la paleta -> color-mix(in srgb, var(--rol, #hex) P%, transparent)
- negro con alfa en fondos      -> var(--cont-3, literal)   (en sombras queda tal cual)
- cualquier otro                -> queda tal cual (se reporta)

verificar(orig, nuevo): resuelve los respaldos y compara color por color.
"""
import re

PALETA = {
    'ffffff': 'en-fondo', '020617': 'fondo', '0a0e3d': 'fondo', '070a2b': 'fondo',
    'ff3fa4': 'destacado', 'ff6ad5': 'destacado-claro', '1323c6': 'destacado-2', '4e8bd8': 'destacado-2-claro',
    '2fbf8f': 'est-exito', 'd9a441': 'est-aviso', 'e85c4a': 'est-error', '60a5fa': 'est-info', '7f8ca8': 'est-inactivo',
    '7deac0': 'est-exito-texto', 'f3d08a': 'est-aviso-texto', 'f5a99c': 'est-error-texto', '93c5fd': 'est-info-texto',
    'ffb3de': 'destacado-texto', '8c99e0': 'destacado-2-texto', 'd1d8ff': 'destacado-2-texto', 'bfd3ff': 'destacado-2-texto',
    'c7d2fe': 'destacado-2-texto', 'c7cceb': 'destacado-2-texto',
    # tonos sueltos del deck, cada uno a su familia
    '6366f1': 'destacado-2', '8b5cf6': 'destacado-2', '6d8bff': 'destacado-2-claro', '6da3e0': 'destacado-2-claro',
    '0d1246': 'fondo', 'ff5cb1': 'destacado-claro', 'ffc2e4': 'destacado-texto',
    '34a878': 'est-exito', '1e9974': 'est-exito', '9ae6c0': 'est-exito-texto',
    '06210f': 'en-destacado', '1a0313': 'en-destacado',
}

COLOR = re.compile(r'#[0-9a-fA-F]{3,8}\b|rgba?\(\s*[0-9.]+\s*,\s*[0-9.]+\s*,\s*[0-9.]+\s*(?:,\s*[0-9.]+\s*)?\)')


def a_rgba(txt):
    t = txt.strip().lower()
    if t.startswith('#'):
        h = t[1:]
        if len(h) in (3, 4):
            h = ''.join(c * 2 for c in h)
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        a = int(h[6:8], 16) / 255 if len(h) == 8 else 1.0
        return (r, g, b, round(a, 4))
    n = [float(x) for x in re.findall(r'[0-9.]+', t)]
    return (int(n[0]), int(n[1]), int(n[2]), round(n[3] if len(n) > 3 else 1.0, 4))


def hexde(r, g, b):
    return '%02x%02x%02x' % (r, g, b)


def pct(a):
    s = ('%.4f' % (a * 100)).rstrip('0').rstrip('.')
    return s + '%'


def rol_de(literal, en_sombra):
    """Devuelve el reemplazo o None."""
    r, g, b, a = a_rgba(literal)
    h = hexde(r, g, b)
    if h == '000000':
        if en_sombra:
            return None
        return f'var(--cont-3, {literal.strip()})'
    rol = PALETA.get(h)
    if not rol:
        return None
    if a >= 1:
        return f'var(--{rol}, {literal.strip()})'
    return f'color-mix(in srgb, var(--{rol}, #{h}) {pct(a)}, transparent)'


def migrar_valor(prop, valor, reporte):
    en_sombra = 'shadow' in prop
    def rep(m):
        nuevo = rol_de(m.group(0), en_sombra)
        if nuevo is None:
            reporte.append((prop, m.group(0)))
            return m.group(0)
        return nuevo
    # No tocar lo que ya está dentro de un var(--x, ...) migrado
    if 'color-mix(in srgb, var(--' in valor:
        return valor
    return COLOR.sub(rep, valor)


def migrar_css(texto, reporte):
    """Reemplaza en declaraciones `prop: valor;` fuera de comentarios."""
    partes = re.split(r'(/\*.*?\*/)', texto, flags=re.S)
    out = []
    for p in partes:
        if p.startswith('/*'):
            out.append(p)
            continue
        out.append(re.sub(r'([a-zA-Z0-9-]+)(\s*:\s*)([^;{}]+)(;|(?=\s*\}))',
                          lambda m: m.group(1) + m.group(2) + migrar_valor(m.group(1), m.group(3), reporte) + m.group(4), p))
    return ''.join(out)


# --- verificación -------------------------------------------------------------
def _resolver(t):
    prev = None
    while prev != t:
        prev = t
        t = re.sub(r'color-mix\(in srgb, var\(--[a-z0-9-]+, (#[0-9a-f]{6})\) ([0-9.]+)%, transparent\)',
                   lambda m: 'rgba(%d,%d,%d,%s)' % (*a_rgba(m.group(1))[:3], round(float(m.group(2)) / 100, 4)), t)
        t = re.sub(r'var\(--[a-z0-9-]+, ((?:#[0-9a-fA-F]{3,8})|(?:rgba?\([^()]*\)))\)', r'\1', t)
    return t


def _norm(t):
    t = re.sub(r'/\*.*?\*/', '', t, flags=re.S)
    t = COLOR.sub(lambda m: 'C(%d,%d,%d,%s)' % a_rgba(m.group(0)), t)
    return re.sub(r'\s+', '', t)


def verificar(orig, nuevo):
    a, b = _norm(orig), _norm(_resolver(nuevo))
    if a == b:
        return None
    i = next((i for i, (x, y) in enumerate(zip(a, b)) if x != y), min(len(a), len(b)))
    return a[max(0, i - 120):i + 120] + '\n---\n' + b[max(0, i - 120):i + 120]
