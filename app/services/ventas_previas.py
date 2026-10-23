"""¿Hay un pago de venta de la llamada en adelante? (23/10/2026)

Una llamada es «Venta» si su lead tiene un pago completo o un split pay. Hasta hoy cualquier pago
valía, de la fecha que fuera: un cliente que ya había comprado en agosto y volvía a hablar en
septiembre (otro programa, una llamada de soporte) marcaba esa llamada como cierre aunque el pago
fuera anterior. Esa misma plata ya había contado en el mes en que se cobró.

Acá se mira la FECHA del pago: la llamada cierra solo si el pago es del día de la llamada o de
después. `TOLERANCIA_DIAS` cubre que el pago tiene fecha de día y la llamada una hora en UTC: una
llamada de las 21:00 de Caracas es del día siguiente en UTC, y el closer cobra durante ella.

Usa el MISMO cruce que `ComercialService.agendas` (`CloserAgendasService._contactos_y_ventas`: con
persona, sus pagos; sin ella, mail e instagram), pero guardando la fecha del último pago de venta
real en vez del conjunto de tipos.
"""
from datetime import timedelta

from app import db
from app.models import FinancialSale
from app.services.closer_agendas_service import CloserAgendasService
from app.services.comercial_cruces import _limpiar_email, _limpiar_ig

TOLERANCIA_DIAS = 1
_VIGENTES = ('', 'completada', 'confirmada')


def _ultimas_por_clave(appts):
    """(por_email, por_ig, por_id, por_persona): la fecha del último pago de venta real de cada clave."""
    from app.services.closer_service import REAL_SALE_TIPOS
    from app.services.sheets_service import SheetsService

    def ultimo(mapa, clave, fecha):
        if clave is not None and fecha and (mapa.get(clave) is None or fecha > mapa[clave]):
            mapa[clave] = fecha

    emails, igs, ids, rows = CloserAgendasService._contactos_y_ventas(
        appts, FinancialSale.tipo_pago, FinancialSale.estado, FinancialSale.date)
    por_email, por_ig, por_id, por_persona = {}, {}, {}, {}
    for mail, ig, client_id, tipo_pago, estado, fecha in rows:
        if (estado or '').strip().lower() not in _VIGENTES:
            continue
        if SheetsService.parse_tipo_pago(tipo_pago)[1] not in REAL_SALE_TIPOS:
            continue
        mail_c, ig_c = _limpiar_email(mail), _limpiar_ig(ig)
        ultimo(por_email, mail_c if mail_c in emails else None, fecha)
        ultimo(por_ig, ig_c if ig_c in igs else None, fecha)
        ultimo(por_id, client_id if client_id in ids else None, fecha)

    personas = {a.person_uuid for a in appts if a.person_uuid}
    if personas:
        for puuid, tipo_pago, estado, fecha in db.session.query(
                FinancialSale.person_uuid, FinancialSale.tipo_pago, FinancialSale.estado,
                FinancialSale.date).filter(FinancialSale.person_uuid.in_(personas)):
            if ((estado or '').strip().lower() in _VIGENTES
                    and SheetsService.parse_tipo_pago(tipo_pago)[1] in REAL_SALE_TIPOS):
                ultimo(por_persona, puuid, fecha)
    return por_email, por_ig, por_id, por_persona


def con_venta_posterior(appts):
    """Los ids de las agendas de `appts` con un pago de venta real del día de la llamada en adelante."""
    appts = [a for a in appts if a.start_time]
    if not appts:
        return set()
    por_email, por_ig, por_id, por_persona = _ultimas_por_clave(appts)
    salida = set()
    for a in appts:
        cliente = a.client
        if a.person_uuid:
            fechas = (por_persona.get(a.person_uuid), por_id.get(a.client_id))
        else:
            fechas = (por_email.get(_limpiar_email(cliente.email) if cliente else None),
                      por_ig.get(_limpiar_ig(cliente.instagram) if cliente else None),
                      por_id.get(a.client_id))
        limite = a.start_time.date() - timedelta(days=TOLERANCIA_DIAS)
        if any(f and f.date() >= limite for f in fechas):
            salida.add(a.id)
    return salida
