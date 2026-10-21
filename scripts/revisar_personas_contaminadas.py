"""Frente J (docs/plan_personas.md): personas cuyo nombre (`people.full_name`) probablemente no es el de
quien es. Solo lee y lista: no corrige nada.

Motivos:
  plantilla        el nombre es de prueba, de plantilla o genérico ("Prueba", "Test", "{{full_name}}",
                   "Sin nombre", "Sesión de ...")
  nombre_de_agenda el nombre es el del campo `nombre` de sus agendas (a veces es el del setter o un
                   rótulo como "Reagenda Jean Carlo") y no el del lead (`lead`)
  minoria          la mayoría de los nombres de sus pagos, agendas y clientes no es compatible con el suyo
                   (`person_service.mismo_nombre`)

Uso: python scripts/revisar_personas_contaminadas.py [--todas]   # sin --todas, las 150 de más plata
"""
import os
import re
import sys
from collections import Counter, defaultdict

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Client, FinancialAgenda, FinancialSale, Person
from app.services.client_dedup_service import _GENERIC_NAMES, _normalize_name
from app.services.person_service import mismo_nombre

LIMITE = 150
PLANTILLA = re.compile(r'\b(prueba|test|testing|demo|reagenda|reagendar|copy|sesion de|sesión de)\b|\{\{|^lead\b',
                       re.IGNORECASE)


def _es_plantilla(nombre):
    n = _normalize_name(nombre)
    return not n or n in _GENERIC_NAMES or bool(PLANTILLA.search(nombre or ''))


def main(todas=False):
    personas = {u: n for u, n in db.session.query(Person.uuid, Person.full_name)
                .filter(Person.merged_into_uuid.is_(None))}
    nombres = defaultdict(Counter)        # persona -> {nombre de sus filas: veces}
    de_agenda = defaultdict(Counter)      # persona -> {FinancialAgenda.nombre: veces}
    pagos, plata = Counter(), Counter()
    for pu, nombre, monto in db.session.query(FinancialSale.person_uuid, FinancialSale.nombre_cliente,
                                              FinancialSale.monto).filter(FinancialSale.person_uuid.isnot(None)):
        pagos[pu] += 1
        plata[pu] += float(monto or 0)
        if _normalize_name(nombre):
            nombres[pu][nombre.strip()] += 1
    for pu, lead, nombre in db.session.query(FinancialAgenda.person_uuid, FinancialAgenda.lead,
                                             FinancialAgenda.nombre).filter(FinancialAgenda.person_uuid.isnot(None)):
        if _normalize_name(lead):
            nombres[pu][lead.strip()] += 1
        if _normalize_name(nombre):
            de_agenda[pu][nombre.strip()] += 1
    for pu, nombre in db.session.query(Client.person_uuid, Client.full_name).filter(Client.person_uuid.isnot(None)):
        if _normalize_name(nombre):
            nombres[pu][nombre.strip()] += 1

    filas, motivos = [], Counter()
    for pu, full_name in personas.items():
        votos = nombres.get(pu, Counter())
        total = sum(votos.values())
        compatibles = sum(n for nombre, n in votos.items() if mismo_nombre(full_name, nombre))
        mayoria = votos.most_common(1)[0][0] if votos else None
        razones = []
        if _es_plantilla(full_name):
            razones.append('plantilla')
        en_agenda = _normalize_name(full_name) in {_normalize_name(n) for n in de_agenda.get(pu, ())}
        if en_agenda and not any(_normalize_name(full_name) == _normalize_name(n) for n in votos):
            razones.append('nombre_de_agenda')
        if total >= 2 and compatibles * 2 < total:
            razones.append('minoria')
        if not razones:
            continue
        motivos.update(razones)
        filas.append((plata[pu], pu, full_name, razones, mayoria, compatibles, total, pagos[pu]))

    print(f'Personas activas: {len(personas)}; para revisar: {len(filas)}')
    for motivo in ('plantilla', 'nombre_de_agenda', 'minoria'):
        print(f'  {motivo:17} {motivos[motivo]:5}')
    con_pagos = [f for f in filas if f[7]]
    print(f'  con pagos: {len(con_pagos)} personas, ${sum(f[0] for f in con_pagos):,.2f}')

    filas.sort(key=lambda f: (-f[0], f[2] or ''))
    print(f'\n{"plata":>10} {"pagos":>5}  persona / nombre  ->  el nombre de la mayoría de sus filas (compatibles/total)  motivos')
    for monto, pu, full_name, razones, mayoria, compatibles, total, n in (filas if todas else filas[:LIMITE]):
        print(f'{monto:10,.0f} {n:5}  {pu} {full_name!r} -> {mayoria!r} ({compatibles}/{total})  {",".join(razones)}')
    if not todas and len(filas) > LIMITE:
        print(f'... {len(filas) - LIMITE} más (--todas para verlas)')


if __name__ == '__main__':
    with create_app().app_context():
        main(todas='--todas' in sys.argv)
