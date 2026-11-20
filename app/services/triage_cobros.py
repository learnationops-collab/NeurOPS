"""Lo cobrado en el área Triage (20/11/2026, ADR-W188): el low ticket y lo que cargó alguien con rol triage.

Salió del Closing (`area_venta`) y se ve como subdato del tablero de Triage: `lt_cobrado` (bruto), `lt_neto` y
`lt_ventas`, en el total y por persona. El período es por la fecha del cobro; el filtro de segmento no lo acota.
"""
from app.models import FinancialSale
from app.services.area_venta import TRIAGE, area_de
from app.services.closer_name_service import resolver_nombre_closer
from app.services.commission_service import cash_neto
from app.services.comercial_vocabulario import venta_completada

CAMPOS = ('lt_cobrado', 'lt_neto', 'lt_ventas')


def _vacio():
    return {'lt_cobrado': 0.0, 'lt_neto': 0.0, 'lt_ventas': 0}


def _sumar(m, v):
    m['lt_cobrado'] = round(m['lt_cobrado'] + float(v.monto or 0), 2)
    m['lt_neto'] = round(m['lt_neto'] + cash_neto(v), 2)
    m['lt_ventas'] += 1


def cobros(desde, hasta, personas):
    """(total, {id de persona: {...}}) de los cobros completados del área Triage entre `desde` y `hasta`."""
    from app.services.comercial_service import ComercialService
    from app.services.triage_service import nombres_de_triage

    triage = nombres_de_triage()
    por_nombre = {p.username: p.id for p in personas}
    total, por_id = _vacio(), {p.id: _vacio() for p in personas}
    filas = FinancialSale.query.filter(FinancialSale.date >= desde, FinancialSale.date < hasta).all()
    for v in filas:
        if not venta_completada(v):
            continue
        vendedor = resolver_nombre_closer(v.email_vendedor)
        if area_de(ComercialService.clasificar_venta(v)[0], vendedor, triage) != TRIAGE:
            continue
        if vendedor in por_nombre:
            _sumar(por_id[por_nombre[vendedor]], v)
            _sumar(total, v)
        elif len(personas) > 1 or not personas:
            # Un low ticket que cargó alguien que no es del triage: va al total del equipo, no a una persona.
            _sumar(total, v)
    return total, por_id


def agregar(datos, desde, hasta, personas):
    """Suma los campos de `cobros` al `total` y a cada fila de `por_persona` de `triage_service.metricas`."""
    total, por_id = cobros(desde, hasta, personas)
    datos['total'].update(total)
    for fila in datos['por_persona']:
        fila.update(por_id.get(fila['id'], _vacio()))
    return datos
