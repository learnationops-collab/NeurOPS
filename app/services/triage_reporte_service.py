"""Los números del reporte de triage contados desde las agendas (`FinancialAgenda.encargado_triage`).

Sacado de `GET /public/triage-report/prefill` para que el reporte único (`app/reporte_dia/triage.py`)
cuente exactamente lo mismo. El criterio no cambió:

- Hoy: agendas del triage cuya cita cae ese día.
- Futuras: agendas creadas ese día para un día posterior.
- Contactada / confirmada / cancelada / reagendada: por palabras en el `estado` de la agenda.
"""
from datetime import date, datetime

from sqlalchemy import func

KW = {
    'contacted': ('contac',),
    'confirmed': ('confirm',),
    'canceled': ('cancel',),
    'rescheduled': ('reagend', 'reprog'),
}


def tiene_estado(agenda, clave):
    """¿El estado de la agenda cae en `clave` (contacted, confirmed, canceled, rescheduled)?"""
    est = str(agenda.estado or '').strip().lower()
    return bool(est) and any(kw in est for kw in KW[clave])


def agendas(triage_name, target_date):
    """(hoy, futuras): las agendas del triage que cuenta su reporte de `target_date`."""
    from app.models import FinancialAgenda

    todas = FinancialAgenda.query.filter(
        func.lower(FinancialAgenda.encargado_triage) == (triage_name or '').strip().lower()).all()
    hoy, futuras = [], []
    for a in todas:
        if not a.date:
            continue
        dia = a.date.date() if isinstance(a.date, (datetime, date)) else a.date
        creada = a.created_at.date() if a.created_at else None
        if dia == target_date:
            hoy.append(a)
        elif creada == target_date and dia > target_date:
            futuras.append(a)
    return hoy, futuras


def contar(triage_name, target_date):
    """Las métricas del prefill (today_* y future_*), con las mismas claves que `TriageDailyReport`."""
    hoy, futuras = agendas(triage_name, target_date)
    salida = {}
    for pre, lista in (('today', hoy), ('future', futuras)):
        salida[f'{pre}_agendas'] = len(lista)
        for clave in KW:
            salida[f'{pre}_{clave}'] = sum(1 for a in lista if tiene_estado(a, clave))
    return salida
