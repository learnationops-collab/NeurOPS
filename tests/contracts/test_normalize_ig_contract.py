"""Contrato: `normalize_ig` y `normalize_email` tienen UNA sola definicion (identity_service).

Llegaron a existir copiadas en 10 lugares (una por modulo; la de finance.py ni se usaba) y 9 tenian
el mismo defecto: comparaban con 'n/a' antes de recortar los espacios. Arreglar una copia y olvidar
las otras dejaba al mismo Instagram reconocido como el mismo lead en un reporte y como dos leads en
otro. Estos tests impiden que vuelvan a copiarse: se busca por AST en todo `app/`, tambien las
funciones anidadas.
"""
import ast
import importlib
from pathlib import Path

import pytest

from app.services import identity_service

RAIZ_APP = Path(__file__).resolve().parents[2] / 'app'
NOMBRES = {'normalize_ig', 'normalize_email'}

# Modulos que usaban su propia copia de normalize_ig y hoy la importan.
USUARIOS_DE_NORMALIZE_IG = [
    'app.services.attribution_service',
    'app.services.marketing_service',
    'app.api.conversational',
    'app.api.manychat',
    'app.api.public.marketing',
    'app.api.public.financial_sales',
    'app.api.public.lead_roadmap',
    'app.api.public.new_clients',
]
USUARIOS_DE_NORMALIZE_EMAIL = ['app.services.attribution_service', 'app.api.public.new_clients']


def _definiciones_en_app():
    """(archivo, nombre) de toda `def normalize_ig/normalize_email` de app/, anidadas incluidas."""
    encontradas = []
    for ruta in sorted(RAIZ_APP.rglob('*.py')):
        arbol = ast.parse(ruta.read_text(encoding='utf-8'), filename=str(ruta))
        for nodo in ast.walk(arbol):
            if isinstance(nodo, (ast.FunctionDef, ast.AsyncFunctionDef)) and nodo.name in NOMBRES:
                encontradas.append((ruta.relative_to(RAIZ_APP.parent).as_posix(), nodo.name))
    return encontradas


def test_solo_identity_service_define_las_funciones():
    assert _definiciones_en_app() == [
        ('app/services/identity_service.py', 'normalize_ig'),
        ('app/services/identity_service.py', 'normalize_email'),
    ]


@pytest.mark.parametrize('modulo', USUARIOS_DE_NORMALIZE_IG)
def test_cada_modulo_usa_la_definicion_unica_de_normalize_ig(modulo):
    assert importlib.import_module(modulo).normalize_ig is identity_service.normalize_ig


@pytest.mark.parametrize('modulo', USUARIOS_DE_NORMALIZE_EMAIL)
def test_cada_modulo_usa_la_definicion_unica_de_normalize_email(modulo):
    assert importlib.import_module(modulo).normalize_email is identity_service.normalize_email
