"""Frente J (docs/plan_personas.md, Etapa 2b): cuántos pagos deja de ver un cliente con el criterio
estricto, y cuánta plata suman. Solo lee.

Antes, un pago era de un cliente también si coincidía por texto (mail, instagram o los últimos 8 dígitos
del teléfono de la copia del pago). Ahora es suyo si es de su persona, si está atado por `client_id`, o,
en pagos sin persona, si coincide por mail o instagram (`sales_consistency_service.filtro_de_pagos`).
Lo que se esconde se clasifica en (cada clase, con la señal que los unía: mail, ig o tel):
  duplicada  el nombre del pago y el del cliente son compatibles: probablemente la misma persona en dos
             filas de `people` sin fusionar (revisar con scripts/fusionar_personas.py)
  otro       nombre incompatible: era el cruce por texto equivocado (el caso Kervin)
  telefono   pago sin persona que solo coincidía por teléfono

Uso: python scripts/medir_pagos_estrictos.py [--ejemplos 20]
"""
import os
import sys
from collections import defaultdict

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Client, FinancialSale
from app.services.person_service import mismo_nombre, normalizar


def _ultimos8(tel):
    digitos = ''.join(c for c in (tel or '') if c.isdigit())
    return digitos[-8:] if len(digitos) >= 8 else None


def main():
    ejemplos = int(sys.argv[sys.argv.index('--ejemplos') + 1]) if '--ejemplos' in sys.argv else 10
    app = create_app()
    with app.app_context():
        por_mail, por_ig, por_tel = defaultdict(set), defaultdict(set), defaultdict(set)
        clientes = {}
        for cid, nombre, email, ig, tel, puuid in db.session.query(
                Client.id, Client.full_name, Client.email, Client.instagram, Client.phone, Client.person_uuid):
            clientes[cid] = (nombre, puuid)
            if normalizar('email', email):
                por_mail[normalizar('email', email)].add(cid)
            if normalizar('instagram', ig):
                por_ig[normalizar('instagram', ig)].add(cid)
            if _ultimos8(tel):
                por_tel[_ultimos8(tel)].add(cid)

        total = defaultdict(lambda: [0, 0.0])
        muestras = defaultdict(list)
        sin_persona = 0
        for v in FinancialSale.query.yield_per(1000):
            if not v.person_uuid:
                sin_persona += 1
            mail, ig, tel = normalizar('email', v.mail_cliente), normalizar('instagram', v.instagram), _ultimos8(v.telefono)
            por_texto = por_mail.get(mail, set()) | por_ig.get(ig, set())
            candidatos = por_texto | por_tel.get(tel, set())
            for cid in candidatos:
                nombre, puuid = clientes[cid]
                if v.client_id == cid or (v.person_uuid and v.person_uuid == puuid):
                    continue
                if not v.person_uuid and cid in por_texto:
                    continue  # sigue siendo suyo: pago sin persona, mismo mail o IG
                senal = ('mail' if cid in por_mail.get(mail, ()) else 'ig' if cid in por_ig.get(ig, ()) else 'tel')
                if not v.person_uuid:
                    clase = 'telefono'
                elif mismo_nombre(v.nombre_cliente, nombre):
                    clase = f'duplicada/{senal}'
                else:
                    clase = f'otro/{senal}'
                total[clase][0] += 1
                total[clase][1] += float(v.monto or 0)
                if len(muestras[clase]) < ejemplos:
                    muestras[clase].append(f'pago {v.id} ({v.nombre_cliente!r}, ${v.monto}) ya no es de '
                                           f'cliente {cid} ({nombre!r})')

        print(f'Pagos sin persona: {sin_persona}')
        print('Pagos que un cliente deja de ver (pago, cliente), por clase:')
        for clase in sorted(total):
            n, plata = total[clase]
            print(f'  {clase:10} {n:6} pares  ${plata:,.2f}')
            for m in muestras[clase]:
                print(f'      {m}')


if __name__ == '__main__':
    main()
