"""limpiar_html: port de limpiarHTML (core/normalizar.js) con html.parser en lugar del DOM.

Descripción con formato: solo negrita, cursiva, subrayado, listas, saltos y links http(s)/mailto.
Todo lo demás queda como texto. Arma el árbol como lo haría el navegador en los casos comunes
(cierres implícitos de <p> y <li>, </br>, <div/> que abre, etiquetas sin cerrar).
"""

import re
from html.parser import HTMLParser

from app.agendas_v2.nucleo.util import cortar, esc, js_trim, txt

TAGS_OK = {
    'b': 'b',
    'strong': 'b',
    'i': 'i',
    'em': 'i',
    'u': 'u',
    'ul': 'ul',
    'ol': 'ol',
    'li': 'li',
    'br': 'br',
    'p': 'p',
    'div': 'div',
    'a': 'a',
}
DESCARTAR = {'script', 'style', 'template', 'iframe', 'object'}
_VACIOS = {
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'link',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
}
# Etiquetas que cierran un <p> abierto (HTML5, "close a p element").
_CIERRAN_P = {
    'address',
    'article',
    'aside',
    'blockquote',
    'center',
    'details',
    'dialog',
    'dir',
    'div',
    'dl',
    'fieldset',
    'figcaption',
    'figure',
    'footer',
    'form',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'header',
    'hgroup',
    'hr',
    'main',
    'menu',
    'nav',
    'ol',
    'p',
    'pre',
    'section',
    'summary',
    'table',
    'ul',
    'li',
    'dd',
    'dt',
    'listing',
    'xmp',
}
_LIMITE = {'button', 'table', 'td', 'th', 'caption', 'html', 'template', 'object', 'applet', 'marquee'}


class _Arbol(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.raiz = {'tag': None, 'attrs': {}, 'hijos': []}
        self.pila = [self.raiz]

    def _abierto(self, tag, limites):
        for i in range(len(self.pila) - 1, 0, -1):
            t = self.pila[i]['tag']
            if t == tag:
                return i
            if t in limites:
                return None
        return None

    def _agregar(self, tag, attrs, abrir=True):
        nodo = {'tag': tag, 'attrs': attrs, 'hijos': []}
        self.pila[-1]['hijos'].append(nodo)
        if abrir and tag not in _VACIOS:
            self.pila.append(nodo)

    def handle_starttag(self, tag, attrs):
        if tag in _CIERRAN_P:
            i = self._abierto('p', _LIMITE)
            if i is not None:
                del self.pila[i:]
        if tag == 'li':
            i = self._abierto('li', _LIMITE | {'ul', 'ol'})
            if i is not None:
                del self.pila[i:]
        a = {}
        for k, v in attrs:
            a.setdefault(k, v)  # con atributos repetidos, vale el primero
        self._agregar(tag, a)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)  # en HTML5 la barra de <div/> no cierra nada

    def handle_endtag(self, tag):
        if tag == 'br':
            self._agregar('br', {})
            return
        i = self._abierto(tag, set())
        if i is not None:
            del self.pila[i:]
        elif tag == 'p':
            self._agregar('p', {}, abrir=False)

    def handle_data(self, data):
        self.pila[-1]['hijos'].append(data)


def _recorrer(n):
    out = ''
    for c in n['hijos']:
        if isinstance(c, str):
            out += esc(c)
            continue
        if c['tag'] in DESCARTAR:
            continue
        tag, inner = TAGS_OK.get(c['tag']), _recorrer(c)
        if not tag:
            out += inner
        elif tag == 'br':
            out += '<br>'
        elif tag == 'a':
            h = c['attrs'].get('href') or ''
            ok = re.match(r'(https?://|mailto:)', h, re.I)
            out += (
                '<a href="' + esc(h) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>' if ok else inner
            )
        else:
            out += '<' + tag + '>' + inner + '</' + tag + '>'
    return out


def limpiar_html(x):
    x = cortar(txt(x), 20000)
    if not js_trim(x):
        return ''
    p = _Arbol()
    p.feed(x.replace('\r\n', '\n').replace('\r', '\n'))
    p.close()
    r = _recorrer(p.raiz)
    return r if js_trim(re.sub('<[^>]+>', '', r.replace('<br>', ''))) else ''
