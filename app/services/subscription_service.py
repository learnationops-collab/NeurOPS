"""La suscripción del cliente a un producto de la Academia, con Work como fuente de verdad (20/10/2026).

Reglas (Santiago, 20/10):
  · la abre la venta: una seña da 7 días; un completo, un parcial o un upsell, la duración por
    defecto (4 meses) desde el pago;
  · una renovación la extiende 4 meses desde donde vencía (o desde el pago, si ya había vencido);
  · el pago que completa una seña (completo, parcial o la cuota) la pasa a acceso completo;
  · el closer la puede dejar más larga o más corta a voluntad (Fulfillment, `cambiar`), y la
    Academia puede dar prórrogas gratuitas (`prorrogar`), que solo extienden;
  · nada se pisa en silencio: cada cambio queda en `SubscriptionEvent`.
Estar al día con las cuotas no mueve esta fecha: eso lo dice la venta.

Lo automático corre dentro del `before_flush` de `sale_service`, sobre el pago recién ubicado.
Cada cambio se le empuja a la Academia al guardar (`subscription_sync`, fase 4), y el aviso de cada
pago (`academy_payment_sync`) lleva el vencimiento de la suscripción (`vencimiento_de`).
"""
from datetime import date, datetime, timedelta

from app import db
from app.models import Client, Subscription, SubscriptionEvent
from app.services.academy_access_service import AcademyAccessService, _add_months
from app.services import subscription_sync

DURACION_MESES = 4
DIAS_SENA = 7
# Lo que, sumado a una venta que era solo seña, la pasa a acceso completo.
COMPLETAN_SENA = ('completo', 'parcial', 'cuota')


def slug_de(programa):
    return (AcademyAccessService.get_product_mapping() or {}).get((programa or '').upper()) if programa else None


def _dia(valor):
    if isinstance(valor, datetime):
        return valor.date()
    return valor or date.today()


def _persona_de(session, client_id):
    return session.query(Client.person_uuid).filter(Client.id == client_id).scalar() if client_id else None


def _suyas(session, client_id):
    """Las suscripciones del cliente y, si tiene persona, también las de sus otros clientes duplicados
    (plan_personas): la suscripción es de la persona."""
    persona = _persona_de(session, client_id)
    filtro = Subscription.client_id == client_id
    if persona:
        filtro = db.or_(filtro, Subscription.person_uuid == persona)
    return session.query(Subscription).filter(filtro)


def _de(session, client_id, slug):
    persona = _persona_de(session, client_id)
    pendiente = next((s for s in session.new if isinstance(s, Subscription) and s.product_slug == slug
                      and (s.client_id == client_id or (persona and s.person_uuid == persona))), None)
    return pendiente or _suyas(session, client_id).filter(Subscription.product_slug == slug) \
        .order_by(Subscription.client_id != client_id, Subscription.id).first()


def otorgar(session, client_id, slug, hasta, kind, *, programa=None, desde=None, is_deposit=None,
            sale=None, payment=None, reason=None, actor_id=None, actor_email=None, source='work',
            puede_acortar=False):
    """Lleva la suscripción del cliente a `slug` hasta `hasta` y lo anota. Sin `puede_acortar` solo
    extiende (un pago nunca le quita días a nadie). Devuelve la suscripción, o None si no cambió."""
    if not client_id or not slug or not hasta:
        return None
    sub = _de(session, client_id, slug)
    antes = sub.expires_at if sub else None
    desde = desde or date.today()
    if sub is None:
        sub = Subscription(client_id=client_id, product_slug=slug, program_code=programa, starts_at=desde,
                           expires_at=hasta, status='active', is_deposit=bool(is_deposit))
        session.add(sub)
    else:
        deja_de_ser_sena = sub.is_deposit and is_deposit is False
        if hasta == sub.expires_at and not deja_de_ser_sena:
            return None
        if hasta < sub.expires_at and not puede_acortar and not deja_de_ser_sena:
            return None
        if sub.expires_at < desde:
            sub.starts_at = desde  # había vencido: vuelve a empezar
        sub.expires_at = hasta if (puede_acortar or hasta > sub.expires_at) else sub.expires_at
        sub.status = 'active'
        if is_deposit is not None:
            sub.is_deposit = is_deposit
        sub.program_code = sub.program_code or programa
    if sale is not None:
        sub.sale = sale
    session.add(SubscriptionEvent(subscription=sub, kind=kind, from_date=antes, to_date=sub.expires_at,
                                  reason=(reason or '')[:255] or None, source=source, actor_id=actor_id,
                                  actor_email=actor_email, sale=sale, payment=payment))
    subscription_sync.anotar(session, sub)
    return sub


