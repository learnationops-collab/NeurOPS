"""Registra un pago histórico (de un lead viejo) directamente en la base de datos local,
SIN disparar ninguna automatización — no dispara el webhook de n8n hacia Discord, no hace
POST a Google Sheets, no dispara la notificación de "seña convertida a venta". Es solo para
que los datos de FinancialSale/Enrollment/Payment de un lead viejo queden consistentes con lo
que realmente pasó (ej. un pago que se cerró por fuera del sistema hace meses y nunca se
registró en el CRM), de forma que el resto del sistema (SalesConsistencyService — el que
decide qué tipos de pago están permitidos a continuación, como Renovación/Upsell/Cuota) lo
tenga en cuenta.

Caso que originó este script: un closer no podía registrar una Renovación para un lead que
pagó Completo en enero porque ese pago nunca quedó como fila de FinancialSale — el lead se
había cerrado fuera del flujo normal del CRM (visible en Discord, pero nunca declarado acá).

Uso:
  # Dry-run (no escribe nada, solo muestra qué se crearía y si la secuencia de pagos lo permite):
  python scripts/registrar_pago_historico.py --client-id 3276 --programa AL --tipo completo \
      --monto 1000 --fecha 2026-01-16 --metodo Stripe --closer jeancarlo@thelearnation.com

  # Aplicar de verdad:
  python scripts/registrar_pago_historico.py --client-id 3276 --programa AL --tipo completo \
      --monto 1000 --fecha 2026-01-16 --metodo Stripe --closer jeancarlo@thelearnation.com --apply

  # Si la secuencia de pagos normal lo bloquearía (ej. ya hay una Cuota registrada después en el
  # tiempo pero el Completo original nunca se guardó) y estás seguro de que el pago histórico es
  # correcto igual, se puede forzar:
  python scripts/registrar_pago_historico.py ... --apply --force

Requiere --client-id (no crea clientes nuevos a propósito — esto es para mantener actualizado
un lead que ya existe en el sistema, no para dar de alta gente nueva; si el cliente no existe,
usa el flujo normal de agendamiento/Declarar Venta).
"""
import argparse
import os
import sys
from datetime import datetime

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db

TIPO_LABELS = {
    'completo': 'Completo',
    'parcial': 'Parcial',
    'seña': 'Seña',
    'sena': 'Seña',
    'cuota': 'Cuota',
    'renovacion': 'Renovación',
    'renovación': 'Renovación',
    'upsell': 'Upsell',
}


