"""Analisis estatico del frontend: que roles llegan a que endpoints del backend.

Sirve para que proteger una ruta del backend no deje a un rol sin una pantalla que ya usa. Para cada
<Route> de App.jsx toma sus roles (ProtectedRoute roles={[...]}) y los componentes de su element, sigue
los imports relativos de cada componente (cierre transitivo) y extrae las llamadas api.get/post/put/
delete/patch('/ruta') de los archivos alcanzados. Une, por llamada, los roles de las rutas desde las que se
alcanza.

Alcance y limites (el test que lo usa los tiene en cuenta):
  - Solo ve rutas escritas como texto. Una llamada con la URL en una variable (api.get(url)) no se ve como
    llamada, pero si se recogen los literales que parecen una ruta de la API (con metodo desconocido '*'),
    que cubren los casos que hoy existen (p. ej. AdsTab: /public/campaigns|adsets|ads/${id}).
  - Una pagina que ninguna ruta de App.jsx alcanza (codigo muerto) no aporta roles.
"""
import re
from functools import lru_cache
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SRC = RAIZ / 'frontend' / 'src'
APP = SRC / 'App.jsx'

IMPORT = re.compile(r"""(?:import|export)\s+(?:[\w*{}\s,]+?)\s+from\s+['"]([^'"]+)['"]""")
IMPORT_DINAMICO = re.compile(r"""import\(\s*['"]([^'"]+)['"]\s*\)""")
LLAMADA = re.compile(r"""\b(?:api|axios)\.(get|post|put|delete|patch)\(\s*([`'"])(.*?)\2""", re.S)
# Un literal que parece una ruta de la API (familias de la politica de acceso), sin saber con que metodo.
LITERAL_DE_RUTA = re.compile(
    r"""['"`](/(?:public|conversational|manychat-webhook|triage|workshop|marketing)/[^'"`\s]*)""")

# Widgets globales de App.jsx (fuera de <Routes>): se cargan con cualquier usuario autenticado.
COMPONENTES_GLOBALES = ('PixelTracker', 'BugReportWidget', 'PlaybookOverlay', 'PlaybookNotification')


def _resolver(desde, especificador):
    if especificador.startswith('@/'):
        base = SRC / especificador[2:]
    elif especificador.startswith('.'):
        base = (desde.parent / especificador).resolve()
    else:
        return None
    for candidato in (base, Path(str(base) + '.jsx'), Path(str(base) + '.js'), base / 'index.jsx', base / 'index.js'):
        if candidato.is_file():
            return candidato
    return None


@lru_cache(maxsize=None)
def _imports_de(archivo):
    texto = archivo.read_text(encoding='utf-8', errors='replace')
    destinos = set()
    for especificador in IMPORT.findall(texto) + IMPORT_DINAMICO.findall(texto):
        destino = _resolver(archivo, especificador)
        if destino and destino.suffix in {'.js', '.jsx'}:
            destinos.add(destino)
    return frozenset(destinos)


def _cierre(archivo):
    visto, pila = set(), [archivo]
    while pila:
        actual = pila.pop()
        if actual in visto:
            continue
        visto.add(actual)
        pila.extend(_imports_de(actual))
    return visto


def normalizar(ruta):
    """/public/x/${id}?a=b  ->  /public/x/<x>   (sin el prefijo /api, sin la cadena de consulta)"""
    ruta = re.sub(r'\$\{[^}]*\}', '<x>', ruta.split('?')[0])
    ruta = ruta if ruta.startswith('/') else '/' + ruta
    return ruta.rstrip('/') or '/'


def _llamadas_de(archivo):
    texto = archivo.read_text(encoding='utf-8', errors='replace')
    llamadas = {(metodo.upper(), normalizar(ruta)) for metodo, _, ruta in LLAMADA.findall(texto)}
    llamadas_explicitas = {ruta for _, ruta in llamadas}
    # Un literal que el archivo YA llama con un metodo explicito no se repite con metodo desconocido: se le
    # atribuirian todos los metodos y saldrian bloqueos que no existen. Solo cuentan los literales que el
    # archivo usa de otra forma (p. ej. en una variable url = cond ? '/x/1' : '/x/2'; api.delete(url)).
    llamadas |= {('*', ruta) for ruta in {normalizar(r) for r in LITERAL_DE_RUTA.findall(texto)}
                 if ruta not in llamadas_explicitas}
    return llamadas


