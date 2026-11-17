"""La pregunta a Learnito con el contexto de una conversación (`learnito_inbox.py`), colgada del blueprint del Inbox
y abierta al setter (es un GET). No llama a la IA: la pregunta la manda el chat de Learnito, como cualquier otra."""
from flask import jsonify, request

from app import db
from app.automatizaciones import learnito_inbox
from app.automatizaciones.api import bp
from app.automatizaciones.modelos import IgContacto


@bp.route('/conversaciones/<int:contacto_id>/learnito', methods=['GET'])
def pregunta_para_learnito(contacto_id):
    contacto = db.session.get(IgContacto, contacto_id)
    if contacto is None:
        return jsonify({'message': 'Not found'}), 404
    from app.automatizaciones import api_trabajo  # cuelga de `bp`: importarlo arriba sería circular
    notas, _ = api_trabajo.historial(contacto.id)
    return jsonify(learnito_inbox.pregunta(contacto, [n['texto'] for n in notas if n.get('texto')],
                                           request.args.get('pedido')))
