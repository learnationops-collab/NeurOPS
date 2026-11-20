"""Las objeciones de las llamadas que no cerraron, agrupadas (panel «Por qué compran y por qué no», ADR-W187).

El closer escribe la objeción en texto libre (`objeciones_service`, y el motivo de no cierre en `motivos_no_cierre`).
Acá se agrupan por palabras clave, sacadas de las que cargaron entre septiembre y noviembre de 2026: una objeción
puede caer en más de una categoría («dinero y lo tiene que hablar con los padres»). Es deliberadamente simple y a la
vista: cada categoría abre sus textos, así quien lee el panel ve si el criterio está bien.
"""
import re
import unicodedata

CATEGORIAS = (
    ('paga_otro', 'Lo decide o lo paga otro',
     r'papa|padre|mama|madre|pareja|espos|novi|decisor|familia|hablarlo|platicar|la mantienen'),
    ('dinero', 'El dinero',
     r'dinero|dineor|capital|tarjeta|prestad|pago|pagar|plata|econom|presupuesto|dolar|usd|inversion|caro|precio|linea|cantidad'),
    ('miedo', '¿Me va a funcionar? / miedo',
     r'miedo|funcion|aprovech|confi|segur|compromis|arrepint|indecis'),
    ('tiempo', 'El tiempo / otro momento',
     r'tiempo|siguiente ano|siguente ano|por ahora|cirugi|retomar|pensarlo|despues|descansar|no le interesa'),
    ('proceso', 'Cómo se llevó la llamada',
     r'lleve mal|no supe|hice mal|se me cayo|senal|no fue llamada'),
)
_RUIDO = re.compile(r'^[\W_]*$')


def _norm(texto):
    s = unicodedata.normalize('NFKD', str(texto or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', s).strip()


def categorias_de(texto):
    """Las claves de las categorías del texto ([] si no cae en ninguna)."""
    t = _norm(texto)
    return [clave for clave, _, patron in CATEGORIAS if re.search(patron, t)]


def texto_de(fila):
    """El texto de la objeción de una fila de `comercial_no_cerradas` (o el motivo, si no hay objeción)."""
    for campo in ('objecion', 'motivo'):
        v = fila.get(campo)
        v = v.get('texto') if isinstance(v, dict) else v
        if v and not _RUIDO.match(str(v)):
            return str(v).strip()
    return None


def agrupar(filas):
    """{total, con_texto, categorias: [{clave, label, n, pct, textos: [{texto, cliente, fecha}]}]}."""
    con_texto = []
    for f in filas:
        t = texto_de(f)
        if t:
            con_texto.append((t, f))
    salida = []
    for clave, label, _ in CATEGORIAS + (('otro', 'Otra', ''),):
        textos = [{'texto': t, 'cliente': f.get('cliente'), 'fecha': f.get('fecha'), 'closer': f.get('closer')}
                  for t, f in con_texto
                  if (clave in categorias_de(t)) or (clave == 'otro' and not categorias_de(t))]
        if textos:
            salida.append({'clave': clave, 'label': label, 'n': len(textos),
                           'pct': round(len(textos) * 100 / len(con_texto), 1), 'textos': textos})
    return {'total': len(filas), 'con_texto': len(con_texto), 'categorias': salida}
