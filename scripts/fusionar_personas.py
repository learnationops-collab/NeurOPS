"""Frente A (docs/plan_personas.md): encuentra personas duplicadas (comparten un dato) y las fusiona
con `person_service.fusionar`.

Uso:
  python scripts/fusionar_personas.py                    # prueba: lista los grupos
  python scripts/fusionar_personas.py --apply            # fusiona los grupos por email e instagram
  python scripts/fusionar_personas.py --apply --telefono # también los de teléfono (revisalos antes)

Mismos resguardos que `ClientDedupService.find_duplicate_groups`: hace falta que el nombre sea
compatible (también con el email: hay gente que tipeó el mail de otro) y un dato que comparten más de
`MAX_POR_DATO` personas se ignora (es un placeholder o un número de pruebas, no un duplicado). El teléfono
solo se fusiona con --telefono, porque una familia puede compartir número. Queda la persona con más
filas vinculadas.
"""
import os
import sys
from collections import Counter, defaultdict

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app import create_app, db
from app.services import person_service
from app.services.attribution_service import UnionFind
from app.services.client_dedup_service import _names_compatible
from personas_indice import IndicePersonas

MAX_POR_DATO = 2
EJEMPLOS = 15
# Para elegir la que queda: cuántas filas apuntan a cada persona.
TABLAS_PESO = ('financial_sales', 'appointments', 'financial_agendas', 'sales', 'enrollments', 'subscriptions')


def _gmail(email):
    usuario, _, dominio = email.partition('@')
    usuario = usuario.split('+')[0]
    return (usuario.replace('.', '') if dominio in ('gmail.com', 'googlemail.com') else usuario) + '@' + dominio


def _peso():
    peso = Counter()
    for tabla in TABLAS_PESO:
        for uuid, n in db.session.execute(db.text(
                f'SELECT person_uuid, count(*) FROM {tabla} WHERE person_uuid IS NOT NULL GROUP BY person_uuid')):
            peso[uuid] += n
    return peso


def grupos(con_telefono):
    indice = IndicePersonas()
    nombre = lambda u: indice.personas[u].full_name  # noqa: E731
    uf, uniones = UnionFind(), []
    for (kind, value), uuids in indice.duenos.items():
        if kind == 'phone' and not con_telefono:
            continue
        if len(uuids) < 2 or len(uuids) > MAX_POR_DATO:
            continue
        a, b = sorted(uuids)
        if _names_compatible(nombre(a), nombre(b)):
            uf.union(a, b)
            uniones.append((a, f'{kind}={value}'))
    por_raiz = defaultdict(set)
    miembros = {u for (_, _), us in indice.duenos.items() for u in us}
    for u in miembros:
        por_raiz[uf.find(u)].add(u)
    motivo = {}
    for a, m in uniones:
        motivo.setdefault(uf.find(a), m)
    resultado = [(sorted(g), motivo.get(r, '')) for r, g in por_raiz.items() if len(g) > 1]
    # Solo para revisar: el mismo gmail escrito con puntos o +etiqueta.
    variantes = defaultdict(set)
    for (kind, value), uuids in indice.duenos.items():
        if kind == 'email':
            variantes[_gmail(value)] |= uuids
    return resultado, [sorted(u) for u in variantes.values() if len(u) > 1], indice


def ejecutar(apply=False, con_telefono=False):
    resultado, variantes, indice = grupos(con_telefono)
    telefono_solo = [] if con_telefono else grupos(True)[0]
    print(f'grupos a fusionar: {len(resultado)} ({sum(len(g) - 1 for g, _ in resultado)} personas de más)')
    print(f'  por qué dato: {dict(Counter(m.split("=")[0] for _, m in resultado))}')
    for g, m in resultado[:EJEMPLOS]:
        print(f'   {m}: {[indice.personas[u].full_name for u in g]} {g}')
    if not con_telefono:
        extra = len(telefono_solo) - len(resultado)
        print(f'con --telefono se sumarían unos {max(0, extra)} grupos más (revisarlos a mano antes)')
    print(f'mismo gmail con puntos o +etiqueta (solo para revisar): {len(variantes)} grupos')

    if not apply:
        print('\n[PRUEBA] No se fusionó nada. Corré con --apply para fusionar.')
        return {'grupos': len(resultado), 'variantes': len(variantes)}
    peso = _peso()
    for g, m in resultado:
        queda = max(g, key=lambda u: (peso[u], -g.index(u)))
        person_service.fusionar(queda, [u for u in g if u != queda], f'Duplicado ({m})')
    print(f'\nAplicado: {len(resultado)} grupos fusionados.')
    return {'grupos': len(resultado), 'variantes': len(variantes)}


if __name__ == '__main__':
    with create_app().app_context():
        ejecutar(apply='--apply' in sys.argv, con_telefono='--telefono' in sys.argv)
