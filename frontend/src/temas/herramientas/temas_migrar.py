"""Migra colores literales a roles de tema, con respaldo = el valor de hoy.

- color de la paleta            -> var(--rol, color)
- rgba de un color de la paleta -> color-mix(in srgb, var(--rol, #hex) P%, transparent)
- negro con alfa en fondos      -> var(--ln-inset-bg, literal)   (en sombras queda tal cual)
- cualquier otro                -> queda tal cual (se reporta)

verificar(orig, nuevo): resuelve los respaldos y compara color por color.
"""
import re

PALETA = {
    'ffffff': 'ln-text-out', '020617': 'ln-page-base', '0a0e3d': 'ln-page-base', '070a2b': 'ln-page-base',
    'ff3fa4': 'ln-brand', 'ff6ad5': 'ln-brand-accent', '1323c6': 'ln-brand-2', '4e8bd8': 'ln-brand-2-accent',
    '2fbf8f': 'ln-success', 'd9a441': 'ln-warning', 'e85c4a': 'ln-danger', '60a5fa': 'ln-info', '7f8ca8': 'ln-idle',
    '7deac0': 'ln-success-text', 'f3d08a': 'ln-warning-text', 'f5a99c': 'ln-danger-text', '93c5fd': 'ln-info-text',
    'ffb3de': 'ln-brand-text', '8c99e0': 'ln-brand-2-text', 'd1d8ff': 'ln-brand-2-text', 'bfd3ff': 'ln-brand-2-text',
    'c7d2fe': 'ln-brand-2-text', 'c7cceb': 'ln-brand-2-text',
    # tonos sueltos del deck, cada uno a su familia
    '6366f1': 'ln-brand-2', '8b5cf6': 'ln-brand-2', '6d8bff': 'ln-brand-2-accent', '6da3e0': 'ln-brand-2-accent',
    '0d1246': 'ln-page-base', 'ff5cb1': 'ln-brand-accent', 'ffc2e4': 'ln-brand-text',
    '34a878': 'ln-success', '1e9974': 'ln-success', '9ae6c0': 'ln-success-text',
    '06210f': 'ln-brand-content', '1a0313': 'ln-brand-content',
    # superficies y bordes de estado (los de .dc-shell) y navys sueltos
    '071a24': 'ln-success-bg', '10413d': 'ln-success-border', '1a171c': 'ln-warning-bg', '473924': 'ln-warning-border',
    '1b0f1d': 'ln-danger-bg', '4c2227': 'ln-danger-border', '0a152c': 'ln-info-bg', '1a3155': 'ln-info-border',
    '05082d': 'ln-page-base', '050822': 'ln-page-base', '101550': 'ln-page-base', '4354ff': 'ln-brand-2-accent',
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
        return f'var(--ln-inset-bg, {literal.strip()})'
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
        t = re.sub(r'color-mix\(in srgb, var\(--ln-[a-z0-9-]+, (#[0-9a-f]{6})\) ([0-9.]+)%, transparent\)',
                   lambda m: 'rgba(%d,%d,%d,%s)' % (*a_rgba(m.group(1))[:3], round(float(m.group(2)) / 100, 4)), t)
        t = re.sub(r'var\(--ln-[a-z0-9-]+, ((?:#[0-9a-fA-F]{3,8})|(?:rgba?\([^()]*\)))\)', r'\1', t)
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
