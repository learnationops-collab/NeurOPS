"""Marketing por SEGMENTO: la matriz A/B/C/D (+ «sin segmento») cortada por fuente, origen, closer o sin corte, y
comparada con otro período (Gabriela, 28/10/2026; cortes y comparación: Kerwin, 28/10/2026).

Cada grupo trae las cifras que dice su propio resumen (`fuentes_service`): leads, agendas, show up, ventas y cash.
**Salen del mismo código que las cifras de la fuente**, no de una consulta parecida: las personas con agenda son
`conteo_agendas_service.personas` (base alta), los cobros `_cobros_para_sumar` y los leads de Setting
`anuncios_service.entradas_del_periodo`. De ahí salen los HECHOS (una agenda, un cobro, un lead, cada uno con su
segmento, su fuente, su origen y su closer) y todo lo demás —las cifras de cada celda, las de la comparación y las
listas que se abren al tocarlas— son cuentas sobre esos hechos con `PERTENECE`, así que la lista suma exacto la celda.

  · **Corte**: `fuente` (Setting, Workshop, Otras), `origen` (el setter, VSL, Momentum, Referido…; Workshop es uno solo),
    `closer` o `ninguno` (todo junto). Los grupos de un corte suman el total; los segmentos de cada grupo, también.
  · **Leads**: solo Setting, las personas que entraron por una palabra clave (con el segmento de quien llenó el
    formulario; el resto es «sin segmento»). Un lead no tiene closer: en el corte por closer no hay leads. Workshop
    NO se parte: sus leads son clics al grupo de WhatsApp, anónimos; su total va entero y por segmento queda en None.
  · **Origen de un cobro**: el detalle de su procedencia (el setter, «En vivo»/«Grabación» → Workshop, VSL…).
  · **Comparación**: el mismo cálculo sobre otro período; cada celda trae `previo` y `delta` (`segmentos_cortes`).
  · **Costo por lead por segmento: pendiente** (decisión de negocio 839). Meta no conoce el segmento: o se
    prorratea el gasto por la mezcla de segmentos, o se divide el gasto de la fuente por los leads del
    segmento. No se calcula hasta que se decida; ver `docs/pendientes_santi.md`.
"""
import time

from app import db
from app.models import Conversation
from app.services import anuncios_service, conteo_agendas_service, fuentes_registros_service, fuentes_service
from app.services import segmentos_cortes as cortes
from app.services.closer_name_service import resolver_nombre_closer
from app.services.fuentes_service import dividir
from app.services.procedencia_ingresos_service import PROCEDENCIAS
from app.services.segmentos_lectura import (
    ETIQUETAS,
    ORDEN,
    SIN,
    _tandas,
    de_agendas_del_libro,
    de_cobros,
    de_conversaciones,
    lista,
    parsear,
)

CAMPOS = ('leads', 'agendas', 'reportadas', 'show_up', 'ventas', 'new_cash', 'cash_total')
DERIVADAS = ('pct_show_up', 'pct_lead_agenda', 'pct_cierre', 'ticket', 'pct_cash')
FUENTES_TODAS = conteo_agendas_service.FUENTES
ETIQUETA_FUENTE = {'setting': 'Setting', 'workshop': 'Workshop', 'otras': 'Otras'}
CORTES = ('fuente', 'origen', 'closer', 'ninguno')
ETIQUETA_CORTE = {'fuente': 'Fuente', 'origen': 'Origen', 'closer': 'Closer', 'ninguno': 'Sin agrupar'}
# Lo que NO se puede partir por segmento (gasto de Meta: no conoce al lead).
SIN_SEGMENTO_POSIBLE = ('gasto',)
TODO = 'todo'
_BALDE = {p['key']: p['label'] for p in PROCEDENCIAS}

# Qué hechos suma cada cifra: la ÚNICA definición, de la celda y de su lista.
PERTENECE = {
    'agendas': lambda h: h['t'] == 'agenda',
    'reportadas': lambda h: h['t'] == 'agenda' and h['con_resultado'],
    'show_up': lambda h: h['t'] == 'agenda' and h['asistio'],
    'ventas': lambda h: h['t'] == 'cobro' and h['es_venta'],
    'new_cash': lambda h: h['t'] == 'cobro' and h['es_venta'],
    'cash_total': lambda h: h['t'] == 'cobro',
    'leads': lambda h: h['t'] == 'lead',
}
_CLAVE_DE = {'fuente': lambda h: h['fuente'], 'origen': lambda h: h['origen'], 'closer': lambda h: h['closer'],
             'ninguno': lambda h: TODO}


