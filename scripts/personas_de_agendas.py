"""Frente D (docs/plan_personas.md): las agendas viejas que siguen sin persona después de
scripts/vincular_personas.py son gente que agendó y nunca quedó como cliente. La agenda es el primer
contacto: se les busca o se les crea su persona, con las mismas reglas que las agendas nuevas
(`person_service`, en before_flush).

Uso (después de los scripts del frente A):
  python scripts/personas_de_agendas.py            # prueba: cuántas tienen datos para identificarlas
  python scripts/personas_de_agendas.py --apply    # les crea o encuentra su persona

Las que no traen ningún dato (mail, instagram o whatsapp) quedan sin persona: no se sabe quién es.
"""
import os
import sys
from collections import Counter

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import FinancialAgenda
from app.services import person_service

LOTE = 200


def ejecutar(apply=False):
    agendas = FinancialAgenda.query.filter(FinancialAgenda.person_uuid.is_(None)).order_by(FinancialAgenda.id).all()
    cuenta = Counter()
    for i, agenda in enumerate(agendas, 1):
        datos = dict(email=agenda.mail, instagram=agenda.instagram, phone=agenda.whatsapp)
        if not person_service.claves(**datos):
            cuenta['sin datos'] += 1
            continue
        encontrada = person_service.buscar(agenda.nombre_persona, **datos)
        cuenta['ya tenía persona' if encontrada else 'persona nueva'] += 1
        if apply:
            agenda.person = encontrada or person_service.resolver(agenda.nombre_persona, fuente='agenda', **datos)
            if i % LOTE == 0:
                db.session.commit()
    print(f'agendas sin persona: {len(agendas)} -> {dict(cuenta)}')
    if not apply:
        db.session.rollback()
        print('\n[PRUEBA] No se escribió nada. Corré con --apply para guardar.')
        return dict(cuenta)
    db.session.commit()
    print('\nAplicado.')
    return dict(cuenta)


if __name__ == '__main__':
    with create_app().app_context():
        ejecutar(apply='--apply' in sys.argv)