def al_ubicar_pago(session, sale, fila, pago, abre, abierta):
    """Lo que un pago NUEVO le hace a la suscripción, ya ubicado en su venta (`sale_service`)."""
    slug = slug_de(pago.programa)
    if not slug or not fila.client_id:
        return None
    dia = _dia(fila.date)
    comun = {'programa': pago.programa, 'desde': dia, 'sale': sale, 'payment': fila}
    if abre and sale.kind == 'renewal':
        actual = _de(session, fila.client_id, slug)
        base = max(dia, actual.expires_at) if actual else dia
        return otorgar(session, fila.client_id, slug, _add_months(base, DURACION_MESES), 'renovacion',
                       is_deposit=False, reason='Renovación', **comun)
    if abre and pago.tipo == 'seña':
        return otorgar(session, fila.client_id, slug, dia + timedelta(days=DIAS_SENA), 'alta',
                       is_deposit=True, reason='Seña: 7 días', **comun)
    if abre and pago.tipo in ('completo', 'parcial', 'upsell'):
        return otorgar(session, fila.client_id, slug, _add_months(dia, DURACION_MESES), 'alta',
                       is_deposit=False, reason='Venta', **comun)
    if not abre and abierta is not None and abierta.solo_sena and pago.tipo in COMPLETAN_SENA:
        return otorgar(session, fila.client_id, slug, _add_months(dia, DURACION_MESES), 'conversion',
                       is_deposit=False, reason='La seña pasó a acceso completo', **comun)
    return None


def cambiar(client, programa, hasta, reason, usuario=None, kind=None):
    """Un cambio a mano desde Work (Fulfillment): puede alargarla o acortarla. Sin `kind`: «alta» si
    no tenía, «extension» si la alarga, «correccion» si la acorta."""
    slug = slug_de(programa)
    if kind is None:
        actual = _de(db.session, client.id, slug) if slug else None
        kind = 'alta' if actual is None else ('extension' if hasta > actual.expires_at else 'correccion')
    return otorgar(db.session, client.id, slug, hasta, kind, programa=programa, reason=reason,
                   actor_id=usuario.id if usuario else None, puede_acortar=True)


def prorrogar(client, *, slug=None, dias=None, hasta=None, reason=None, actor_email=None):
    """Una prórroga gratuita que pide la Academia: solo extiende. Sin `slug`, la suscripción que
    vence más tarde. Levanta LookupError (no tiene) o ValueError (la fecha no extiende)."""
    q = _suyas(db.session, client.id)
    sub = (q.filter_by(product_slug=slug) if slug else q.order_by(Subscription.expires_at.desc())).first()
    if sub is None:
        raise LookupError('Ese cliente no tiene una suscripción en Work.')
    if hasta is None:
        if not dias or int(dias) <= 0:
            raise ValueError('Falta cuántos días (más de cero) o hasta cuándo.')
        hasta = max(sub.expires_at, date.today()) + timedelta(days=int(dias))
    if hasta <= sub.expires_at:
        raise ValueError(f'Una prórroga solo extiende: hoy vence el {sub.expires_at.isoformat()}.')
    return otorgar(db.session, client.id, sub.product_slug, hasta, 'prorroga', reason=reason or 'Prórroga',
                   actor_email=actor_email, source='academia')


def del_cliente(client_id):
    """Las suscripciones del cliente con su historial, la que vence más tarde primero."""
    if not client_id:
        return []
    subs = _suyas(db.session, client_id).order_by(Subscription.expires_at.desc()).all()
    return [s.to_dict(with_events=True) for s in subs]


def vencimiento_de(client_id, programa):
    """Hasta cuándo tiene acceso al producto de `programa`, según su suscripción; None si no tiene."""
    slug = slug_de(programa)
    if not client_id or not slug:
        return None
    sub = _de(db.session, client_id, slug)
    return sub.expires_at if sub else None
