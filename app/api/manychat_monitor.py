"""El monitor de ManyChat: el historial de webhooks y los entrantes del período (rutas de `manychat.bp`)."""
from flask import request, jsonify
from flask_login import current_user
from app import db
from app.api.manychat import bp
from app.services.setter_assignment_service import condicion_leads_visibles


@bp.route('/manychat-webhook/log', methods=['GET'])
def get_webhook_log():
    """Retorna las últimas N interacciones recibidas."""
    from app.models import LeadAnswer, Conversation, Ad

    limit = int(request.args.get('limit', 10))

    query = LeadAnswer.query
    # El historial de una persona (la ficha de Entrantes): todos sus webhooks.
    if request.args.get('lead_id', type=int):
        query = query.filter(LeadAnswer.conversation_id == request.args.get('lead_id', type=int))
    # Cada setter solo ve los leads que ManyChat le repartió (más los que
    # todavía no tienen asignación).
    condicion = condicion_leads_visibles(current_user)
    if condicion is not None:
        query = query.join(Conversation, Conversation.id == LeadAnswer.conversation_id).filter(condicion)

    # Traemos las respuestas ordenadas por creación
    answers = query.order_by(LeadAnswer.created_at.desc()).limit(limit).all()

    # Cargar nombres de anuncios y leads
    ad_ids = [a.ad_id for a in answers if a.ad_id]
    ads_map = {}
    if ad_ids:
        ads = Ad.query.filter(Ad.id.in_(ad_ids)).all()
        ads_map = {a.id: a for a in ads}

    return jsonify([{
        'id': ans.id,  # ID de la respuesta, usado para editar
        'lead_id': ans.conversation.id,
        'manychat_id': ans.conversation.manychat_id,
        'person_uuid': ans.conversation.person_uuid,
        'lead_name': ans.conversation.name,
        'lead_ig': ans.conversation.ig,
        'follower': ans.conversation.follower,
        'last_stage': ans.conversation.last_stage,
        'setter': ans.conversation.setter,
        'ad_id': ans.ad_id,
        'ad_name': ads_map[ans.ad_id].name if ans.ad_id and ans.ad_id in ads_map else '—',
        'keyword': ans.keyword,
        'fecha': ans.fecha_recibida,
        'opening': ans.opening,
        'variante': ans.variante,
        'id_option': ans.id_option,
        'id_option_send': ans.id_option_send,
        'id_question': ans.id_question,
        'qualification': ans.qualification,
        'created_at': ans.created_at.isoformat() if ans.created_at else None,
        'updated_at': ans.updated_at.isoformat() if ans.updated_at else None
    } for ans in answers]), 200


