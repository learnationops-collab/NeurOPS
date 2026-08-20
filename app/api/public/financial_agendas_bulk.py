"""Edicion masiva de agendas del Tablero de Agendas.

Vive aparte de `financial_agendas.py` (que ya pasa las 1000 lineas) y reutiliza
`_build_agenda_queries` para que el modo "aplicar a todo lo filtrado" opere
exactamente sobre el mismo recorte que el usuario ve en pantalla.

Solo admin/operador: es una escritura en lote sobre datos historicos.
"""
import logging

from flask import request, jsonify
from flask_login import login_required
from sqlalchemy import or_, func

from app.models import db, FinancialAgenda, User, Client, Appointment
from app.decorators import admin_required
from app.services.fuente_service import FUENTES_CANONICAS
from . import bp
from .financial_agendas import _build_agenda_queries

logger = logging.getLogger(__name__)

# Campos que se pueden reescribir en lote. Quedan fuera a proposito los estados
# post-call y los estados "Cancelada"/"Reagendada": esos disparan el flujo de
# CloserService.process_agenda, que exige una razon y (a veces) una fecha nueva
# por cada agenda, algo que no tiene sentido aplicar con un valor unico a 200
# registros. Para eso siguen estando los selectores fila por fila.
CAMPOS_MASIVOS = {
    'nombre': 'Fuente',
    'closer': 'Closer',
    'encargado_triage': 'Call Confirmer',
    'estado': 'Estado pre call',
}

ESTADOS_MASIVOS_PERMITIDOS = ['Pendiente', 'Contactado', 'Confirmado', 'Sin respuesta']

LIMITE_LOTE = 5000


def _sincronizar_fuente_con_cita(agenda):
    """Propaga la fuente nueva a la cita asociada.

    `Appointment.origin` es de donde el sync inverso recupera la fuente, y
    `setter_id` es lo que alimenta las metricas del setter. Se toca solo eso: un
    sync completo aca reescribiria estados de la llamada, que no es lo que pidio
    quien edito la fuente.
    """
    ig = agenda.instagram.strip().replace('@', '').lower() \
        if agenda.instagram and agenda.instagram.lower() not in ('n/a', '') else None
    mail = agenda.mail.strip().lower() \
        if agenda.mail and agenda.mail.lower() not in ('n/a', '') else None

    condiciones = []
    if ig:
        condiciones.append(func.lower(func.replace(Client.instagram, '@', '')) == ig)
    if mail:
        condiciones.append(func.lower(Client.email) == mail)
    if not condiciones:
        return False

    client = Client.query.filter(or_(*condiciones)).first()
    if not client or not agenda.date:
        return False

    from datetime import timedelta
    inicio = agenda.date - timedelta(hours=12)
    fin = agenda.date + timedelta(hours=12)
    appt = Appointment.query.filter(
        Appointment.client_id == client.id,
        Appointment.start_time >= inicio,
        Appointment.start_time <= fin
    ).first()
    if not appt:
        return False

    appt.origin = agenda.nombre or appt.origin
    # Si la fuente nueva es un setter del equipo, la agenda pasa a atribuirsele.
    setter = User.query.filter(
        func.lower(User.username) == (agenda.nombre or '').strip().lower(),
        User.role == 'setter'
    ).first()
    appt.setter_id = setter.id if setter else None
    db.session.add(appt)
    return True


@bp.route('/public/financial-agendas/bulk-update', methods=['POST'])
@login_required
@admin_required
def bulk_update_financial_agendas():
    """Aplica un mismo valor a varias agendas de una sola vez.

    Cuerpo esperado:
      { "fields": {"nombre": "workshop"},
        "ids": [1, 2, 3] }                  -> solo esas agendas
      { "fields": {...}, "apply_filters": true }  -> todo el recorte filtrado
        (los filtros viajan en la query string, igual que en el GET del tablero)
      "dry_run": true                        -> devuelve cuantas tocaria, sin escribir
    """
    data = request.get_json() or {}
    campos = data.get('fields') or {}
    ids = data.get('ids') or []
    aplicar_filtros = bool(data.get('apply_filters'))
    dry_run = bool(data.get('dry_run'))

    # Validacion temprana: no abrir una transaccion para un payload invalido.
    desconocidos = [k for k in campos if k not in CAMPOS_MASIVOS]
    if desconocidos:
        return jsonify({"error": f"Campos no editables en lote: {', '.join(desconocidos)}"}), 400
    if not campos:
        return jsonify({"error": "No se indicó ningún campo para modificar"}), 400
    if not ids and not aplicar_filtros:
        return jsonify({"error": "Seleccioná agendas o activá 'aplicar a todo el filtro'"}), 400

    estado_nuevo = campos.get('estado')
    if estado_nuevo is not None and estado_nuevo not in ESTADOS_MASIVOS_PERMITIDOS:
        return jsonify({
            "error": "En lote solo se pueden aplicar estados que no requieran razón ni fecha: "
                     + ', '.join(ESTADOS_MASIVOS_PERMITIDOS)
        }), 400

    if aplicar_filtros:
        _, query, _ = _build_agenda_queries()
        agendas = query.limit(LIMITE_LOTE).all()
    else:
        try:
            ids = [int(i) for i in ids]
        except (TypeError, ValueError):
            return jsonify({"error": "La lista de ids contiene valores inválidos"}), 400
        if len(ids) > LIMITE_LOTE:
            return jsonify({"error": f"Máximo {LIMITE_LOTE} agendas por lote"}), 400
        agendas = FinancialAgenda.query.filter(FinancialAgenda.id.in_(ids)).all()

    if dry_run:
        return jsonify({"matched": len(agendas), "updated": 0, "dry_run": True}), 200

    from app.services.booking_service import BookingService

    actualizadas = 0
    citas_sincronizadas = 0
    try:
        for agenda in agendas:
            cambio = False
            for campo, valor in campos.items():
                if campo == 'closer':
                    valor = BookingService.normalize_closer_name(valor)
                if getattr(agenda, campo) != valor:
                    setattr(agenda, campo, valor)
                    cambio = True
            if not cambio:
                continue
            actualizadas += 1
            if 'nombre' in campos:
                try:
                    if _sincronizar_fuente_con_cita(agenda):
                        citas_sincronizadas += 1
                except Exception as e:
                    logger.error(f"[BULK AGENDAS] No se pudo sincronizar la cita de la agenda {agenda.id}: {e}")

        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"[BULK AGENDAS] Error aplicando la edición masiva: {e}")
        return jsonify({"error": str(e)}), 500

    return jsonify({
        "message": f"{actualizadas} agenda(s) actualizada(s)",
        "matched": len(agendas),
        "updated": actualizadas,
        "appointments_synced": citas_sincronizadas,
        "fields": list(campos.keys()),
    }), 200


@bp.route('/public/financial-agendas/bulk-options', methods=['GET'])
@login_required
@admin_required
def bulk_update_options():
    """Catálogo de valores válidos para el panel de edición masiva."""
    closers = [u.username for u in User.query.filter_by(role='closer').order_by(User.username).all()]
    triage = [u.username for u in User.query.filter_by(role='triage').order_by(User.username).all()]
    return jsonify({
        "fields": CAMPOS_MASIVOS,
        "fuentes": FUENTES_CANONICAS,
        "closers": closers,
        "encargados_triage": triage,
        "estados": ESTADOS_MASIVOS_PERMITIDOS,
        "limite_lote": LIMITE_LOTE,
    }), 200
