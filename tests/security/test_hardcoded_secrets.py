"""Secretos escritos en el codigo.

Un secreto en el repositorio lo conoce cualquiera con acceso a el (colaboradores, CI, copias) y no se
puede rotar sin desplegar. Se busca por AST en app/ y config.py: asignaciones de un literal a un
nombre de secreto, lecturas de variable de entorno de un secreto CON valor por defecto, y
set_password('literal'). Los valores NUNCA se imprimen: solo archivo y nombre.

Es un trinquete: un secreto nuevo rompe el test, y quitar uno obliga a actualizar la lista.
"""
import ast
import re
from collections import Counter
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parents[2]
NOMBRE_SECRETO = re.compile(r'(SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|EXPECTED_KEY)', re.IGNORECASE)

# (archivo, nombre) -> cuantas veces. Todos son hallazgos reales salvo el ultimo. (Ya salieron del
# codigo la clave de backup/restore y las contrasenas fijas de fix-auth.)
CONOCIDOS = {
    ('app/services/import_service.py', 'set_password'): 3,  # la misma clave por defecto para todo usuario importado
    ('app/services/user_service.py', 'set_password'): 1,  # clave debil por defecto si se crea un usuario sin clave
    ('app/api/webhooks.py', 'EXPECTED_TOKEN'): 1,  # token del webhook de ManyChat
    ('app/api/sheets.py', 'CRON_SECRET'): 1,  # valor por defecto del secreto del cron
    ('app/api/closer_followups.py', 'CRON_SECRET'): 1,  # idem, cron de recordatorios por WhatsApp
    ('config.py', 'SECRET_KEY'): 1,  # respaldo de DESARROLLO: solo se usa fuera de produccion
}
ACEPTABLES = {('config.py', 'SECRET_KEY')}


def _literal(nodo, minimo):
    return isinstance(nodo, ast.Constant) and isinstance(nodo.value, str) and len(nodo.value.strip()) >= minimo


def _es_o_lleva_un_valor_literal(nodo):
    """'literal', `x or 'literal'` o `'a' if c else x`. NO cuenta la clave de `datos['password']`."""
    if _literal(nodo, 1):
        return True
    if isinstance(nodo, ast.BoolOp):
        return any(_es_o_lleva_un_valor_literal(v) for v in nodo.values)
    if isinstance(nodo, ast.IfExp):
        return _es_o_lleva_un_valor_literal(nodo.body) or _es_o_lleva_un_valor_literal(nodo.orelse)
    return False


def _nombre_destino(destino):
    if isinstance(destino, ast.Name):
        return destino.id
    if isinstance(destino, ast.Attribute):
        return destino.attr
    return None


def _es_lectura_de_entorno(llamada):
    f = llamada.func
    if isinstance(f, ast.Attribute) and f.attr in ('getenv', 'get'):
        base = f.value
        return (isinstance(base, ast.Name) and base.id == 'os') or (
            isinstance(base, ast.Attribute) and base.attr == 'environ')
    return False


def _hallazgos_de(ruta, relativa):
    arbol = ast.parse(ruta.read_text(encoding='utf-8'), filename=str(ruta))
    encontrados = []
    for nodo in ast.walk(arbol):
        if isinstance(nodo, ast.Assign):
            for destino in nodo.targets:
                nombre = _nombre_destino(destino)
                if nombre and NOMBRE_SECRETO.search(nombre) and _literal(nodo.value, 8):
                    encontrados.append((relativa, nombre))
        elif isinstance(nodo, ast.Call):
            if _es_lectura_de_entorno(nodo) and len(nodo.args) >= 2 and _literal(nodo.args[0], 1) \
                    and NOMBRE_SECRETO.search(nodo.args[0].value) and _literal(nodo.args[1], 1):
                encontrados.append((relativa, nodo.args[0].value))
            elif isinstance(nodo.func, ast.Attribute) and nodo.func.attr == 'set_password' and nodo.args \
                    and _es_o_lleva_un_valor_literal(nodo.args[0]):
                encontrados.append((relativa, 'set_password'))
    return encontrados


def _todos_los_hallazgos():
    archivos = [RAIZ / 'config.py', *sorted((RAIZ / 'app').rglob('*.py'))]
    return [h for ruta in archivos for h in _hallazgos_de(ruta, ruta.relative_to(RAIZ).as_posix())]


def test_los_secretos_escritos_en_el_codigo_son_exactamente_los_conocidos():
    encontrados = Counter(_todos_los_hallazgos())

    assert dict(encontrados) == CONOCIDOS, (
        'Secretos en el codigo distintos de los conocidos (se muestran archivo y nombre, nunca el valor):\n'
        f'  nuevos o de mas: {dict(encontrados - Counter(CONOCIDOS))}\n'
        f'  ya no estan:     {dict(Counter(CONOCIDOS) - encontrados)}')


@pytest.mark.xfail(strict=True, reason=(
    "BUG DE SEGURIDAD: hay secretos escritos en el codigo (token del webhook de ManyChat, valor por "
    "defecto del secreto de los crons y las contrasenas por defecto de usuarios importados o creados "
    "sin clave). Deben salir a variables de entorno, rotarse y no tener valor por defecto."))
def test_no_hay_secretos_escritos_en_el_codigo():
    reales = sorted(set(_todos_los_hallazgos()) - ACEPTABLES)

    assert reales == [], f'Secretos escritos en el codigo (archivo, nombre): {reales}'
