"""Normalizacion de las identidades con las que se reconoce a un lead: Instagram y mail.

La misma persona llega escrita de varias formas y muchas filas traen un placeholder ('N/A') en
lugar del dato. `normalize_ig` existia copiada en 10 lugares (una por modulo) y 9 comparaban con
'n/a' ANTES de recortar los espacios: un 'N/A ' (tipico de una celda de Google Sheets) se tomaba
como un usuario real y Union-Find fusionaba a dos personas distintas en AttributionService, con lo
que la venta de una se atribuia a la agenda de la otra. Vive aca, sin dependencias, para que haya
una sola definicion.
"""

# Valores que significan "no hay dato". Se comparan YA recortados y en minuscula.
PLACEHOLDERS = frozenset({'', 'n/a'})


def normalize_ig(value):
    """Usuario de Instagram en minusculas y sin '@'; None si viene vacio o es un placeholder."""
    if not value or not isinstance(value, str):
        return None
    handle = value.strip().lstrip('@').strip().lower()
    return None if handle in PLACEHOLDERS else handle


def normalize_email(value):
    """Mail en minusculas y sin espacios; None si viene vacio o es un placeholder."""
    if not value or not isinstance(value, str):
        return None
    email = value.strip().lower()
    return None if email in PLACEHOLDERS else email
