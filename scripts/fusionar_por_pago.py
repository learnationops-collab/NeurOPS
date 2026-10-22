"""Personas duplicadas que un pago delata (docs/plan_personas.md): el mail copiado en el pago es de una
persona Q, pero el pago quedó en otra persona P (o el cliente del pago, por `client_id`, es de otra), y las
dos tienen un nombre compatible entre sí y con el de la copia (`person_service.mismo_nombre`). Lo mismo con el
instagram, y con los datos que el cliente de Q tiene en sus columnas aunque no sean identidades de Q. Un
mail mal escrito (no es un mail válido) cuenta solo si es el mismo texto y P y Q se llaman exactamente
igual. El teléfono no cuenta: une a familias y a quien agenda por otros. Con el criterio
estricto de J, el cliente de Q deja de ver ese pago: fusionándolas, lo vuelve a ver.

Solo lista: escribe los grupos en el formato de `scripts/fusionar_lista.py` (una línea por grupo, con
`?`, queda la persona con pagos), que es quien fusiona.

Uso:
  python scripts/fusionar_por_pago.py [--salida grupos.txt] [--excluir excluidos.txt]
`--excluir`: un archivo con uuid (uno o varios por línea) de grupos que no se fusionan por decisión de
Santiago (por ejemplo Javier Duarte Moreno / Juan Moreno); un grupo que toque alguno queda afuera.
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
from app.models import Client, FinancialSale, Person, PersonIdentity
from app.services.client_dedup_service import _normalize_name
from app.services.person_service import mismo_nombre, normalizar

RECIENTES = datetime(2026, 5, 20)


def _arg(nombre):
    return sys.argv[sys.argv.index(nombre) + 1] if nombre in sys.argv else None


def main(salida, excluir):
    nombre = dict(db.session.query(Person.uuid, Person.full_name).filter(Person.merged_into_uuid.is_(None)))
    # También los mails «para revisar» (review_note: compartidos con alguien de otro nombre): justo así
    # suele quedar el mail de una persona duplicada. Los grupos que salen por uno se marcan.
    duenos, a_revisar = defaultdict(set), set()
    for pu, valor, nota in db.session.query(PersonIdentity.person_uuid, PersonIdentity.value, PersonIdentity.review_note).filter(
            PersonIdentity.kind == 'email', PersonIdentity.retired_at.is_(None)):
        if pu in nombre:
            duenos[valor].add(pu)
            if nota:
                a_revisar.add((pu, valor))
    # Las columnas del cliente (doble escritura): un dato que el cliente tiene ahí y su persona no tiene como
    # identidad también lo reconoce.
    persona_del_cliente, por_dato = {}, defaultdict(set)   # (kind, valor) -> {persona}
    crudos = defaultdict(set)                               # mail mal escrito, tal cual -> {persona}
    for cid, pu, email, ig in db.session.query(Client.id, Client.person_uuid, Client.email, Client.instagram):
        persona_del_cliente[cid] = pu
        if pu not in nombre:
            continue
        for kind, valor in (('email', email), ('instagram', ig)):
            if normalizar(kind, valor):
                por_dato[(kind, normalizar(kind, valor))].add(pu)
        if email and not normalizar('email', email):
            crudos[email.strip().lower()].add(pu)
    for pu, kind, valor in db.session.query(PersonIdentity.person_uuid, PersonIdentity.kind, PersonIdentity.value).filter(
            PersonIdentity.kind == 'instagram', PersonIdentity.retired_at.is_(None)):
        if pu in nombre:
            por_dato[(kind, valor)].add(pu)
    for (valor), us in duenos.items():
        por_dato[('email', valor)] |= us

    padre, pagos, por_nota, regla = {}, defaultdict(list), set(), defaultdict(set)

    def raiz(x):
        padre.setdefault(x, x)
        while padre[x] != x:
            padre[x] = padre[padre[x]]
            x = padre[x]
        return x

    def unir(x, q, v, motivo):
        padre[raiz(x)] = raiz(q)
        pagos[frozenset((x, q))].append(v)
        regla[frozenset((x, q))].add(motivo)

    for v in FinancialSale.query.filter(FinancialSale.person_uuid.isnot(None)).yield_per(1000):
        donde = {v.person_uuid, persona_del_cliente.get(v.client_id)} - {None}
        # 1. El mail o el instagram del pago es de otra persona (identidad o columna de su cliente) y las dos
        #    tienen un nombre compatible con el de la copia. El teléfono no: una familia lo comparte.
        for kind, crudo in (('email', v.mail_cliente), ('instagram', v.instagram)):
            valor = normalizar(kind, crudo)
            for q in por_dato.get((kind, valor), ()) if valor else ():
                for x in donde - {q}:
                    if x in nombre and mismo_nombre(nombre[q], nombre[x]) and mismo_nombre(nombre[q], v.nombre_cliente) \
                            and mismo_nombre(nombre[x], v.nombre_cliente):
                        unir(x, q, v, 'mail' if kind == 'email' else 'instagram')
                        if (q, valor) in a_revisar:
                            por_nota.add(q)
        # 2. El mismo mail mal escrito (no es un mail válido, pero es el mismo texto) en el pago y en un
        #    cliente de otra persona, y las dos se llaman exactamente igual.
        crudo = (v.mail_cliente or '').strip().lower()
        if crudo and not normalizar('email', crudo):
            for q in crudos.get(crudo, ()):
                for x in donde - {q}:
                    if x in nombre and _normalize_name(nombre[q]) == _normalize_name(nombre[x]):
                        unir(x, q, v, 'mail_mal_escrito')

    grupos = defaultdict(set)
    for u in list(padre):
        grupos[raiz(u)].add(u)
    excluidos = set()
    if excluir:
        excluidos = {u.strip().lower() for linea in open(excluir, encoding='utf-8') for u in linea.split()
                     if not linea.startswith('#')}
    lineas, afuera = [], []
    for g in sorted(grupos.values(), key=lambda g: sorted(g)):
        suyos = list({v.id: v for par, vs in pagos.items() if par <= g for v in vs}.values())
        motivos = sorted({m for par, ms in regla.items() if par <= g for m in ms})
        fechas = [v.date for v in suyos if v.date]
        reciente = any(f >= RECIENTES for f in fechas)
        detalle = (f'{len(suyos)} pagos, ${sum(float(v.monto or 0) for v in suyos):,.2f}, '
                   f'{min(fechas):%Y-%m-%d} a {max(fechas):%Y-%m-%d}' if fechas else f'{len(suyos)} pagos')
        print(f'{" | ".join(f"{u} {nombre.get(u)!r}" for u in sorted(g))}  ({detalle}; por {"+".join(motivos)})'
              + ('  DESDE EL 20/05/2026' if reciente else '') + ('  (por un mail para revisar)' if g & por_nota else ''))
        if g & excluidos:
            afuera.append(g)
            continue
        lineas.append('? ' + ' '.join(sorted(g)))
    print(f'\n{len(grupos)} grupos ({len(afuera)} excluidos), {sum(len(g) - 1 for g in grupos.values())} personas de más')
    if salida:
        with open(salida, 'w', encoding='utf-8') as f:
            f.write('# fusionar_por_pago: personas duplicadas que un pago delata\n' + '\n'.join(lineas) + '\n')
        print(f'Escrito {salida}: {len(lineas)} grupos. Fusionar con scripts/fusionar_lista.py (modo prueba antes).')


if __name__ == '__main__':
    with create_app().app_context():
        main(_arg('--salida'), _arg('--excluir'))
