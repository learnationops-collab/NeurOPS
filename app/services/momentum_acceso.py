"""El acceso del alumno, arriba del reporte de una Momentum (ADR-W276): cuántos días le quedan o hace cuánto se
le venció. Sale de su suscripción; sin suscripción, de su ingreso más los 4 meses que tiene todo programa."""
from datetime import date, datetime

from dateutil.relativedelta import relativedelta

MESES_POR_DEFECTO = 4


def _dia(valor):
    if isinstance(valor, datetime):
        return valor.date()
    return valor if isinstance(valor, date) else None


def acceso(client, programa_code, ingreso):
    """{vence (ISO), dias (negativo = vencido), estimado (sin suscripción: ingreso + 4 meses)} o None."""
    if not client:
        return None
    from app.models import Subscription
    from app.services.subscription_service import vencimiento_de

    vence = vencimiento_de(client.id, programa_code) if programa_code else None
    if vence is None:
        ultima = (Subscription.query.filter_by(client_id=client.id)
                  .order_by(Subscription.expires_at.desc()).first())
        vence = ultima.expires_at if ultima else None
    estimado = vence is None
    if estimado:
        inicio = _dia(ingreso)
        if not inicio:
            return None
        vence = inicio + relativedelta(months=MESES_POR_DEFECTO)
    return {'vence': vence.isoformat(), 'dias': (vence - date.today()).days, 'estimado': estimado}
