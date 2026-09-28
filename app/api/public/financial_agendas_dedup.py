"""Gestion de agendas repetidas del mismo lead, desde el libro de agendas.

Vive aparte de `financial_agendas.py` (que ya pasa las 1300 lineas) y reusa
`_build_agenda_queries` para que los grupos se calculen exactamente sobre el
recorte que el usuario ve en pantalla: si filtro septiembre, ve los duplicados de
septiembre.

Solo admin/operador. La deteccion y las reglas viven en
`app/services/agenda_dedup_service.py`; aca solo esta la capa HTTP.
"""
import logging

from flask import jsonify, request
from flask_login import current_user, login_required

from app.decorators import admin_required
from app.models import FinancialAgenda, User, db
from app.services import agenda_dedup_service as dedup
from . import bp
from .financial_agendas import _build_agenda_queries

logger = logging.getLogger(__name__)

# Que significa cada motivo, para que la pantalla no tenga que saberlo.
MOTIVOS = {
    'reprogramacion': {
        'etiqueta': 'Probable reprogramación',
        'detalle': 'Movió la cita a otro día y entró como agenda nueva.',
        'sugiere_descartar': True,
    },
    'duplicado_del_webhook': {
        'etiqueta': 'Duplicado del webhook',
        'detalle': 'Dos filas para la misma reunión: n8n las mandó casi a la vez y ninguna vio a la otra.',
        'sugiere_descartar': True,
    },
    'volvio_a_agendar': {
        'etiqueta': 'Volvió a agendar',
        'detalle': 'Su llamada anterior ya se resolvió, o pasaron semanas: son dos agendas de verdad.',
        'sugiere_descartar': False,
    },
}


def _fila(agenda, cita):
    """Lo justo para decidir cual se conserva, sin el `to_dict` completo (que hace
    varias consultas por fila y aca se pintan grupos enteros)."""
    return {
        'id': agenda.id,
        'lead': agenda.lead,
        'fuente': agenda.nombre,
        'closer': agenda.closer,
        'mail': agenda.mail,
        'instagram': agenda.instagram,
        'whatsapp': agenda.whatsapp,
        'estado': agenda.estado or 'Pendiente',
        'registro': agenda.registro or (agenda.created_at.isoformat() if agenda.created_at else None),
        'created_at': agenda.created_at.isoformat() if agenda.created_at else None,
        'date': agenda.date.isoformat() if agenda.date else None,
        'appointment_id': cita.id if cita else None,
        'cita_cancelada': bool(cita and (cita.result or '').lower().startswith('cancel')),
    }


@bp.route('/public/financial-agendas/duplicados', methods=['GET'])
@login_required
@admin_required
def listar_duplicados():
    """Grupos de agendas que parecen del mismo lead, dentro del filtro actual.

    Los filtros viajan en la query string, igual que en el GET del tablero.
    """
    date_query, _, _ = _build_agenda_queries()
    limite = min(request.args.get('limite', 60, type=int) or 60, 200)
    grupos, hay_mas = dedup.grupos_de(date_query, limite=limite)

    # Las citas de todas las filas de una sola vez: una por una eran dos consultas por
    # agenda y la pantalla pinta cientos.
    citas = dedup.citas_de([a for g in grupos for a in g])

    salida = []
    for grupo in grupos:
        motivo = dedup.motivo_probable(grupo)
        sugerida = dedup.sugerir_conservada(grupo)
        salida.append({
            'clave': f"g{min(a.id for a in grupo)}",
            'motivo': motivo,
            **MOTIVOS.get(motivo, {'etiqueta': 'Repetida', 'detalle': '', 'sugiere_descartar': False}),
            'conservar_sugerida_id': sugerida.id,
            'agendas': [_fila(a, citas.get(a.id)) for a in grupo],
        })

    return jsonify({
        'grupos': salida,
        'total_grupos': len(salida),
        'total_agendas_de_mas': sum(len(g['agendas']) - 1 for g in salida),
        # Hay mas de los que entran en una pantalla: conviene acotar el filtro de fechas
        # del tablero en vez de servir mil grupos que nadie va a revisar de un tiron.
        'hay_mas': hay_mas,
    }), 200


