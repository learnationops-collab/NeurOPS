"""El historial de la herramienta «Broadcast de WhatsApp» (ADR-W229): cada «Enviar» (lote) con sus cuentas, y
los números de un lote con lo que pasó y, si respondió, su conversación y el setter que la tiene."""
from app import db
from app.automatizaciones.modelos import IgContacto
from app.models.user import User
from app.models.whatsapp import WaEnvio

LOTES = 60


def _iso(momento):
    return momento.isoformat() + 'Z' if momento else None


def lotes():
    """Cada envío con su conteo por estado, en total y por plantilla (`plantillas`: {nombre: {estado: n}})."""
    filas = (db.session.query(WaEnvio.lote, db.func.min(WaEnvio.creado_en), db.func.min(WaEnvio.enviado_por_id))
             .group_by(WaEnvio.lote).order_by(db.func.min(WaEnvio.creado_en).desc()).limit(LOTES).all())
    conteo, por_plantilla = {}, {}
    for lote, plantilla, estado, n in (db.session.query(WaEnvio.lote, WaEnvio.plantilla, WaEnvio.estado,
                                                        db.func.count(WaEnvio.id))
                                       .filter(WaEnvio.lote.in_([f[0] for f in filas]))
                                       .group_by(WaEnvio.lote, WaEnvio.plantilla, WaEnvio.estado)):
        total = conteo.setdefault(lote, {})
        total[estado] = total.get(estado, 0) + n
        por_plantilla.setdefault(lote, {}).setdefault(plantilla, {})[estado] = n
    usuarios = {u.id: u.username for u in User.query.filter(User.id.in_({f[2] for f in filas if f[2]}))}
    return [{'lote': lote, 'plantillas': por_plantilla.get(lote, {}), 'creado_en': _iso(creado), 'por': usuarios.get(por),
             'total': sum(conteo.get(lote, {}).values()), 'por_estado': conteo.get(lote, {})}
            for lote, creado, por in filas]


def numeros(lote):
    filas = (db.session.query(WaEnvio, IgContacto.setter_id).outerjoin(IgContacto, IgContacto.id == WaEnvio.contacto_id)
             .filter(WaEnvio.lote == lote).order_by(WaEnvio.id).all())
    setters = {u.id: u.username for u in User.query.filter(User.id.in_({s for _, s in filas if s}))}
    return [{'telefono': e.telefono, 'nombre': e.nombre, 'plantilla': e.plantilla, 'estado': e.estado, 'enviado_en': _iso(e.enviado_en),
             'error': e.error, 'respuesta': e.respuesta, 'contacto_id': e.contacto_id, 'setter': setters.get(s)}
            for e, s in filas]
