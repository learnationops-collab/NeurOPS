# -*- coding: utf-8 -*-
"""Auditoria (y correccion) de la hora real de las agendas.

Para que sirve: responder con datos, no con suposiciones, la pregunta "¿la hora que
muestra el sistema es la hora real de la cita?". Compara, agenda por agenda, el string
que mando la fuente (n8n/Calendly, guardado en `fecha_meet`/`raw_data`) contra el
instante que quedo guardado en `FinancialAgenda.date` y en el `Appointment.start_time`
sincronizado, y muestra ambos en la zona horaria que le pidas.

Contexto: hasta el 5/09/2026 el webhook guardaba la fecha en hora local de America/La_Paz
dentro de una columna que todo el sistema lee como UTC (ver app/services/agenda_time_service.py).
Las agendas que entraron antes de ese fix siguen corridas; este script las encuentra y,
con --fix, las corrige.

Uso:
    python scripts/auditar_horarios_agendas.py                      # auditoria, ultimos 60 dias
    python scripts/auditar_horarios_agendas.py --dias 365 --limite 40
    python scripts/auditar_horarios_agendas.py --tz America/Sao_Paulo
    python scripts/auditar_horarios_agendas.py --closer "Marlon"
    python scripts/auditar_horarios_agendas.py --fix                # aplica la correccion
    python scripts/auditar_horarios_agendas.py --target staging     # contra la base de staging

Sin --fix no escribe absolutamente nada: es seguro correrlo contra produccion.
"""
import argparse
import os
import sys
from collections import Counter
from datetime import datetime, timedelta

from dotenv import load_dotenv

current_dir = os.path.abspath(os.path.dirname(__file__))
sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))

# `config.py` calcula SQLALCHEMY_DATABASE_URI al importarse, antes de que Flask arme la app,
# asi que el destino se resuelve ACA, antes de cualquier `from app import ...`. Es el mismo
# problema real que documenta scripts/actualizar_db.py (27/ago/2026): sin esto, --target
# staging termina escribiendo sobre la SQLite local sin avisar.
load_dotenv()
_target = 'local'
for _i, _a in enumerate(sys.argv):
    if _a == '--target' and _i + 1 < len(sys.argv):
        _target = sys.argv[_i + 1]
    elif _a.startswith('--target='):
        _target = _a.split('=', 1)[1]
if _target in ('staging', 'testing'):
    _url = os.getenv('DATABASE_STAGING') or os.getenv('DATABASE_TESTING')
    if _url:
        os.environ['DATABASE_URL'] = _url

import pytz  # noqa: E402

from app import create_app, db  # noqa: E402
from app.models import Appointment, Client, FinancialAgenda  # noqa: E402
from app.services.agenda_time_service import parse_a_utc, zona_origen  # noqa: E402

TOLERANCIA_MINUTOS = 2  # margen para redondeos de segundos/microsegundos


def _string_de_origen(agenda):
    """El texto crudo que mando la fuente para la hora de la cita.

    `fecha_meet` es el string tal cual llego (el webhook lo guarda sin tocarlo). Si esta
    vacio o quedo pisado con un `str(datetime)`, se cae al payload original en `raw_data`.
    """
    raw = agenda.raw_data if isinstance(agenda.raw_data, dict) else {}
    for valor in (agenda.fecha_meet, raw.get('fecha'), raw.get('date'), raw.get('registro')):
        if valor and str(valor).strip():
            return str(valor).strip()
    return None


def _appointment_de(agenda):
    """El Appointment que `sync_financial_agenda_to_appointment` creo desde esta agenda.

    Se busca por cliente + `start_time` exactamente igual a `agenda.date`, porque el sync
    copia el valor tal cual (`appt.start_time = agenda.date`). La igualdad exacta evita
    tocar citas creadas a mano o por el embudo web, que ya estan en UTC correcto.
    """
    if not agenda.date:
        return None
    filtros = []
    mail = (agenda.mail or '').strip().lower()
    if mail and mail != 'n/a' and '@' in mail:
        filtros.append(db.func.lower(Client.email) == mail)
    ig = (agenda.instagram or '').strip().lstrip('@').lower()
    if ig and ig != 'n/a':
        filtros.append(db.func.lower(db.func.replace(Client.instagram, '@', '')) == ig)
    if not filtros:
        return None
    return (Appointment.query.join(Client, Appointment.client_id == Client.id)
            .filter(db.or_(*filtros), Appointment.start_time == agenda.date).first())


def _en_zona(dt_utc, tz):
    if not dt_utc:
        return '--'
    return pytz.UTC.localize(dt_utc).astimezone(tz).strftime('%d/%m %H:%M')


def analizar(agenda):
    """(estado, correcto_utc, drift_horas, traia_offset). Estado dice que hacer con la fila."""
    origen = _string_de_origen(agenda)
    if not origen:
        return 'sin_origen', None, None, None
    correcto, traia_offset = parse_a_utc(origen)
    if not correcto:
        return 'ilegible', None, None, traia_offset
    if not agenda.date:
        return 'sin_fecha', correcto, None, traia_offset
    drift = (agenda.date - correcto).total_seconds() / 3600.0
    if abs(drift) * 60 <= TOLERANCIA_MINUTOS:
        return 'ok', correcto, drift, traia_offset
    return 'corrida', correcto, drift, traia_offset


