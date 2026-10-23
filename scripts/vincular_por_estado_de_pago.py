"""Vincula con la Academia a los clientes con ventas o cuotas cuya persona todavía no tiene su id de alumno
(23/10/2026). Es el mismo aviso de estado de pago de siempre: la Academia encuentra al alumno (por el uuid de
la persona, el id del cliente o el email), le guarda el work_uuid y responde su user_id, que queda en la persona
(`academy_payment_status.guardar_alumno`). Se puede correr de nuevo: los ya vinculados se saltean.

Uso:
  python scripts/vincular_por_estado_de_pago.py            # prueba: lista a quiénes les mandaría el aviso
  python scripts/vincular_por_estado_de_pago.py --apply    # manda los avisos y guarda los ids
"""
import os
import sys
import time

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db  # noqa: E402
from app.models import Client, FinancialSale, InstallmentPlan, PersonIdentity  # noqa: E402

# La API de la Academia acepta 60 pedidos por minuto, compartidos con producción.
PAUSA_S = 1.5


def candidatos():
    con_algo = {cid for (cid,) in db.session.query(InstallmentPlan.client_id)
                .filter(InstallmentPlan.client_id.isnot(None))}
    con_algo |= {cid for (cid,) in db.session.query(FinancialSale.client_id)
                 .filter(FinancialSale.client_id.isnot(None), FinancialSale.estado == 'Completada')}
    vinculadas = {u for (u,) in db.session.query(PersonIdentity.person_uuid)
                  .filter(PersonIdentity.kind == 'learnation_user_id', PersonIdentity.retired_at.is_(None))}
    return [c for c in Client.query.filter(Client.id.in_(con_algo)).order_by(Client.id).all()
            if c.person_uuid and c.person_uuid not in vinculadas]


def ejecutar(apply=False):
    from app.services.academy_payment_status import estado, guardar_alumno
    from app.services.learnation_service import LearnationAPIError, LearnationService

    lista = candidatos()
    print(f'{len(lista)} clientes con ventas o cuotas sin id de alumno.')
    cuenta = {}
    for c in lista:
        if not apply:
            print(f'  {c.id} {c.full_name!r} ({c.person_uuid[:8]})')
            continue
        try:
            respuesta = LearnationService.report_payment_status(estado(c))
            resultado = guardar_alumno({'work_client_id': c.id}, respuesta) or 'sin user_id'
        except LearnationAPIError as e:
            resultado = f'la Academia respondió {e.status_code}'
        cuenta[resultado] = cuenta.get(resultado, 0) + 1
        print(f'  {c.id} {c.full_name!r}: {resultado}')
        time.sleep(PAUSA_S)
    if apply:
        print(f'\nAplicado: {cuenta}')
    else:
        print('\n[PRUEBA] No se mandó nada. Corré con --apply para mandar los avisos y guardar los ids.')


if __name__ == '__main__':
    app = create_app()
    with app.app_context():
        ejecutar(apply='--apply' in sys.argv)
