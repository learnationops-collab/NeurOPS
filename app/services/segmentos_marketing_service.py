"""Marketing por SEGMENTO: la matriz A/B/C/D (+ «sin segmento») × Setting / Workshop (Gabriela, 28/10/2026).

Cada fuente trae, por segmento, las cifras que dice su propio resumen (`fuentes_service`): leads, agendas, show
up, ventas y cash. **Salen del mismo código que las cifras de la fuente**, no de una consulta parecida:
las personas con agenda son `conteo_agendas_service.personas` (base alta), los cobros `_cobros_para_sumar` y los
leads de Setting `anuncios_service.entradas_del_periodo`. Cada uno se reparte en su grupo con
`segmentos_lectura` (el segmento de la persona), así los cinco grupos suman exactamente la cifra de la fuente.

  · **Leads**: Setting, las personas que entraron por una palabra clave (con el segmento de quien llenó el
    formulario; el resto es «sin segmento»). Workshop NO se parte: sus leads son clics al grupo de WhatsApp,
    anónimos, y no hay a quién mirarle el formulario; su total va entero y por segmento queda en None.
  · **Costo por lead por segmento: pendiente** (decisión de negocio 839). Meta no conoce el segmento: o se
    prorratea el gasto por la mezcla de segmentos, o se divide el gasto de la fuente por los leads del
    segmento. No se calcula hasta que se decida; ver `docs/pendientes_santi.md`.
"""
from app.services import anuncios_service, conteo_agendas_service, fuentes_registros_service, fuentes_service
from app.services.fuentes_service import FUENTES, dividir
from app.services.segmentos_lectura import (
    ETIQUETAS, ORDEN, SIN, de_agendas_del_libro, de_cobros, de_conversaciones, lista, parsear,
)

CAMPOS = ('leads', 'agendas', 'reportadas', 'show_up', 'ventas', 'new_cash', 'cash_total')
# Lo que NO se puede partir por segmento (gasto de Meta: no conoce al lead).
SIN_SEGMENTO_POSIBLE = ('gasto',)


def _vacia():
    return {c: 0 for c in CAMPOS}


def _derivadas(fila, total_cash):
    """Las tasas de una fila: show up (sobre citas con resultado), agenda ÷ lead, cierre (ventas ÷ asistieron),
    ticket (New Cash ÷ ventas) y el % de todo el cash de la fuente."""
    reportadas = fila['reportadas'] if fila['reportadas'] is not None else fila['agendas']
    return {
        **fila,
        'pct_show_up': dividir(fila['show_up'] * 100, reportadas, 1),
        'pct_lead_agenda': dividir(fila['agendas'] * 100, fila['leads'], 1) if fila['leads'] else None,
        'pct_cierre': dividir(fila['ventas'] * 100, fila['show_up'], 1),
        'ticket': dividir(fila['new_cash'], fila['ventas']),
        'pct_cash': dividir(fila['cash_total'] * 100, total_cash, 1),
    }


def _leads_de_setting(desde, hasta):
    """[clave del grupo] de cada entrada por palabra clave del período (las mismas de la tabla de Marketing: sin
    las palabras clave archivadas)."""
    desde_dt, hasta_dt = anuncios_service._limites(desde, hasta)
    archivadas = fuentes_registros_service._claves_archivadas()
    entradas = [e for e in anuncios_service.entradas_del_periodo(desde_dt, hasta_dt, anuncios_service._clave_de_cada_anuncio())
                if e['clave'] not in archivadas]
    grupo = de_conversaciones({e['lead_id'] for e in entradas})
    return [grupo.get(e['lead_id'], SIN) for e in entradas]


