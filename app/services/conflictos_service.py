"""La vista Conflictos: los casos de datos que no cierran y decide una persona (27/10/2026).

Cada caso dice de dónde viene con fecha (la venta o el pago que el closer reconoce) y la historia muestra lo
que se cargó ese día: los campos de la venta y de cada pago tal como quedaron, las agendas y las notas del
caso. La ficha del lead (Fulfillment, Academia, pagos) se abre aparte con su `person_uuid`.

Lo ven la dirección y Operaciones (todos los casos) y cada responsable (los suyos).
"""
from datetime import datetime, timedelta

from app import db
from app.models import Appointment, Conflicto, CONFLICTO_TIPOS, FinancialSale, Sale, User
from app.services import lead_log_service

ROLES_TODOS = ('admin', 'operator', 'director_comercial')
CIERRES = ('resuelto', 'descartado')


class ErrorConflicto(Exception):
    def __init__(self, mensaje, codigo=400):
        super().__init__(mensaje)
        self.codigo = codigo


def ve_todos(usuario):
    return any(usuario.tiene_rol(r) for r in ROLES_TODOS)


def _visibles(usuario):
    q = Conflicto.query
    return q if ve_todos(usuario) else q.filter(Conflicto.responsable_id == usuario.id)


def buscar(usuario, conflicto_id):
    caso = _visibles(usuario).filter(Conflicto.id == conflicto_id).first()
    if not caso:
        raise ErrorConflicto('Caso no encontrado.', 404)
    return caso


def _iso(valor):
    return valor.isoformat() if valor else None


def _nombre(caso):
    return caso.person.full_name if caso.person else None


def fila(caso):
    return {
        'id': caso.id, 'tipo': caso.tipo, 'titulo': caso.titulo, 'detalle': caso.detalle, 'monto': caso.monto,
        'person_uuid': caso.person_uuid, 'persona': _nombre(caso) or 'Sin nombre',
        'origen_fecha': _iso(caso.origen_fecha), 'origen_texto': caso.origen_texto,
        'sale_id': caso.sale_id, 'financial_sale_id': caso.financial_sale_id,
        'responsable': caso.responsable.username if caso.responsable else None,
        'responsable_id': caso.responsable_id, 'estado': caso.estado, 'resolucion': caso.resolucion,
        'resuelto_por': caso.resuelto_por.username if caso.resuelto_por else None,
        'resuelto_at': _iso(caso.resuelto_at), 'created_at': _iso(caso.created_at),
    }


def cuenta(usuario):
    return _visibles(usuario).filter(Conflicto.estado == 'abierto').count()


def listar(usuario, estado='abierto'):
    q = _visibles(usuario)
    q = q.filter(Conflicto.estado.in_(CIERRES)) if estado == 'cerrado' else q.filter(Conflicto.estado == 'abierto')
    casos = q.order_by(Conflicto.origen_fecha.desc().nullslast(), Conflicto.id.desc()).all()
    abiertos = _visibles(usuario).filter(Conflicto.estado == 'abierto')
    semana = datetime.utcnow() - timedelta(days=7)
    return {
        'casos': [fila(c) for c in casos],
        'resumen': {
            'abiertos': abiertos.count(),
            'en_juego': sum(c.monto or 0 for c in abiertos.all()),
            'resueltos_semana': _visibles(usuario).filter(Conflicto.estado.in_(CIERRES),
                                                         Conflicto.resuelto_at >= semana).count(),
        },
        've_todos': ve_todos(usuario),
    }


# --- La historia: lo que se cargó cada día ----------------------------------------------------------

def _campos(pares):
    return [{'campo': k, 'valor': v} for k, v in pares if v not in (None, '')]


def _de_venta(v, caso):
    return {
        'fecha': _iso(v.sold_at), 'fuente': 'Work',
        'titulo': f'Venta {v.program_code or ""} cargada por {v.closer_email or "sin closer"}'.replace('  ', ' '),
        'mal': v.id == caso.sale_id, 'nota': v.review_note,
        'campos': _campos([('Programa', v.program_code), ('Tipo', {'new': 'Venta nueva'}.get(v.kind, v.kind)),
                           ('Total acordado', v.agreed_total), ('Estado', v.status), ('Setter', v.setter),
                           ('Venta', f'#{v.id}')]),
    }


