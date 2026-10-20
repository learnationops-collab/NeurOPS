"""Carga inicial de las suscripciones (`Subscription`): una por cliente con el último acceso que Work
le dio en la Academia (`Client.academy_product_slug` / `academy_expires_at`, que guarda cada alta,
renovación o corte). Se cuelga de la última venta de ese programa (correr antes scripts/backfill_sales.py).

Uso:
  python scripts/backfill_subscriptions.py            # prueba: cuenta, no escribe nada
  python scripts/backfill_subscriptions.py --apply    # crea las suscripciones con su evento «alta»

No pisa: un cliente que ya tiene suscripción a ese producto se saltea. Lo que la Academia haya
cambiado por su cuenta (una asignación a mano) no está acá: lo compara la fase 4.
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
from app.services.sheets_service import SheetsService
from app.services.subscription_service import DURACION_MESES

MOTIVO = 'Carga inicial: el último acceso que Work le dio en la Academia'


def _ultima_venta(client_id, programa):
    q = Sale.query.filter_by(client_id=client_id)
    if programa:
        q = q.filter_by(program_code=programa)
    return q.order_by(Sale.sold_at.desc(), Sale.id.desc()).first()


def ejecutar(apply=False):
    """La carga dentro de un app context. Devuelve los números."""
    programa_de = {slug: codigo for codigo, slug in (AcademyAccessService.get_product_mapping() or {}).items()}
    clientes = Client.query.filter(Client.academy_product_slug.isnot(None), Client.academy_expires_at.isnot(None)).all()
    numeros = {'clientes': len(clientes), 'creadas': 0, 'ya_tenian': 0, 'vigentes': 0, 'sin_venta': 0, 'sena': 0}
    hoy = date.today()
    for client in clientes:
        slug = client.academy_product_slug
        if Subscription.query.filter_by(client_id=client.id, product_slug=slug).first():
            numeros['ya_tenian'] += 1
            continue
        programa = programa_de.get(slug)
        vence = client.academy_expires_at.date()
        venta = _ultima_venta(client.id, programa)
        sena = bool(venta) and all(SheetsService.parse_tipo_pago(p.tipo_pago)[1] == 'seña' for p in venta.payments)
        desde = venta.sold_at.date() if venta and venta.sold_at else _add_months(vence, -DURACION_MESES)
        numeros['creadas'] += 1
        numeros['vigentes'] += vence >= hoy
        numeros['sin_venta'] += venta is None
        numeros['sena'] += sena
        if apply:
            sub = Subscription(client_id=client.id, product_slug=slug, program_code=programa, sale=venta,
                               starts_at=min(desde, vence), expires_at=vence, status='active', is_deposit=sena)
            db.session.add(sub)
            db.session.add(SubscriptionEvent(subscription=sub, kind='alta', to_date=vence, reason=MOTIVO,
                                             source='work', sale=venta))
    print(f"Clientes con acceso dado desde Work: {numeros['clientes']}")
    print(f"Suscripciones a crear: {numeros['creadas']} (vigentes hoy: {numeros['vigentes']}, "
          f"solo seña: {numeros['sena']}, sin venta agrupada: {numeros['sin_venta']}); ya tenían: {numeros['ya_tenian']}")
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
