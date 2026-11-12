"""Las reglas de un nodo «condición»: si los datos del contacto las cumplen todas."""
from app.automatizaciones.nucleo.grafo import normalizar_texto


def _valor(contacto, campo):
    if campo == 'usuario':
        return contacto.username
    if campo == 'nombre':
        return contacto.nombre
    return (contacto.variables or {}).get(campo)


def cumple(contacto, reglas):
    for regla in reglas:
        actual, esperado = normalizar_texto(_valor(contacto, regla.get('campo'))), normalizar_texto(regla.get('valor'))
        ok = {
            'igual': actual == esperado,
            'distinto': actual != esperado,
            'contiene': bool(esperado) and esperado in actual,
            'no_contiene': not esperado or esperado not in actual,
            'existe': bool(actual),
            'no_existe': not actual,
        }[regla['operador']]
        if not ok:
            return False
    return True
