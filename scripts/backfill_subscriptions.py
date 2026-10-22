"""Carga de las suscripciones desde el historial de la Academia (docs/plan_personas.md, 22/10/2026).

Objetivo: cada alumno que compró tiene su suscripción, con sus renovaciones y prórrogas.

  · Una por persona y producto. Cada asignación paga que tuvo en la Academia (`product_user`, del export
    de `scripts/academia_export.php`) es un período de su historia, en orden: la primera es el alta, la que
    pasa de seña a acceso completo es la conversión, la que coincide con otra venta es una renovación y la
    que no tiene pago cerca es una prórroga (la dio el equipo).
  · Fechas y producto: los de la Academia. El vencimiento actual es el de su última asignación (se respetan
    las fechas de hoy, también los cortes); el producto es el que de verdad se dio, aunque la venta diga
    otro programa (decisión de Santiago: SI > RR > AL; se puede renovar a uno inferior).
  · La venta de cada período: la de la persona con un pago entre 3 días antes y 10 después de que la
    asignación se creó o se modificó. Un alta sin venta cerca (acceso dado con demora, o los cargados al
    abrir la Academia el 31/01/2026) toma la venta libre más cercana de la persona. Las ventas que quedan
    (una renovación pagada que no movió la Academia, una compra de otro programa) se atan a la suscripción
    más parecida con un evento que no cambia la fecha.
  · El alumno se cruza con su persona como dice `scripts/academia_alumnos.py`
    (`scripts/vincular_alumnos_academia.py` corrige los que se cruzan mal, antes de esta carga).

No escribe en la Academia y no pisa: si la persona ya tiene suscripción a ese producto, solo se le atan
las ventas. Listas aparte: alumnos sin persona, vinculados por nombre y fecha (para revisar), accesos sin
compra y ventas de 2026 con pago real sin acceso.

Uso:
  python scripts/backfill_subscriptions.py academia.json            # prueba
  python scripts/backfill_subscriptions.py academia.json --apply    # crea suscripciones y eventos
"""
import os
import sys
from collections import Counter, defaultdict
from datetime import date, datetime

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app import create_app, db
from app.models import Sale, Subscription, SubscriptionEvent
from app.services import person_service
from app.services.academy_access_service import AcademyAccessService
import academia_alumnos as aa

DESDE_2026 = datetime(2026, 1, 1)
RANGO = {'ace-learners': 1, 'residency-roadmap': 2, 'residency-roadmap-for-steps': 3}
MOTIVOS = {'alta': 'Venta', 'conversion': 'La seña pasó a acceso completo', 'renovacion': 'Renovación',
           'prorroga': 'Prórroga del equipo, sin pago cerca'}


def _periodos(filas, person_uuid, ventas, usadas):
    """[(kind, fila, venta)]: la historia de una suscripción, una entrada por asignación."""
    # Primero cada asignación con la venta de su fecha; recién después, un alta sin venta toma la libre
    # más cercana (si no, le robaría la venta a la conversión o renovación que sí coincide).
    por_fecha = []
    for fila in filas:
        venta = ventas.cerca(person_uuid, aa.momentos(fila), usadas)
        if venta is not None:
            usadas.add(venta.id)
        por_fecha.append(venta)
    if filas and por_fecha[0] is None:
        por_fecha[0] = ventas.libre_antes(person_uuid, filas[0]['creada'], usadas)
    salida = []
    for fila, venta in zip(filas, por_fecha):
        if not salida:
            kind = 'alta'
        elif salida[-1][1]['is_deposit'] and not fila['is_deposit']:
            kind = 'conversion'
        elif venta is not None and venta is not salida[-1][2]:
            kind = 'renovacion'
        else:
            kind = 'prorroga'
        if venta is not None:
            usadas.add(venta.id)
        salida.append((kind, fila, venta))
    return salida


def _estado(ultima, hoy):
    vence = ultima['vence'].date() if ultima['vence'] else hoy
    if ultima['status'] == 'active':
        return 'active' if vence >= hoy else 'expired'
    return 'cancelled' if vence >= hoy else 'expired'  # la sacaron antes de tiempo (baja a mano)


def _la_mas_parecida(slug_venta, slugs):
    """El producto de la persona más cercano al de la venta (el mismo, o el de rango más parecido)."""
    rango = RANGO.get(slug_venta, 2)
    return min(slugs, key=lambda s: (abs(RANGO.get(s, 2) - rango), -RANGO.get(s, 2)))


def _guardar(person, slug, programa, suyas, historia, estado):
    cliente = person_service.cliente_de(person, crear=True)
    db.session.flush()
    ultima = suyas[-1]
    con_venta = [v for _, _, v in historia if v is not None]
    sub = Subscription(client_id=cliente.id, person_uuid=person.uuid, product_slug=slug, program_code=programa,
                       starts_at=suyas[0]['creada'].date(), expires_at=(ultima['vence'] or ultima['creada']).date(),
                       status=estado, is_deposit=bool(ultima['is_deposit']), sale=con_venta[-1] if con_venta else None)
    db.session.add(sub)
    anterior = None
    for kind, fila, venta in historia:
        hasta = (fila['vence'] or fila['creada']).date()
        motivo = 'Seña' if kind == 'alta' and fila['is_deposit'] else MOTIVOS[kind]
        if fila['asignado_por']:
            motivo += f" (dada por {fila['asignado_por']})"
        db.session.add(SubscriptionEvent(subscription=sub, kind=kind, from_date=anterior, to_date=hasta,
                                         reason=f'Carga desde la Academia: {motivo}'[:255],
                                         source='work' if venta else 'academia', sale=venta, created_at=fila['creada']))
        if venta is not None:
            venta.subscription = sub
        anterior = hasta
    return sub


