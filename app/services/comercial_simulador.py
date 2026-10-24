"""Simulador de la dirección comercial: los datos de partida (24/10/2026).

El simulador calcula en el navegador (`frontend/src/pages/comercial/components/simulador/modelo.js`);
acá solo se entregan las SUMAS de las ventanas con las que se arma la línea base, para que no haya
una definición nueva de nada:

  · cash, cash neto, ticket: `ComercialService.totales_ventas`;
  · asistieron, ventas (pago completo + split, nunca señas) y show up: `totales_agendas`;
  · entrantes, aperturas y agendas reportadas: el reporte diario de los setters (`sumar`);
  · agendas generadas: las del sistema, una por persona y por fecha de creación (`generadas`);
  · gasto y entrantes de anuncios: la tabla de Marketing (`anuncios_service.tablero`).

Las filas se leen UNA vez para los últimos 60 días y cada ventana (el mes en curso, 14, 30 y 60 días)
es un corte por fecha de esas mismas filas. Las ventanas terminan AYER: hoy está a medias y bajaría
el ritmo diario. Es el mismo alcance de equipo que ve la dirección en Analizar.
"""
from datetime import date, timedelta

from app.services import anuncios_service, setter_analitica
from app.services import setter_reporte_v2 as reporte_v2
from app.services.comercial_service import ComercialService
from app.services.commission_service import CLOSER_RATE, SETTER_RATE

DIAS_ATRAS = 60
VENTANAS = (14, 30, 60)


def _dia(valor):
    return valor[:10] if valor else None


def _dentro(filas, campo, desde, hasta):
    ini, fin = desde.isoformat(), hasta.isoformat()
    return [f for f in filas if _dia(f.get(campo)) and ini <= _dia(f[campo]) <= fin]


def _por_dia_de_marketing(tablero):
    """{fecha: [entrantes, gasto]} sumando todas las palabras clave del tablero de Marketing."""
    dias = {}
    for fila in tablero['filas']:
        for fecha, valores in fila['dias'].items():
            acum = dias.setdefault(fecha, [0, 0.0])
            acum[0] += valores[0]
            acum[1] += valores[2]
    return dias


def _ventana(desde, hasta, agendas, ventas, generadas, pares, marketing):
    ag = _dentro(agendas, 'fecha', desde, hasta)
    ve = _dentro(ventas, 'fecha', desde, hasta)
    ge = _dentro(generadas, 'creada', desde, hasta)
    ini, fin = desde.isoformat(), hasta.isoformat()
    lecturas = [l for l, _ in pares if l['fecha'] and ini <= l['fecha'] <= fin]
    suma = reporte_v2.sumar(lecturas)
    tot_a = ComercialService.totales_agendas(ag)
    tot_g = ComercialService.totales_agendas(ge)
    tot_v = ComercialService.totales_ventas(ve)
    dias_mkt = [v for f, v in marketing.items() if ini <= f <= fin]
    return {
        'desde': ini, 'hasta': fin,
        'dias': (hasta - desde).days + 1,
        'habiles': setter_analitica.dias_habiles(desde, hasta),
        'setters': {
            'entrantes': suma['totales']['entrantes'],
            'aperturas': suma['totales']['aperturas'],
            'generadas': len(ge),
            # Cuánto de lo que cierran los closers sale de las agendas de un setter.
            'ventas_originadas': tot_g['ventas'],
        },
        'closers': {
            'agendas': tot_a['agendas'],
            'realizadas': tot_a['realizadas'],
            'asistieron': tot_a['asistieron'],
            'ventas': tot_a['ventas'],
            'cash': tot_v['cash'],
            'cash_neto': tot_v['cash_neto'],
            'cash_nuevas': round(sum(f['monto'] for f in ve if f['es_venta']), 2),
            'ticket': tot_v['ticket'],
        },
        'ads': {
            'entrantes': sum(v[0] for v in dias_mkt),
            'gasto': round(sum(v[1] for v in dias_mkt), 2),
        },
        'equipo': {
            'closers': len({f['closer_id'] for f in ag if f.get('closer_id')}),
            'setters': len({fila.setter_id for l, fila in pares
                            if l['fecha'] and ini <= l['fecha'] <= fin and not l['no_laborable']}),
        },
    }


def base(hoy=None):
    """Las ventanas de la línea base y los parámetros de comisión. Ver el docstring del módulo."""
    hoy = hoy or date.today()
    ayer = hoy - timedelta(days=1)
    inicio = hoy - timedelta(days=DIAS_ATRAS)
    primero = hoy.replace(day=1)

    agendas = ComercialService.agendas(inicio, ayer)
    ventas = ComercialService.ventas(inicio, ayer)
    generadas = ComercialService.generadas(inicio, ayer)
    pares = setter_analitica.pares_de(inicio, ayer)
    tablero = anuncios_service.tablero(inicio, ayer)
    marketing = _por_dia_de_marketing(tablero)

    def ventana(desde):
        return _ventana(desde, ayer, agendas, ventas, generadas, pares, marketing)

    ventanas = {str(n): ventana(hoy - timedelta(days=n)) for n in VENTANAS}
    # El día 1 el mes en curso todavía no tiene ningún día cerrado.
    ventanas['mes'] = ventana(primero) if primero <= ayer else None
    return {
        'hoy': hoy.isoformat(),
        'ventanas': ventanas,
        'comisiones': {'closers': CLOSER_RATE, 'setters': SETTER_RATE},
        # Lo cobrado que Marketing atribuye a una palabra clave, en los 60 días: con eso y el gasto
        # sale el ROAS de anuncios (`totales` del tablero).
        'anuncios': {'cobrado': tablero['totales']['cobrado'], 'gasto': tablero['totales']['gasto'],
                     'moneda': tablero['moneda']},
        'miembros': {'closers': len(ComercialService.miembros('closers')),
                     'setters': len(ComercialService.miembros('setters'))},
    }
