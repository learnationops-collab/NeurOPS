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
    filas = (db.session.query(WaEnvio.lote, WaEnvio.plantilla, db.func.min(WaEnvio.creado_en),
                              db.func.min(WaEnvio.enviado_por_id))
             .group_by(WaEnvio.lote, WaEnvio.plantilla).order_by(db.func.min(WaEnvio.creado_en).desc())
             .limit(LOTES).all())
    ids = [f[0] for f in filas]
    conteo = {}
    for lote, estado, n in (db.session.query(WaEnvio.lote, WaEnvio.estado, db.func.count(WaEnvio.id))
                            .filter(WaEnvio.lote.in_(ids)).group_by(WaEnvio.lote, WaEnvio.estado)):
        conteo.setdefault(lote, {})[estado] = n
    usuarios = {u.id: u.username for u in User.query.filter(User.id.in_({f[3] for f in filas if f[3]}))}
    return [{'lote': lote, 'plantilla': plantilla, 'creado_en': _iso(creado), 'por': usuarios.get(por),
             'total': sum(conteo.get(lote, {}).values()), 'por_estado': conteo.get(lote, {})}
            for lote, plantilla, creado, por in filas]


def numeros(lote):
    filas = (db.session.query(WaEnvio, IgContacto.setter_id).outerjoin(IgContacto, IgContacto.id == WaEnvio.contacto_id)
             .filter(WaEnvio.lote == lote).order_by(WaEnvio.id).all())
    setters = {u.id: u.username for u in User.query.filter(User.id.in_({s for _, s in filas if s}))}
    return [{'telefono': e.telefono, 'nombre': e.nombre, 'estado': e.estado, 'enviado_en': _iso(e.enviado_en),
             'error': e.error, 'respuesta': e.respuesta, 'contacto_id': e.contacto_id, 'setter': setters.get(s)}
            for e, s in filas]