def _de_pago(p, caso):
    return {
        'fecha': _iso(p.date or p.created_at), 'fuente': 'Pasarela' if p.transaction_source else 'Work',
        'titulo': f'Pago de ${p.monto or 0:,.0f}'.replace(',', '.') + (f' · {p.tipo_pago}' if p.tipo_pago else ''),
        'mal': p.id == caso.financial_sale_id or (caso.sale_id is not None and p.sale_id == caso.sale_id
                                                   and p.transaction_status != 'verified'),
        'nota': None,
        'campos': _campos([('Tipo de pago', p.tipo_pago), ('Monto', p.monto), ('Método', p.metodo_pago),
                           ('Correo', p.mail_cliente), ('Instagram', p.instagram), ('Closer', p.email_vendedor),
                           ('Setter', p.setter), ('Cobro en la pasarela', p.transaction_status),
                           ('Cargado', p.marca_temporal)]),
    }


def _de_agenda(a):
    return {
        'fecha': _iso(a.start_time), 'fuente': 'Agendas',
        'titulo': f'Llamada con {a.closer.username if a.closer else "sin closer"}'
                  + (f' · {a.closer_result}' if a.closer_result and a.closer_result != 'Pendiente' else ''),
        'mal': False, 'nota': None, 'campos': [],
    }


def historia(caso):
    eventos = [{**e, 'campos': e.get('campos') or []} for e in (caso.historia or [])]
    if caso.person_uuid:
        uuid = caso.person_uuid
        eventos += [_de_venta(v, caso) for v in Sale.query.filter(Sale.person_uuid == uuid)]
        eventos += [_de_pago(p, caso) for p in FinancialSale.query.filter(FinancialSale.person_uuid == uuid)]
        eventos += [_de_agenda(a) for a in Appointment.query.filter(Appointment.person_uuid == uuid)]
    return sorted(eventos, key=lambda e: e.get('fecha') or '')


def detalle(caso):
    return {**fila(caso), 'historia': historia(caso)}


# --- Escrituras -----------------------------------------------------------------------------------------

def cerrar(caso, datos, usuario):
    estado = datos.get('estado')
    if estado not in CIERRES:
        raise ErrorConflicto('Elegí si quedó resuelto o se descarta.')
    texto = (datos.get('resolucion') or '').strip()
    if not texto:
        raise ErrorConflicto('Escribí qué se hizo, para que quede en la ficha.')
    caso.estado, caso.resolucion = estado, texto
    caso.resuelto_por_id, caso.resuelto_at = usuario.id, datetime.utcnow()
    if caso.person_uuid:
        lead_log_service.registrar(caso.person_uuid, 'conflicto', f'Conflicto «{caso.titulo}» {estado}: {texto}',
                                   user_id=usuario.id, origen='conflicto', origen_id=caso.id)
    db.session.commit()
    return detalle(caso)


def reabrir(caso, usuario):
    caso.estado, caso.resuelto_por_id, caso.resuelto_at = 'abierto', None, None
    db.session.commit()
    return detalle(caso)


def crear(datos, usuario):
    """Lo usan Operaciones y los scripts de limpieza para cargar un caso."""
    titulo = (datos.get('titulo') or '').strip()
    if not titulo:
        raise ErrorConflicto('Falta qué no cierra.')
    tipo = datos.get('tipo') or 'cobranza'
    if tipo not in CONFLICTO_TIPOS:
        raise ErrorConflicto('Tipo desconocido.')
    responsable = db.session.get(User, datos['responsable_id']) if datos.get('responsable_id') else None
    caso = Conflicto(tipo=tipo, titulo=titulo, detalle=datos.get('detalle'), monto=datos.get('monto'),
                     person_uuid=datos.get('person_uuid'), sale_id=datos.get('sale_id'),
                     financial_sale_id=datos.get('financial_sale_id'), origen_texto=datos.get('origen_texto'),
                     origen_fecha=datetime.fromisoformat(datos['origen_fecha']) if datos.get('origen_fecha') else None,
                     responsable_id=responsable.id if responsable else None, historia=datos.get('historia'))
    db.session.add(caso)
    db.session.commit()
    return detalle(caso)