# --- Los hechos --------------------------------------------------------------------------------------

def _origen_de_cobro(fuente, c):
    if fuente == 'workshop':
        return 'Workshop'
    if fuente == 'setting':
        return c['detalle'] if c['balde'] == 'setting' and c['detalle'] else 'Sin identificar'
    return c['detalle'] or _BALDE.get(c['balde'], 'Sin identificar')


def _setters_de(ids):
    salida = {}
    for tanda in _tandas(ids):
        salida.update(db.session.query(Conversation.id, Conversation.setter).filter(Conversation.id.in_(tanda)))
    return salida


def _leads_de_setting(desde, hasta):
    """Cada entrada por palabra clave del período (las mismas de la tabla de Marketing: sin las archivadas), como hecho."""
    desde_dt, hasta_dt = anuncios_service._limites(desde, hasta)
    archivadas = fuentes_registros_service._claves_archivadas()
    entradas = [e for e in anuncios_service.entradas_del_periodo(desde_dt, hasta_dt, anuncios_service._clave_de_cada_anuncio())
                if e['clave'] not in archivadas]
    segmento = de_conversaciones({e['lead_id'] for e in entradas})
    setter = _setters_de({e['lead_id'] for e in entradas})
    return [{'t': 'lead', 'id': f"{e['lead_id']}-{e['clave'] or 'sin'}", 'fuente': 'setting',
             'origen': (setter.get(e['lead_id']) or '').strip() or 'Sin identificar', 'closer': None,
             'seg': segmento.get(e['lead_id'], SIN)} for e in entradas]


_MEMORIA = {}   # {(desde, hasta): (cuándo, resultado)}: cambiar de corte o de filtro no rehace la cuenta de 3 s
_VIGENCIA = 45  # segundos


def hechos(desde, hasta):
    """([hechos], clics de WhatsApp de Workshop) del período: las agendas por fecha de alta, los cobros y los leads de Setting,
    cada uno con su segmento. Es todo lo que cuenta esta vista. Se recuerda 45 s: la vista pide el mismo período varias
    veces (otro corte, otro filtro, la lista de una celda) y nadie modifica lo devuelto."""
    ahora = time.monotonic()
    guardado = _MEMORIA.get((desde, hasta))
    if guardado and ahora - guardado[0] < _VIGENCIA:
        return guardado[1]
    resultado = _hechos(desde, hasta)
    for k in [k for k, (t, _) in _MEMORIA.items() if ahora - t >= _VIGENCIA]:
        del _MEMORIA[k]
    _MEMORIA[(desde, hasta)] = (ahora, resultado)
    return resultado


def _hechos(desde, hasta):
    desde_dt, hasta_dt = anuncios_service._limites(desde, hasta)
    _por_clave, _sin, cobros, _sin_clave, claves = anuncios_service._ventas(
        desde_dt, hasta_dt, anuncios_service._clave_de_cada_anuncio())

    personas = conteo_agendas_service.personas(desde, hasta, 'alta')
    de_agenda = de_agendas_del_libro(p['agenda_id'] for p in personas)
    salida = [{'t': 'agenda', 'id': str(p['agenda_id']), 'fuente': p['fuente'], 'origen': conteo_agendas_service.origen_de_agenda(p['fuente'], p['origen']),
               'closer': resolver_nombre_closer(p['closer']), 'asistio': bool(p['asistio']),
               'con_resultado': bool(p['con_resultado']), 'seg': de_agenda[p['agenda_id']]} for p in personas]

    de_cobro = de_cobros(cobros)
    for cobro, c in zip(cobros, fuentes_service._cobros_para_sumar(cobros, claves)):
        fuente = fuentes_service.fuente_de_cobro(c['por_clave'], c['balde']) or 'otras'
        salida.append({'t': 'cobro', 'id': str(cobro.id), 'fuente': fuente, 'origen': _origen_de_cobro(fuente, c),
                       'closer': resolver_nombre_closer(cobro.email_vendedor), 'monto': c['monto'],
                       'es_venta': c['es_venta'], 'seg': de_cobro[cobro.id]})
    salida.extend(_leads_de_setting(desde, hasta))
    return salida, fuentes_service._leads_de_workshop(desde, hasta)


