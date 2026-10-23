"""Las ventas del closer desde `Sale` (Etapa 2c, parte 6 de docs/plan_personas.md): «Mis ventas», el detalle
de una venta (SaleDetailModal) y cuántas ventas tiene cada cliente. Antes salían de `Enrollment`/`Payment`,
el espejo que se deja de escribir.

Una venta es del closer si su `closer_email` es uno de sus identificadores
(`CloserService._resolve_sale_identifiers`, el mismo mapeo que usa la lista de ventas). Sus pagos son las
filas de `FinancialSale` con su `sale_id`; lo que debe, `deuda_service`.
"""
import json
from datetime import datetime, timedelta

from sqlalchemy import func, or_

from app import db
from app.models import Appointment, Client, FinancialSale, Person, Sale
from app.services import deuda_service
from app.services.comercial_vocabulario import venta_completada

NOMBRES = {'AL': 'Ace Learners', 'RR': 'Residency Roadmap', 'SI': 'Specialist Initiative'}
CODIGOS = {v.lower(): k for k, v in NOMBRES.items()}


def nombre_de_programa(codigo):
    return NOMBRES.get(codigo, codigo) if codigo else 'Programa a definir'


def _pagos(sale_ids):
    """{sale_id: [pagos ordenados por fecha]}."""
    salida = {}
    for i in range(0, len(sale_ids), 500):
        for p in (FinancialSale.query.filter(FinancialSale.sale_id.in_(sale_ids[i:i + 500]))
                  .order_by(FinancialSale.date.asc(), FinancialSale.id.asc())):
            salida.setdefault(p.sale_id, []).append(p)
    return salida


def _cobrado(pagos):
    return round(sum(float(p.monto or 0) for p in pagos if venta_completada(p)), 2)


def _nombre(sale):
    person = db.session.get(Person, sale.person_uuid) if sale.person_uuid else None
    if person and person.full_name:
        return person.full_name
    client = sale.client
    return (client.full_name or client.email) if client else 'Sin nombre'


def listar(user, page=1, search=None, start_date=None, end_date=None, programas=None, metodos=None):
    """«Mis ventas»: las del closer, de la más nueva a la más vieja, de a 50. Misma forma que la lista vieja
    de inscripciones (id, student_name, program_name, amount, payment_method, status, date); `id` es el de
    la venta."""
    from app.services.closer_service import CloserService
    identificadores = {e.lower() for e in CloserService._resolve_sale_identifiers(user) if e}
    query = Sale.query.filter(func.lower(func.trim(Sale.closer_email)).in_(identificadores or {''}))
    if search:
        patron = f'%{search}%'
        query = query.outerjoin(Person, Sale.person_uuid == Person.uuid).outerjoin(Client, Sale.client_id == Client.id) \
            .filter(or_(Person.full_name.ilike(patron), Person.email.ilike(patron),
                        Client.full_name.ilike(patron), Client.email.ilike(patron)))
    if start_date:
        query = query.filter(Sale.sold_at >= datetime.strptime(start_date, '%Y-%m-%d'))
    if end_date:
        query = query.filter(Sale.sold_at < datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1))
    if programas:
        codigos = {CODIGOS.get(p.strip().lower(), p.strip().upper()) for p in programas if p.strip()}
        query = query.filter(Sale.program_code.in_(codigos))
    if metodos:
        con_metodo = db.session.query(FinancialSale.sale_id).filter(
            func.lower(FinancialSale.metodo_pago).in_({m.strip().lower() for m in metodos if m.strip()}))
        query = query.filter(Sale.id.in_(con_metodo))
    pagina = query.order_by(Sale.sold_at.desc(), Sale.id.desc()).paginate(page=page, per_page=50, error_out=False)

    pagos = _pagos([s.id for s in pagina.items])
    filas = []
    for s in pagina.items:
        suyos = pagos.get(s.id, [])
        ultimo = suyos[-1] if suyos else None
        saldo = deuda_service.saldo(s, _cobrado(suyos))
        filas.append({
            'id': s.id,
            'student_name': _nombre(s),
            'program_name': nombre_de_programa(s.program_code),
            'amount': float(ultimo.monto or 0) if ultimo else (deuda_service.total_de(s) or 0.0),
            'payment_method': (ultimo.metodo_pago if ultimo and ultimo.metodo_pago else 'N/A'),
            'status': s.status if s.status != 'active' else ('completed' if saldo <= 0.01 else 'pending'),
            'date': s.sold_at.isoformat() if s.sold_at else None,
        })
    return {'data': filas, 'total': pagina.total, 'pages': pagina.pages}