@bp.route('/public/financial-agendas/duplicados/resolver', methods=['POST'])
@login_required
@admin_required
def resolver_duplicados():
    """Conserva una agenda del grupo y descarta las otras. Reversible.

    Cuerpo esperado:
      { "conservada_id": 172961,
        "descartar_ids": [172955],
        "motivo": "reprogramó al 26",      # opcional
        "cancelar_citas": true }           # opcional, por defecto true
    """
    data = request.get_json() or {}
    conservada_id = data.get('conservada_id')
    descartar_ids = [i for i in (data.get('descartar_ids') or []) if i != conservada_id]
    cancelar_citas = data.get('cancelar_citas', True)

    if not conservada_id or not descartar_ids:
        return jsonify({"error": "Hacen falta la agenda que se conserva y al menos una a descartar"}), 400

    conservada = FinancialAgenda.query.get(conservada_id)
    if not conservada:
        return jsonify({"error": f"No existe la agenda #{conservada_id}"}), 404
    if conservada.duplicada_de_id is not None:
        return jsonify({"error": f"La agenda #{conservada_id} ya está descartada; restaurala primero"}), 400

    # Se revalida el grupo en el servidor: que las que se van a descartar sean de verdad
    # del mismo lead que la que se conserva. Si no, un id equivocado en el cuerpo del
    # request borraría del libro la agenda de otra persona.
    a_descartar = FinancialAgenda.query.filter(FinancialAgenda.id.in_(descartar_ids)).all()
    if len(a_descartar) != len(set(descartar_ids)):
        return jsonify({"error": "Alguna de las agendas a descartar no existe"}), 404

    grupos = dedup.encontrar_grupos([conservada] + a_descartar)
    del_grupo = {a.id for g in grupos for a in g} if grupos else set()
    ajenas = [a.id for a in a_descartar if a.id not in del_grupo]
    if ajenas:
        return jsonify({
            "error": f"Estas agendas no parecen del mismo lead que la #{conservada_id}: "
                     f"{', '.join(str(i) for i in ajenas)}"
        }), 400

    try:
        for agenda in a_descartar:
            dedup.descartar(conservada, agenda, current_user.id,
                            motivo=data.get('motivo'), cancelar_cita=cancelar_citas)
        db.session.commit()
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception('[DEDUP AGENDAS] no se pudo resolver el grupo de #%s', conservada_id)
        return jsonify({"error": f"No se pudo guardar: {e}"}), 500

    logger.info('[DEDUP AGENDAS] %s conservo #%s y descarto %s',
                current_user.username, conservada.id, descartar_ids)
    return jsonify({
        "conservada_id": conservada.id,
        "descartadas": [a.id for a in a_descartar],
        "mensaje": f"{len(a_descartar)} agenda(s) marcadas como repetidas de #{conservada.id}"
    }), 200


@bp.route('/public/financial-agendas/duplicados/restaurar', methods=['POST'])
@login_required
@admin_required
def restaurar_duplicados():
    """Deshace un descarte: la fila vuelve al libro y su cita al estado que tenía."""
    data = request.get_json() or {}
    ids = data.get('agenda_ids') or []
    if not ids:
        return jsonify({"error": "No se indicó ninguna agenda a restaurar"}), 400

    agendas = FinancialAgenda.query.filter(FinancialAgenda.id.in_(ids)).all()
    if not agendas:
        return jsonify({"error": "No se encontró ninguna de esas agendas"}), 404

    try:
        for agenda in agendas:
            dedup.restaurar(agenda)
        db.session.commit()
    except ValueError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        db.session.rollback()
        logger.exception('[DEDUP AGENDAS] no se pudo restaurar %s', ids)
        return jsonify({"error": f"No se pudo guardar: {e}"}), 500

    logger.info('[DEDUP AGENDAS] %s restauro %s', current_user.username, ids)
    return jsonify({"restauradas": [a.id for a in agendas]}), 200


@bp.route('/public/financial-agendas/duplicados/descartadas', methods=['GET'])
@login_required
@admin_required
def listar_descartadas():
    """Lo que se descartó, para poder revisarlo o deshacerlo más tarde."""
    filas = (FinancialAgenda.query
             .filter(FinancialAgenda.duplicada_de_id.isnot(None))
             .order_by(FinancialAgenda.descartada_at.desc())
             .limit(200).all())

    usuarios = {u.id: u.username for u in User.query.all()} if filas else {}
    return jsonify([{
        **_fila(a, None),
        'duplicada_de_id': a.duplicada_de_id,
        'descartada_at': a.descartada_at.isoformat() if a.descartada_at else None,
        'descartada_por': usuarios.get(a.descartada_por_id),
        'descartada_motivo': a.descartada_motivo,
    } for a in filas]), 200
