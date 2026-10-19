"""Las herramientas de Learnito: lo que Claude puede pedirle a Work, siempre sobre el closer logueado.

Claude no entra a la base: elige una herramienta y Work la ejecuta con la sesión del closer, así que
nunca ve datos de otro. Cada resultado es TEXTO CORTO, no JSON: es lo que más pesa en la segunda
llamada a Claude (va como entrada), y una línea por agenda o por cliente alcanza para contestar.
Por lo mismo hay topes de filas y las descripciones de las herramientas son breves: cada herramienta
se paga en todas las consultas, se use o no.

Solo de lectura. Los datos salen de los mismos servicios que las pantallas del closer: las agendas
de `CloserAgendasService.get_ledger` (Mi cartera › Agendas) y la deuda de
`CloserFollowUpService._cartera_items` (Mi cartera), con sus mismas reglas (baja, cuotas, zona horaria).
"""
import logging
import unicodedata
from datetime import date, datetime

import pytz

from app.services.user_time_service import zona_del_usuario

logger = logging.getLogger(__name__)

MAX_AGENDAS = 15
MAX_DEUDORES = 10
MAX_COINCIDENCIAS = 3

HERRAMIENTAS = [
    {
        'name': 'mis_agendas',
        'description': 'Agendas del closer en un día: hora, alumno y estado ("mis agendas", "mis llamadas").',
        'input_schema': {
            'type': 'object',
            'properties': {'fecha': {'type': 'string', 'description': 'AAAA-MM-DD. Si no la dice, hoy.'}},
            'additionalProperties': False,
        },
    },
    {
        'name': 'deuda_de',
        'description': 'Deuda de un cliente del closer: saldo y próxima cuota.',
        'input_schema': {
            'type': 'object',
            'properties': {'nombre': {'type': 'string', 'description': 'Nombre o parte del nombre.'}},
            'required': ['nombre'],
            'additionalProperties': False,
        },
    },
    {
        'name': 'los_que_mas_deben',
        'description': 'Los clientes del closer que más deben, de mayor a menor.',
        'input_schema': {
            'type': 'object',
            'properties': {'cantidad': {'type': 'integer', 'description': 'Entre 1 y 10. Por defecto 5.'}},
            'additionalProperties': False,
        },
    },
]


class HerramientaError(Exception):
    """Un pedido que no se puede cumplir: el texto vuelve a Claude como error de la herramienta."""


def _plata(monto):
    return 'US$' + f'{float(monto or 0):,.0f}'.replace(',', '.')


def _dia(iso):
    return date.fromisoformat(iso[:10]).strftime('%d/%m') if iso else ''


def _sin_tildes(texto):
    plano = unicodedata.normalize('NFKD', texto or '')
    return ''.join(c for c in plano if not unicodedata.combining(c)).casefold().strip()


def _linea_de_deuda(item):
    nombre = item['lead_name']
    programa = item.get('programa_code')
    cabeza = f'{nombre} ({programa})' if programa else nombre
    deuda = item.get('deuda') or 0
    if deuda <= 0.01:
        return f'{cabeza}: al día.'
    cuota = item.get('proxima_cuota')
    if not cuota or cuota.get('sin_plan'):
        return f'{cabeza}: debe {_plata(deuda)}, sin plan de cuotas.'
    vencida = ' (VENCIDA)' if cuota.get('vencida') else ''
    return (f'{cabeza}: debe {_plata(deuda)}; próxima cuota {_plata(cuota["monto"])} '
            f'el {_dia(cuota["fecha_vencimiento"])}{vencida}.')


def _cartera(user):
    from app.services.closer_followup_service import CloserFollowUpService
    return CloserFollowUpService._cartera_items(user.id)


def mis_agendas(user, fecha=None):
    from app.services.closer_agendas_service import CloserAgendasService
    if fecha:
        try:
            date.fromisoformat(fecha)
        except ValueError as e:
            raise HerramientaError('La fecha tiene que ser AAAA-MM-DD.') from e
        datos = CloserAgendasService.get_ledger(user.id, 'custom', fecha, fecha)
    else:
        datos = CloserAgendasService.get_ledger(user.id, 'hoy')
    dia = datos['rango'].get('start')
    items = sorted(datos['items'], key=lambda i: i['start_time'] or '')
    if not items:
        return f'Sin agendas el {_dia(dia)}.'
    zona = zona_del_usuario(user)
    lineas = [f'{len(items)} agendas el {_dia(dia)} (hora del closer):']
    for item in items[:MAX_AGENDAS]:
        # `start_time` se guarda en UTC sin zona: se pasa a la hora del closer.
        inicio = datetime.fromisoformat(item['start_time'])
        hora = (pytz.utc.localize(inicio) if inicio.tzinfo is None else inicio).astimezone(zona)
        extra = ' · con venta' if item.get('venta') else ''
        lineas.append(f'{hora:%H:%M} {item["lead_name"]} · {item["estado_label"]}{extra}')
    if len(items) > MAX_AGENDAS:
        lineas.append(f'… y {len(items) - MAX_AGENDAS} más.')
    return '\n'.join(lineas)


def deuda_de(user, nombre):
    buscado = _sin_tildes(nombre)
    if len(buscado) < 2:
        raise HerramientaError('Decime al menos dos letras del nombre.')
    coincidencias = [i for i in _cartera(user) if buscado in _sin_tildes(i['lead_name'])]
    if not coincidencias:
        return f'No hay ningún cliente tuyo que se llame «{nombre}».'
    lineas = [_linea_de_deuda(i) for i in coincidencias[:MAX_COINCIDENCIAS]]
    if len(coincidencias) > MAX_COINCIDENCIAS:
        lineas.append(f'Hay {len(coincidencias)} con ese nombre; pedí uno más preciso.')
    return '\n'.join(lineas)


def los_que_mas_deben(user, cantidad=5):
    try:
        cantidad = max(1, min(MAX_DEUDORES, int(cantidad)))
    except (TypeError, ValueError) as e:
        raise HerramientaError('cantidad tiene que ser un número entre 1 y 10.') from e
    deudores = sorted((i for i in _cartera(user) if (i.get('deuda') or 0) > 0.01),
                      key=lambda i: i['deuda'], reverse=True)
    if not deudores:
        return 'Ningún cliente tuyo debe plata.'
    total = sum(i['deuda'] for i in deudores)
    lineas = [f'{len(deudores)} clientes te deben {_plata(total)} en total. Los que más:']
    lineas += [_linea_de_deuda(i) for i in deudores[:cantidad]]
    return '\n'.join(lineas)


_EJECUTORES = {'mis_agendas': mis_agendas, 'deuda_de': deuda_de, 'los_que_mas_deben': los_que_mas_deben}


def ejecutar(nombre, entrada, user):
    """(texto, es_error). Un error inesperado se loguea y vuelve como error, sin cortar la charla."""
    funcion = _EJECUTORES.get(nombre)
    if not funcion:
        return f'No existe la herramienta {nombre}.', True
    try:
        return funcion(user, **(entrada or {})), False
    except (HerramientaError, TypeError) as e:
        return str(e), True
    except Exception as e:
        logger.error(f'[COPILOTO] {nombre} falló para el usuario {user.id}: {e}')
        return 'No se pudo leer ese dato. Probá de nuevo en un rato.', True
