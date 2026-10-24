"""Variabilidad: lo que se suma a la serie diaria para ver los CAMBIOS (24/10/2026).

La serie por día (`comercial_analitica.variabilidad`) dice cómo se movió cada métrica. Esto le
agrega, como claves NUEVAS (la forma anterior de la respuesta no cambia), lo que hace falta para
leer por qué se movió:

  · **`previo` y `semana`**: la misma serie en el período comparado del header y en la semana
    anterior (el período corrido 7 días). Cada una va alineada por posición con `dias` —el día i del
    período contra el día i del otro— y con `None` donde el otro período no llega. Las dos se
    calculan con las MISMAS funciones que la serie actual, así que una definición no puede
    divergir entre lo que se ve y contra lo que se compara.
  · **`personas`**: en cada serie (o en cada una de sus sub-series) lo que puso cada closer o setter
    día por día, para decir quién explica una subida o una caída. Solo con el equipo entero: si ya se
    eligió una persona no hay nada que repartir. En una tasa cada persona trae además `pesos` (el
    denominador de su día) para que un 0% sobre una sola llamada no se lea como un hundimiento.
  · **`hoy` y `referencias`**: el día de corte del servidor (los días que vienen no son ceros del
    equipo: son días que no pasaron) y los rangos de `previo`/`semana`.

El cálculo de la banda normal, los picos y el acumulado va en el frontend: se mueve con la sub-serie
elegida y no necesita otra consulta.
"""
from datetime import date, timedelta

from app.models import User
from app.services import setter_analitica
from app.services.comercial_service import ROL_SETTERS, ComercialService

# Más de esto no se reparte: una lista de quince personas no se lee. Lo que queda afuera se junta en
# «Otros» (solo en lo que se suma; una tasa no se puede sumar).
MAX_PERSONAS = 8
# Qué serie del setter es el denominador de cada tasa que se puede ponderar.
PESO_SETTER = {'cualificacion': 'entrantes', 'apertura': 'entrantes'}


def completar(salida, rol, start, end, miembro_id, prev_start, prev_end, filas):
    """Agrega `hoy`, `referencias`, `previo`, `semana` y `personas` a la respuesta de `variabilidad`.

    `filas` es `(agendas, ventas)` del closer, ya leídas, o None con setters."""
    series, dias = salida['series'], salida['dias']
    salida['hoy'] = date.today().isoformat()
    salida['referencias'] = {}

    rangos = {}
    if prev_start and prev_end:
        rangos['previo'] = (prev_start, prev_end)
    semana = (start - timedelta(days=7), end - timedelta(days=7))
    # Con "7 días" el período anterior YA es la semana anterior: dos curvas iguales no aportan.
    if semana != rangos.get('previo'):
        rangos['semana'] = semana

    for clave, (r_ini, r_fin) in rangos.items():
        series_ref = _series_de(rol, r_ini, r_fin, miembro_id)
        _pegar(series, series_ref, clave, len(dias))
        salida['referencias'][clave] = {'start': r_ini.isoformat(), 'end': r_fin.isoformat()}

    if miembro_id is None:
        por_persona = (_por_persona_setters(dias, start, end) if rol == ROL_SETTERS
                       else _por_persona_closers(dias, *filas, series))
        _repartir(series, por_persona, rol == ROL_SETTERS)


def _series_de(rol, start, end, miembro_id):
    from app.services import comercial_analitica as ca
    dias = ca._dias_del(start, end)
    if rol == ROL_SETTERS:
        return ca._series_setters(dias, start, end, miembro_id)
    return ca._series_closers(dias, start, end, miembro_id, ComercialService.nombre_de(miembro_id))


def _alinear(vals, largo):
    """`vals` del otro período con el largo del actual: lo que no llega es None (un día que no
    existe), no cero (un día sin actividad)."""
    if vals is None:
        return [None] * largo
    return [vals[i] if i < len(vals) else None for i in range(largo)]


def _vals_base(serie):
    """Los valores de la vista principal de una serie, con o sin sub-series."""
    if not serie:
        return None
    if 'series' in serie:
        return serie['series'][0]['vals']
    return serie.get('vals')


def _pegar(series, series_ref, clave, largo):
    """Cuelga `clave` en cada serie y sub-serie, emparejando la del otro período por clave y rótulo.

    Una categoría que el otro período no tuvo (una forma de pago, un programa) es un período sin
    actividad en esa categoría: ceros. Solo cuando la serie entera no existe del otro lado queda en
    None."""
    por_clave = {s['key']: s for s in series_ref}
    for s in series:
        ref = por_clave.get(s['key'])
        if 'series' not in s:
            s[clave] = _alinear(_vals_base(ref), largo)
            continue
        por_rotulo = {x['label']: x['vals'] for x in ref.get('series', [])} if ref else {}
        base = _vals_base(ref)
        for i, sub in enumerate(s['series']):
            vals = por_rotulo.get(sub['label'])
            if vals is None and i == 0:
                vals = base
            if vals is None and ref is not None:
                vals = [0] * largo
            sub[clave] = _alinear(vals, largo)


