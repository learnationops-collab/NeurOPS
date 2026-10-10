"""Genera las reglas de tema para las clases de color de Tailwind usadas en un conjunto de archivos.

Solo existen bajo `[data-tema]`: sin tema elegido no aplican y todo queda como hoy.
Uso: python temas_tailwind.py <scope> <salida.css> <archivos...>
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import temas_migrar as tm  # noqa: E402

ESCALA = {'50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'}
FAM = {
    'pink': 'destacado', 'fuchsia': 'destacado',
    'violet': 'destacado-2', 'purple': 'destacado-2', 'indigo': 'destacado-2', 'blue': 'destacado-2',
    'sky': 'est-info', 'cyan': 'est-info',
    'emerald': 'est-exito', 'green': 'est-exito', 'teal': 'est-exito', 'lime': 'est-exito',
    'amber': 'est-aviso', 'yellow': 'est-aviso', 'orange': 'est-aviso',
    'red': 'est-error', 'rose': 'est-error',
}
TEXTO_DE = {'destacado': 'destacado-texto', 'destacado-2': 'destacado-2-texto', 'est-info': 'est-info-texto',
            'est-exito': 'est-exito-texto', 'est-aviso': 'est-aviso-texto', 'est-error': 'est-error-texto'}
CLARO_DE = {'destacado': 'destacado-claro', 'destacado-2': 'destacado-2-claro'}
GRISES = {'slate', 'gray', 'zinc', 'neutral', 'stone'}
EXTRA_HEX = {'111219': 'modal'}

VARIANTES = r'(?:(?:hover|focus|focus-visible|focus-within|active|disabled|group-hover|placeholder):)*'
UTIL = r'(?:bg|from|via|to|text|border(?:-[trblxy])?|ring|divide|placeholder|fill|stroke|accent|caret|outline|decoration)'
COLOR = r'(?:white|black|(?:' + '|'.join(sorted(GRISES | set(FAM))) + r')-\d{2,3}|\[#[0-9a-fA-F]{3,8}\])'
CLASE = re.compile(r'(?<![\w:-])(' + VARIANTES + UTIL + '-' + COLOR + r'(?:/(?:\d{1,3}|\[[0-9.]+\]))?)(?![\w-])')


def rol_gris(util, shade):
    s = int(shade)
    if util == 'text' or util == 'placeholder':
        return ('en-fondo', None) if s <= 200 else ('en-fondo', 85) if s == 300 else ('texto-2', None) if s == 400 else ('texto-3', None)
    if util == 'bg':
        if s >= 950: return ('fondo', None)
        if s >= 900: return ('modal', None)
        if s >= 800: return ('cont-fuerte', None)
        if s >= 600: return ('borde-3', None)
        return ('invertido', None)
    # bordes, ring, divide, outline
    if s >= 900: return ('borde-1', None)
    if s >= 800: return ('borde-2', None)
    return ('borde-3', None)


def valor(util, color, opac):
    if color == 'white':
        rol, base = 'en-fondo', None
    elif color == 'black':
        if util == 'bg':
            rol, base = ('velo' if (opac or 100) >= 50 else 'cont-3'), None
            opac = None
        else:
            rol, base = 'en-destacado', None
    elif color.startswith('[#'):
        h = color[2:-1].lower()
        h = ''.join(c * 2 for c in h) if len(h) == 3 else h[:6]
        rol, base = tm.PALETA.get(h) or EXTRA_HEX.get(h), None
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
            if util == 'bg' and s >= 900:
                # fondo muy oscuro de un color: un tinte de ese color sobre el fondo del tema
                return f'color-mix(in srgb, var(--{r}) 25%, var(--fondo))' if not opac or opac >= 100 else                     f'color-mix(in srgb, color-mix(in srgb, var(--{r}) 25%, var(--fondo)) {opac}%, transparent)'
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
    alcance = f'[data-tema] :is({scope}, {scope} *)'
    selector = f'{alcance} {grupo}{sel}' if grupo else f'[data-tema] :is({scope}, {scope} *){sel}'
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
