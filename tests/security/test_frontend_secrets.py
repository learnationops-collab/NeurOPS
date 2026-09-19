"""Secretos escritos en el frontend.

TODO lo que hay en frontend/src acaba en el bundle que la web sirve a cualquiera, con o sin sesion: un
secreto escrito ahi es publico. Asi estuvo la clave de respaldo de la base durante meses (una constante en
las paginas de respaldo y restauracion, que ademas eran publicas). El backend tiene su propio trinquete
(test_hardcoded_secrets); este cubre el JavaScript: asignaciones y propiedades de objeto y de JSX cuyo
nombre parece de un secreto y cuyo valor es un literal.

Los valores NUNCA se imprimen: solo archivo, linea y nombre.
"""
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
EXTENSIONES = {'.js', '.jsx', '.ts', '.tsx'}

NOMBRE = r'[A-Za-z_$][\w$]*'
NOMBRE_SECRETO = re.compile(r'(secret|token|password|passwd|api[_-]?key|expected_?key|credential)', re.IGNORECASE)
# nombre = 'literal'   nombre: "literal"   'nombre': "literal"   nombre=`literal`
# (una constante, una propiedad de objeto con o sin comillas, o un atributo JSX)
ASIGNACION = re.compile(
    rf'(?P<nombre>{NOMBRE})[\'"]?\s*[:=]\s*(?P<comilla>[\'"`])(?P<valor>[^\'"`\n]+)(?P=comilla)')
LARGO_MINIMO = 8

# (archivo, nombre) que se parecen a un secreto y NO lo son (p. ej. el NOMBRE de una clave de
# localStorage). Cada una con su motivo. Hoy no hay ninguna.
PERMITIDOS = {}


def hallazgos_en(texto):
    """[(linea, nombre)] de las asignaciones de un literal a un nombre de secreto."""
    encontrados = []
    for numero, linea in enumerate(texto.splitlines(), 1):
        for m in ASIGNACION.finditer(linea):
            valor = m.group('valor').strip()
            es_texto_para_personas = ' ' in valor  # "Nueva contrasena", "Bearer xyz"
            if (NOMBRE_SECRETO.search(m.group('nombre')) and len(valor) >= LARGO_MINIMO
                    and not es_texto_para_personas and '${' not in valor):
                encontrados.append((numero, m.group('nombre')))
    return encontrados


def _todos_los_hallazgos():
    resultado = []
    for ruta in sorted((RAIZ / 'frontend' / 'src').rglob('*')):
        if ruta.suffix in EXTENSIONES and 'node_modules' not in ruta.parts:
            relativa = ruta.relative_to(RAIZ).as_posix()
            resultado += [(relativa, numero, nombre)
                          for numero, nombre in hallazgos_en(ruta.read_text(encoding='utf-8', errors='replace'))
                          if (relativa, nombre) not in PERMITIDOS]
    return resultado


def test_el_frontend_no_lleva_secretos_escritos():
    encontrados = _todos_los_hallazgos()

    assert encontrados == [], (
        'Hay literales asignados a nombres de secreto en el frontend (archivo, linea, nombre; nunca el valor). '
        'Todo lo que hay ahi es publico: sacalo a una variable de entorno del servidor o pidelo en pantalla. '
        'Si es el nombre de una clave de almacenamiento y no un secreto, agregalo a PERMITIDOS con su motivo:\n'
        + '\n'.join(f'  {archivo}:{linea}  {nombre}' for archivo, linea, nombre in encontrados))


def test_el_frontend_a_escanear_existe_y_tiene_codigo():
    # Que el escaneo no pase en vacio porque cambio la carpeta.
    archivos = [p for p in (RAIZ / 'frontend' / 'src').rglob('*') if p.suffix in EXTENSIONES]

    assert len(archivos) > 100


# --- El escaner: detecta lo que debe y no da falsas alarmas comunes ---------------------------

def test_detecta_la_linea_real_que_llevaba_la_clave_de_respaldo():
    linea = "    const SECRET_KEY = 'neurops_secret_backup_2024';"

    assert hallazgos_en(linea) == [(1, 'SECRET_KEY')]


def test_detecta_propiedades_de_objeto_y_atributos_jsx_y_plantillas():
    codigo = '\n'.join([
        "const config = { password: 'hunter2hunter2' };",
        '<Formulario apiKey="abcdef123456" />',
        'const api_key = `abcdef123456`;',
        "headers = { 'X-Token': 'abcdef123456' };",          # clave de objeto entre comillas: se lee 'Token'
        '{ "password": "abcdefgh1234" }',                    # JSON
        "const webhookSecret = 'valor-largo-1234';",
    ])

    assert [nombre for _, nombre in hallazgos_en(codigo)] == [
        'password', 'apiKey', 'api_key', 'Token', 'password', 'webhookSecret']


def test_no_marca_lo_que_no_es_un_literal_de_secreto():
    codigo = '\n'.join([
        "const token = localStorage.getItem('auth_token');",          # el valor no es un literal
        "const TOKEN_CORTO = 'abc';",                                   # demasiado corto para serlo
        "const passwordLabel = 'Nueva contraseña del usuario';",        # texto para personas (lleva espacios)
        'headers.Authorization = `Bearer ${token}`;',                   # plantilla con variable
        '<input type="password" name="password" />',                    # el literal es del atributo type/name
        "const placeholder = 'Ingresa tu clave';",                      # el nombre no es de un secreto
        "const cabecera = 'X-ManyChat-Token';",                         # el nombre no es de un secreto
    ])

    assert hallazgos_en(codigo) == []