def main():
    ap = argparse.ArgumentParser(description='Audita (y corrige) la hora real de las agendas.')
    ap.add_argument('--dias', type=int, default=60, help='Ventana hacia atras y adelante, en dias (0 = todo).')
    ap.add_argument('--tz', default=None, help='Zona en la que mostrar las horas (default: la del sistema de origen).')
    ap.add_argument('--closer', default=None, help='Filtrar por nombre de closer (coincidencia parcial).')
    ap.add_argument('--limite', type=int, default=25, help='Cuantas filas desviadas listar en el detalle.')
    ap.add_argument('--fix', action='store_true', help='Aplica la correccion. Sin esto no escribe nada.')
    ap.add_argument('--target', default='local', help='local (default) | staging')
    args = ap.parse_args()

    try:
        tz = pytz.timezone(args.tz) if args.tz else zona_origen()
    except Exception:
        print(f"Zona horaria desconocida: {args.tz}")
        return 1

    app = create_app()
    with app.app_context():
        uri = str(db.engine.url)
        print(f"Base: {uri.split('@')[-1]}")
        print(f"Zona de lectura: {tz} | Zona asumida para fechas sin offset: {zona_origen()}")

        query = FinancialAgenda.query
        if args.dias:
            desde = datetime.utcnow() - timedelta(days=args.dias)
            hasta = datetime.utcnow() + timedelta(days=args.dias)
            query = query.filter(FinancialAgenda.date >= desde, FinancialAgenda.date <= hasta)
        if args.closer:
            query = query.filter(FinancialAgenda.closer.ilike(f"%{args.closer}%"))
        agendas = query.order_by(FinancialAgenda.date.desc()).all()

        estados = Counter()
        formatos = Counter()
        drifts = Counter()
        desviadas = []
        for agenda in agendas:
            estado, correcto, drift, traia_offset = analizar(agenda)
            estados[estado] += 1
            if traia_offset is not None:
                formatos['con offset' if traia_offset else 'SIN offset (zona asumida)'] += 1
            if estado == 'corrida':
                drifts[round(drift, 2)] += 1
                desviadas.append((agenda, correcto, drift))

        total = len(agendas)
        print(f"\nAgendas analizadas: {total}")
        if not total:
            print("No hay agendas en la ventana pedida.")
            return 0

        print("\n--- ESTADO ---")
        etiquetas = {
            'ok': 'coinciden con el string de origen',
            'corrida': 'GUARDADAS EN OTRO INSTANTE que el que mando la fuente',
            'sin_origen': 'sin string de origen (no se pueden verificar)',
            'ilegible': 'string de origen ilegible',
            'sin_fecha': 'sin fecha guardada',
        }
        for estado, cant in estados.most_common():
            print(f"  {cant:5}  {etiquetas.get(estado, estado)}")

        print("\n--- FORMATO QUE MANDA LA FUENTE ---")
        for formato, cant in formatos.most_common():
            print(f"  {cant:5}  {formato}")
        if formatos.get('SIN offset (zona asumida)'):
            print(f"  (para esas, el instante real depende de asumir {zona_origen()};"
                  f" pedirle a n8n que mande ISO con zona elimina la suposicion)")

        if drifts:
            print("\n--- CORRIMIENTO (guardado - real), en horas ---")
            for horas, cant in sorted(drifts.items(), key=lambda kv: -kv[1]):
                print(f"  {cant:5}  {horas:+.2f} h")

        if desviadas:
            print(f"\n--- DETALLE (primeras {min(args.limite, len(desviadas))} de {len(desviadas)}) ---")
            print(f"{'LEAD':22} {'CLOSER':14} {'ORIGEN (crudo)':28} {'SE VE':>12} {'REAL':>12} {'DRIFT':>8}")
            print('-' * 100)
            for agenda, correcto, drift in desviadas[:args.limite]:
                print(f"{(agenda.lead or '')[:21]:22} {(agenda.closer or '')[:13]:14} "
                      f"{(_string_de_origen(agenda) or '')[:27]:28} "
                      f"{_en_zona(agenda.date, tz):>12} {_en_zona(correcto, tz):>12} {drift:+7.1f}h")

        if not args.fix:
            print("\nModo auditoria (no se escribio nada). Para corregir: --fix")
            return 0

        if not desviadas:
            print("\nNada que corregir.")
            return 0

        print(f"\nCorrigiendo {len(desviadas)} agendas...")
        citas_corregidas = 0
        for agenda, correcto, _drift in desviadas:
            appt = _appointment_de(agenda)
            agenda.date = correcto
            if appt:
                appt.start_time = correcto
                citas_corregidas += 1
        db.session.commit()
        print(f"Listo: {len(desviadas)} agendas y {citas_corregidas} citas (Appointment) corregidas.")
        print("Las citas sin agenda asociada (creadas a mano o por el embudo web) no se tocaron: "
              "esas ya estaban en UTC.")
    return 0


if __name__ == '__main__':
    sys.exit(main())
