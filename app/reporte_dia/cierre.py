"""El cierre automático del día (job `reporte_cierre` del scheduler, cada 15 minutos, en el líder).

Para cada persona activa con rol closer, setter o triage cuya hora local ya pasó las 10:00, cierra el día
anterior (y cualquier día más viejo que haya quedado abierto): fija lo sugerido a mano, guarda los números
en la tabla del rol, calcula el estado, pone `closed_at` y manda a Discord con los triggers de siempre.

A Discord va solo lo que tiene algo que contar: un día que la persona tocó o en el que hubo trabajo. Un
domingo sin agendas que nadie abrió se cierra igual (incompleto), en silencio. Un día que ya tenía
reporte del flujo viejo se cierra como legado, sin volver a mandarlo.
"""
import logging
from datetime import datetime

from sqlalchemy.orm.attributes import flag_modified

from app import db
from app.models import DailyClose, User
from app.reporte_dia.comun import ROLES, cierre_o_nuevo, datos, rol_de, ultimo_dia_cerrable
from app.reporte_dia.dia import calcular, modulo
from app.reporte_dia.estado import status_guardado

logger = logging.getLogger(__name__)


def cerrar_dia(user, dia, rol):
    """Cierra un día abierto. Devuelve True si salió a Discord."""
    m = modulo(rol)
    close = cierre_o_nuevo(user, dia, rol, m, nacer_cerrado=False)
    if close.closed_at:
        # Recién creado como legado (o ya cerrado): no se recalcula ni se manda.
        close.status = 'completo' if close.status == 'en_curso' else close.status
        db.session.commit()
        return False
    tocado = close.id is not None
    # La última vez que escribió la persona, antes de que el cierre toque la fila: el autoflush de
    # `persistir` pone `updated_at` en la hora del cierre y el reporte salía siempre «enviado tarde».
    close.escrito_en = close.updated_at
    calc = calcular(user, dia, rol, close)
    d = datos(close)
    # Lo sugerido queda fijo: es lo que se guarda y lo que se ve después.
    for item in calc['mano']:
        if item['clave'] not in d['mano'] and item['valor'] is not None:
            d['mano'][item['clave']] = item['valor']
    close.data = d
    flag_modified(close, 'data')
    close.closed_at = datetime.utcnow()
    close.status = status_guardado(close, calc['faltan'])
    row = m.persistir(user, dia, close, calc['vals'])
    db.session.commit()
    if not (tocado or m.hubo_trabajo(calc['vals'], dia)):
        return False
    try:
        m.discord(row)
    except Exception as e:
        logger.error(f"[reporte_cierre] Discord de {user.username} {dia}: {e}")
    return True


def correr():
    """Cierra lo que ya pasó su hora. Devuelve cuántos días cerró."""
    cerrados = 0
    usuarios = User.query.filter(User.is_active.is_(True), User.role.in_(ROLES)).all()
    for u in usuarios:
        rol = rol_de(u)
        if not rol:
            continue
        corte = ultimo_dia_cerrable(u)
        abiertos = {c.date: c.role for c in DailyClose.query.filter(
            DailyClose.user_id == u.id, DailyClose.closed_at.is_(None), DailyClose.date <= corte)}
        if corte not in abiertos and not DailyClose.query.filter_by(user_id=u.id, date=corte).first():
            abiertos[corte] = rol
        for dia in sorted(abiertos):
            try:
                cerrar_dia(u, dia, abiertos[dia] if abiertos[dia] in ROLES else rol)
                cerrados += 1
            except Exception as e:
                db.session.rollback()
                logger.error(f"[reporte_cierre] {u.username} {dia}: {e}")
    return cerrados
