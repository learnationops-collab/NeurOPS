"""Contrato: el tooltip de «Lead perdido» y de «Archivada sin reporte» dice lo mismo en todas partes.

La mayoría de las pantallas lo reciben del backend, con el chip (`AYUDA_ESTADO` en
`closer_agendas_service.py`). Las que muestran el `closer_result` crudo —el mazo del closer, su
auditoría, el tablero de triage— no tienen chip y usan una copia en
`frontend/src/utils/estadosAgenda.js`. Este test impide que las dos se separen en silencio.
"""
import re
from pathlib import Path

from app.services.closer_agendas_service import AYUDA_ESTADO

JS = (Path(__file__).resolve().parents[2] / 'frontend' / 'src' / 'utils' / 'estadosAgenda.js')


def _ayudas_del_js():
    texto = JS.read_text(encoding='utf-8')
    bloque = re.search(r'export const AYUDA_ESTADO = \{(.*?)\};', texto, re.S).group(1)
    return dict(re.findall(r"(\w+): '([^']*)'", bloque))


def test_el_frontend_tiene_las_mismas_oraciones_que_el_backend():
    assert _ayudas_del_js() == AYUDA_ESTADO
