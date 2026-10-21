"""La Academia y Work se identifican por la persona (20/10/2026, frente G de docs/plan_personas.md).

El `work_uuid` de un alumno es el uuid de su persona en Work (`people.uuid`). La Academia lo pide al
registrarlo (`POST /people/resolve`) y desde ahí lo manda en cada llamada; Work lo manda en cada aviso.
El email y el `work_client_id` siguen sirviendo para los alumnos que todavía no lo tienen.
"""
from flask import jsonify, request

from app import db
from app.api.external import bp
from app.decorators import require_academy_token
from app.models import FinancialSale
from app.services import person_service


def cliente_del_alumno(data):
    """El cliente de Work del alumno: por su `work_uuid` y, si no viene o no tiene cliente, por
    `work_client_id` o `email` como siempre."""
    from app.services import academy_payment_status

    return academy_payment_status.buscar_cliente(data.get('work_client_id'), data.get('email'),
                                                 work_uuid=data.get('work_uuid'))


def _persona_dict(person):
    cliente = person_service.cliente_de(person, crear=False)
    return {**person_service.datos(person), 'work_uuid': person.uuid,
            'email_academia': person_service.dato(person, 'email', uso='academia'),
            'work_client_id': cliente.id if cliente else None}


@bp.route('/people/resolve', methods=['POST'])
@require_academy_token
def academy_resolver_persona():
    """La Academia registra un alumno y le pide su `work_uuid`. Si Work no lo conoce, lo crea (decisión
    de Santiago, 20/10/2026): todo alumno tiene persona desde el primer día.

    Cuerpo: `email` (obligatorio), `name`, `phone` y `learnation_user_id` (el id del alumno en la
    Academia). Devuelve la persona con su `work_uuid`. Llamarlo dos veces devuelve la misma.
    """
    data = request.get_json(silent=True) or {}
    email = person_service.normalizar('email', data.get('email'))
    if not email:
        return jsonify({"success": False, "error": "Falta un email válido"}), 422
    person = person_service.resolver(
        (data.get('name') or '').strip() or None, email=email, phone=data.get('phone'),
        learnation_user_id=data.get('learnation_user_id'), crear=True, fuente='academia')
    db.session.commit()
    return jsonify({"success": True, "person": _persona_dict(person)}), 200


@bp.route('/people/<string:work_uuid>', methods=['GET'])
@require_academy_token
def academy_persona(work_uuid):
    """La persona de ese `work_uuid` (si se fusionó, la que quedó: su `work_uuid` puede cambiar) con
    sus pagos, con la misma lista blanca que `/students/<email>/payments`."""
    person = person_service.por_uuid(work_uuid)
    if person is None:
        return jsonify({"success": False, "error": "No existe ninguna persona con ese work_uuid"}), 404
    pagos = FinancialSale.query.filter(FinancialSale.person_uuid == person.uuid) \
        .order_by(FinancialSale.date.asc()).all()
    return jsonify({"success": True, "person": _persona_dict(person), "payments": [{
        "fecha": s.date.isoformat() if s.date else None,
        "monto": round(float(s.monto), 2) if s.monto is not None else None,
        "tipo_pago": s.tipo_pago,
        "metodo_pago": s.metodo_pago,
        "estado": s.estado,
    } for s in pagos]}), 200


class DatoDeOtraPersona(ValueError):
    """El dato corregido ya es de otra persona: no se le cambia a ésta."""


_KIND = {'mail_cliente': 'email', 'telefono': 'phone', 'instagram': 'instagram'}


def corregir_persona_de_venta(sale, changes, modo='corregir'):
    """Lo que la Academia corrige de una venta se corrige en su persona, que es de donde se lee
    (Etapa 2b de docs/plan_personas.md). Corregir es nuevo principal y el anterior dado de baja;
    el mail que se mostraba era el de pago, se corrige ése. Con `modo='pago'`, el mail se suma como
    su mail de pago y el principal no cambia. Sin persona no hace nada (queda la copia). No hace commit."""
    person = sale.person if sale.person_uuid else None
    if person is None:
        return
    nombre = person_service.nombre_limpio(changes.get('nombre_cliente'))
    if nombre:
        person.full_name = nombre
    for campo, kind in _KIND.items():
        if campo not in changes:
            continue
        valor = person_service.normalizar(kind, changes[campo])
        if not valor:
            continue
        if set(person_service.duenos(kind, valor)) - {person.uuid}:
            raise DatoDeOtraPersona(f'El {campo} {changes[campo]} ya es de otra persona.')
        de_pago = kind == 'email' and (modo == 'pago' or person_service.dato(person, 'email', uso='pago')
                                        not in (None, person.email))
        if valor == person_service.dato(person, kind, uso='pago' if de_pago else None):
            continue
        person_service.hacer_principal(person, kind, changes[campo], uso='pago' if de_pago else None,
                                       reason='corrección desde la Academia', corrige=modo != 'pago')
