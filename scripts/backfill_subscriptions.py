"""Carga inicial de las suscripciones (`Subscription`), una por persona y producto (frente L de
docs/plan_personas.md, 20/10/2026).

  · Quiénes: los clientes a los que Work les dio acceso en la Academia (`Client.academy_product_slug`).
    Los clientes duplicados de la misma persona dan una sola suscripción por producto.
  · Vencimiento: el que la Academia tiene HOY (la asignación activa de ese producto, `GET
    /users/<id>/products`); si la API no la trae, `Client.academy_expires_at`. Entre varios clientes
    de la persona, el más lejano. La carga nunca acorta: no se recalcula «pago inicial + 4 meses».
  · Venta: la última de ese programa de la persona (`Sale.person_uuid`; sin persona, la del cliente).
    Si está cancelada, la suscripción queda sin venta.

No manda nada a la Academia (solo lee) y no pisa: una persona que ya tiene suscripción a ese
producto se saltea.

Uso:
  python scripts/backfill_subscriptions.py            # prueba: cuenta y muestra ejemplos, no escribe
  python scripts/backfill_subscriptions.py --apply    # crea las suscripciones con su evento «alta»
"""
import os
import sys
from datetime import date

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Client, Sale, Subscription, SubscriptionEvent
from app.services.academy_access_service import AcademyAccessService, _add_months
from app.services.learnation_service import LearnationAPIError, LearnationService
from app.services.sheets_service import SheetsService
from app.services.subscription_service import DURACION_MESES

MOTIVO = 'Carga inicial: el vencimiento que la Academia tiene hoy'
EJEMPLOS = 10


def _fecha(valor):
    return date.fromisoformat(str(valor)[:10]) if valor else None


def _de_la_academia(learnation_user_id, slug, cache, numeros):
    """(vencimiento, es_seña) de la asignación activa de ese producto en la Academia, o (None, None)."""
    if not learnation_user_id:
        return None, None
    if learnation_user_id not in cache:
        try:
            cache[learnation_user_id] = LearnationService.get_student_products(learnation_user_id).get('products') or []
        except LearnationAPIError as e:
            numeros['errores_api'] += 1
            print(f'  [API] alumno {learnation_user_id}: {e}')
            cache[learnation_user_id] = []
    activas = [p for p in cache[learnation_user_id]
               if p.get('product_slug') == slug and p.get('status') == 'active' and p.get('expires_at')]
    if not activas:
        return None, None
    mejor = max(activas, key=lambda p: p['expires_at'])
    return _fecha(mejor['expires_at']), bool(mejor.get('is_deposit'))


def _ultima_venta(person_uuid, client_ids, programa):
    q = Sale.query.filter(Sale.person_uuid == person_uuid) if person_uuid else Sale.query.filter(Sale.client_id.in_(client_ids))
    if programa:
        q = q.filter_by(program_code=programa)
    return q.order_by(Sale.sold_at.desc(), Sale.id.desc()).first()


def _grupos(clientes):
    """{(persona o cliente, slug): [clientes]}: los duplicados de una persona van juntos."""
    grupos = {}
    for c in clientes:
        grupos.setdefault((c.person_uuid or f'c{c.id}', c.academy_product_slug), []).append(c)
    return grupos


