"""Fusiona personas a partir de una lista aprobada a mano (docs/plan_personas.md), con
`person_service.fusionar`.

El archivo tiene una línea por grupo, con los uuid separados por espacio. El primero es el que queda;
si la línea empieza con `?`, queda el que tenga más pagos y, a igualdad, el que tenga ficha de cliente
(después, más filas en total y el más antiguo). Las líneas vacías y las que empiezan con `#` se ignoran.

Antes de fusionar se valida todo el archivo: cada uuid existe, no está ya fusionado, no se repite en
dos grupos y cada grupo tiene al menos dos personas. Con un error no se fusiona ningún grupo.

Uso:
  python scripts/fusionar_lista.py grupos.txt            # prueba: datos de cada persona y qué se movería
  python scripts/fusionar_lista.py grupos.txt --apply    # fusiona
"""
import os
import sys

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Person, PersonIdentity
from app.services import person_service

MOTIVO = 'fusión manual aprobada'
# Lo que se informa que se mueve; `person_service.TABLAS` mueve todas.
MOSTRAR = ('financial_sales', 'financial_agendas', 'appointments', 'sales', 'subscriptions', 'clients',
           'conversations', 'leads', 'manychat_leads')


def leer(ruta):
    grupos = []
    with open(ruta, encoding='utf-8') as f:
        for n, linea in enumerate(f, 1):
            linea = linea.strip()
            if not linea or linea.startswith('#'):
                continue
            elegir = linea.startswith('?')
            uuids = [u.strip().lower() for u in linea.lstrip('?').split()]
            grupos.append((n, elegir, uuids))
    return grupos


def validar(grupos):
    errores, vistos = [], {}
    for n, _, uuids in grupos:
        if len(set(uuids)) < 2:
            errores.append(f'línea {n}: hace falta al menos dos personas distintas')
        for u in uuids:
            p = db.session.get(Person, u)
            if p is None:
                errores.append(f'línea {n}: {u} no existe')
            elif p.merged_into_uuid:
                errores.append(f'línea {n}: {u} ya está fusionada en {p.merged_into_uuid}')
            if u in vistos and vistos[u] != n:
                errores.append(f'línea {n}: {u} también está en la línea {vistos[u]}')
            vistos.setdefault(u, n)
    return errores


def filas_de(uuid):
    cuenta = {}
    for model in person_service.TABLAS:
        n = model.query.filter(model.person_uuid == uuid).count()
        if n:
            cuenta[model.__tablename__] = n
    return cuenta


def elegir_sobreviviente(uuids, filas):
    def peso(u):
        p = db.session.get(Person, u)
        return (filas[u].get('financial_sales', 0), filas[u].get('clients', 0) > 0, sum(filas[u].values()),
                -(p.created_at.timestamp() if p.created_at else 0))
    return max(uuids, key=peso)


def datos(uuid):
    idents = PersonIdentity.query.filter(PersonIdentity.person_uuid == uuid, PersonIdentity.retired_at.is_(None))
    por_tipo = {}
    for i in idents:
        por_tipo.setdefault(i.kind, []).append(i.value + ('*' if i.is_primary else '') + (f' ({i.uso})' if i.uso else ''))
    return por_tipo


def main(ruta, apply=False):
    grupos = leer(ruta)
    errores = validar(grupos)
    if errores:
        print('No se fusiona nada; corregí el archivo:')
        for e in errores:
            print(f'  {e}')
        return
    plan = []
    for n, elegir, uuids in grupos:
        uuids = list(dict.fromkeys(uuids))
        filas = {u: filas_de(u) for u in uuids}
        queda = elegir_sobreviviente(uuids, filas) if elegir else uuids[0]
        otros = [u for u in uuids if u != queda]
        plan.append((queda, otros))
        print(f'\n== línea {n}: queda {queda} ({"elegido por pagos y ficha" if elegir else "el primero"})')
        for u in [queda] + otros:
            p = db.session.get(Person, u)
            d = datos(u)
            print(f'  {"QUEDA" if u == queda else "se va"} {u} {p.full_name!r}')
            print(f'      mails {d.get("email", [])} tel {d.get("phone", [])} ig {d.get("instagram", [])}')
            print(f'      filas {filas[u] or "ninguna"}')
        movidas = {}
        for u in otros:
            for tabla, k in filas[u].items():
                movidas[tabla] = movidas.get(tabla, 0) + k
        se_ven = {t: movidas[t] for t in MOSTRAR if movidas.get(t)}
        resto = {t: k for t, k in movidas.items() if t not in MOSTRAR}
        print(f'  se mueve a la que queda: {se_ven or "nada"}' + (f' y además {resto}' if resto else ''))
        clientes = filas[queda].get('clients', 0) + movidas.get('clients', 0)
        if clientes > 1:
            print(f'  quedarían {clientes} clientes de la misma persona: se fusionan (ClientDedupService)')

    print(f'\n{len(plan)} grupos, {sum(len(o) for _, o in plan)} personas de más.')
    if not apply:
        print('[PRUEBA] No se fusionó nada. Corré con --apply para fusionar.')
        return
    for queda, otros in plan:
        person_service.fusionar(queda, otros, motivo=MOTIVO)
    print(f'Aplicado: {len(plan)} grupos fusionados.')


if __name__ == '__main__':
    argumentos = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not argumentos:
        sys.exit('Falta el archivo con los grupos (ver el docstring).')
    with create_app().app_context():
        main(argumentos[0], apply='--apply' in sys.argv)
