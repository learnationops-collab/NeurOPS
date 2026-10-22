"""Carga en `person_identities` el email, instagram, teléfono e id de la Academia de cada persona, a
partir de sus clientes. Las reglas de normalización están en `app/services/person_service.py`.

Uso:
  python scripts/backfill_person_identities.py            # prueba: cuenta y lista los datos compartidos
  python scripts/backfill_person_identities.py --apply    # guarda las identidades

Correrlo dos veces no duplica nada. El primer dato de cada tipo queda como principal. Un email que
tienen dos personas con nombres incompatibles queda en la más antigua; en las otras, para revisar (es
el caso de alguien que tipeó el mail de otro). Los datos compartidos se listan: son los duplicados que
fusiona el frente A.
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
from app.models import Client, Person, PersonIdentity
from app.services.client_dedup_service import _names_compatible
from app.services.person_service import COLUMNAS_CLIENTE, normalizar

EJEMPLOS = 10


def ejecutar(apply=False):
    existentes = {(i.person_uuid, i.kind, i.value) for i in PersonIdentity.query.with_entities(
        PersonIdentity.person_uuid, PersonIdentity.kind, PersonIdentity.value)}
    con_principal = {(i.person_uuid, i.kind) for i in PersonIdentity.query.with_entities(
        PersonIdentity.person_uuid, PersonIdentity.kind).filter(PersonIdentity.is_primary.is_(True))}
    personas = {p.uuid: p for p in Person.query.filter(Person.merged_into_uuid.is_(None))
                .with_entities(Person.uuid, Person.full_name, Person.created_at)}
    clientes = Client.query.filter(Client.person_uuid.isnot(None)).order_by(Client.id).with_entities(
        Client.person_uuid, *[getattr(Client, c) for c in COLUMNAS_CLIENTE]).all()

    filas, duenos = [], defaultdict(list)
    for c in clientes:
        if c.person_uuid not in personas:
            continue
        for kind in COLUMNAS_CLIENTE:
            value = normalizar(kind, getattr(c, kind))
            if not value or (c.person_uuid, kind, value) in existentes:
                continue
            existentes.add((c.person_uuid, kind, value))
            filas.append({'person_uuid': c.person_uuid, 'kind': kind, 'value': value, 'source': 'backfill',
                          'is_primary': False, 'review_note': None})
            duenos[(kind, value)].append(c.person_uuid)

    # Email de otra persona con otro nombre: queda en la más antigua, en las demás para revisar.
    orden = lambda u: (personas[u].created_at is None, personas[u].created_at, u)  # noqa: E731
    revisar = set()
    for (kind, value), uuids in duenos.items():
        if kind != 'email' or len(uuids) < 2:
            continue
        primero, *resto = sorted(set(uuids), key=orden)
        for u in resto:
            if not _names_compatible(personas[primero].full_name, personas[u].full_name):
                revisar.add((u, value))
    for f in filas:
        if (f['person_uuid'], f['value']) in revisar and f['kind'] == 'email':
            f['review_note'] = 'Email compartido con otra persona de otro nombre'
        elif (f['person_uuid'], f['kind']) not in con_principal:
            f['is_primary'] = True
            con_principal.add((f['person_uuid'], f['kind']))

    compartidos = {k: set(u) for k, u in duenos.items() if len(set(u)) > 1}
    print(f'personas: {len(personas)} | identidades nuevas: {len(filas)} {dict(Counter(f["kind"] for f in filas))}')
    print(f'emails para revisar (de otra persona con otro nombre): {len(revisar)}')
    print(f'datos compartidos por más de una persona: {len(compartidos)} {dict(Counter(k for k, _ in compartidos))}')
    for (kind, value), uuids in list(compartidos.items())[:EJEMPLOS]:
        print(f'   {kind}={value}: {sorted(uuids)}')

    if not apply:
        print('\n[PRUEBA] No se escribió nada. Corré con --apply para guardar.')
        return {'nuevas': len(filas), 'compartidos': len(compartidos), 'revisar': len(revisar)}
    db.session.bulk_insert_mappings(PersonIdentity, filas)
    db.session.commit()
    print(f'\nAplicado: {len(filas)} identidades guardadas.')
    return {'nuevas': len(filas), 'compartidos': len(compartidos), 'revisar': len(revisar)}


if __name__ == '__main__':
    with create_app().app_context():
        ejecutar(apply='--apply' in sys.argv)
