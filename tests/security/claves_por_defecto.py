"""Las claves por defecto que el codigo uso alguna vez, cargadas del script de auditoria.

Una sola lista para todos los tests: si se agrega una clave al script, los tests de las cuentas que se
crean sin clave la incluyen sin tocar nada. El script vive en scripts/ (no es un paquete), asi que se
carga por ruta.
"""
import importlib.util
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]


def _cargar_script():
    ruta = RAIZ / 'scripts' / 'auditar_contrasenas_por_defecto.py'
    especificacion = importlib.util.spec_from_file_location('auditar_contrasenas_por_defecto', ruta)
    modulo = importlib.util.module_from_spec(especificacion)
    especificacion.loader.exec_module(modulo)
    return modulo


auditoria = _cargar_script()

CLAVES_POR_DEFECTO = tuple(auditoria.CLAVES_POR_DEFECTO)
