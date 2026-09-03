"""Reporte de solo lectura: citas (Appointment) duplicadas del mismo cliente.

Pedido del usuario: el show up calculado en el dashboard (cuenta filas de Appointment,
ver CloserService._stats_from_bandeja) no cuadra con el conteo manual del closer, y la
sospecha es que hay agendas duplicadas del mismo lead que se están contando por separado.

Este script NO modifica nada. Agrupa las citas por cliente y busca pares que caen dentro
de una ventana de horas entre sí (mismo criterio de "mismo evento" que usa la
sincronización FinancialAgenda <-> Appointment en booking_service.py, ventanas de 12/36h),
y muestra el estado de cada una para que se pueda decidir cuál conservar.

Uso:
  python scripts/reporte_agendas_duplicadas.py                       # todo el historial
  python scripts/reporte_agendas_duplicadas.py --closer NOMBRE       # filtra por closer
  python scripts/reporte_agendas_duplicadas.py --start 2026-08-01 --end 2026-08-31
  python scripts/reporte_agendas_duplicadas.py --ventana-horas 6     # ventana más estricta
"""
import argparse
import os
import sys
from collections import defaultdict
from datetime import datetime

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app
from app.models import Appointment, Client, User


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--closer', default=None, help='Username del closer (filtra)')
    p.add_argument('--start', default=None, help='YYYY-MM-DD, filtra por start_time >=')
    p.add_argument('--end', default=None, help='YYYY-MM-DD, filtra por start_time <=')
    p.add_argument('--ventana-horas', type=float, default=12.0,
                    help='Distancia máxima entre dos citas del mismo cliente para considerarlas '
                         'la misma agenda duplicada (default 12h, igual que la sincronización)')
    return p.parse_args()


def main():
    args = parse_args()
    app = create_app()
    with app.app_context():
        q = Appointment.query
        if args.closer:
            closer_user = User.query.filter_by(username=args.closer).first()
            if not closer_user:
                print(f"No se encontró closer con username={args.closer!r}")
                return
            q = q.filter(Appointment.closer_id == closer_user.id)
        if args.start:
            q = q.filter(Appointment.start_time >= datetime.strptime(args.start, '%Y-%m-%d'))
        if args.end:
            end_dt = datetime.strptime(args.end, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            q = q.filter(Appointment.start_time <= end_dt)

        appts = q.filter(Appointment.client_id.isnot(None), Appointment.start_time.isnot(None)) \
                  .order_by(Appointment.client_id, Appointment.start_time).all()

        by_client = defaultdict(list)
        for a in appts:
            by_client[a.client_id].append(a)

        client_cache = {c.id: c for c in Client.query.filter(Client.id.in_(by_client.keys())).all()}
        closer_cache = {u.id: u.username for u in User.query.all()}

        ventana = args.ventana_horas * 3600
        grupos_duplicados = []

        for client_id, lista in by_client.items():
            lista.sort(key=lambda a: a.start_time)
            grupo_actual = [lista[0]]
            for prev, cur in zip(lista, lista[1:]):
                if (cur.start_time - prev.start_time).total_seconds() <= ventana:
                    grupo_actual.append(cur)
                else:
                    if len(grupo_actual) > 1:
                        grupos_duplicados.append((client_id, grupo_actual))
                    grupo_actual = [cur]
            if len(grupo_actual) > 1:
                grupos_duplicados.append((client_id, grupo_actual))

        if not grupos_duplicados:
            print(f"Sin duplicados detectados (ventana {args.ventana_horas}h).")
            return

        total_citas_duplicadas = sum(len(g) for _, g in grupos_duplicados)
        # "Show up" contado de más: por cada grupo, todas las filas menos una son sobrantes
        # SI todas (o más de una) están marcadas Show up.
        show_up_de_mas = 0
        show_up_inconsistentes = 0

        print(f"--- Agendas duplicadas por cliente · ventana {args.ventana_horas}h ---")
        print(f"Grupos con duplicados: {len(grupos_duplicados)} | citas involucradas: {total_citas_duplicadas}\n")

        for client_id, grupo in sorted(grupos_duplicados, key=lambda g: g[1][0].start_time):
            cliente = client_cache.get(client_id)
            nombre = cliente.full_name if cliente else f"(cliente #{client_id})"
            show_ups_en_grupo = sum(1 for a in grupo if (a.closer_result or '').strip().lower() == 'show up')
            if show_ups_en_grupo > 1:
                show_up_de_mas += show_ups_en_grupo - 1
            resultados_distintos = {(a.closer_result or 'Pendiente') for a in grupo}
            if len(resultados_distintos) > 1:
                show_up_inconsistentes += 1

            print(f"Cliente: {nombre} (id {client_id})")
            for a in grupo:
                closer_name = closer_cache.get(a.closer_id, '?')
                print(f"    appt {a.id:>6} | {a.start_time.isoformat(sep=' ', timespec='minutes')} | "
                      f"closer={closer_name:<15} | result={a.result!r:<15} closer_result={a.closer_result!r}")
            print()

        print("--- Resumen ---")
        print(f"Show up de más por duplicados (infla el dashboard): {show_up_de_mas}")
        print(f"Grupos con estados post-call inconsistentes entre duplicados: {show_up_inconsistentes}")
        print("\nEste script no modificó nada. Revisá cada grupo y decidí a mano cuál cita conservar")
        print("(o pedime que arme un script de fusión/borrado una vez que confirmes el criterio).")


if __name__ == '__main__':
    main()
