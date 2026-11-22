"""La primera versión de la Guía del setting (ADR-W197): el documento de setting de Mario, completo, en
`guia_inicial.json`. Rige mientras nadie publicó una versión (`guia_setting_versiones` vacía). Forma: `guia.py`."""
import json
from pathlib import Path

INICIAL = json.loads((Path(__file__).with_name('guia_inicial.json')).read_text(encoding='utf-8'))
