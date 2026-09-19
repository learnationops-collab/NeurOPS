"""Contrato: ningun modulo usa un nombre que no define ni importa.

Un import que falta solo revienta cuando alguien llama a esa ruta (NameError, y de ahi un 500), asi que
pasa desapercibido hasta entonces. Asi estuvieron rotos, sin que nadie lo notara, POST
/api/admin/sales/quick-create (Lead), el POST de comentarios del mazo del closer (Comment y
Notification) y el chequeo publico de cliente por Instagram (or_). Se revisa todo `app/` y `config.py`
con la regla F821 de ruff, sin leer ruff.toml (--isolated): lo unico que se pide es que no haya nombres
sin definir, no un estilo.
"""
import subprocess
import sys
from pathlib import Path

import pytest

pytest.importorskip('ruff', reason='ruff no esta instalado (pip install -r requirements-dev.txt)')

RAIZ = Path(__file__).resolve().parents[2]


def test_no_hay_nombres_sin_definir_en_app():
    proceso = subprocess.run(
        [sys.executable, '-m', 'ruff', 'check', '--isolated', '--select', 'F821', '--output-format', 'concise',
         'app', 'config.py'],
        cwd=RAIZ, capture_output=True, text=True, timeout=120,
    )

    assert proceso.returncode == 0, (
        'Hay nombres usados sin definir ni importar (cada uno es un NameError, es decir un 500, cuando se '
        'llama a esa ruta):\n' + proceso.stdout)
