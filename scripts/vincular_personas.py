"""Frente A (docs/plan_personas.md): le pone `person_uuid` a las filas viejas que todavía no lo tienen,
buscando a la persona por los datos copiados en la fila. No crea personas.

Uso (después de scripts/backfill_person_identities.py --apply):
  python scripts/vincular_personas.py            # prueba: cuánto vincula por tabla y por qué dato
  python scripts/vincular_personas.py --apply    # guarda person_uuid y los datos nuevos de cada persona

Los datos de la fila que la persona no tenía (el mail con que pagó, su manychat_id) se le anotan, así la
próxima vez la encuentra directo; un dato que ya es de otra persona no se suma. Correrlo dos veces no
duplica nada: solo toma filas con person_uuid NULL.
"""
import os
import sys
from collections import Counter

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app import create_app, db
from app.models import (ConciliacionMovimiento, FinancialAgenda, FinancialSale, Lead, ManychatAdLead, ManychatLead,
                        PersonIdentity, PublicRegistration)
from app.services.person_service import claves
from personas_indice import IndicePersonas

# Tabla -> (fuente, columnas: nombre, email, instagram, phone, manychat_id). WorkshopLead no trae ningún
# dato de contacto (solo nombre): se vincula por promoted_client_id, que ya hizo la migración.
TABLAS = (
    (FinancialSale, 'pago', ('nombre_cliente', 'mail_cliente', 'instagram', 'telefono', None)),
    (FinancialAgenda, 'agenda', ('nombre_persona', 'mail', 'instagram', 'whatsapp', None)),  # los dos formatos de la hoja
    (Lead, 'manychat', ('name', 'email', 'instagram_username', None, 'manychat_id')),
    (ManychatLead, 'manychat', ('name', None, 'ig', None, 'manychat_id')),
    (ManychatAdLead, 'manychat', ('lead_name', None, None, None, 'manychat_id')),
    (ConciliacionMovimiento, 'conciliacion', ('nombre', 'email', None, None, None)),
    (PublicRegistration, 'registro', ('name', None, None, 'phone', None)),
)
LOTE = 500


def _val(fila, col):
    return getattr(fila, col) if col else None


def ejecutar(apply=False):
    if not PersonIdentity.query.first():
        print('Falta cargar las identidades: corré antes scripts/backfill_person_identities.py --apply')
        return None
    indice = IndicePersonas()
    nuevas, totales = [], {}
    for model, fuente, (c_nom, c_mail, c_ig, c_tel, c_mc) in TABLAS:
        filas = model.query.filter(model.person_uuid.is_(None)).all()
        por = Counter()
        for fila in filas:
            datos = {'email': _val(fila, c_mail), 'instagram': _val(fila, c_ig), 'phone': _val(fila, c_tel),
                     'manychat_id': _val(fila, c_mc)}
            uuid, kind = indice.buscar(_val(fila, c_nom), **datos)
            if uuid is None:
                por['sin datos' if not claves(**datos) else 'sin persona'] += 1
                continue
            por[f'por {kind}'] += 1
            fila.person_uuid = uuid
            nuevas += indice.nuevas(uuid, claves(**datos), fuente)
        vinculadas = sum(n for k, n in por.items() if k.startswith('por '))
        totales[model.__tablename__] = {'sin persona': len(filas), 'vinculadas': vinculadas, **por}
        print(f'{model.__tablename__}: {len(filas)} sin persona -> vincula {vinculadas} {dict(por)}')
    print(f'datos nuevos para anotar a sus personas: {len(nuevas)} {dict(Counter(n["kind"] for n in nuevas))}')

    if not apply:
        db.session.rollback()
        print('\n[PRUEBA] No se escribió nada. Corré con --apply para guardar.')
        return totales
    # Primero se guardan los person_uuid: el seguimiento automático (frente B) le anota a la persona el
    # manychat_id del lead que se vincula. Lo que ya quedó así no se repite, ni se pisa su principal.
    db.session.flush()
    uuids = list({n['person_uuid'] for n in nuevas})
    ya, principales = set(), set()
    for i in range(0, len(uuids), LOTE):
        for r in PersonIdentity.query.filter(PersonIdentity.person_uuid.in_(uuids[i:i + LOTE])).with_entities(
                PersonIdentity.person_uuid, PersonIdentity.kind, PersonIdentity.value, PersonIdentity.is_primary,
                PersonIdentity.retired_at):
            ya.add((r.person_uuid, r.kind, r.value))
            if r.is_primary and r.retired_at is None:
                principales.add((r.person_uuid, r.kind))
    faltan = []
    for n in nuevas:
        if (n['person_uuid'], n['kind'], n['value']) in ya:
            continue
        clave = (n['person_uuid'], n['kind'])
        n['is_primary'] = clave not in principales
        principales.add(clave)
        faltan.append(n)
    for i in range(0, len(faltan), LOTE):
        db.session.bulk_insert_mappings(PersonIdentity, faltan[i:i + LOTE])
    # Los principales nuevos se muestran en la persona si no tenía ese dato.
    for kind in ('email', 'instagram', 'phone'):
        db.session.execute(db.text(f"""
            UPDATE people SET {kind} = (SELECT i.value FROM person_identities i WHERE i.person_uuid = people.uuid
                                        AND i.kind = '{kind}' AND i.is_primary AND i.retired_at IS NULL)
            WHERE {kind} IS NULL"""))
    db.session.commit()
    print('\nAplicado.')
    return totales


if __name__ == '__main__':
    with create_app().app_context():
        ejecutar(apply='--apply' in sys.argv)
