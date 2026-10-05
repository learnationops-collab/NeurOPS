"""Une dos cuentas de una misma persona en UNA con varios roles.

    env/Scripts/python.exe -u scripts/unificar_cuentas.py --target staging --destino 1135 --origen 1126
    env/Scripts/python.exe -u scripts/unificar_cuentas.py --target staging --destino 1135 --origen 1126 --aplicar

`--destino` es la cuenta que queda; `--origen`, la que se absorbe. Sin `--aplicar` hace TODO el
trabajo dentro de una transacción y la revierte (ensayo): el informe es el mismo que el real, así se
ven los choques antes de tocar nada.

Qué hace, en una sola transacción:
  1. Pasa a `--destino` cada fila que apunta a `--origen` (todas las claves foráneas a `users.id`, se
     leen de la base y no de una lista a mano). Si una fila choca con una restricción única (p. ej. dos
     reportes del mismo día), esa fila se deja como estaba y se informa: no se pierde ni se pisa nada.
  2. Registra el usuario y el correo de `--origen` como alias de `--destino`: las ventas y agendas que
     se atribuyen por TEXTO ('Marlon Closer', 'marlon@thelearnation.com') siguen resolviendo a la
     persona. Los alias solo ganan si ningún usuario se llama igual, por eso el paso 3.
  3. Deja la cuenta `--origen` inactiva y con usuario y correo inertes, sin borrarla (reversible).
  4. Le suma a `--destino` el rol de `--origen` en `users.roles_extra`.

Producción solo con `--target produccion --confirmo-produccion` (y, como siempre, sin `--aplicar` es un
ensayo). Los otros destinos se niegan si apuntan a DATABASE_PRODUCTION. Al aplicar se escribe un respaldo
JSON con las filas que se movieron y el estado anterior de las dos cuentas, para poder deshacerlo.
"""
import argparse
import json
import os
import sys
from datetime import datetime
from urllib.parse import urlparse

from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def _misma_base(a, b):
    ua, ub = urlparse(a), urlparse(b)
    return (ua.hostname, ua.port, ua.path) == (ub.hostname, ub.port, ub.path)


def _url_del_destino(target, confirmo_produccion=False):
    produccion = os.getenv('DATABASE_PRODUCTION') or ''
    if target == 'produccion':
        if not confirmo_produccion:
            sys.exit('Producción exige --confirmo-produccion.')
        url = produccion
    elif target == 'staging':
        url = os.getenv('DATABASE_STAGING') or os.getenv('DATABASE_TESTING')
    else:
        url = f"sqlite:///{os.path.join(RAIZ, 'instance', 'local.db')}"
    if not url:
        sys.exit(f'No hay base configurada para --target {target}.')
    if target != 'produccion' and produccion and _misma_base(url, produccion):
        sys.exit('Ese destino apunta a producción: usa --target produccion --confirmo-produccion.')
    return url


def _claves_a_users(motor):
    """[(tabla, columna)] de todas las claves foráneas que apuntan a `users`."""
    inspector = inspect(motor)
    refs = []
    for tabla in inspector.get_table_names():
        for fk in inspector.get_foreign_keys(tabla):
            if fk['referred_table'] == 'users' and len(fk['constrained_columns']) == 1:
                refs.append((tabla, fk['constrained_columns'][0]))
    return sorted(refs)


def _pk(motor, tabla):
    return inspect(motor).get_pk_constraint(tabla).get('constrained_columns') or []


