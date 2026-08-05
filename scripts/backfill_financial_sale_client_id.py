"""Backfill de FinancialSale.client_id para ventas históricas que se guardaron antes de
que la columna existiera. Resuelve/crea el Client con la misma lógica de identidad que ya
usa el resto del sistema (BookingService.create_or_update_client), en vez de dejar la
agrupación por cliente librada a coincidencias de texto libre en cada consulta.

Uso:
  python scripts/backfill_financial_sale_client_id.py            # dry-run: solo cuenta, no toca client_id
  python scripts/backfill_financial_sale_client_id.py --apply    # aplica los cambios (setea client_id)

Nota: BookingService.create_or_update_client hace commit por su cuenta al crear/actualizar
un Client (mismo comportamiento que en el resto del sistema), así que incluso el modo
dry-run puede crear o completar filas de Client si no existían — lo único que NO hace sin
--apply es escribir FinancialSale.client_id.
"""
import os
import sys

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import FinancialSale
from app.services.booking_service import BookingService


def backfill(apply=False):
    app = create_app()
    with app.app_context():
        sales = FinancialSale.query.filter(FinancialSale.client_id == None).all()
        print(f"--- FinancialSale sin client_id: {len(sales)} ---")

        resolved = 0
        skipped = 0
        for sale in sales:
            client = BookingService.create_or_update_client({
                'name': sale.nombre_cliente,
                'email': sale.mail_cliente,
                'instagram': sale.instagram,
                'phone': sale.telefono,
            })
            if not client:
                skipped += 1
                continue
            resolved += 1
            if apply:
                sale.client_id = client.id

        if apply:
            db.session.commit()
            print(f"Aplicado: {resolved} ventas vinculadas a un Client, {skipped} sin datos suficientes para resolver.")
        else:
            print(f"[DRY-RUN] Se vincularían {resolved} ventas, {skipped} quedarían sin client_id. Corré con --apply para guardar.")


if __name__ == '__main__':
    backfill(apply='--apply' in sys.argv)
