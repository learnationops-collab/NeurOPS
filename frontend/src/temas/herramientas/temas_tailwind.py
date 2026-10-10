"""Genera las reglas de tema para las clases de color de Tailwind usadas en un conjunto de archivos.

Solo existen bajo `[data-tema]`: sin tema elegido no aplican y todo queda como hoy.
Uso: python temas_tailwind.py <scope> <salida.css> <archivos...>   (scope "" = toda la app)
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import temas_migrar as tm  # noqa: E402

ESCALA = {'50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'}
FAM = {
    'pink': 'ln-brand', 'fuchsia': 'ln-brand',
    'violet': 'ln-brand-2', 'purple': 'ln-brand-2', 'indigo': 'ln-brand-2', 'blue': 'ln-brand-2',
    'sky': 'ln-info', 'cyan': 'ln-info',
    'emerald': 'ln-success', 'green': 'ln-success', 'teal': 'ln-success', 'lime': 'ln-success',
    'amber': 'ln-warning', 'yellow': 'ln-warning', 'orange': 'ln-warning',
    'red': 'ln-danger', 'rose': 'ln-danger',
}
TEXTO_DE = {'ln-brand': 'ln-brand-text', 'ln-brand-2': 'ln-brand-2-text', 'ln-info': 'ln-info-text',
            'ln-success': 'ln-success-text', 'ln-warning': 'ln-warning-text', 'ln-danger': 'ln-danger-text'}
CLARO_DE = {'ln-brand': 'ln-brand-accent', 'ln-brand-2': 'ln-brand-2-accent'}
GRISES = {'slate', 'gray', 'zinc', 'neutral', 'stone'}
EXTRA_HEX = {'111219': 'ln-window-bg', '1b0f1d': 'ln-danger-bg', '4c2227': 'ln-danger-border', '1a1204': 'ln-warning-bg'}
FIJOS = {'25d366'}  # el verde de WhatsApp es marca de otro: no cambia con el tema


def rol_por_luz(h, util):
    """Hex escrito a mano que no está en la paleta: por luminosidad y tono."""
    import colorsys
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    tono, luz, sat = colorsys.rgb_to_hls(r, g, b)
    texto = util in ('text', 'placeholder', 'decoration')
    if luz < 0.22:  # paneles casi negros o navy
        return 'ln-inverse-text' if texto else 'ln-window-bg' if util == 'bg' else 'ln-border-main'
    if luz > 0.9:
        return 'ln-text-out' if texto else 'ln-inverse-bg' if util == 'bg' else 'ln-border-subtle'
    if sat < 0.2:  # grises medios
        return 'ln-text-muted' if texto else 'ln-ct3-bg-strong' if util == 'bg' else 'ln-border-strong'
    if 0.55 <= tono <= 0.72:  # azules
        return 'ln-brand-2' if luz < 0.55 else 'ln-brand-2-accent' if luz < 0.75 else 'ln-brand-2-text'
    return None

VARIANTES = r'(?:(?:hover|focus|focus-visible|focus-within|active|disabled|group-hover|placeholder):)*'
UTIL = r'(?:bg|from|via|to|text|border(?:-[trblxy])?|ring|divide|placeholder|fill|stroke|accent|caret|outline|decoration)'
COLOR = r'(?:white|black|(?:' + '|'.join(sorted(GRISES | set(FAM))) + r')-\d{2,3}|\[#[0-9a-fA-F]{3,8}\])'
CLASE = re.compile(r'(?<![\w:-])(' + VARIANTES + UTIL + '-' + COLOR + r'(?:/(?:\d{1,3}|\[[0-9.]+\]))?)(?![\w-])')


def rol_gris(util, shade):
    s = int(shade)
    if util == 'text' or util == 'placeholder':
        if s <= 200: return ('ln-text-out', None)
        if s == 300: return ('ln-text-out', 85)
        if s == 400: return ('ln-text-muted', None)
        if s <= 600: return ('ln-text-faint', None)
        return ('ln-inverse-text', None)  # texto oscuro en una interfaz oscura: va sobre algo claro
    if util == 'bg':
        if s >= 950: return ('ln-page-base', None)
        if s >= 900: return ('ln-window-bg', None)
        if s >= 800: return ('ln-ct3-bg-strong', None)
        if s >= 600: return ('ln-border-strong', None)
        return ('ln-inverse-bg', None)
    # bordes, ring, divide, outline
    if s <= 300: return ('ln-border-subtle', None)
    if s >= 900: return ('ln-border-subtle', None)
    if s >= 800: return ('ln-border-main', None)
    return ('ln-border-strong', None)


def valor(util, color, opac):
    if color == 'white':
        # blanco sólido de fondo en una interfaz oscura es una píldora o botón invertido; con
        # transparencia, un velo del color del texto
        rol, base = ('ln-inverse-bg' if util == 'bg' and (opac is None or opac >= 100) else 'ln-text-out'), None
    elif color == 'black':
        if util == 'bg':
            rol, base = ('ln-scrim' if (opac or 100) >= 50 else 'ln-inset-bg'), None
            opac = None
        else:
            rol, base = 'ln-brand-content', None
    elif color.startswith('[#'):
        h = color[2:-1].lower()
        h = ''.join(c * 2 for c in h) if len(h) == 3 else h[:6]
        if h in FIJOS:
            return None
        rol, base = tm.PALETA.get(h) or EXTRA_HEX.get(h) or rol_por_luz(h, util), None
        if not rol:
            return None
    else:
        fam, shade = color.rsplit('-', 1)
        if shade not in ESCALA:
            return None  # clase inexistente en Tailwind: hoy no hace nada, con tema tampoco
        if fam in GRISES:
            rol, base = rol_gris('bg' if util == 'bg' else 'text' if util in ('text', 'placeholder', 'fill', 'stroke', 'caret', 'accent', 'decoration') else 'borde', shade)
            if base:
                opac = round((opac or 100) * base / 100)
        else:
            r = FAM[fam]
            s = int(shade)
            if util == 'bg' and s <= 200:
                # fondo clarito de un color: un tinte de ese color
                return f'color-mix(in srgb, var(--{r}) {round(15 * (opac or 100) / 100)}%, transparent)'
            if util not in ('text', 'placeholder', 'decoration') and s <= 200:
                return f'color-mix(in srgb, var(--{r}) {round(35 * (opac or 100) / 100)}%, transparent)'
            if util == 'bg' and s >= 900:
                # fondo muy oscuro de un color: un tinte de ese color sobre el fondo del tema
                return f'color-mix(in srgb, var(--{r}) 25%, var(--ln-page-base))' if not opac or opac >= 100 else                     f'color-mix(in srgb, color-mix(in srgb, var(--{r}) 25%, var(--ln-page-base)) {opac}%, transparent)'
            if util in ('text', 'placeholder', 'decoration'):
                rol = TEXTO_DE[r] if s <= 300 else CLARO_DE.get(r, r) if s == 400 else r
            else:
                rol = TEXTO_DE[r] if s <= 200 else CLARO_DE.get(r, r) if s <= 400 else r
    if opac is None or opac >= 100:
        return f'var(--{rol})'
    return f'color-mix(in srgb, var(--{rol}) {opac}%, transparent)'


PROP = {'bg': 'background-color', 'text': 'color', 'border': 'border-color', 'ring': '--tw-ring-color', 'fill': 'fill',
        'stroke': 'stroke', 'accent': 'accent-color', 'caret': 'caret-color', 'outline': 'outline-color',
        'decoration': 'text-decoration-color', 'placeholder': 'color', 'divide': 'border-color'}
LADO = {'t': ['border-top-color'], 'b': ['border-bottom-color'], 'l': ['border-left-color'], 'r': ['border-right-color'],
        'x': ['border-left-color', 'border-right-color'], 'y': ['border-top-color', 'border-bottom-color']}
PSEUDO = {'hover': ':hover', 'focus': ':focus', 'focus-visible': ':focus-visible', 'focus-within': ':focus-within',
          'active': ':active', 'disabled': ':disabled'}


def esc(c):
    return re.sub(r'([:/\[\]#.%])', r'\\\1', c)


def regla(scope, clase):
    *vars_, util_color = clase.split(':')
    m = re.match(r'(' + UTIL + ')-(' + COLOR + r')(?:/(\d{1,3}|\[[0-9.]+\]))?$', util_color)
    if not m:
        return None
    util, color, op = m.group(1), m.group(2), m.group(3)
    opac = None
    if op:
        opac = round(float(op.strip('[]')) * (100 if op.startswith('[') else 1))
    base_util = util.split('-')[0] if util.startswith('border') else util
    v = valor('bg' if base_util in ('from', 'via', 'to') else base_util, color, opac)
    if v is None:
        return None
    if base_util == 'from':
        decl = f'--tw-gradient-from:{v} var(--tw-gradient-from-position)'
    elif base_util == 'via':
        decl = f'--tw-gradient-stops:var(--tw-gradient-from), {v} var(--tw-gradient-via-position), var(--tw-gradient-to)'
    elif base_util == 'to':
        decl = f'--tw-gradient-to:{v} var(--tw-gradient-to-position)'
    else:
        decl = None
    props = [] if decl else LADO[util[-1]] if util.startswith('border-') else [PROP[base_util]]
    sel = f'.{esc(clase)}'
    grupo = ''
    for x in vars_:
        if x == 'group-hover':
            grupo = '.group:hover '
        elif x == 'placeholder':
            sel += '::placeholder'
        else:
            sel += PSEUDO[x]
    if base_util == 'placeholder':
        sel += '::placeholder'
    if base_util == 'divide':
        sel += ' > * + *'
    if not scope:  # toda la app: cuelga de <html> con tema
        selector = f'[data-tema] {grupo}{sel}'
    else:
        alcance = f'[data-tema] :is({scope}, {scope} *)'
        selector = f'{alcance} {grupo}{sel}' if grupo else f'{alcance}{sel}'
    return selector + '{' + (decl or ';'.join(f'{p}:{v}' for p in props)) + '}'


def main():
    scope, salida, *archivos = sys.argv[1:]
    clases = set()
    for a in archivos:
        clases |= set(CLASE.findall(open(a, encoding='utf-8').read()))
    reglas, sin = [], []
    for c in sorted(clases):
        r = regla(scope, c)
        (reglas.append(r) if r else sin.append(c))
    open(salida, 'w', encoding='utf-8', newline='\n').write('\n'.join(reglas) + '\n')
    print(len(clases), 'clases;', len(reglas), 'reglas; sin regla:', ' '.join(sin))


if __name__ == '__main__':
    main()
