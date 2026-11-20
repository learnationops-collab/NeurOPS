"""A qué tablero va cada venta: Closing o Triage (20/11/2026, ADR-W188).

El low ticket (programa LT) es un programa aparte, no una seña: lo vende el triage y se ve en su tablero, no en el
de Closing, donde subía el close rate del equipo (su venta entraba arriba y su llamada no, abajo) y bajaba el
ticket promedio. También va al Triage cualquier venta cargada por alguien con rol triage.

Revisar › Ventas sigue listando todos los cobros, cada uno con su `area`: las cifras del Closing abren la lista
con «Área: Closing», así lista y número cierran.
"""
from app.services.closer_name_service import resolver_nombre_closer
from app.services.closer_service import PROGRAM_LABELS

CLOSING, TRIAGE = 'Closing', 'Triage'
LOW_TICKET = PROGRAM_LABELS['LT']


def _triage():
    from app.services.triage_service import nombres_de_triage
    return nombres_de_triage()


def area_de(programa, vendedor, triage):
    """TRIAGE si es low ticket o la cargó alguien de `triage` (usernames); CLOSING si no."""
    return TRIAGE if programa == LOW_TICKET or vendedor in triage else CLOSING


def marcar(filas):
    """Le pone `area` a cada fila de `ComercialService.ventas` (con `programa` y `closer`)."""
    triage = _triage()
    for f in filas:
        f['area'] = area_de(f['programa'], f['closer'], triage)
    return filas


def de_closing(filas):
    """Las filas de venta que cuentan en el Closing."""
    return [f for f in filas if f.get('area', CLOSING) == CLOSING]


def cobros_de_closing(cobros):
    """Lo mismo sobre cobros (`FinancialSale`) sueltos."""
    from app.services.comercial_service import ComercialService
    triage = _triage()
    return [v for v in cobros
            if area_de(ComercialService.clasificar_venta(v)[0], resolver_nombre_closer(v.email_vendedor), triage) == CLOSING]
