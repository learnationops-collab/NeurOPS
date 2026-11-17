"""Cada mañana, en #📋-reportes de adquisitions, quién no mandó el reporte de ayer y quién tiene llamadas
sin resultado, con la persona etiquetada (reunión de estrategia del 16/11/2026, Leadership 1405).

- Closers y triage (rol principal): si ayer tuvieron llamadas, deben el reporte del día del mazo
  (`CloserDailyReport`). Aparte, las llamadas de los últimos DIAS_ATRASO días que ya pasaron sin resultado.
- Setters: el reporte de setter (`SetterDailyStats`) de lunes a sábado; el domingo no se pide.

«Ayer» es el de la zona de cada persona. Si no falta nada, no sale mensaje. Corre una vez por día desde el
scheduler (`reminder_scheduler`, en el proceso líder).
"""
import os
from datetime import timedelta

from app import db
from app.models import CloserDailyReport, SetterDailyStats, User
from app.services.discord_avisos import envio

CANAL = 'reportes_ventas'
HORA_UTC = int(os.environ.get('REPORTES_FALTANTES_HORA_UTC', '14'))  # 10:00 Caracas y Bolivia, 8:00 México
DIAS_ATRASO = 7
ROLES_LLAMADAS = ('closer', 'triage')
DOMINGO = 6  # date.weekday()


def _mencion(u):
    return f'<@{u.discord_id}>' if u.discord_id else f'**{u.username}**'


def _plural(n, uno, varios):
    return f'{n} {uno if n == 1 else varios}'


def _de_llamadas(u):
    """Lo que debe un closer o triage: (falta el reporte de ayer, llamadas de ayer, llamadas sin resultado)."""
    from app.services.comercial_service import ComercialService
    from app.services.user_time_service import hoy_del_usuario

    ayer = hoy_del_usuario(u) - timedelta(days=1)
    filas = ComercialService.agendas(ayer - timedelta(days=DIAS_ATRASO - 1), ayer, closer_id=u.id)
    de_ayer = len(ComercialService.agendas(ayer, ayer, closer_id=u.id))
    sin_resultado = sum(1 for f in filas if f['post_call']['key'] == 'pendiente' and f['ya_paso'])
    falta = de_ayer > 0 and not CloserDailyReport.query.filter_by(closer_id=u.id, date=ayer).first()
    return falta, de_ayer, sin_resultado


def _de_setter(u):
    """¿Le falta al setter el reporte de ayer? (el domingo no se pide)."""
    from app.services.user_time_service import hoy_del_usuario

    ayer = hoy_del_usuario(u) - timedelta(days=1)
    if ayer.weekday() == DOMINGO:
        return False
    return not SetterDailyStats.query.filter_by(setter_id=u.id, date=ayer).first()


def pendientes():
    """[(usuario, [qué debe])]: solo quien debe algo, por nombre."""
    salida = []
    for u in User.query.filter(User.is_active.is_(True)).order_by(User.username).all():
        rol = u._role
        debe = []
        if rol in ROLES_LLAMADAS:
            falta, de_ayer, sin_resultado = _de_llamadas(u)
            if falta:
                debe.append(f"falta el reporte de ayer ({_plural(de_ayer, 'llamada', 'llamadas')})")
            if sin_resultado:
                debe.append(_plural(sin_resultado, 'llamada sin resultado', 'llamadas sin resultado'))
        elif rol == 'setter' and _de_setter(u):
            debe.append('falta el reporte de setter de ayer')
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