def detalle(sale_id):
    """El detalle de una venta para SaleDetailModal, con la forma del detalle viejo de inscripción: cliente,
    programa (su total), pagos (filas de `FinancialSale`), agendas y formulario; suma `deuda` y la
    suscripción."""
    sale = db.session.get(Sale, sale_id)
    if sale is None:
        return None
    client = sale.client
    if client is None and sale.person_uuid:
        client = Client.query.filter_by(person_uuid=sale.person_uuid).order_by(Client.id).first()
    person = db.session.get(Person, sale.person_uuid) if sale.person_uuid else None
    suyos = _pagos([sale.id]).get(sale.id, [])
    cobrado = _cobrado(suyos)

    agendas = [{'id': a.id, 'start_time': a.start_time.isoformat() if a.start_time else None,
                'last_stage': a.last_stage, 'origin': a.origin}
               for a in (client.appointments.order_by(Appointment.start_time.desc()) if client else [])]
    formulario = []
    for sa in (client.survey_answers if client else []):
        puntos, q = 0, sa.question
        if q and q.options:
            try:
                opciones = json.loads(q.options)
                if isinstance(opciones, list):
                    puntos = next((int(o.get('points', 0)) for o in opciones if str(o.get('text')) == str(sa.answer)), 0)
            except (ValueError, TypeError, AttributeError):
                puntos = 0
        formulario.append({'question': q.text if q else 'Pregunta eliminada', 'answer': sa.answer, 'points': puntos})

    suscripcion = sale.subscription.to_dict() if getattr(sale, 'subscription', None) else None
    return {
        'id': sale.id,
        'client': {
            'id': client.id if client else None,
            'person_uuid': sale.person_uuid,
            'name': (person.full_name if person else None) or (client.full_name if client else None),
            'email': (person.email if person else None) or (client.email if client else None),
            'phone': (person.phone if person else None) or (client.phone if client else None),
            'instagram': (person.instagram if person else None) or (client.instagram if client else None),
        },
        'program': {'id': sale.program_code, 'name': nombre_de_programa(sale.program_code),
                    'price': deuda_service.total_de(sale) or 0.0},
        'payments': [{
            'id': p.id, 'amount': float(p.monto or 0), 'date': p.date.isoformat() if p.date else None,
            'type': p.tipo_pago, 'method': p.metodo_pago or 'N/A',
            'status': 'completed' if venta_completada(p) else 'pending', 'method_id': None,
        } for p in suyos],
        'appointments': agendas,
        'survey': formulario,
        'total_paid': cobrado,
        'deuda': round(deuda_service.saldo(sale, cobrado), 2),
        'status': sale.status,
        'kind': sale.kind,
        'suscripcion': suscripcion,
    }


def cantidades(clientes):
    """{client_id: cuántas ventas tiene su persona (o el cliente, sin persona)}: el «✓ N cierres» de las
    listas de agendas. Los que no tienen ninguna no aparecen."""
    clientes = [c for c in clientes if c is not None]
    personas = sorted({c.person_uuid for c in clientes if c.person_uuid})
    sueltos = sorted({c.id for c in clientes if not c.person_uuid})
    por_persona, por_cliente = {}, {}
    for valores, columna, destino in ((personas, Sale.person_uuid, por_persona), (sueltos, Sale.client_id, por_cliente)):
        for i in range(0, len(valores), 500):
            for clave, n in (db.session.query(columna, func.count(Sale.id))
                             .filter(columna.in_(valores[i:i + 500])).group_by(columna)):
                destino[clave] = n
    salida = {}
    for c in clientes:
        n = por_persona.get(c.person_uuid, 0) if c.person_uuid else por_cliente.get(c.id, 0)
        if n:
            salida[c.id] = n
    return salida
