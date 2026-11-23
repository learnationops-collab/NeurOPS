"""Qué falta para que el día quede completo, su estado y la tira de los últimos 7 días."""
from datetime import timedelta

from app.models import DailyClose
from app.reporte_dia.comun import plural, ultimo_dia_cerrable, victoria_completa


def faltan(victoria, close, pendientes):
    """Lo que falta para «completo». Un día no laborable no debe nada; los avisos no bloquean."""
    if close is not None and close.is_non_working_day:
        return []
    n = len(pendientes.get('agendas') or []) + sum(1 for m in pendientes.get('mano') or [] if m['valor'] is None)
    salida = []
    if n:
        salida.append(plural(n, 'pendiente', 'pendientes'))
    if not victoria_completa(victoria):
        salida.append('la victoria')
    if not (close is not None and (close.tomorrow or '').strip()):
        salida.append('el «mañana»')
    return salida


def status_guardado(close, falta):
    """El `status` de la fila: en curso hasta que el job lo cierra; después, completo o incompleto."""
    if not close.closed_at:
        return 'en_curso'
    return 'completo' if close.is_non_working_day or not falta else 'incompleto'


def estado_de(user, dia, close, row, corte=None):
    """El estado que ve la persona: en_curso · completo · incompleto · no_laborable.

    Un día sin cierre propio que ya pasó su hora de cierre es del flujo viejo: completo si mandó el
    reporte (no laborable si lo marcó así), incompleto si no."""
    corte = corte or ultimo_dia_cerrable(user)
    if close is not None:
        if close.is_non_working_day:
            return 'no_laborable'
        if close.closed_at:
            return close.status if close.status in ('completo', 'incompleto') else 'incompleto'
        return 'en_curso'
    if dia <= corte:
        if row is None:
            return 'incompleto'
        return 'no_laborable' if getattr(row, 'is_non_working_day', False) else 'completo'
    return 'en_curso'


def cierres_rango(user, desde, hasta):
    return {c.date: c for c in DailyClose.query.filter(
        DailyClose.user_id == user.id, DailyClose.date >= desde, DailyClose.date <= hasta)}


def semana(user, modulo, hoy):
    """La tira: los últimos 7 días hasta hoy, del más viejo al más nuevo."""
    desde = hoy - timedelta(days=6)
    cierres = cierres_rango(user, desde, hoy)
    filas = modulo.filas_rango(user, desde, hoy)
    corte = ultimo_dia_cerrable(user)
    return [{'fecha': d.isoformat(), 'estado': estado_de(user, d, cierres.get(d), filas.get(d), corte)}
            for d in (desde + timedelta(days=k) for k in range(7))]
