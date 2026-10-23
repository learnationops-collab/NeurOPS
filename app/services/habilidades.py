"""Habilidades de Learnito: recetas con nombre que combinan operaciones del motor de tablas (app/services/tablas/),
incluso entre sistemas (cruzan Work con la Academia por alumno_id).

Las operaciones son genéricas (un plan por claves sobre cualquier fuente); una habilidad es una pregunta frecuente
ya resuelta: sus planes están armados y validados acá, y Learnito solo elige la habilidad y sus parámetros.
Para sumar una: una función que recibe (user, **parametros) y devuelve texto corto, y su entrada en HABILIDADES.
"""
import logging

from app.services.tablas import exclusion, motor

logger = logging.getLogger(__name__)

MAX_LISTA = 15
BANDAS = ('Perdido', 'Rescate', 'Se enfría', 'Activo', 'Sin actividad')


class HabilidadError(ValueError):
    """Parámetros que no sirven: el texto vuelve a Learnito como error."""


def _todas_las_filas(correr):
    """Junta las páginas de un paquete (hasta 20.000 filas, el límite de la magnitud `large`)."""
    pagina, filas = 1, []
    while True:
        p = correr(pagina)
        filas += p.get('filas') or []
        if not p.get('siguiente'):
            return filas
        pagina = p['siguiente']


def _plata(n):
    return 'US$' + f'{float(n or 0):,.0f}'.replace(',', '.')


def _entero(valor, defecto, minimo, maximo, nombre):
    try:
        n = int(valor if valor is not None else defecto)
    except (TypeError, ValueError) as e:
        raise HabilidadError(f'{nombre} tiene que ser un número.') from e
    return max(minimo, min(maximo, n))


def _pulso(user):
    """{alumno_id: (franja, días sin actividad)} de todos los alumnos de la Academia."""
    from app.services.copiloto_datos import _academia
    plan = {'fuente': 'alumno', 'columnas': ['pulse_band', 'pulse_days']}
    filas = _todas_las_filas(lambda pagina: _academia(user, plan=plan, pagina=pagina))
    return {f.get('alumno_id') or f.get('clave'): (f.get('pulse_band'), f.get('pulse_days')) for f in filas}


def cobranza_en_riesgo(user, dias=14):
    """Las cuotas pendientes que vencen en los próximos `dias`, cruzadas con el Pulso de la Academia."""
    dias = _entero(dias, 14, 1, 90, 'dias')
    montos = exclusion.sees_amounts(user)
    plan = {
        'fuente': 'installment_plans',
        'condiciones': {'match': 'all', 'items': [
            {'field': 'f.estado', 'op': 'neq', 'value': 'pagado'},
            {'field': 'f.fecha_vencimiento', 'op': 'next_days', 'value': dias}]},
        'columnas': ['f.numero_cuota', 'f.fecha_vencimiento', 'f.programa_code', 'p.client_id.full_name']
                    + (['f.monto'] if montos else []),
        'orden': {'dato': 'f.fecha_vencimiento', 'dir': 'asc'},
    }
    cuotas = _todas_las_filas(lambda pagina: motor.run(user, plan, pagina=pagina))
    if not cuotas:
        return f'Ninguna cuota pendiente vence en los próximos {dias} días.'
    pulso = _pulso(user)
    por_banda = {}
    for c in cuotas:
        banda, dias_sin = pulso.get(c.get('alumno_id'), (None, None)) if c.get('alumno_id') else (None, None)
        c['_banda'], c['_dias_sin'] = banda or 'Sin cruce con la Academia', dias_sin
        n, m = por_banda.get(c['_banda'], (0, 0.0))
        por_banda[c['_banda']] = (n + 1, m + float(c.get('f.monto') or 0))

    total = len(cuotas)
    lineas = [f'{total} cuotas pendientes vencen en los próximos {dias} días'
              + (f' ({_plata(sum(m for _, m in por_banda.values()))}).' if montos else '.'), 'Por franja del Pulso:']
    orden = [*BANDAS, 'Sin cruce con la Academia']
    for banda in sorted(por_banda, key=lambda b: orden.index(b) if b in orden else len(orden)):
        n, m = por_banda[banda]
        lineas.append(f'{banda}: {n}' + (f' ({_plata(m)})' if montos else ''))
    riesgo = [c for c in cuotas if c['_banda'] in ('Perdido', 'Rescate')]
    if riesgo:
        lineas.append('En riesgo (Rescate o Perdido), por vencimiento:')
        for c in riesgo[:MAX_LISTA]:
            monto = f", {_plata(c.get('f.monto'))}" if montos else ''
            lineas.append(f"{c.get('p.client_id.full_name') or c.get('fila')} · cuota {c.get('f.numero_cuota')} "
                          f"vence {c.get('f.fecha_vencimiento')}{monto} · {c['_banda']}, "
                          f"{c['_dias_sin']} días sin actividad")
        if len(riesgo) > MAX_LISTA:
            lineas.append(f'… y {len(riesgo) - MAX_LISTA} más.')
    if total < 30:
        lineas.append(f'Aviso: Muestra chica: son {total}. Un cambio de pocos mueve mucho el número.')
    lineas.append('Método: cuotas de Work (installment_plans) cruzadas por alumno_id con el Pulso de la Academia.')
    return '\n'.join(lineas)