# --- Las cifras --------------------------------------------------------------------------------------

def _sumar(hs):
    fila = {c: sum(1 for h in hs if PERTENECE[c](h)) for c in ('leads', 'agendas', 'reportadas', 'show_up', 'ventas')}
    fila['new_cash'] = round(sum(h['monto'] for h in hs if PERTENECE['new_cash'](h)), 2)
    fila['cash_total'] = round(sum(h['monto'] for h in hs if PERTENECE['cash_total'](h)), 2)
    return fila


def _derivadas(fila, total_cash):
    """Las tasas de una fila: show up (sobre citas con resultado), agenda ÷ lead, cierre (ventas ÷ asistieron),
    ticket (New Cash ÷ ventas) y el % de todo el cash del grupo."""
    reportadas = fila['reportadas'] if fila['reportadas'] is not None else fila['agendas']
    return {
        **fila,
        'pct_show_up': dividir(fila['show_up'] * 100, reportadas, 1),
        'pct_lead_agenda': dividir(fila['agendas'] * 100, fila['leads'], 1) if fila['leads'] else None,
        'pct_cierre': dividir(fila['ventas'] * 100, fila['show_up'], 1),
        'ticket': dividir(fila['new_cash'], fila['ventas']),
        'pct_cash': dividir(fila['cash_total'] * 100, total_cash, 1),
    }


def _ambito(corte, clave, hs):
    """Las fuentes de un grupo: de qué dependen sus leads."""
    return {clave} if corte == 'fuente' else {h['fuente'] for h in hs}


def _tabla(corte, clave, hs, elegidos, clics):
    """{key, label, filas: [una por segmento elegido], total} de un grupo. `clics`: los de Workshop (sus «leads»)."""
    ambito = _ambito(corte, clave, hs)
    parcial = elegidos is not None
    por_seg = cortes.separar(hs, lambda h: h['seg'])
    todo = _sumar(hs)['cash_total']
    leads_de_setting = corte != 'closer' and ambito <= {'setting'}

    def fila(seg, grupo):
        f = _sumar(grupo)
        if not leads_de_setting:
            f['leads'] = None
        return f

    filas = [{'segmento': s, 'label': ETIQUETAS[s], **_derivadas(fila(s, por_seg.get(s, [])), todo)}
             for s in ORDEN if elegidos is None or s in elegidos]
    elegidas = [h for h in hs if elegidos is None or h['seg'] in elegidos]
    total = fila(None, elegidas)
    if corte != 'closer' and ambito == {'workshop'}:
        total['leads'] = None if parcial else clics
    etiqueta = {'fuente': ETIQUETA_FUENTE.get(clave, clave), 'ninguno': 'Todo lo filtrado'}.get(corte, clave)
    return {'key': clave, 'label': etiqueta, 'filas': filas,
            'total': {'segmento': None, 'label': 'Total del filtro' if parcial else 'Total', **_derivadas(total, todo)}}


def _en_juego(hs, corte, fuentes):
    """Los hechos de las fuentes elegidas; en el corte por closer sin los leads (no tienen closer)."""
    return [h for h in hs if h['fuente'] in fuentes and not (corte == 'closer' and h['t'] == 'lead')]


def _separar(hs, corte, fuentes):
    sep = cortes.separar(_en_juego(hs, corte, fuentes), _CLAVE_DE[corte])
    if corte == 'fuente':
        for f in fuentes:
            sep.setdefault(f, [])
    elif corte == 'ninguno':
        sep.setdefault(TODO, [])
    return sep


def _fuentes(valor):
    elegidas = [f for f in FUENTES_TODAS if f in {p.strip() for p in str(valor or '').split(',')}]
    return elegidas or list(FUENTES_TODAS)


