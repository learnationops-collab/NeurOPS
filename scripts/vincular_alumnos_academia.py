"""Vincula alumnos de la Academia con su persona de Work cuando el cruce automático se equivoca
(docs/plan_personas.md, 22/10/2026): el mail del alumno quedó en la ficha de otra persona (el closer lo
cargó mal, o pagó otro), o el alumno se registró con un mail que Work no tiene.

El archivo es una lista JSON de {"alumno": <id de la Academia>, "persona": "<uuid>", "mail": "<mail del
alumno>", "motivo": "..."}. Por cada uno: el id de alumno y el mail pasan a esa persona; si otra persona
los tenía, se le dan de baja (`person_service.retirar`). Así `backfill_subscriptions` y los avisos de la
Academia encuentran a la persona correcta. Se puede correr dos veces.

Uso:
  python scripts/vincular_alumnos_academia.py vinculos.json            # prueba
  python scripts/vincular_alumnos_academia.py vinculos.json --apply    # guarda
"""
import json
import os
import sys

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Person
from app.services import person_service, system_log_service


def _vigente(person):
    vistos = set()
    while person is not None and person.merged_into_uuid and person.uuid not in vistos:
        vistos.add(person.uuid)
        person = db.session.get(Person, person.merged_into_uuid)
    return person


def ejecutar(archivo, apply=False):
    vinculos = json.load(open(archivo, encoding='utf-8'))
    for v in vinculos:
        destino = _vigente(person_service.por_uuid(v['persona']))
        if destino is None:
            print(f"  alumno {v['alumno']}: la persona {v['persona']} no existe; se saltea")
            continue
        pares = [('learnation_user_id', str(v['alumno']))] + ([('email', v['mail'])] if v.get('mail') else [])
        print(f"  alumno {v['alumno']} -> {destino.full_name!r} ({destino.uuid[:8]}): {v.get('motivo', '')}")
        for kind, valor in pares:
            valor = person_service.normalizar(kind, valor)
            for otro in person_service.duenos(kind, valor):
                if otro != destino.uuid:
                    otra = person_service.por_uuid(otro)
                    print(f'      se le da de baja {kind}={valor} a {otra.full_name!r} ({otro[:8]})')
                    if apply:
                        person_service.retirar(otra, kind, valor, reason=f"Es del alumno {v['alumno']}: {v.get('motivo', '')}"[:255])
        if apply:
            person_service.anotar(destino, pares, 'academia')
            system_log_service.registrar(f"Alumno {v['alumno']} vinculado a su persona",
                                         v.get('motivo'), entity_type='person', entity_id=destino.uuid)
    if apply:
        db.session.commit()
        print(f'\nAplicado: {len(vinculos)} vínculos.')
    else:
        print('\n[PRUEBA] No se guardó nada. Corré con --apply para guardar.')


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        ejecutar(sys.argv[1], apply='--apply' in sys.argv)