def registrar_pago_historico(client_id, program_code, tipo_pago_simple, monto, fecha=None,
                              metodo_pago=None, examen=None, closer_email=None, setter=None,
                              instagram=None, telefono=None, email=None, nombre_cliente=None,
                              apply=False, force=False):
    app = create_app()
    with app.app_context():
        from app.models import Client, FinancialSale, PaymentMethod, User
        from app.services.sales_consistency_service import SalesConsistencyService
        from app.services.sheets_service import SheetsService

        program_code = (program_code or '').strip().upper()
        tipo_key = (tipo_pago_simple or '').strip().lower()
        tipo_label = TIPO_LABELS.get(tipo_key)

        if not tipo_label:
            print(f"[ERROR] Tipo de pago inválido: {tipo_pago_simple!r}. Opciones: {sorted(set(TIPO_LABELS.values()))}")
            return None
        if program_code not in SheetsService.PROGRAM_KEYWORDS:
            print(f"[ERROR] Programa inválido: {program_code!r}. Opciones: {sorted(SheetsService.PROGRAM_KEYWORDS.keys())}")
            return None

        client = Client.query.get(client_id)
        if not client:
            print(f"[ERROR] No existe ningún Client con id={client_id}. Este script no crea clientes nuevos a propósito.")
            return None

        print(f"Cliente: #{client.id} {client.full_name} · {client.email or 'sin email'} · {client.instagram or 'sin IG'} · {client.phone or 'sin teléfono'}")

        # Misma validación de secuencia de pago que usa el flujo normal (Declarar Venta) — un
        # backfill histórico también debería respetar Seña→Parcial/Completo→Cuota→Renovación/
        # Upsell salvo que el operador confirme explícitamente que hace falta forzarlo.
        ok, reason, state = SalesConsistencyService.validate_next_payment_type(client.id, program_code, tipo_key)
        print(f"Estado de pago actual en {program_code}: pagado ${state['total_paid']:.2f} de ${state['program_price']:.2f} "
              f"(seña={state['has_deposit']}, parcial={state['has_first_payment']}, completo={state['has_full_payment']}, "
              f"cuotas={state['has_installments']}, renov/upsell={state['has_renewal_or_upsell']})")
        if not ok:
            if not force:
                print(f"[BLOQUEADO] La secuencia normal de pagos rechaza esto: {reason}")
                print("Si estás seguro de que este pago histórico es correcto igual, volvé a correr con --force.")
                return None
            print(f"[FORZADO] La secuencia normal lo hubiera bloqueado ({reason}) — se registra igual porque se pidió --force.")

        try:
            fecha_dt = datetime.strptime(fecha, '%Y-%m-%d') if fecha else datetime.utcnow()
        except ValueError:
            print(f"[ERROR] Fecha inválida: {fecha!r}. Formato esperado: YYYY-MM-DD.")
            return None

        tipo_pago_str = f"{program_code} - {tipo_label}"

        print("\n--- Se va a registrar ---")
        print(f"  tipo_pago:     {tipo_pago_str}")
        print(f"  monto:         ${float(monto):.2f}")
        print(f"  fecha:         {fecha_dt.date().isoformat()}")
        print(f"  metodo_pago:   {metodo_pago or '(sin especificar)'}")
        print(f"  email_vendedor:{closer_email or '(sin especificar)'}")
        print("  -> Se crea FinancialSale + su espejo en Enrollment/Payment.")
        print("  -> NO se dispara el webhook de n8n/Discord ni se escribe en Google Sheets.")

        if not apply:
            print("\n[DRY-RUN] Nada se guardó todavía. Volvé a correr con --apply para confirmar.")
            return None

        sale = FinancialSale(
            client_id=client.id,
            email_vendedor=closer_email or '',
            nombre_cliente=nombre_cliente or client.full_name or '',
            telefono=telefono or client.phone or '',
            mail_cliente=email or client.email or '',
            tipo_pago=tipo_pago_str,
            monto=float(monto),
            metodo_pago=metodo_pago or '',
            examen=examen or '',
            instagram=instagram or client.instagram or '',
            setter=setter or '',
            estado='Completada',
            sold_in_call=False,
            date=fecha_dt
        )
        db.session.add(sale)
        db.session.commit()
        print(f"\n[OK] FinancialSale #{sale.id} creada.")

        # Espejo a Enrollment/Payment — mismo criterio que SheetsService._sync_enrollment_payment,
        # para que el historial del cliente y el sistema de cuotas también queden consistentes
        # (sin esto, la venta existiría en FinancialSale pero el cliente seguiría sin aparecer
        # inscrito en el programa en el resto de la app).
        program = SheetsService.resolve_program(program_code)
        if not program:
            print(f"[AVISO] No se encontró un Program activo para {program_code} — no se creó Enrollment/Payment, solo FinancialSale.")
            return sale

        from app.models import Enrollment, Payment

        PAYMENT_TYPE_MAP = {
            'completo': 'full', 'parcial': 'first_payment', 'seña': 'down_payment', 'sena': 'down_payment',
            'cuota': 'installment', 'renovacion': 'renewal', 'renovación': 'renewal', 'upsell': 'upsell',
        }
        payment_type = PAYMENT_TYPE_MAP.get(tipo_key, 'full')

        closer = None
        if closer_email:
            closer = User.query.filter(db.func.lower(User.email) == closer_email.strip().lower()).first()

        enrollment = Enrollment.query.filter_by(client_id=client.id, program_id=program.id).first()
        if not enrollment:
            enrollment = Enrollment(client_id=client.id, program_id=program.id, closer_id=closer.id if closer else None)
            db.session.add(enrollment)
            db.session.flush()
            print(f"[OK] Enrollment #{enrollment.id} creado ({program.name}).")
        elif closer and not enrollment.closer_id:
            enrollment.closer_id = closer.id
            print(f"[OK] Enrollment #{enrollment.id} existente actualizado con closer.")
        else:
            print(f"[OK] Enrollment #{enrollment.id} ya existía, se reutiliza.")

        payment_method = None
        if metodo_pago:
            payment_method = PaymentMethod.query.filter(db.func.lower(PaymentMethod.name) == metodo_pago.strip().lower()).first()

        payment = Payment(
            enrollment_id=enrollment.id,
            payment_method_id=payment_method.id if payment_method else None,
            amount=float(monto),
            payment_type=payment_type,
            status='completed',
            date=fecha_dt
        )
        db.session.add(payment)

        if payment_type in ('full', 'first_payment') and (not enrollment.enrollment_date or fecha_dt < enrollment.enrollment_date):
            enrollment.enrollment_date = fecha_dt

        db.session.commit()
        print(f"[OK] Payment #{payment.id} creado (enrollment #{enrollment.id}).")
        print("\nListo — ningún webhook ni Discord ni Google Sheets fueron tocados, solo la base de datos local.")
        return sale


def _main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--client-id', type=int, required=True, help='ID del Client existente al que se le registra el pago')
    parser.add_argument('--programa', required=True, help='Código de programa: AL, RR o SI')
    parser.add_argument('--tipo', required=True, help='completo | parcial | seña | cuota | renovacion | upsell')
    parser.add_argument('--monto', type=float, required=True, help='Monto pagado')
    parser.add_argument('--fecha', help='Fecha real del pago, YYYY-MM-DD (default: hoy)')
    parser.add_argument('--metodo', help='Método de pago (Stripe/Hotmart/PayPal/Otro)')
    parser.add_argument('--examen', help='Examen del lead (MIR/ENARM/etc), opcional')
    parser.add_argument('--closer', help='Email del closer que hizo la venta (email_vendedor)')
    parser.add_argument('--setter', help='Nombre del setter, opcional')
    parser.add_argument('--instagram', help='Override de instagram para la fila (default: el del Client)')
    parser.add_argument('--telefono', help='Override de teléfono para la fila (default: el del Client)')
    parser.add_argument('--email', help='Override de email para la fila (default: el del Client)')
    parser.add_argument('--nombre', help='Override de nombre para la fila (default: el del Client)')
    parser.add_argument('--apply', action='store_true', help='Aplica de verdad (sin esto es dry-run)')
    parser.add_argument('--force', action='store_true', help='Ignora el bloqueo de secuencia de pagos si aplica')
    args = parser.parse_args()

    registrar_pago_historico(
        client_id=args.client_id,
        program_code=args.programa,
        tipo_pago_simple=args.tipo,
        monto=args.monto,
        fecha=args.fecha,
        metodo_pago=args.metodo,
        examen=args.examen,
        closer_email=args.closer,
        setter=args.setter,
        instagram=args.instagram,
        telefono=args.telefono,
        email=args.email,
        nombre_cliente=args.nombre,
        apply=args.apply,
        force=args.force
    )


if __name__ == '__main__':
    _main()
