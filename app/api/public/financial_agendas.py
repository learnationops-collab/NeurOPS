"""Las agendas financieras: la agenda que se carga a mano para atribuir una venta, y los helpers que otros
módulos importan con este nombre.

El ingreso por webhook de n8n/Calendly (POST /public/financial-agendas, su verificación de hora y el
sync desde Sheets) se sacó el 23/10/2026: desde el 15/10 todas las agendas entran por Agendas 2.0.
"""
from flask import jsonify, request

from app.models import FinancialAgenda, db
from app.services import agenda_contacto_service
from . import bp
# Re-export: otros modulos importan estos helpers desde aca.
from .financial_agendas_helpers import (  # noqa: F401
    parse_date_robustly, ESTADOS_AGENDA_ABIERTA, _split_multi, _build_agenda_queries, _resolve_closer_results)


@bp.route('/public/financial-agendas/atribucion', methods=['POST'])
def crear_agenda_de_atribucion():
    """Una agenda cargada a mano para atribuir una venta que no tenía (el modal de Atribuir de Ventas): la
    fuente o el setter, el closer, la fecha y el lead, que queda como su persona. No agenda nada."""
    data = request.get_json(silent=True) or {}
    fuente = (data.get('fuente') or '').strip()
    if not fuente:
        return jsonify({'error': 'Falta la fuente o el setter'}), 400
    fecha = parse_date_robustly(data.get('fecha')) if data.get('fecha') else None
    agenda = FinancialAgenda(nombre=fuente, closer=(data.get('closer') or '').strip() or None, estado='Pendiente',
                             raw_data={'fuente_origen': 'atribucion_manual'})
    if fecha:
        agenda.date = fecha
    db.session.add(agenda)
    agenda_contacto_service.dar_persona(agenda, nombre=data.get('nombre'), mail=data.get('mail'),
                                        instagram=data.get('instagram'), telefono=data.get('whatsapp'))
    db.session.commit()
    return jsonify({'id': agenda.id, 'person_uuid': agenda.person_uuid}), 201