def por_segmento(desde, hasta, cobros, claves, fuentes):
    """{segmentos, fuentes: [{key, label, filas: [una por grupo], total}]}.

    `cobros` y `claves`: los del período (`anuncios_service._ventas`); `fuentes`: `fuentes_service.resumen()['fuentes']`,
    de donde sale el total de leads de Workshop (clics)."""
    acumulado = {f['key']: {s: _vacia() for s in ORDEN} for f in FUENTES}

    # La matriz cuenta siempre por fecha de alta (las agendas del libro: son las que tienen formulario y segmento);
    # «Otras» no entra: no tiene leads ni gasto que partir.
    personas = [p for p in conteo_agendas_service.personas(desde, hasta, 'alta') if p['fuente'] in acumulado]
    grupo_de_agenda = de_agendas_del_libro(p['agenda_id'] for p in personas)
    for p in personas:
        fila = acumulado[p['fuente']][grupo_de_agenda[p['agenda_id']]]
        fila['agendas'] += 1
        fila['show_up'] += 1 if p['asistio'] else 0
        fila['reportadas'] += 1 if p['con_resultado'] else 0

    de_cobro = fuentes_service._cobros_para_sumar(cobros, claves)
    grupo_de_cobro = de_cobros(cobros)
    for cobro, c in zip(cobros, de_cobro):
        fuente = fuentes_service.fuente_de_cobro(c['por_clave'], c['balde'])
        if fuente is None:
            continue
        fila = acumulado[fuente][grupo_de_cobro[cobro.id]]
        fila['cash_total'] += c['monto']
        if c['es_venta']:
            fila['new_cash'] += c['monto']
            fila['ventas'] += 1

    for grupo in _leads_de_setting(desde, hasta):
        acumulado['setting'][grupo]['leads'] += 1

    leads_workshop = next((f['leads'] for f in fuentes if f['key'] == 'workshop'), None)
    salida = []
    for f in FUENTES:
        k = f['key']
        filas = acumulado[k]
        for fila in filas.values():
            fila['cash_total'], fila['new_cash'] = round(fila['cash_total'], 2), round(fila['new_cash'], 2)
            if k == 'workshop':
                fila['leads'] = None
        total = {c: sum(filas[s][c] or 0 for s in ORDEN) for c in CAMPOS}
        total['new_cash'], total['cash_total'] = round(total['new_cash'], 2), round(total['cash_total'], 2)
        if k == 'workshop':
            total['leads'] = leads_workshop
        salida.append({**f, 'filas': [{'segmento': s, 'label': ETIQUETAS[s], **_derivadas(filas[s], total['cash_total'])}
                                      for s in ORDEN],
                       'total': {'segmento': None, 'label': 'Total', **_derivadas(total, total['cash_total'])}})
    return {'segmentos': lista(), 'fuentes': salida}


# --- Las listas detrás de cada celda -----------------------------------------------------------------

_COLUMNA_SEGMENTO = {'key': 'segmento', 'header': 'Segmento', 'tipo': 'texto', 'ancho': '110px'}
_UNIDAD = {'agendas': 'personas con agenda', 'reportadas': 'con resultado', 'show_up': 'asistieron', 'ventas': 'ventas',
           'new_cash': 'ventas nuevas', 'cash_total': 'cobros', 'leads': 'entradas por palabra clave'}


def _grupos_de(fuente, metrica, filas):
    """{id de la fila: clave del grupo} de las filas de una lista de `fuentes_registros_service`."""
    from app.models import FinancialSale

    if metrica in ('agendas', 'reportadas', 'show_up'):
        return {str(i): g for i, g in de_agendas_del_libro(int(f['id']) for f in filas).items()}
    if metrica == 'leads':
        grupo = de_conversaciones({int(f['id'].split('-')[0]) for f in filas})
        return {f['id']: grupo.get(int(f['id'].split('-')[0]), SIN) for f in filas}
    cobros = FinancialSale.query.filter(FinancialSale.id.in_([int(f['id']) for f in filas])).all() if filas else []
    return {str(i): g for i, g in de_cobros(cobros).items()}


def registros(fuente, metrica, segmento, desde, hasta):
    """La lista de una celda de la matriz: lo que suma `metrica` en `fuente` para el grupo `segmento` ('A'…'D',
    'sin'; varios separados por coma; vacío = todos). Es la lista de `fuentes_registros_service` con una columna
    de segmento y solo las filas del grupo: su suma es la celda."""
    elegidos = parsear(segmento)
    if segmento and elegidos is None and not set(str(segmento).replace(' ', '').split(',')) <= set(ORDEN):
        raise ValueError('Segmento desconocido.')
    if metrica in SIN_SEGMENTO_POSIBLE:
        raise ValueError('El gasto de Meta no se parte por segmento: Meta no conoce al lead.')
    if fuente == 'workshop' and metrica == 'leads':
        raise ValueError('Los leads de Workshop son clics al grupo de WhatsApp: no traen formulario ni segmento.')
    base = fuentes_registros_service.registros(fuente, metrica, desde, hasta)
    grupo_de = _grupos_de(fuente, metrica, base['filas'])
    filas = []
    for f in base['filas']:
        g = grupo_de.get(str(f['id']), SIN)
        if elegidos is None or g in elegidos:
            filas.append({**f, 'segmento': ETIQUETAS[g]})
    nombre = ' + '.join(ETIQUETAS[s] for s in ORDEN if s in elegidos) if elegidos else 'todos los segmentos'
    resumen = f"{len(filas):,} {_UNIDAD.get(metrica, 'filas')} · {nombre}"
    if metrica in ('ventas', 'new_cash', 'cash_total'):
        resumen += f" · ${sum(f['monto'] for f in filas):,.2f}"
    return {'fuente': fuente, 'metrica': metrica, 'segmento': ','.join(s for s in ORDEN if s in elegidos) if elegidos else None,
            'resumen': resumen, 'filas': filas, 'columnas': [base['columnas'][0], _COLUMNA_SEGMENTO, *base['columnas'][1:]]}
