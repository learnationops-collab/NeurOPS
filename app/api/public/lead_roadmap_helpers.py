"""Ayudantes de texto del roadmap del lead (`lead_roadmap.py`): comparar nombres, valores genericos y fechas."""
import unicodedata

def _strip_accents(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if not unicodedata.combining(c))

def names_plausibly_match(name_a, name_b):
    # En agendas historicas, el mail/telefono de una fila a veces quedo mal cargado y
    # coincide con el de OTRO cliente ya existente (ver caso Yrein Cordova / Rolando
    # Sanchez Perez, sep/2026): sin este chequeo, resolver por mail/telefono terminaba
    # mostrando la ficha completa (ventas, chat, historial) de una persona distinta a
    # la que se hizo click. Si no hay nombre de un lado o del otro no podemos comparar,
    # asi que no bloqueamos (evita falsos negativos cuando el lead nunca tuvo nombre).
    if not name_a or not name_b:
        return True
    a_tokens = {t for t in _strip_accents(name_a).lower().split() if len(t) > 2}
    b_tokens = {t for t in _strip_accents(name_b).lower().split() if len(t) > 2}
    if not a_tokens or not b_tokens:
        return True
    return bool(a_tokens & b_tokens)

def is_generic_val(val):
    # Valida si un valor es generico o no valido
    if not val:
        return True
    val_clean = str(val).strip().lower()
    return val_clean in ('n/a', 'none', 'null', 'sin email', 'sin telefono', 'sin teléfono', 'desconocido', '')

def format_datetime_es(dt):
    # Formatea un objeto datetime a string legible en español
    if not dt:
        return ""
    months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    return f"{dt.day:02d} {months[dt.month - 1]} {dt.year}, {dt.hour:02d}:{dt.minute:02d} hs"

def format_date_es(dt):
    # Formatea un objeto datetime a solo fecha en español
    if not dt:
        return ""
    months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
    return f"{dt.day:02d} {months[dt.month - 1]} {dt.year}"