def estado_de_pagos(user):
    """Los clientes por estado de pago (y su deuda, si quien pregunta ve montos)."""
    from app.services.copiloto_datos import _texto_paquete
    plan = {'fuente': 'clients', 'columnas': ['s.estado_pago'], 'agrupar_por': 's.estado_pago',
            'condiciones': {'match': 'all', 'items': [{'field': 's.estado_pago', 'op': 'notempty'}]},
            'medir': {'metrica': 'sum', 'dato': 's.deuda'} if exclusion.sees_amounts(user) else None}
    return _texto_paquete(motor.run(user, plan, por_pagina=1))


def ventas_por_periodo(user, periodo='month', dias=365, programa=None):
    """Las ventas de los últimos `dias`, por período (y de un programa, si se pide)."""
    from app.services.copiloto_datos import _texto_paquete
    dias = _entero(dias, 365, 1, 3650, 'dias')
    items = [{'field': 'f.sold_at', 'op': 'within_days', 'value': dias}]
    if programa:
        items.append({'field': 'f.program_code', 'op': 'eq', 'value': str(programa).upper()})
    plan = {'fuente': 'sales', 'columnas': ['f.sold_at'], 'agrupar_por': 'f.sold_at', 'periodo': periodo,
            'condiciones': {'match': 'all', 'items': items}}
    return _texto_paquete(motor.run(user, plan, por_pagina=1))


def agendas_por_estado(user, dias=30):
    """Las agendas de los últimos `dias` por estado (el de Mi cartera)."""
    from app.services.copiloto_datos import _texto_paquete
    dias = _entero(dias, 30, 1, 365, 'dias')
    plan = {'fuente': 'appointments', 'columnas': ['s.estado_agenda'], 'agrupar_por': 's.estado_agenda',
            'condiciones': {'match': 'all', 'items': [{'field': 'f.start_time', 'op': 'within_days', 'value': dias}]}}
    return _texto_paquete(motor.run(user, plan, por_pagina=1))


# nombre -> (función, descripción corta para Learnito, parámetros)
HABILIDADES = {
    'cobranza_en_riesgo': (cobranza_en_riesgo, 'Cuotas que vencen pronto cruzadas con el Pulso de la Academia '
                                               '(quién está en Rescate o Perdido).', {'dias': 'entero, 14'}),
    'estado_de_pagos': (estado_de_pagos, 'Clientes por estado de pago (al día, por vencer, vencida…) y su deuda.', {}),
    'ventas_por_periodo': (ventas_por_periodo, 'Ventas por día, semana, mes, trimestre o año.',
                           {'periodo': 'day|week|month|quarter|year', 'dias': 'entero, 365', 'programa': 'AL|RR|SI'}),
    'agendas_por_estado': (agendas_por_estado, 'Agendas de los últimos días por estado (show up, no show…).',
                           {'dias': 'entero, 30'}),
}


def descripcion():
    """Una línea por habilidad, para la descripción de la herramienta."""
    return ' '.join(f'{n}({", ".join(f"{k}: {v}" for k, v in p.items())}): {d}' for n, (_, d, p) in HABILIDADES.items())


def usar(user, nombre, parametros=None):
    if nombre not in HABILIDADES:
        raise HabilidadError(f'No existe la habilidad {nombre}.')
    funcion, _, aceptados = HABILIDADES[nombre]
    parametros = {k: v for k, v in (parametros or {}).items() if k in aceptados}
    return funcion(user, **parametros)
