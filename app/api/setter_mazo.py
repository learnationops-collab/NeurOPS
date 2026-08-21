"""La lista unica de agendas del mazo del setter.

Antes el paso "Agendas" mostraba DOS listas de las mismas agendas: un panel de
"Agendas Desatribuidas" (las que no tienen anuncio asociado, con los campos para
corregir el Instagram y asignar el anuncio) y debajo una lista de "Agendas
Atribuidas" armada sobre las citas. La misma agenda aparecia arriba y abajo, y
cada mitad podia hacer solo la mitad del trabajo.

Aca se arma una sola lista, sobre las FinancialAgenda del setter — el mismo
criterio de fuente que usa "Mis Agendas" —, con todo lo que hace falta en cada
fila: el estado de atribucion del anuncio, el Instagram resuelto y el hilo de
comentarios del lead.

Vive aparte porque `setter.py` ya pasa las 1700 lineas; se cuelga del mismo
blueprint.
"""
import logging
from datetime import datetime, timedelta

from flask import request, jsonify
from flask_login import current_user

from app import db
from app.models import ROLE_SETTER, Client, Appointment, ManychatLead, LeadAnswer, Ad, Comment, CommentNotification
from app.decorators import role_required
from app.services.user_time_service import hoy_del_usuario, limites_dia_utc, limites_rango_utc
from app.api.setter import bp
from app.api.setter_agendas import agendas_del_setter, _cliente_de, _cita_de

logger = logging.getLogger(__name__)


def _rango_pedido():
    """(desde, hasta) en UTC segun el ?date_range de la pantalla.

    "Hoy" es el del setter, no el del servidor (que corre en UTC): ver
    user_time_service.
    """
    date_range = request.args.get('date_range', 'today')
    target_date_str = request.args.get('date')
    hoy = hoy_del_usuario(current_user)

    if date_range == 'today':
        return limites_dia_utc(current_user, hoy)
    if date_range == 'yesterday':
        return limites_dia_utc(current_user, hoy - timedelta(days=1))
    if date_range == 'week':
        return limites_rango_utc(current_user, hoy - timedelta(days=7), hoy)
    if date_range == 'month':
        return limites_rango_utc(current_user, hoy - timedelta(days=30), hoy)
    if date_range == 'custom' and target_date_str:
        try:
            dia = datetime.strptime(target_date_str, '%Y-%m-%d').date()
            return limites_dia_utc(current_user, dia)
        except ValueError:
            pass
    return None, None


def _normalizar_ig(valor):
    if not valor or not isinstance(valor, str) or valor.strip().lower() in ('n/a', 'none', ''):
        return None
    return valor.strip().lstrip('@').lower()


def _lead_de_manychat(ig_norm, nombre_norm):
    """El ManychatLead de esta persona, por instagram o por nombre exacto."""
    if ig_norm:
        lead = ManychatLead.query.filter(
            db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_norm
        ).first()
        if lead:
            return lead
    if nombre_norm:
        return ManychatLead.query.filter(
            db.func.lower(ManychatLead.name) == nombre_norm
        ).first()
    return None


def _anuncio_de(lead):
    """El Ad atribuido a este lead, o None si todavia no tiene."""
    if not lead:
        return None
    respuesta = LeadAnswer.query.filter(
        LeadAnswer.lead_id == lead.id,
        LeadAnswer.ad_id != None  # noqa: E711
    ).order_by(LeadAnswer.created_at.desc()).first()
    return Ad.query.get(respuesta.ad_id) if respuesta else None