def vista(desde, hasta, corte='fuente', fuentes=None, segmentos=None, comparar=None):
    """{corte, fuentes, segmentos, cuentas, grupos: [{key, label, filas, total}], comparacion}.

    `fuentes`: las fuentes que entran (coma; vacío = las tres). `segmentos`: los grupos A/B/C/D/sin a ver (coma; vacío = todos).
    `comparar`: (desde, hasta) del período contra el que se compara; cada fila y total trae `previo` y `delta`."""
    corte = corte if corte in CORTES else 'fuente'
    fuentes = _fuentes(fuentes)
    elegidos = parsear(segmentos)
    hs, clics = hechos(desde, hasta)
    sep = _separar(hs, corte, fuentes)
    previo = hechos(*comparar) if comparar else None
    sep_p = _separar(previo[0], corte, fuentes) if previo else {}
    orden = cortes.claves(sep, sep_p, fijo=fuentes if corte == 'fuente' else ())

    grupos = [_tabla(corte, k, sep.get(k, []), elegidos, clics) for k in orden]
    if previo:
        grupos = cortes.unir_comparacion(grupos, [_tabla(corte, k, sep_p.get(k, []), elegidos, previo[1]) for k in orden],
                                         CAMPOS + DERIVADAS)
    cuentas = {s: sum(1 for h in _en_juego(hs, corte, fuentes) if h['t'] == 'agenda' and h['seg'] == s) for s in ORDEN}
    return {'corte': corte, 'cortes': [{'key': k, 'label': ETIQUETA_CORTE[k]} for k in CORTES],
            'fuentes': [{'key': f, 'label': ETIQUETA_FUENTE[f]} for f in fuentes], 'segmentos': lista(), 'cuentas': cuentas,
            'grupos': grupos,
            'comparacion': {'desde': comparar[0].isoformat(), 'hasta': comparar[1].isoformat()} if comparar else None}


# --- Las otras vistas de Marketing con un segmento elegido ---------------------------------------------

# Lo que se pisa de una fuente cuando se mira un solo segmento: lo que sale de los hechos. El resto (gasto de Meta, costos, ROAS,
# upsells, la serie por día) no se parte por segmento: queda en None o vacío, y la pantalla lo dice.
_PISADAS = ('leads', 'agendas', 'reportadas', 'show_up', 'ventas', 'new_cash', 'cash_total')


def acotar_fuentes(resumen, desde, hasta, segmento):
    """`fuentes_service.resumen` con las cifras de Setting, Workshop y Otras acotadas a los segmentos `segmento` (A…D, sin; coma).
    Sale de la misma matriz de Segmentos (`vista`), así que cada cifra es la de su celda; cuenta siempre por fecha de alta. El
    gasto de Meta no conoce al lead: sin gasto, los costos y el ROAS quedan en None. Los leads de Workshop (clics) tampoco."""
    elegidos = parsear(segmento)
    if not elegidos:
        return resumen
    por_fuente = {g['key']: g['total'] for g in vista(desde, hasta, 'fuente', None, segmento)['grupos']}
    fuentes = []
    for f in resumen['fuentes']:
        t = por_fuente[f['key']]
        base = {k: v for k, v in f.items() if k not in _PISADAS}
        fuentes.append({**fuentes_service.metricas_de_fuente({
            **base, **{k: t[k] for k in _PISADAS}, 'gasto': 0.0, 'agendas_alta': t['agendas'], 'agendas_dias': {},
            'clientes': 0, 'clientes_upsell': 0, 'cuotas': 0, 'cuotas_monto': 0.0, 'upsells': 0, 'upsells_monto': 0.0}),
            'gasto': None})
    otras = por_fuente['otras']
    hs, _clics = hechos(desde, hasta)
    cobros_de_otras = sum(1 for h in hs if h['fuente'] == 'otras' and PERTENECE['cash_total'](h) and h['seg'] in elegidos)
    por_origen = vista(desde, hasta, 'origen', 'otras', segmento)['grupos']
    return {**resumen, 'fuentes': fuentes, 'otras': {
        **{k: v for k, v in resumen['otras'].items() if k not in _PISADAS + ('origenes', 'cobros')},
        'agendas': otras['agendas'], 'show_up': otras['show_up'], 'reportadas': otras['reportadas'], 'agendas_alta': otras['agendas'],
        'agendas_dias': {}, 'pct_show_up': otras['pct_show_up'], 'cash_total': otras['cash_total'], 'new_cash': otras['new_cash'],
        'ventas': otras['ventas'], 'cobros': cobros_de_otras,
        'origenes': [{'origen': g['label'], 'agendas': g['total']['agendas'], 'show_up': g['total']['show_up'],
                      'reportadas': g['total']['reportadas'], 'pct_show_up': g['total']['pct_show_up'],
                      'pct_agendas': dividir(g['total']['agendas'] * 100, otras['agendas'], 1)}
                     for g in por_origen if g['total']['agendas']]},
        'agendas_total': sum(t['agendas'] for t in por_fuente.values()), 'base': 'alta',
        'segmento': {'elegidos': [s for s in ORDEN if s in elegidos]}}