@bp.route('/manychat-webhook/entrantes', methods=['GET'])
def get_entrantes():
    """Los leads entrantes del período, UNA fila por persona (Marketing › Entrantes, 16/10/2026).

    Entra quien tuvo alguna interacción en [desde, hasta] (días, ambos incluidos). De cada uno: su
    palabra clave (la de su primera interacción, resuelta como en Rendimiento), la campaña y el conjunto
    de Meta de esa palabra clave, el estado (calificado, descalificado, en conversación o sin respuesta,
    con la regla de `calificacion_service`, la misma que Rendimiento) y la etapa del flujo de ManyChat: el último mensaje que se le
    mandó (`id_option_send`) y el último que contestó (`id_option`), con su nombre del catálogo de
    mensajes. Cada setter ve solo los suyos, como en el monitor.
    """
    from datetime import date, datetime, time, timedelta
    from app.models import ConversationalMessage, LeadAnswer, Conversation, MetaAnuncio
    from app.services import anuncios_service as servicio, calificacion_service

    def dia(valor, defecto):
        try:
            return date.fromisoformat(valor) if valor else defecto
        except ValueError:
            return defecto

    hasta = dia(request.args.get('hasta'), date.today())
    desde = dia(request.args.get('desde'), hasta - timedelta(days=29))
    desde_dt, hasta_dt = datetime.combine(desde, time.min), datetime.combine(hasta, time.max)

    consulta = db.session.query(LeadAnswer.conversation_id).filter(
        LeadAnswer.created_at >= desde_dt, LeadAnswer.created_at <= hasta_dt)
    condicion = condicion_leads_visibles(current_user)
    if condicion is not None:
        consulta = consulta.join(Conversation, Conversation.id == LeadAnswer.conversation_id).filter(condicion)
    lead_ids = {lid for (lid,) in consulta.distinct()}

    clave_de_anuncio = servicio._clave_de_cada_anuncio()
    # Una fila por persona: sus conversaciones (la del Inbox y la de ManyChat) se juntan.
    personas = servicio._por_persona(lead_ids, clave_de_anuncio)
    grupo_de = {lid: clave for clave, g in personas.items() for lid in g['leads']}
    mensajes = {m.message_id: (m.title, m.category) for m in ConversationalMessage.query.all()}
    grupo_de_clave = {}
    for m in MetaAnuncio.query.filter(MetaAnuncio.clave.isnot(None)).order_by(
            (MetaAnuncio.estado == 'ACTIVE').desc(), MetaAnuncio.actualizado_at.desc()):
        grupo_de_clave.setdefault(m.clave, (m.campana, m.conjunto))

    pasos = {}
    for tanda in servicio._en_tandas(grupo_de):
        for lead_id, enviado, respondido, creada in db.session.query(
                LeadAnswer.conversation_id, LeadAnswer.id_option_send, LeadAnswer.id_option, LeadAnswer.created_at
        ).filter(LeadAnswer.conversation_id.in_(tanda)).order_by(LeadAnswer.created_at):
            paso = pasos.setdefault(grupo_de[lead_id], {'enviado': None, 'respondido': None})
            if (enviado or '').strip() not in ('', '0', '0.0'):
                paso['enviado'] = enviado.strip()
            if servicio._respondio(respondido):
                paso['respondido'] = respondido.strip()

    def mensaje(mid):
        titulo, categoria = mensajes.get(mid, (None, None))
        return {'id': mid, 'titulo': titulo or (f'Mensaje {mid}' if mid else None), 'categoria': categoria}

    leads = {l.id: l for tanda in servicio._en_tandas(grupo_de)
             for l in Conversation.query.filter(Conversation.id.in_(tanda))}
    descalificados = calificacion_service.descalificados()
    filas = []
    for clave_persona, grupo in personas.items():
        historia = grupo['filas']
        lead = leads.get(grupo['leads'][0])
        if not lead or not historia:
            continue
        tope = max((descalificados[lid] for lid in grupo['leads'] if lid in descalificados), default=None)
        clave = next((h[1] for h in historia if h[1]), None)
        de_manychat = calificacion_service.ultima_de_manychat(h[2] for h in historia)
        calificacion = calificacion_service.efectiva(de_manychat, historia[0][0], tope)
        respondio = any(h[3] for h in historia) or calificacion is not None
        estado = ('calificado' if calificacion == 'true' else 'descalificado' if calificacion == 'false'
                  else 'en_conversacion' if respondio else 'sin_respuesta')
        campana, conjunto = grupo_de_clave.get(clave, (None, None))
        paso = pasos.get(clave_persona, {})
        filas.append({
            'lead_id': lead.id,
            'manychat_id': lead.external_id,
            'person_uuid': lead.person_uuid,
            'nombre': lead.name,
            'ig': lead.ig,
            'follower': bool(lead.follower),
            'setter': lead.setter,
            'clave': clave,
            'campana': campana,
            'conjunto': conjunto,
            'estado': estado,
            # Descalificado por el closer o el formulario aunque ManyChat lo había calificado (calificacion_service).
            'descalificado_despues': calificacion == 'false' and de_manychat != 'false',
            'respondio': respondio,
            'ultimo_enviado': mensaje(paso.get('enviado')),
            'ultimo_respondido': mensaje(paso.get('respondido')),
            'interacciones': len(historia),
            'primera_at': historia[0][0].isoformat() + 'Z',
            'ultima_at': historia[-1][0].isoformat() + 'Z',
        })
    filas.sort(key=lambda f: f['ultima_at'], reverse=True)
    return jsonify({'desde': desde.isoformat(), 'hasta': hasta.isoformat(), 'filas': filas,
                    # El catálogo, para nombrar cada paso del historial de una persona.
                    'mensajes': {mid: {'titulo': t, 'categoria': c} for mid, (t, c) in mensajes.items()}}), 200