@bp.route('/deck/agendas', methods=['GET'])
@role_required(ROLE_SETTER)
def get_agendas_del_mazo():
    """Todas las agendas del setter en el rango, en una sola lista.

    Cada fila trae lo necesario para trabajarla sin salir de la pantalla: si le
    falta el anuncio, el Instagram con el que se la puede reconocer, y el estado
    del hilo de comentarios del lead.
    """
    desde, hasta = _rango_pedido()
    agendas = agendas_del_setter(current_user, desde, hasta)

    sin_leer = {n.client_id for n in CommentNotification.query.filter_by(
        user_id=current_user.id, is_read=False).all()}

    filas = []
    vistas = set()
    for agenda in agendas:
        ig_norm = _normalizar_ig(agenda.instagram)
        nombre_norm = (agenda.lead or '').strip().lower()

        # Una misma persona puede tener varias filas de agenda (reagendas); en la
        # lista de trabajo se muestra una sola.
        llave = f"ig:{ig_norm}" if ig_norm else (f"nombre:{nombre_norm}" if nombre_norm else None)
        if llave and llave in vistas:
            continue
        if llave:
            vistas.add(llave)

        lead_mc = _lead_de_manychat(ig_norm, nombre_norm)
        anuncio = _anuncio_de(lead_mc)
        client = _cliente_de(agenda)
        cita = _cita_de(agenda, client)

        # El de la agenda manda: es el campo que el setter corrige desde la fila, y
        # si lo pisara el de ManyChat la correccion pareceria no haber hecho nada.
        # Recien si la agenda no tiene, se completa con el handle real de la
        # conversacion, que es mejor que nada para encontrar a la persona.
        ig_mostrado = agenda.instagram \
            if _normalizar_ig(agenda.instagram) else (
                (lead_mc.ig if lead_mc and lead_mc.ig else None)
                or (client.instagram if client and client.instagram else None))
        if not _normalizar_ig(ig_mostrado):
            ig_mostrado = f"@{nombre_norm.replace(' ', '_')}" if nombre_norm else ''

        filas.append({
            "id": agenda.id,
            "agenda_id": agenda.id,
            "appointment_id": cita.id if cita else None,
            "cliente": agenda.lead or 'Desconocido',
            "lead_name": agenda.lead or 'Desconocido',
            "instagram": ig_mostrado,
            "whatsapp": agenda.whatsapp or (client.phone if client else ''),
            "closer": agenda.closer or 'Sin asignar',
            "fuente": agenda.nombre or '',
            "date": agenda.date.isoformat() if agenda.date
                    else (agenda.created_at.isoformat() if agenda.created_at else None),
            "fecha_meet": agenda.fecha_meet or '',
            "estado": (cita.result if cita else None) or agenda.estado or 'Pendiente',
            "tiene_anuncio": anuncio is not None,
            "ad_name": anuncio.name if anuncio else '',
            "client_id": client.id if client else None,
            "comments_count": Comment.query.filter(
                Comment.comment_type == 'client',
                Comment.associated_id == client.id).count() if client else 0,
            "unread_comment": bool(client and client.id in sin_leer),
        })

    return jsonify(filas), 200


@bp.route('/deck/agendas/<int:agenda_id>/instagram', methods=['POST'])
@role_required(ROLE_SETTER)
def actualizar_instagram_de_agenda(agenda_id):
    """Corrige el Instagram de una agenda propia.

    Se escribe en la agenda y en el cliente, que es de donde lo leen las demas
    pantallas; sin eso la correccion se perdia al recargar.
    """
    from app.models.financial import FinancialAgenda
    from app.services.fuente_service import normalizar

    nuevo = (request.get_json() or {}).get('instagram', '').strip().lstrip('@')
    if not nuevo:
        return jsonify({"error": "Escribí un usuario de Instagram"}), 400

    agenda = FinancialAgenda.query.get(agenda_id)
    if not agenda:
        return jsonify({"error": "Agenda no encontrada"}), 404
    if normalizar(agenda.nombre) != normalizar(current_user.username):
        return jsonify({"error": "Esta agenda no es de tu fuente"}), 403

    client = _cliente_de(agenda)
    agenda.instagram = nuevo
    db.session.add(agenda)
    if client:
        client.instagram = nuevo
        db.session.add(client)
    db.session.commit()

    return jsonify({"message": f"Instagram actualizado a @{nuevo}",
                    "instagram": nuevo,
                    "client_id": client.id if client else None}), 200
