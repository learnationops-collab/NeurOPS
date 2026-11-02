"""Validación de datos de SOLO LECTURA: cruza las cifras de las pantallas entre sí y contra sus fuentes.

    python scripts/validar_datos.py                                  # mes anterior completo + mes en curso
    python scripts/validar_datos.py --desde 2026-10-01 --hasta 2026-10-31 --salida docs/validacion.md

En el servidor (el entorno enlazado de Railway es producción) basta con copiar los archivos a /tmp y correrlos desde /app;
no se escribe nada en la base. Con el despliegue ya al día, `python scripts/validar_datos.py` corre directo. Si no:

    tar cf - scripts/validar_datos*.py | railway ssh --service "learnation work" -- sh -c \\
        "mkdir -p /tmp/vd && tar xf - -C /tmp/vd && cd /app && python /tmp/vd/scripts/validar_datos.py"

Imprime un informe markdown (el progreso va por stderr): cada cruce lleva los dos valores, la diferencia, su tolerancia y por
qué puede diferir.

Cruces: (a) cash/ventas de Marketing vs Comercial vs Finanzas · (b) la ficha del cliente vs `FinancialSale` · (c) agendas de
Dirección vs Revisar vs triage vs Marketing · (d) segmentos A/B/C/D vs el total · (e) comisión real vs estimada ·
(f) ventas sin cliente, agendas duplicadas, pagos sin venta.

Es de solo lectura por tres lados: la sesión se abre con `default_transaction_read_only=on`, un guardia rechaza cualquier
sentencia que no sea SELECT antes de enviarla y nada hace commit. No arranca el scheduler de recordatorios, no manda mensajes
ni llama servicios externos. Usa una app Flask mínima (solo la base y los modelos), no `create_app()`.
"""
import argparse
import os
import sys
from datetime import date, datetime, timedelta

os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'
_aqui = os.path.dirname(os.path.abspath(__file__))
for ruta in (os.getcwd(), os.path.join(_aqui, '..'), _aqui):
    sys.path.insert(0, os.path.abspath(ruta))

from app import db  # noqa: E402
from app import models as _modelos  # noqa: E402,F401  (registra todas las tablas)
from validar_datos_base import Informe, armar_app, poner_guardia, renderizar  # noqa: E402
from validar_datos_cruces import cruce_a, cruce_b, cruce_c, cruce_d, cruce_e, cruce_f, cruce_g  # noqa: E402


def periodos_por_defecto():
    hoy = date.today()
    primero = hoy.replace(day=1)
    anterior_fin = primero - timedelta(days=1)
    return [(anterior_fin.replace(day=1), anterior_fin), (primero, hoy)]


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--desde')
    ap.add_argument('--hasta')
    ap.add_argument('--salida', help='Guarda el informe markdown en esta ruta.')
    ap.add_argument('--max-clientes', type=int, default=1000,
                    help='Clientes que se cruzan contra la ficha (los de pagos más recientes).')
    args = ap.parse_args()
    periodos = [(date.fromisoformat(args.desde), date.fromisoformat(args.hasta or args.desde))] if args.desde else periodos_por_defecto()
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    app, es_pg = armar_app()
    inicio = datetime.utcnow()
    inf = Informe()
    with app.app_context():
        poner_guardia(es_pg)
        for d, h in periodos:
            print(f'== Período {d} → {h}', file=sys.stderr)
            for cruce in (cruce_a, cruce_c, cruce_d, cruce_f):
                cruce(inf, d, h)
        cruce_b(inf, args.max_clientes)
        cruce_e(inf)
        cruce_g(inf)
        db.session.rollback()
    texto = renderizar(inf, periodos, inicio)
    print(texto)
    if args.salida:
        with open(args.salida, 'w', encoding='utf-8') as f:
            f.write(texto)


if __name__ == '__main__':
    main()
