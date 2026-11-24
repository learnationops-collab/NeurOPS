"""Cada mañana, en #📋-reportes de adquisitions, quién dejó incompleto el reporte de ayer y quién tiene
llamadas sin resultado, con la persona etiquetada (reunión de estrategia del 16/11/2026, Leadership 1405).

- Desde el reporte único (ADR-W203) se avisa el día de ayer que quedó **incompleto** en `daily_closes`, para
  closers, setters y triage por igual (antes el triage se medía contra el reporte del closer y salía siempre
  como faltante). Si ayer no hubo trabajo (closer o triage sin agendas, setter un domingo) y la persona no
  lo tocó, no se avisa.
- Closers y triage: aparte, las llamadas de los últimos DIAS_ATRASO días que ya pasaron sin resultado.

«Ayer» es el de la zona de cada persona. Si no falta nada, no sale mensaje. Corre una vez por día desde el
scheduler (`reminder_scheduler`, en el proceso líder).
"""
import logging
import os
from datetime import timedelta

from app import db
from app.models import User
from app.services.discord_avisos import envio

logger = logging.getLogger(__name__)

CANAL = 'reportes_ventas'
HORA_UTC = int(os.environ.get('REPORTES_FALTANTES_HORA_UTC', '14'))  # 10:00 Caracas y Bolivia, 8:00 México
DIAS_ATRASO = 7
ROLES_LLAMADAS = ('closer', 'triage')
ROLES_REPORTE = ('closer', 'setter', 'triage')


def _mencion(u):
    return f'<@{u.discord_id}>' if u.discord_id else f'**{u.username}**'


def _plural(n, uno, varios):
    return f'{n} {uno if n == 1 else varios}'


def _llamadas_sin_resultado(u):
    """Las llamadas de los últimos DIAS_ATRASO días que ya pasaron sin resultado."""
    from app.services.comercial_service import ComercialService
    from app.services.user_time_service import hoy_del_usuario

    ayer = hoy_del_usuario(u) - timedelta(days=1)
    filas = ComercialService.agendas(ayer - timedelta(days=DIAS_ATRASO - 1), ayer, closer_id=u.id)
    return sum(1 for f in filas if f['post_call']['key'] == 'pendiente' and f['ya_paso'])


def _ayer_incompleto(u):
    """¿El reporte de ayer quedó incompleto? Lee `daily_closes`; si el job todavía no lo cerró, lo calcula
    sin guardar. Un día sin trabajo que la persona no tocó no se avisa."""
    from app.reporte_dia.comun import cierre_de, rol_de
    from app.reporte_dia.dia import calcular, modulo
    from app.services.user_time_service import hoy_del_usuario

    ayer = hoy_del_usuario(u) - timedelta(days=1)
    close = cierre_de(u, ayer)
    rol = (close.role if close is not None else None) or rol_de(u)
    if not rol:
        return False
    m = modulo(rol)
    if close is None and m.fila(u, ayer) is not None:
        return False  # lo mandó por el flujo viejo
    if close is not None and (close.is_non_working_day or (close.data or {}).get('legado')):
        return False
    if close is not None and close.closed_at and close.status != 'incompleto':
        return False
    calc = calcular(u, ayer, rol, close)
    if not calc['faltan']:
        return False
    tocado = close is not None and (close.victory or close.tomorrow or (close.data or {}).get('mano'))
    return bool(tocado or m.hubo_trabajo(calc['vals'], ayer))


def pendientes():
    """[(usuario, [qué debe])]: solo quien debe algo, por nombre."""
    salida = []
    for u in User.query.filter(User.is_active.is_(True)).order_by(User.username).all():
        rol = u._role
        debe = []
        try:
            incompleto = rol in ROLES_REPORTE and _ayer_incompleto(u)
        except Exception as e:
            db.session.rollback()
            logger.error(f"[REPORTES FALTANTES] reporte de ayer de {u.username}: {e}")
            incompleto = False
        if incompleto:
            debe.append('el reporte de ayer quedó incompleto')
        if rol in ROLES_LLAMADAS:
            sin_resultado = _llamadas_sin_resultado(u)
            if sin_resultado:
                debe.append(_plural(sin_resultado, 'llamada sin resultado', 'llamadas sin resultado'))
            # Las que canceló en su Google Calendar sin decir por qué (ADR-W191).
            from app.services.cancelaciones_google import pendientes as sin_motivo
            canceladas = len(sin_motivo(u.id))
            if canceladas:
                debe.append(_plural(canceladas, 'cancelada en Google sin motivo', 'canceladas en Google sin motivo'))
        if debe:
            salida.append((u, debe))
    return salida


def armar(lista):
    """El mensaje, o None si nadie debe nada."""
    if not lista:
        return None
    lineas = ['⏰ **Reportes pendientes**']
    lineas += [f"• {_mencion(u)}: {' · '.join(debe)}" for u, debe in lista]
    return '\n'.join(lineas)[:1990]


def publicar():
    """Publica el aviso. Devuelve a cuántas personas etiquetó."""
    lista = pendientes()
    texto = armar(lista)
    if texto:
        envio.enviar(CANAL, {'content': texto, 'allowed_mentions': {'parse': ['users']}}, etiqueta='REPORTES FALTANTES')
    db.session.rollback()  # solo lectura: no deja la sesión abierta
    return len(lista)
