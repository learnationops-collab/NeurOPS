"""Carga en `client_identities` el email, instagram, teléfono e id de la Academia de cada cliente.
Las reglas de normalización están en `app/services/client_identity_service.py`.

Uso:
  python scripts/backfill_client_identities.py            # prueba: cuenta y lista los datos compartidos
  python scripts/backfill_client_identities.py --apply    # guarda las identidades

Correrlo dos veces no duplica nada: solo agrega lo que el cliente todavía no tiene. Un dato que tienen
dos clientes se carga en los dos y se lista: son los duplicados para fusionar o revisar.
"""
import os
import sys
from collections import Counter, defaultdict

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Client, ClientIdentity
from app.services.client_identity_service import COLUMNAS, normalizar

EJEMPLOS = 10


def ejecutar(apply=False):
    existentes = {(i.client_id, i.kind, i.value) for i in
                  ClientIdentity.query.with_entities(ClientIdentity.client_id, ClientIdentity.kind, ClientIdentity.value)}
    nuevas, duenos = [], defaultdict(set)
    clientes = Client.query.with_entities(Client.id, Client.full_name, *[getattr(Client, c) for c in COLUMNAS.values()]).all()
    for fila in clientes:
        for kind, col in COLUMNAS.items():
            value = normalizar(kind, getattr(fila, col))
            if not value:
                continue
            duenos[(kind, value)].add(fila.id)
            if (fila.id, kind, value) not in existentes:
                nuevas.append({'client_id': fila.id, 'kind': kind, 'value': value, 'source': 'backfill'})

    compartidos = {k: ids for k, ids in duenos.items() if len(ids) > 1}
    print(f'clientes: {len(clientes)} | identidades nuevas: {len(nuevas)} {dict(Counter(n["kind"] for n in nuevas))}')
    print(f'datos compartidos por más de un cliente: {len(compartidos)} {dict(Counter(k for k, _ in compartidos))}')
    for (kind, value), ids in list(compartidos.items())[:EJEMPLOS]:
        print(f'   {kind}={value}: clientes {sorted(ids)}')

    if not apply:
        print('\n[PRUEBA] No se escribió nada. Corré con --apply para guardar.')
        return {'nuevas': len(nuevas), 'compartidos': len(compartidos)}
    db.session.bulk_insert_mappings(ClientIdentity, nuevas)
    db.session.commit()
    print(f'\nAplicado: {len(nuevas)} identidades guardadas.')
    return {'nuevas': len(nuevas), 'compartidos': len(compartidos)}


if __name__ == '__main__':
    with create_app().app_context():
        ejecutar(apply='--apply' in sys.argv)