# --- Por persona -------------------------------------------------------------------------------


def _por_persona_closers(dias, agendas, ventas, series_equipo):
    """`{nombre: (series, pesos)}`: las series del closer sobre SUS filas, repartidas con la misma
    función que arma las del equipo. `pesos` es `{key: vals}` de las tasas ponderables.

    Las categorías de las sub-series (forma de pago, programa) son las del EQUIPO: si cada persona
    eligiera las suyas, quien vendió con una sola forma de pago no tendría sub-series y su venta
    caería en «Otros»."""
    from app.services import comercial_analitica as ca
    fijas = {s['key']: [x['label'] for x in s['series'][1:]]
             for s in series_equipo if s['key'] in ('ventas', 'programas') and 'series' in s}
    volumen = {}
    for f in list(agendas) + list(ventas):
        volumen[f['closer']] = volumen.get(f['closer'], 0) + 1
    salida = {}
    for nombre in sorted(volumen, key=volumen.get, reverse=True)[:MAX_PERSONAS]:
        propias_a = [f for f in agendas if f['closer'] == nombre]
        propias_v = [f for f in ventas if f['closer'] == nombre]
        series = ca._series_closers_de_filas(dias, propias_a, propias_v, fijas)
        realizadas = ca._serie(dias, propias_a, ca._dia_de_agenda, filtro=lambda f: f['realizada'])
        salida[nombre] = (series, {'showup': realizadas})
    return salida


def _por_persona_setters(dias, start, end):
    ids = {m['id'] for m in ComercialService.miembros(ROL_SETTERS)}
    ids |= set(setter_analitica.lecturas_por_setter(start, end))
    if not ids:
        return {}
    nombres = {u.id: u.username for u in User.query.filter(User.id.in_(ids)).all()}
    leidas = []
    for sid in ids:
        series = setter_analitica.series(dias, start, end, sid)
        movimiento = sum(sum(_vals_base(s) or []) for s in series)
        if movimiento:
            leidas.append((movimiento, nombres.get(sid, f'Setter {sid}'), series))
    leidas.sort(key=lambda t: t[0], reverse=True)
    salida = {}
    for _, nombre, series in leidas[:MAX_PERSONAS]:
        base = {s['key']: _vals_base(s) for s in series}
        pesos = {k: base[den] for k, den in PESO_SETTER.items() if den in base}
        salida[nombre] = (series, pesos)
    return salida


def _vals_de_persona(series_persona, key, rotulo, posicion):
    """Los valores de una persona para una serie o sub-serie del equipo, o None si no la tiene."""
    s = next((x for x in series_persona if x['key'] == key), None)
    if not s:
        return None
    if 'series' not in s:
        return s['vals'] if posicion == 0 else None
    sub = next((x for x in s['series'] if x['label'] == rotulo), None)
    return sub['vals'] if sub else None


def _repartir(series, por_persona, es_setters):
    """Cuelga `personas` en cada serie y sub-serie del equipo, si hay al menos dos con algo que
    repartir."""
    if len(por_persona) < 2:
        return
    for s in series:
        destinos = s['series'] if 'series' in s else [s]
        for posicion, destino in enumerate(destinos):
            rotulo = destino.get('label')
            lista = []
            for nombre, (series_persona, pesos) in por_persona.items():
                vals = _vals_de_persona(series_persona, s['key'], rotulo, posicion)
                if not vals or not any(vals):
                    continue
                entrada = {'nombre': nombre, 'vals': vals}
                if s.get('tipo') == 'tasa' and s['key'] in pesos and posicion == 0:
                    entrada['pesos'] = pesos[s['key']]
                lista.append(entrada)
            if s.get('tipo') != 'tasa':
                _sumar_otros(lista, destino['vals'])
            if len(lista) >= 2:
                destino['personas'] = lista


def _sumar_otros(lista, total):
    """Junta en «Otros» lo del equipo que no está en las personas listadas (las que quedaron fuera
    del tope o no tienen rol activo), para que las partes cierren con el total."""
    resto = [round(t - sum(p['vals'][i] for p in lista), 2) for i, t in enumerate(total)]
    # Un resto de centavos es redondeo, no una persona.
    if any(abs(r) > 0.5 for r in resto):
        lista.append({'nombre': 'Otros', 'vals': [max(r, 0) for r in resto], 'otros': True})