# --- Las listas detrás de cada celda -----------------------------------------------------------------

_COLUMNA_SEGMENTO = {'key': 'segmento', 'header': 'Segmento', 'tipo': 'texto', 'ancho': '110px'}
_COLUMNA_FUENTE = {'key': 'fuente', 'header': 'Fuente', 'tipo': 'texto', 'ancho': '100px'}
_COLUMNA_CLOSER = {'key': 'closer', 'header': 'Closer', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)'}
_UNIDAD = {'agendas': 'personas con agenda', 'reportadas': 'con resultado', 'show_up': 'asistieron', 'ventas': 'ventas',
           'new_cash': 'ventas nuevas', 'cash_total': 'cobros', 'leads': 'entradas por palabra clave'}


def _columnas(base, metrica):
    # La columna «Fuente» de las agendas es el nombre libre de la fuente: pasa a «Origen» para no chocar con la de Setting/Workshop/Otras.
    propias = [{**c, 'header': 'Origen'} if c['key'] == 'origen' and c['header'] == 'Fuente' else c for c in base]
    extra = [_COLUMNA_CLOSER] if metrica in ('ventas', 'new_cash', 'cash_total') else []
    return [propias[0], _COLUMNA_SEGMENTO, _COLUMNA_FUENTE, *propias[1:], *extra]


def registros(desde, hasta, metrica, segmento='', fuentes=None, corte='fuente', grupo=None):
    """La lista de una celda: lo que suma `metrica` en el `grupo` del `corte` (None = todos los grupos) para los segmentos
    `segmento` (A…D, sin; varios por coma; vacío = todos) y las `fuentes` elegidas. Sale de los mismos hechos y de
    `PERTENECE` que la celda: su cantidad es la cifra."""
    elegidos = parsear(segmento)
    if segmento and elegidos is None and not set(str(segmento).replace(' ', '').split(',')) <= set(ORDEN):
        raise ValueError('Segmento desconocido.')
    if metrica in SIN_SEGMENTO_POSIBLE:
        raise ValueError('El gasto de Meta no se parte por segmento: Meta no conoce al lead.')
    if metrica not in PERTENECE:
        raise ValueError('Esa cifra todavía no tiene lista.')
    corte = corte if corte in CORTES else 'fuente'
    fuentes = _fuentes(fuentes)
    if metrica == 'leads' and (fuentes == ['workshop'] or (corte == 'fuente' and grupo == 'workshop')):
        raise ValueError('Los leads de Workshop son clics al grupo de WhatsApp: no traen formulario ni segmento.')

    hs, _clics = hechos(desde, hasta)
    del_corte = _en_juego(hs, corte, fuentes)
    if grupo is not None:
        del_corte = [h for h in del_corte if _CLAVE_DE[corte](h) == grupo]
    elegidos_h = [h for h in del_corte if PERTENECE[metrica](h) and (elegidos is None or h['seg'] in elegidos)]
    por_id = {(h['fuente'], h['id']): h for h in elegidos_h}

    presentes = [f for f in fuentes if any(h['fuente'] == f for h in elegidos_h)] or fuentes[:1]
    filas, columnas = [], None
    for f in presentes:
        base = fuentes_registros_service.registros(f, metrica, desde, hasta)
        columnas = columnas or base['columnas']
        for r in base['filas']:
            h = por_id.get((f, str(r['id'])))
            if h is None:
                continue
            fila = {**r, 'segmento': ETIQUETAS[h['seg']], 'fuente': ETIQUETA_FUENTE[f]}
            if h['t'] == 'cobro':
                fila['closer'] = h['closer']
            filas.append(fila)
    nombre = ' + '.join(ETIQUETAS[s] for s in ORDEN if s in elegidos) if elegidos else 'todos los segmentos'
    resumen = f"{len(filas):,} {_UNIDAD[metrica]} · {nombre}"
    if metrica in ('ventas', 'new_cash', 'cash_total'):
        resumen += f" · ${sum(f['monto'] for f in filas):,.2f}"
    return {'metrica': metrica, 'corte': corte, 'grupo': grupo, 'segmento': ','.join(s for s in ORDEN if s in elegidos) if elegidos else None,
            'resumen': resumen, 'filas': filas, 'columnas': _columnas(columnas, metrica)}
