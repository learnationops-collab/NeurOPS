"""Carga inicial de las suscripciones (`Subscription`), una por persona y producto (frente L de
docs/plan_personas.md, 20/10/2026).

  · Quiénes: las asignaciones activas pagas que la Academia tiene HOY (`GET /api/students?product=`
    de cada producto de los programas de Work: los alumnos con su asignación `active` y su vencimiento), más los accesos que dio Work (`Client.academy_product_slug`)
    que no estén allá. Cada alumno se cruza con su persona: primero por su id de la Academia
    (`learnation_user_id`), después por su mail (`person_service.buscar`, sin crear). Un alumno sin
    persona se cuenta y se lista, no se crea.
  · Vencimiento: la carga nunca acorta: el más lejano entre la Academia y `academy_expires_at` (y
    entre los clientes duplicados de la persona). No se recalcula «pago inicial + 4 meses».
  · Venta: la última de ese programa de la persona (`Sale.person_uuid`). Si está cancelada, queda sin venta.

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
from app.services import person_service
from app.services.academy_access_service import AcademyAccessService, _add_months
from app.services.learnation_service import LearnationAPIError, LearnationService
from app.services.sheets_service import SheetsService
from app.services.subscription_service import DURACION_MESES

MOTIVO = 'Carga inicial: el vencimiento que la Academia tiene hoy'
EJEMPLOS = 10


def _fecha(valor):
    return date.fromisoformat(str(valor)[:10]) if valor else None


class _Academia:
    """Lo que la Academia tiene hoy, leído una vez por alumno."""

    def __init__(self, slugs, numeros):
        self.slugs, self.numeros, self.cache = slugs, numeros, {}

    def asignaciones(self, user_id):
        """[(slug, vence, es_seña)] activas pagas de ese alumno: una por producto, la más lejana."""
        if user_id not in self.cache:
            try:
                productos = LearnationService.get_student_products(user_id).get('products') or []
            except LearnationAPIError as e:
                self.numeros['errores_api'] += 1
                print(f'  [API] alumno {user_id}: {e}')
                productos = []
            mejores = {}
            for p in productos:
                vence = _fecha(p.get('expires_at'))
                if p.get('status') == 'active' and vence and p.get('product_slug') in self.slugs:
                    actual = mejores.get(p['product_slug'])
                    if actual is None or vence > actual[0]:
                        mejores[p['product_slug']] = (vence, bool(p.get('is_deposit')))
            self.cache[user_id] = [(slug, v, s) for slug, (v, s) in mejores.items()]
        return self.cache[user_id]

    def alumnos(self):
        """{user_id: (email, [(slug, vence, es_seña)])}: los alumnos con una asignación activa de cada
        producto (`GET /api/students?product=<slug>`, con sus productos activos y el vencimiento)."""
        import requests

        base = LearnationService.BASE_URL.rsplit('/v1', 1)[0]
        alumnos = {}
        for slug in sorted(self.slugs):
            r = requests.get(f'{base}/students', params={'product': slug}, headers=LearnationService._headers(), timeout=60)
            r.raise_for_status()
            for a in r.json().get('data') or []:
                email, asignaciones = alumnos.setdefault(a['id'], ((a.get('email') or '').strip().lower() or None, {}))
                for p in a.get('active_products') or []:
                    vence = _fecha(p.get('expires_at'))
                    if p.get('slug') in self.slugs and vence and vence > asignaciones.get(p['slug'], (date.min,))[0]:
                        asignaciones[p['slug']] = (vence, False)
        return {uid: (email, [(s, v, d) for s, (v, d) in asig.items()]) for uid, (email, asig) in alumnos.items()}


def _persona_del_alumno(user_id, email):
    """Por su id de la Academia y, si no, por su mail. Nunca crea."""
    return person_service.buscar(learnation_user_id=user_id) or (person_service.buscar(email=email) if email else None)


def _ultima_venta(person_uuid, client_ids, programa):
    q = Sale.query.filter(Sale.person_uuid == person_uuid) if person_uuid else Sale.query.filter(Sale.client_id.in_(client_ids))
    if programa:
        q = q.filter_by(program_code=programa)
    return q.order_by(Sale.sold_at.desc(), Sale.id.desc()).first()


def _juntar(academia, numeros, sin_persona):
    """{(persona o cliente, slug): {'academia': (vence, seña) | None, 'work': fecha | None, 'clientes': [...]}}"""
    grupos = {}

    def grupo(clave, slug):
        return grupos.setdefault((clave, slug), {'academia': None, 'work': None, 'clientes': []})

    def sumar_academia(g, vence, sena):
        if g['academia'] is None or vence > g['academia'][0]:
            g['academia'] = (vence, sena)

    alumnos = academia.alumnos()
    numeros['alumnos_academia'] = len(alumnos)
    for user_id, (email, asignaciones) in alumnos.items():
        academia.cache.setdefault(user_id, asignaciones)
        if not asignaciones:
            continue
        numeros['asignaciones_academia'] += len(asignaciones)
        person = _persona_del_alumno(user_id, email)
        if person is None:
            numeros['alumnos_sin_persona'] += 1
            sin_persona.append(f'alumno {user_id} <{email}>: {", ".join(s for s, _, _ in asignaciones)}')
            continue
        for slug, vence, sena in asignaciones:
            sumar_academia(grupo(('p', person.uuid), slug), vence, sena)

    clientes = Client.query.filter(Client.academy_product_slug.isnot(None), Client.academy_expires_at.isnot(None)) \
        .order_by(Client.id).all()
    numeros['clientes_work'] = len(clientes)
    for c in clientes:
        g = grupo(('p', c.person_uuid) if c.person_uuid else ('c', c.id), c.academy_product_slug)
        g['clientes'].append(c)
        g['work'] = max(filter(None, [g['work'], c.academy_expires_at.date()]))
        if g['academia'] is None and c.learnation_user_id:  # no está en proceso: se le pregunta igual
            for slug, vence, sena in academia.asignaciones(c.learnation_user_id):
                if slug == c.academy_product_slug:
                    sumar_academia(g, vence, sena)
    return grupos


def ejecutar(apply=False):
    """La carga dentro de un app context. Devuelve los números."""
    programa_de = {slug: codigo for codigo, slug in (AcademyAccessService.get_product_mapping() or {}).items()}
    numeros = {k: 0 for k in (
        'alumnos_academia', 'asignaciones_academia', 'alumnos_sin_persona', 'clientes_work', 'personas_producto',
        'creadas', 'ya_tenian', 'sin_cliente', 'vigentes', 'sin_venta', 'venta_cancelada', 'sena', 'solo_academia',
        'solo_work', 'en_las_dos', 'difieren', 'academia_mas_lejos', 'work_mas_lejos', 'errores_api')}
    sin_persona, sin_cliente, ejemplos, hoy = [], [], [], date.today()
    grupos = _juntar(_Academia(set(programa_de), numeros), numeros, sin_persona)
    numeros['personas_producto'] = len(grupos)

    for (clave, slug), g in grupos.items():
        person_uuid = clave[1] if clave[0] == 'p' else None
        person = person_service.por_uuid(person_uuid) if person_uuid else None
        client = (person_service.cliente_de(person, crear=False) if person else None) or (g['clientes'] or [None])[0]
        if client is None:
            numeros['sin_cliente'] += 1
            sin_cliente.append(f'persona {person_uuid}: {slug}')
            continue
        ids = [c.id for c in g['clientes']] or [client.id]
        ya = Subscription.query.filter(Subscription.product_slug == slug, (
            Subscription.person_uuid == person_uuid) if person_uuid else Subscription.client_id.in_(ids)).first()
        if ya:
            numeros['ya_tenian'] += 1
            continue
        programa = programa_de.get(slug)
        venta = _ultima_venta(person_uuid, ids, programa)
        if venta is not None and venta.status == 'cancelled':
            numeros['venta_cancelada'] += 1
            venta = None

        academia, work = g['academia'], g['work']
        fechas = [f for f in (academia[0] if academia else None, work) if f]
        vence = max(fechas)
        if academia and work:
            numeros['en_las_dos'] += 1
            if academia[0] != work:
                numeros['difieren'] += 1
                numeros['academia_mas_lejos' if academia[0] > work else 'work_mas_lejos'] += 1
        else:
            numeros['solo_academia' if academia else 'solo_work'] += 1
        # La lista de la Academia no dice si la asignación es de una seña: sale de la venta.
        sena = (academia and academia[1]) or (
            bool(venta) and all(SheetsService.parse_tipo_pago(p.tipo_pago)[1] == 'seña' for p in venta.payments))
        desde = venta.sold_at.date() if venta and venta.sold_at else _add_months(vence, -DURACION_MESES)
        numeros['creadas'] += 1
        numeros['vigentes'] += vence >= hoy
        numeros['sin_venta'] += venta is None
        numeros['sena'] += bool(sena)
        if len(ejemplos) < EJEMPLOS and (len(g['clientes']) > 1 or not (academia and work) or academia[0] != work):
            ejemplos.append(f'persona={person_uuid} cliente={client.id} producto={slug} '
                            f'academia={academia[0] if academia else None} work={work} -> vence={vence} '
                            f'venta={venta.id if venta else None} seña={bool(sena)}')
        if apply:
            sub = Subscription(client_id=client.id, person_uuid=person_uuid, product_slug=slug, program_code=programa,
                               sale=venta, starts_at=min(desde, vence), expires_at=vence, status='active',
                               is_deposit=bool(sena))
            db.session.add(sub)
            db.session.add(SubscriptionEvent(subscription=sub, kind='alta', to_date=vence, reason=MOTIVO,
                                             source='academia' if academia else 'work', sale=venta))

    n = numeros
    print(f"Academia: {n['alumnos_academia']} alumnos con producto pago,{n['asignaciones_academia']} asignaciones activas pagas; "
          f"{n['alumnos_sin_persona']} alumnos sin persona en Work (no se crean)")
    print(f"Work: {n['clientes_work']} clientes con acceso dado desde Work")
    print(f"Personas y producto: {n['personas_producto']} -> a crear: {n['creadas']} (vigentes hoy: {n['vigentes']}, "
          f"seña: {n['sena']}); ya tenían: {n['ya_tenian']}; persona sin cliente: {n['sin_cliente']}")
    print(f"Origen: solo Academia {n['solo_academia']}, solo Work {n['solo_work']}, en las dos {n['en_las_dos']} "
          f"(difieren {n['difieren']}: Academia más lejos {n['academia_mas_lejos']}, Work más lejos {n['work_mas_lejos']})")
    print(f"Sin venta: {n['sin_venta']} (con la última venta cancelada: {n['venta_cancelada']}); errores de la API: {n['errores_api']}")
    for titulo, lista in (('Alumnos sin persona', sin_persona), ('Personas sin cliente', sin_cliente), ('Ejemplos', ejemplos)):
        if lista:
            print(f'\n{titulo}:')
            for linea in lista:
                print(f'  {linea}')
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