def ejecutar(apply=False):
    """La carga dentro de un app context. Devuelve los números."""
    programa_de = {slug: codigo for codigo, slug in (AcademyAccessService.get_product_mapping() or {}).items()}
    clientes = Client.query.filter(Client.academy_product_slug.isnot(None), Client.academy_expires_at.isnot(None)) \
        .order_by(Client.id).all()
    grupos = _grupos(clientes)
    numeros = {'clientes': len(clientes), 'personas_producto': len(grupos), 'creadas': 0, 'ya_tenian': 0,
               'vigentes': 0, 'sin_venta': 0, 'venta_cancelada': 0, 'sena': 0, 'sin_persona': 0,
               'duplicados_juntados': 0, 'con_fecha_academia': 0, 'sin_fecha_academia': 0,
               'difieren': 0, 'academia_mas_lejos': 0, 'academia_mas_cerca': 0, 'errores_api': 0}
    ejemplos, cache, hoy = [], {}, date.today()

    for i, ((clave, slug), grupo) in enumerate(grupos.items(), 1):
        if i % 100 == 0:
            print(f'  ... {i}/{len(grupos)}')
        person_uuid = None if clave.startswith('c') else clave
        client = grupo[0]  # el más antiguo de la persona
        ids = [c.id for c in grupo]
        ya = Subscription.query.filter(Subscription.product_slug == slug, (
            Subscription.person_uuid == person_uuid) if person_uuid else Subscription.client_id.in_(ids)).first()
        if ya:
            numeros['ya_tenian'] += 1
            continue
        programa = programa_de.get(slug)
        venta = _ultima_venta(person_uuid, ids, programa)
        if not person_uuid and venta is not None and venta.person_uuid:
            person_uuid = venta.person_uuid
        if venta is not None and venta.status == 'cancelled':
            numeros['venta_cancelada'] += 1
            venta = None

        work = max(c.academy_expires_at.date() for c in grupo)
        academia = [_de_la_academia(c.learnation_user_id, slug, cache, numeros) for c in grupo]
        academia = [a for a in academia if a[0]]
        if academia:
            vence, sena_academia = max(academia, key=lambda a: a[0])
            numeros['con_fecha_academia'] += 1
            if vence != work:
                numeros['difieren'] += 1
                numeros['academia_mas_lejos' if vence > work else 'academia_mas_cerca'] += 1
        else:
            vence, sena_academia = work, None
            numeros['sin_fecha_academia'] += 1

        sena = sena_academia if sena_academia is not None else (
            bool(venta) and all(SheetsService.parse_tipo_pago(p.tipo_pago)[1] == 'seña' for p in venta.payments))
        desde = venta.sold_at.date() if venta and venta.sold_at else _add_months(vence, -DURACION_MESES)
        numeros['creadas'] += 1
        numeros['vigentes'] += vence >= hoy
        numeros['sin_venta'] += venta is None
        numeros['sena'] += bool(sena)
        numeros['sin_persona'] += person_uuid is None
        numeros['duplicados_juntados'] += len(grupo) - 1
        if len(ejemplos) < EJEMPLOS and (len(grupo) > 1 or (academia and vence != work) or venta is None):
            ejemplos.append(f'persona={person_uuid} clientes={ids} producto={slug} academia='
                            f'{vence if academia else None} work={work} -> vence={vence} '
                            f'venta={venta.id if venta else None} seña={bool(sena)}')
        if apply:
            sub = Subscription(client_id=client.id, person_uuid=person_uuid, product_slug=slug, program_code=programa,
                               sale=venta, starts_at=min(desde, vence), expires_at=vence, status='active',
                               is_deposit=bool(sena))
            db.session.add(sub)
            db.session.add(SubscriptionEvent(subscription=sub, kind='alta', to_date=vence, reason=MOTIVO,
                                             source='academia' if academia else 'work', sale=venta))

    n = numeros
    print(f"Clientes con acceso dado desde Work: {n['clientes']} -> {n['personas_producto']} personas y producto "
          f"({n['duplicados_juntados']} clientes duplicados juntados)")
    print(f"Suscripciones a crear: {n['creadas']} (vigentes hoy: {n['vigentes']}, seña: {n['sena']}, "
          f"sin persona: {n['sin_persona']}); ya tenían: {n['ya_tenian']}")
    print(f"Sin venta: {n['sin_venta']} (de ellas, con la última venta cancelada: {n['venta_cancelada']})")
    print(f"Vencimiento de la Academia: {n['con_fecha_academia']}; sin fecha en la Academia (queda academy_expires_at): "
          f"{n['sin_fecha_academia']}; errores de la API: {n['errores_api']}")
    print(f"Difieren Academia vs academy_expires_at: {n['difieren']} (Academia más lejos: {n['academia_mas_lejos']}, "
          f"más cerca: {n['academia_mas_cerca']})")
    print('\nEjemplos:')
    for e in ejemplos:
        print(f'  {e}')
    if apply:
        db.session.commit()
        print('\nAplicado.')
    else:
        db.session.rollback()
        print('\n[PRUEBA] No se escribió nada. Corré con --apply para guardar.')
    return numeros


if __name__ == '__main__':
    with create_app().app_context():
        ejecutar(apply='--apply' in sys.argv)