def _rutas_de_app():
    texto = APP.read_text(encoding='utf-8')
    importados = {}
    for m in re.finditer(r"""import\s+(\w+)\s+from\s+['"]([^'"]+)['"]""", texto):
        destino = _resolver(APP, m.group(2))
        if destino:
            importados[m.group(1)] = destino
    rutas = []
    for m in re.finditer(r'<Route\s+path="([^"]+)"\s+element=\{(.*?)\}\s*/>', texto, re.S):
        elemento = m.group(2)
        roles = re.search(r'roles=\{\[(.*?)\]\}', elemento)
        rutas.append({
            'path': m.group(1),
            'protegido': '<ProtectedRoute' in elemento,
            'roles': re.findall(r"'([^']+)'", roles.group(1)) if roles else [],
            'componentes': [c for c in re.findall(r'<([A-Z]\w*)', elemento)
                            if c not in {'ProtectedRoute', 'MainLayout', 'Navigate'}],
        })
    return rutas, importados


@lru_cache(maxsize=None)
def llamadas_del_frontend():
    """{(metodo, ruta normalizada): {'roles': set, 'cualquiera': bool, 'publico': bool, 'archivos': set}}.

    `roles`: roles que llegan a una pantalla con ProtectedRoute(roles). `cualquiera`: se llega desde una
    pantalla con sesion pero sin roles (o desde un widget global). `publico`: se llega desde una pantalla
    SIN ProtectedRoute (un visitante anonimo)."""
    rutas, importados = _rutas_de_app()
    resultado = {}

    def registrar(llamada, archivo, protegido, roles):
        datos = resultado.setdefault(llamada, {'roles': set(), 'cualquiera': False, 'publico': False,
                                               'archivos': set()})
        datos['archivos'].add(archivo.relative_to(SRC).as_posix())
        if not protegido:
            datos['publico'] = True
        elif roles:
            datos['roles'] |= set(roles)
        else:
            datos['cualquiera'] = True

    for ruta in rutas:
        archivos = set()
        for componente in ruta['componentes']:
            if componente in importados:
                archivos |= _cierre(importados[componente])
        for archivo in archivos:
            for llamada in _llamadas_de(archivo):
                registrar(llamada, archivo, ruta['protegido'], ruta['roles'])
    for componente in COMPONENTES_GLOBALES:
        if componente in importados:
            for archivo in _cierre(importados[componente]):
                for llamada in _llamadas_de(archivo):
                    registrar(llamada, archivo, True, [])
    return resultado


def cantidad_de_rutas_de_app():
    return len(_rutas_de_app()[0])


def coincide(ruta_frontend, regla_backend):
    """Una llamada del frontend (/public/x/<x>) coincide con una regla de Flask (/api/public/x/<int:id>) si
    tienen los mismos segmentos: literal contra literal, y un segmento dinamico del backend acepta una
    variable del frontend o un literal que cumpla el conversor. Una variable del frontend NO coincide con un
    segmento literal del backend (evita atribuir /public/x/<x> a /api/public/x/repair-db)."""
    regla = regla_backend[len('/api'):] if regla_backend.startswith('/api') else regla_backend
    a, b = ruta_frontend.strip('/').split('/'), regla.strip('/').split('/')
    if len(a) != len(b):
        return False
    for segmento_front, segmento_back in zip(a, b):
        dinamico = re.fullmatch(r'<(?:(\w+):)?\w+>', segmento_back)
        if dinamico:
            if segmento_front == '<x>':
                continue
            if dinamico.group(1) == 'int' and not segmento_front.isdigit():
                return False
            continue
        if segmento_front != segmento_back:
            return False
    return True


def bloqueos(politica, llamadas, roles_reales, roles_inexistentes, excepciones):
    """Problemas entre una tabla de politica y las llamadas del frontend. Lista vacia = no se deja a nadie fuera.

    politica:   {(metodo, regla): objeto con .roles}
    llamadas:   lo que devuelve llamadas_del_frontend()
    excepciones: {(metodo, regla): {rol: motivo}} de roles que la politica niega a proposito."""
    problemas = []
    for (metodo, regla), permitida in sorted(politica.items()):
        for (metodo_front, ruta), datos in sorted(llamadas.items()):
            if metodo_front not in (metodo, '*') or not coincide(ruta, regla):
                continue
            llamada = f'{metodo} {regla}  <-  {ruta} ({", ".join(sorted(datos["archivos"]))})'
            if datos['publico']:
                problemas.append(f'PAGINA PUBLICA llama a una ruta protegida: {llamada}')
            desconocidos = set(datos['roles']) - roles_reales - roles_inexistentes
            if desconocidos:
                problemas.append(f'ROL DESCONOCIDO {sorted(desconocidos)} en App.jsx: {llamada}')
            necesarios = (set(datos['roles']) & roles_reales) | (roles_reales if datos['cualquiera'] else set())
            tolerados = set(excepciones.get((metodo, regla), {}))
            for rol in sorted(necesarios - set(permitida.roles) - tolerados):
                problemas.append(f'EL ROL {rol} PIERDE UNA PANTALLA que usa: {llamada}')
    return problemas