def _atar_resto(sub, ventas_sueltas):
    """Ventas de la persona que no movieron la Academia: quedan en la suscripción, sin cambiar la fecha."""
    for venta in ventas_sueltas:
        kind = 'renovacion' if venta.kind == 'renewal' else 'extension'
        db.session.add(SubscriptionEvent(subscription=sub, kind=kind, from_date=sub.expires_at, to_date=sub.expires_at,
                                         reason='Carga: venta sin cambio de acceso en la Academia (se respeta la fecha)',
                                         source='work', sale=venta, created_at=venta.sold_at))
        venta.subscription = sub


def ejecutar(archivo, apply=False):
    mapping = AcademyAccessService.get_product_mapping() or {}
    programa_de = {slug: codigo for codigo, slug in mapping.items()}
    hoy = date.today()
    filas, alumnos = aa.leer(archivo, set(programa_de))
    ventas = aa.Ventas()

    por_persona, sin_persona, por_nombre, n = defaultdict(lambda: defaultdict(list)), [], [], Counter()
    for uid, suyas in filas.items():
        u = alumnos[uid]
        if aa.es_prueba(u):
            n['pruebas'] += 1
            continue
        person, como = aa.persona_del_alumno(u, suyas, ventas)
        if person is None:
            sin_persona.append(f"alumno {uid} {u['name']!r} <{u['email']}>: {sorted({a['slug'] for a in suyas})}")
            continue
        if como == 'nombre y fecha':
            por_nombre.append(f"alumno {uid} {u['name']!r} <{u['email']}> -> {person.full_name!r} ({person.uuid[:8]})")
            if apply:
                person_service.anotar(person, [('learnation_user_id', str(uid))], 'academia')
        for a in suyas:
            por_persona[person.uuid][a['slug']].append(a)

    eventos, sin_venta, atadas = Counter(), [], set()
    for person_uuid, productos in sorted(por_persona.items()):
        person = person_service.por_uuid(person_uuid)
        usadas, subs = set(), {}
        for slug, suyas in sorted(productos.items(), key=lambda x: RANGO.get(x[0], 2)):
            suyas.sort(key=lambda a: (a['creada'], a['id']))
            historia = _periodos(suyas, person_uuid, ventas, usadas)
            ya = Subscription.query.filter(Subscription.person_uuid == person_uuid, Subscription.product_slug == slug).first()
            if ya is not None:
                n['ya_tenian'] += 1
                if apply:
                    for _, _, venta in historia:
                        if venta is not None:
                            venta.subscription = ya
                subs[slug] = ya
                continue
            estado = _estado(suyas[-1], hoy)
            n['suscripciones'] += 1
            n[estado] += 1
            n['sena'] += bool(suyas[-1]['is_deposit'])
            eventos.update(kind for kind, _, _ in historia)
            if not any(v for _, _, v in historia):
                sin_venta.append(f"{person.full_name!r} {slug} hasta {str(suyas[-1]['vence'])[:10]} ({estado})")
            subs[slug] = _guardar(person, slug, programa_de.get(slug), suyas, historia, estado) if apply else slug
        # Las ventas de la persona que no se ataron a ningún período van a su suscripción más parecida.
        sueltas = defaultdict(list)
        for venta, _ in ventas.de(person_uuid):
            if venta.id not in usadas and venta.status == 'active' and not ventas.solo_sena(venta):
                sueltas[_la_mas_parecida(mapping.get((venta.program_code or '').upper()), list(subs))].append(venta)
                usadas.add(venta.id)
                eventos['venta sin cambio en la Academia'] += 1
        if apply:
            for slug, lista in sueltas.items():
                _atar_resto(subs[slug], lista)
        atadas |= usadas

    sin_acceso = []
    for venta in Sale.query.filter(Sale.sold_at >= DESDE_2026, Sale.status == 'active', Sale.person_uuid.isnot(None)) \
            .order_by(Sale.sold_at).all():
        if venta.id in atadas or venta.subscription_id:
            continue
        if ventas.solo_sena(venta):
            n['solo_sena_sin_acceso'] += 1
            continue
        persona = person_service.por_uuid(venta.person_uuid)
        cobrado = sum(float(p.monto or 0) for p in ventas.pagos.get(venta.id, []))
        sin_acceso.append(f'venta {venta.id} {venta.kind} {venta.program_code} {venta.sold_at:%Y-%m-%d} '
                          f'{persona.full_name if persona else None!r} ${cobrado:,.0f}')

    print(f"Suscripciones: {n['suscripciones']} ({n['active']} vigentes, {n['expired']} vencidas, "
          f"{n['cancelled']} quitadas antes de tiempo; {n['sena']} en seña); ya tenían: {n['ya_tenian']}; "
          f"cuentas de prueba salteadas: {n['pruebas']}")
    print(f'Eventos: {dict(eventos)}; ventas atadas: {len(atadas)}')
    for titulo, lista in (('Alumnos vinculados por nombre y fecha (revisar)', por_nombre),
                          ('Alumnos con producto pago sin persona en Work', sin_persona),
                          ('Suscripciones sin ninguna venta (acceso sin compra en Work)', sin_venta),
                          (f"Ventas de 2026 con pago real y sin acceso (las de solo seña no se listan: "
                           f"{n['solo_sena_sin_acceso']})", sin_acceso)):
        print(f'{titulo}: {len(lista)}')
        for s in lista:
            print(f'  {s}')
    if apply:
        db.session.commit()
        print('\nAplicado.')
    else:
        print('\n[PRUEBA] No se escribió nada. Corré con --apply para guardar.')


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        ejecutar(sys.argv[1], apply='--apply' in sys.argv)