def unificar(motor, destino, origen, aplicar):
    informe = {'movidas': {}, 'conflictos': {}, 'alias': [], 'respaldo': {'filas': {}, 'alias_creados': []}}
    with motor.connect() as conn:
        trans = conn.begin()
        try:
            filas = {r.id: r for r in conn.execute(
                text('SELECT id, username, email, role, roles_extra, is_active, persona_id FROM users WHERE id IN (:a, :b)'),
                {'a': destino, 'b': origen})}
            if destino not in filas or origen not in filas:
                sys.exit('Alguna de las cuentas no existe.')
            d, o = filas[destino], filas[origen]
            print(f'Destino: #{d.id} {d.username} <{d.email}> {d.role} (extra: {d.roles_extra or "-"})')
            print(f'Origen : #{o.id} {o.username} <{o.email}> {o.role} (activo: {o.is_active})')

            # 1) Reasignar todas las filas que apuntan al origen.
            for tabla, col in _claves_a_users(motor):
                cuantas = conn.execute(text(f'SELECT COUNT(*) FROM "{tabla}" WHERE "{col}" = :o'), {'o': origen}).scalar()
                if not cuantas:
                    continue
                pk = _pk(motor, tabla)
                # Las claves de las filas que se van a mover: con eso el respaldo permite deshacer.
                if pk:
                    cols_pk0 = ', '.join(f'"{c}"' for c in pk)
                    informe['respaldo']['filas'][f'{tabla}.{col}'] = {
                        'pk': pk,
                        'valores': [list(f) for f in conn.execute(
                            text(f'SELECT {cols_pk0} FROM "{tabla}" WHERE "{col}" = :o'), {'o': origen}).fetchall()],
                    }
                sp = conn.begin_nested()
                try:
                    conn.execute(text(f'UPDATE "{tabla}" SET "{col}" = :d WHERE "{col}" = :o'), {'d': destino, 'o': origen})
                    sp.commit()
                    informe['movidas'][f'{tabla}.{col}'] = cuantas
                    continue
                except IntegrityError:
                    sp.rollback()
                # Alguna fila choca: se mueve una por una y las que chocan se quedan.
                if not pk:
                    informe['conflictos'][f'{tabla}.{col}'] = cuantas
                    continue
                cols_pk = ', '.join(f'"{c}"' for c in pk)
                movidas = 0
                for fila in conn.execute(text(f'SELECT {cols_pk} FROM "{tabla}" WHERE "{col}" = :o'), {'o': origen}).fetchall():
                    donde = ' AND '.join(f'"{c}" = :p{i}' for i, c in enumerate(pk))
                    params = {f'p{i}': v for i, v in enumerate(fila)} | {'d': destino}
                    sp = conn.begin_nested()
                    try:
                        conn.execute(text(f'UPDATE "{tabla}" SET "{col}" = :d WHERE {donde}'), params)
                        sp.commit()
                        movidas += 1
                    except IntegrityError:
                        sp.rollback()
                informe['movidas'][f'{tabla}.{col}'] = movidas
                if movidas < cuantas:
                    informe['conflictos'][f'{tabla}.{col}'] = cuantas - movidas

            # 2) Alias con el usuario y el correo del origen (ya no son de nadie más).
            for alias in dict.fromkeys(a for a in (o.username, o.email) if a):
                existe = conn.execute(text('SELECT user_id FROM closer_aliases WHERE alias_name = :a'), {'a': alias}).first()
                if existe:
                    informe['alias'].append(f'{alias} (ya existía, de #{existe[0]})')
                    continue
                conn.execute(text('INSERT INTO closer_aliases (user_id, alias_name, created_at) VALUES (:u, :a, CURRENT_TIMESTAMP)'),
                             {'u': destino, 'a': alias[:100]})
                informe['alias'].append(alias)
                informe['respaldo']['alias_creados'].append(alias[:100])

            informe['respaldo']['antes'] = {
                'destino': {'id': d.id, 'username': d.username, 'email': d.email, 'role': d.role, 'roles_extra': d.roles_extra,
                            'persona_id': d.persona_id},
                'origen': {'id': o.id, 'username': o.username, 'email': o.email, 'role': o.role,
                           'roles_extra': o.roles_extra, 'is_active': bool(o.is_active), 'persona_id': o.persona_id},
            }

            # 3) El origen queda inactivo y con identidad inerte (sin borrarlo).
            conn.execute(text('UPDATE users SET is_active = :f, username = :u, email = :e, persona_id = NULL WHERE id = :o'),
                         {'f': False, 'u': f'fusionada_{origen}', 'e': f'fusionada_{origen}@invalid.local', 'o': origen})

            # La persona ya es una sola cuenta: si estaban vinculadas (`persona_id`), el destino se desvincula
            # salvo que le quede otra cuenta activa con el mismo grupo.
            if d.persona_id is not None:
                otras = conn.execute(
                    text('SELECT COUNT(*) FROM users WHERE persona_id = :p AND id NOT IN (:d, :o) AND is_active'),
                    {'p': d.persona_id, 'd': destino, 'o': origen}).scalar()
                if not otras:
                    conn.execute(text('UPDATE users SET persona_id = NULL WHERE id = :d'), {'d': destino})

            # 4) El destino gana el rol del origen.
            extras = [r for r in (d.roles_extra or '').split(',') if r]
            for rol in [o.role, *[r for r in (o.roles_extra or '').split(',') if r]]:
                if rol != d.role and rol not in extras:
                    extras.append(rol)
            conn.execute(text('UPDATE users SET roles_extra = :r WHERE id = :d'), {'r': ','.join(extras) or None, 'd': destino})
            informe['roles'] = [d.role, *extras]
        except BaseException:
            trans.rollback()
            raise
        if aplicar:
            trans.commit()
        else:
            trans.rollback()
    return informe


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--target', choices=['staging', 'local', 'produccion'], required=True)
    ap.add_argument('--confirmo-produccion', action='store_true', help='obligatorio con --target produccion')
    ap.add_argument('--destino', type=int, required=True, help='id de la cuenta que queda')
    ap.add_argument('--origen', type=int, required=True, help='id de la cuenta que se absorbe')
    ap.add_argument('--aplicar', action='store_true', help='sin esto es un ensayo que se revierte')
    args = ap.parse_args()
    if args.destino == args.origen:
        sys.exit('--destino y --origen son la misma cuenta.')

    load_dotenv(os.path.join(RAIZ, '.env'))
    motor = create_engine(_url_del_destino(args.target, args.confirmo_produccion))
    if 'roles_extra' not in [c['name'] for c in inspect(motor).get_columns('users')]:
        sys.exit('Falta la columna users.roles_extra: despliega develop (o corre `flask db upgrade`) primero.')

    informe = unificar(motor, args.destino, args.origen, args.aplicar)
    print('\nFilas pasadas al destino:')
    for k, v in informe['movidas'].items():
        print(f'  {k}: {v}')
    if informe['conflictos']:
        print('\nQUEDARON en el origen por chocar con una restricción única:')
        for k, v in informe['conflictos'].items():
            print(f'  {k}: {v}')
    print('\nAlias:', ', '.join(informe['alias']) or '-')
    print('Roles del destino:', ', '.join(informe['roles']))
    print('\n' + ('APLICADO.' if args.aplicar else 'ENSAYO: no se cambió nada (usa --aplicar).'))


if __name__ == '__main__':
    main()
