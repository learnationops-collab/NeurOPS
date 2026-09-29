"""Aplica a lo que YA existe la regla "un lead no puede tener dos agendas el mismo día a
la misma hora".

Desde el 28/09/2026 esa regla se hace cumplir sola cuando entra una agenda nueva (ver
`agenda_dedup_service.reconciliar`, enganchado en el webhook de n8n, en el espejo de citas
y en la segunda llamada del closer). Este script es la pasada única sobre lo que quedó de
antes: el mismo cálculo, recorriendo las agendas ya cargadas.

Nada se borra. La fila que sobra se MARCA (`duplicada_de_id`) y se puede devolver una por
una desde el panel de Duplicados del libro de agendas.

Uso:
  python scripts/reconciliar_agendas_repetidas.py                      # dry-run
  python scripts/reconciliar_agendas_repetidas.py --apply              # escribe
  python scripts/reconciliar_agendas_repetidas.py --desde 2026-07-01   # acota el periodo

Hay que correrlo una vez por base de datos: producción tiene la suya.
"""
import argparse
import os
import sys

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

# `create_app()` arranca el scheduler de recordatorios, que manda WhatsApp reales apenas
# arranca el proceso. Este script se corre a mano contra producción, así que se apaga
# siempre (mismo criterio que scripts/backfill_show_up_por_venta.py).
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'

from app import create_app, db                              # noqa: E402
from app.models import FinancialAgenda                      # noqa: E402
from app.services import agenda_dedup_service as dedup      # noqa: E402


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--apply', action='store_true', help='escribe; sin esto solo muestra')
    p.add_argument('--desde', default='2026-01-01', help='YYYY-MM-DD, fecha de reunión mínima')
    return p.parse_args()


def main():
    args = parse_args()
    app = create_app()
    with app.app_context():
        agendas = (FinancialAgenda.query
                   .filter(FinancialAgenda.date >= args.desde,
                           FinancialAgenda.duplicada_de_id.is_(None))
                   .order_by(FinancialAgenda.created_at).all())
        modo = 'APLICANDO' if args.apply else 'DRY-RUN (no se escribió nada)'
        print(f"--- {len(agendas)} agendas vigentes desde {args.desde} · {modo} ---")

        # De la más nueva a la más vieja: al resolver un choque queremos que la fila que
        # sobra sea, en igualdad de condiciones, la que llegó después.
        marcadas = 0
        # En dry-run nada queda marcado en la base, así que cada par se evaluaría dos
        # veces —una desde cada fila— y el total saldría al doble. Este conjunto imita lo
        # que en el modo real hace el propio `duplicada_de_id` ya escrito.
        ya_resueltas = set()

        # `universo` hace que las hermanas se busquen en memoria sobre las filas ya
        # cargadas. Preguntando por cada agenda eran miles de viajes a la base y contra el
        # proxy público de Railway la conexión se caía a mitad del recorrido. Las reglas
        # son exactamente las mismas.
        for agenda in reversed(agendas):
            if agenda.duplicada_de_id is not None or agenda.id in ya_resueltas:
                continue  # ya la resolvió una vuelta anterior de este mismo bucle

            if not args.apply:
                # Mismo cálculo que el modo real, no una copia: `simular` devuelve las
                # decisiones sin escribirlas.
                for conservada, sobrante, motivo in dedup.reconciliar(
                        agenda, simular=True, universo=agendas):
                    if sobrante.id in ya_resueltas or conservada.id in ya_resueltas:
                        continue
                    ya_resueltas.add(sobrante.id)
                    tipo = 'misma hora' if 'misma hora' in motivo else 'reprogramación'
                    print(f"  {(agenda.lead or '')[:28]:<28} {tipo:<15} "
                          f"conserva #{conservada.id} ({conservada.date}) · marca #{sobrante.id}")
                    marcadas += 1
                continue

            for sobrante in dedup.reconciliar(agenda, universo=agendas):
                print(f"  {(agenda.lead or '')[:28]:<28} marcada #{sobrante.id} "
                      f"({sobrante.descartada_motivo})")
                marcadas += 1
                # Se commitea por cada marca y no una vez por agenda recorrida: así la
                # transacción dura lo que dura el cambio, y si la conexión se corta a
                # mitad (pasó contra el proxy de Railway) lo ya resuelto queda guardado y
                # volver a correrlo sigue desde ahí.
                db.session.commit()

        if args.apply:
            print(f"\nListo: {marcadas} agenda(s) marcadas como repetidas.")
            print("Se deshacen una por una desde el panel de Duplicados del libro de agendas.")
        else:
            print(f"\n{marcadas} agenda(s) se marcarían.")
            print("Para aplicarlo: python scripts/reconciliar_agendas_repetidas.py --apply")


if __name__ == '__main__':
    main()
