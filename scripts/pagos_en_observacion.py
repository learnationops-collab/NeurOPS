"""Pagos en observación (docs/plan_personas.md, pase a producción): el pago es de una persona, pero su
copia (mail, instagram o teléfono) apunta al cliente de otra con un nombre compatible. Antes del criterio
estricto (frente J) ese cliente también lo veía; ahora no.

No se fusionan ni se mueven (decisión de Santiago, 22/10/2026): no se sabe si fue un pago suyo o datos
cruzados por el closer. Quedan pendientes hasta deducirlo:
  - desde 2026, a su venta se le suma el motivo de revisión «pago en observación» (ficha y «Ventas para
    revisar»); lo anterior no se revisa caso por caso;
  - todos guardan en `raw_data['observacion']` a qué otras personas apuntaba y por qué dato. La fecha y el
    monto, que van a ser la clave del matching automático de ingresos, ya están en el pago.

Corre después de `backfill_sales.py --rehacer`, que rearma las ventas y se llevaría el motivo.
Se puede correr dos veces: solo suma lo que falta.

Uso:
  python scripts/pagos_en_observacion.py            # prueba: lista los pagos
  python scripts/pagos_en_observacion.py --apply    # los marca
"""
import os
import sys
from collections import defaultdict
from datetime import datetime

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Client, FinancialSale, Sale
from app.services.person_service import mismo_nombre, normalizar
from app.services.sale_service import _anotar

MOTIVO = 'pago en observación'
CORTE = datetime(2026, 1, 1)


def _ultimos8(tel):
    digitos = ''.join(c for c in (tel or '') if c.isdigit())
    return digitos[-8:] if len(digitos) >= 8 else None


def _indices():
    por_dato, clientes = defaultdict(set), {}
    for cid, nombre, email, ig, tel, puuid in db.session.query(
            Client.id, Client.full_name, Client.email, Client.instagram, Client.phone, Client.person_uuid):
        clientes[cid] = (nombre, puuid)
        for clave in (('mail', normalizar('email', email)), ('ig', normalizar('instagram', ig)),
                      ('tel', _ultimos8(tel))):
            if clave[1]:
                por_dato[clave].add(cid)
    return por_dato, clientes


def observados():
    """{pago: [{person_uuid, cliente, nombre, dato}]}: las otras personas a las que apunta cada pago."""
    por_dato, clientes = _indices()
    salida = {}
    for v in FinancialSale.query.filter(FinancialSale.person_uuid.isnot(None)).yield_per(1000):
        claves = (('mail', normalizar('email', v.mail_cliente)), ('ig', normalizar('instagram', v.instagram)),
                  ('tel', _ultimos8(v.telefono)))
        otras = {}
        for dato, valor in claves:
            for cid in por_dato.get((dato, valor), ()) if valor else ():
                nombre, puuid = clientes[cid]
                if not puuid or puuid == v.person_uuid or v.client_id == cid or puuid in otras:
                    continue
                if mismo_nombre(v.nombre_cliente, nombre):
                    otras[puuid] = {'person_uuid': puuid, 'cliente': cid, 'nombre': nombre, 'dato': dato}
        if otras:
            salida[v] = list(otras.values())
    return salida


def ejecutar(apply=False):
    pagos = observados()
    antes = [v for v in pagos if v.date and v.date < CORTE]
    print(f'pagos en observación: {len(pagos)}, ${sum(float(v.monto or 0) for v in pagos):,.2f}')
    print(f'  anteriores a 2026: {len(antes)}; desde 2026: {len(pagos) - len(antes)}')
    print(f'  sin venta: {sum(1 for v in pagos if not v.sale_id)}')
    for v, otras in sorted(pagos.items(), key=lambda x: x[0].date or datetime.min):
        destino = ', '.join(f'{o["nombre"]!r} por {o["dato"]}' for o in otras)
        print(f'   pago {v.id} {v.date:%Y-%m-%d} ${v.monto} {v.nombre_cliente!r} → {destino}' if v.date
              else f'   pago {v.id} sin fecha ${v.monto} {v.nombre_cliente!r} → {destino}')
    if not apply:
        print('\n[PRUEBA] No se marcó nada. Corré con --apply para marcarlos.')
        return
    ventas = set()
    for v, otras in pagos.items():
        v.raw_data = {**(v.raw_data or {}), 'observacion': {
            'motivo': 'la copia del pago apunta a otra persona con nombre compatible',
            'otras_personas': otras, 'marcado': datetime.utcnow().isoformat(timespec='seconds')}}
        # Antes de 2026 no se revisa caso por caso: queda solo la marca en el pago, para el matching.
        if v.sale_id and v.date and v.date >= CORTE:
            ventas.add(v.sale_id)
    for sale in Sale.query.filter(Sale.id.in_(ventas)).all() if ventas else []:
        _anotar(sale, [MOTIVO])
    db.session.commit()
    print(f'\nAplicado: {len(pagos)} pagos marcados, {len(ventas)} ventas con «{MOTIVO}».')


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        ejecutar(apply='--apply' in sys.argv)
