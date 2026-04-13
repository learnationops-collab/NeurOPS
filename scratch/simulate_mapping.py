import json

def _get_val(item, key):
    if not item or not isinstance(item, dict): return None
    if key in item: return item[key]
    key_lower = key.lower()
    for k in item.keys():
        if k.lower() == key_lower:
            return item[k]
    return None

def _to_str(val):
    if val is None: return None
    s = str(val).strip()
    return s if s else None

# Data from user screenshot
raw_data_str = """{
  "nombre": "Sandra Delgado villaverde",
  "registro": "2024-09-01T03:00:00.000Z",
  "fecha": "2024-09-03T03:00:00.000Z",
  "meet": "51 964 023 216",
  "whatsapp": "America/Lima",
  "zona_geografica": "Rafael",
  "closer": "Entrevista Diagnóstica Gratuita",
  "lead": "marielcaropdel@gmail.com",
  "mail": "",
  "instagram": ""
}"""

item = json.loads(raw_data_str)

fields = {
    "nombre": _to_str(_get_val(item, 'nombre')),
    "registro": _to_str(_get_val(item, 'registro')),
    "fecha_meet": _to_str(_get_val(item, 'fecha_meet')),
    "whatsapp": _to_str(_get_val(item, 'whatsapp')),
    "zona_geografica": _to_str(_get_val(item, 'zona_geografica')),
    "closer": _to_str(_get_val(item, 'closer')),
    "lead": _to_str(_get_val(item, 'lead')),
    "mail": _to_str(_get_val(item, 'mail')),
    "instagram": _to_str(_get_val(item, 'instagram'))
}

print(json.dumps(fields, indent=2))
