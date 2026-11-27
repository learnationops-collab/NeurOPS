"""GET /api/inbox/mis-pendientes: cuántas conversaciones asignadas a quien pregunta esperan su respuesta.

Es la cuenta del Inbox en el dock (ADR-W242): mientras haya alguna, queda fijado. «Espera» es la misma regla
de la bandeja (`colas.js`): lo último lo escribió el lead, no se marcó «No requiere respuesta» después y no
salió de la bandeja como No lead / In-abrible. Asignada = el setter de su último recorrido o el puesto a mano
(`bandeja.asignaciones`). Solo cuenta lo de los últimos DIAS: lo más viejo ya no se puede contestar.
"""
from datetime import timedelta

from flask import jsonify
from flask_login import current_user

from app import db
from app.automatizaciones import bandeja, fases, servicio
from app.automatizaciones.api import bp
from app.automatizaciones.modelos import AutEjecucion, IgContacto, IgMensaje

DIAS = 30


def esperan(usuario_id, ahora):
    desde = ahora - timedelta(days=DIAS)
    candidatos = {c for (c,) in db.session.query(IgContacto.id).filter(IgContacto.setter_id == usuario_id)}
    candidatos |= {c for (c,) in db.session.query(AutEjecucion.contacto_id)
                   .filter(AutEjecucion.setter_id == usuario_id).distinct()}
    if not candidatos:
        return 0
    asignados = bandeja.asignaciones(list(candidatos))
    mios = [cid for cid in candidatos if (asignados.get(cid) or {}).get('id') == usuario_id]
    if not mios:
        return 0
    ultimo = (db.session.query(IgMensaje.contacto_id, db.func.max(IgMensaje.enviado_en).label('en'))
              .filter(IgMensaje.contacto_id.in_(mios)).group_by(IgMensaje.contacto_id).subquery())
    ultimos = (IgMensaje.query.join(ultimo, db.and_(ultimo.c.contacto_id == IgMensaje.contacto_id,
                                                     ultimo.c.en == IgMensaje.enviado_en))
               .filter(IgMensaje.enviado_en >= desde).order_by(IgMensaje.id).all())
    ultimo_de = {}
    for m in ultimos:  # en empate de hora, el de id mayor (como la bandeja)
        ultimo_de[m.contacto_id] = m
    del_lead = {cid: m.enviado_en for cid, m in ultimo_de.items() if m.origen == IgMensaje.LEAD}
    if not del_lead:
        return 0
    contactos = IgContacto.query.filter(IgContacto.id.in_(list(del_lead))).all()
    cerradas = fases.cerradas(contactos)
    return sum(1 for c in contactos
               if c.id not in cerradas and not (c.resuelta_en and c.resuelta_en >= del_lead[c.id]))


@bp.route('/mis-pendientes', methods=['GET'])
def mis_pendientes():
    return jsonify({'esperan': esperan(current_user.id, servicio.ahora())})
