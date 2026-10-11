"""El reporte diario del setter, versión 2 (10/10/2026): cómo se guarda y cómo se lee.

Es el formulario por pasos que aprobó Kerwin (Entrantes · Aperturas · Embudo · Follow-ups ·
Reflexión · Resumen). Lo que cambia contra el v1:

- Entrantes, no leads, in-abribles, aperturas (en entrantes y en dolor) y agendas van POR CANAL:
  anuncios (`ads_*`) e inbound (`inb_*`).
- Aparecen las bienvenidas: hechas, respondidas y aperturas (`bnv_*`).
- El embudo (dolor → oferta → link) y los follow-ups (entrantes, dolor, oferta, link) son totales y
  reusan las columnas del v1 (`funnel_*`, `*_fu`). La reflexión son dos textos en `reflections`.
- Desde el 11/10/2026 también cuántos respondieron cada follow-up (`followups_respondidos`), en las
  columnas del v1 que ya guardaban eso (`*_fur`): Kerwin pidió el % de respuesta en «Mis datos».

Los cualificados no se cargan: son los entrantes menos los no leads y los in-abribles, por canal.

Los totales del v1 se siguen llenando (`inbox_entrantes`, `not_lead`, `inbox_leads`,
`funnel_qualification`, `funnel_agenda`, aperturas enviadas), así que lo que ya leía esas columnas
—la Vista General de /admin/ventas, Discord, el historial— sigue cuadrando con un reporte v2.

Este módulo es la única puerta: el endpoint del reporte escribe con `escribir`, y quien analiza
(«Mis datos», Comparativas) lee con `leer` y suma con `sumar`, que también entienden las filas v1
(sin canales: solo totales).
"""

CANALES = (('anuncios', 'ads'), ('inbound', 'inb'))
CAMPOS_CANAL = ('entrantes', 'no_lead', 'inabribles', 'ap_entrantes', 'ap_dolor', 'agendas')
BIENVENIDAS = (('hechas', 'bnv_hechas'), ('respondidas', 'bnv_respondidas'), ('aperturas', 'bnv_aperturas'))
EMBUDO = (('dolor', 'funnel_pain'), ('oferta', 'funnel_offer'), ('link', 'funnel_link'))
FOLLOWUPS = (('entrantes', 'qualification_fu'), ('dolor', 'pain_fu'), ('oferta', 'offer_fu'), ('link', 'link_fu'))
# Cuántos respondieron cada follow-up: las columnas `*_fur` del v1, con el mismo significado.
RESPONDIDOS = (('entrantes', 'qualification_fur'), ('dolor', 'pain_fur'), ('oferta', 'offer_fur'), ('link', 'link_fur'))
REFLEXION = ('flujo_trabajo', 'win_del_dia')

# Lo que se suma entre reportes (todo menos la reflexión).
TOTALES = ('entrantes', 'no_lead', 'inabribles', 'cualificados', 'ap_entrantes', 'ap_dolor', 'aperturas', 'agendas')

# Columnas que solo carga el v1 y el formulario nuevo no pide: las respuestas a aperturas, las
# aperturas en oferta y en link, el follow-up post-agenda (enviados y respondidos), la eficacia de
# las dos preguntas, las etapas del pipeline viejo y las respuestas cualitativas. Un día reportado
# con el v1 y vuelto a mandar con el v2 no puede arrastrarlas: la fila diría «9 aperturas
# respondidas» de un reporte que ya no existe, y la tasa de respuesta de la Vista General las
# mezclaría. Las respuestas a los follow-ups de las cuatro etapas ya no son solo del v1.
SOLO_V1 = (
    'opening_responded', 'qualification_opening_responded', 'pain_opening_responded',
    'offer_opening_submitted', 'offer_opening_responded', 'link_opening_submitted', 'link_opening_responded',
    'agenda_fur', 'agenda_fu',
    'q1_useful', 'q1_unuseful', 'q2_useful', 'q2_unuseful',
    'stage_1_value', 'stage_2_value', 'stage_3_value', 'stage_4_value', 'stage_5_value',
)


def _entero(valor):
    """Un número del formulario: entero, nunca negativo; lo que no se entiende es 0."""
    try:
        return max(0, int(valor or 0))
    except (TypeError, ValueError):
        return 0


def cualificados(entrantes, no_lead, inabribles):
    return max(0, _entero(entrantes) - _entero(no_lead) - _entero(inabribles))


def vacio():
    """Un reporte v2 en cero: la forma que manda el formulario."""
    return {
        **{canal: {campo: 0 for campo in CAMPOS_CANAL} for canal, _ in CANALES},
        'bienvenidas': {k: 0 for k, _ in BIENVENIDAS},
        'embudo': {k: 0 for k, _ in EMBUDO},
        'followups': {k: 0 for k, _ in FOLLOWUPS},
        'followups_respondidos': {k: 0 for k, _ in RESPONDIDOS},
        'reflexion': {k: '' for k in REFLEXION},
    }


def escribir(stat, datos):
    """Vuelca un reporte v2 (la forma de `vacio()`) en la fila y la marca como versión 2.

    Llena también los totales del v1, con el mismo significado que tenían:
    `funnel_qualification` era «los que respondieron» y `inbox_leads` = respondieron − no leads,
    que en el v2 son entrantes − in-abribles y los cualificados.
    """
    datos = datos or {}
    tot = dict.fromkeys(('entrantes', 'no_lead', 'inabribles', 'cualificados', 'ap_entrantes', 'ap_dolor', 'agendas'), 0)
    for canal, pre in CANALES:
        del_canal = datos.get(canal) or {}
        valores = {campo: _entero(del_canal.get(campo)) for campo in CAMPOS_CANAL}
        for campo, valor in valores.items():
            setattr(stat, f'{pre}_{campo}', valor)
            tot[campo] += valor
        tot['cualificados'] += cualificados(valores['entrantes'], valores['no_lead'], valores['inabribles'])

    bienvenidas = datos.get('bienvenidas') or {}
    for clave, columna in BIENVENIDAS:
        setattr(stat, columna, _entero(bienvenidas.get(clave)))
    embudo = datos.get('embudo') or {}
    for clave, columna in EMBUDO:
        setattr(stat, columna, _entero(embudo.get(clave)))
    followups = datos.get('followups') or {}
    for clave, columna in FOLLOWUPS:
        setattr(stat, columna, _entero(followups.get(clave)))
    # Un cliente que todavía no manda los respondidos los deja en 0, como antes del 11/10.
    respondidos = datos.get('followups_respondidos') or {}
    for clave, columna in RESPONDIDOS:
        setattr(stat, columna, _entero(respondidos.get(clave)))
    reflexion = datos.get('reflexion') or {}
    stat.reflections = {k: str(reflexion.get(k) or '') for k in REFLEXION}
    if 'is_non_working_day' in datos:
        stat.is_non_working_day = bool(datos.get('is_non_working_day'))

    for columna in SOLO_V1:
        setattr(stat, columna, 0)
    stat.answers = {}

    stat.report_version = 2
    stat.inbox_entrantes = tot['entrantes']
    stat.not_lead = tot['no_lead']
    stat.inbox_inabribles = tot['inabribles']
    stat.inbox_leads = tot['cualificados']
    stat.funnel_qualification = tot['cualificados'] + tot['no_lead']
    stat.funnel_agenda = tot['agendas']
    stat.qualification_opening_submitted = tot['ap_entrantes']
    stat.pain_opening_submitted = tot['ap_dolor']
    stat.opening_submitted = tot['ap_entrantes'] + tot['ap_dolor']
    return stat


def como_v1(stat):
    """La fila vuelve a ser un reporte v1: la pisa un cliente que todavía manda el formulario viejo.

    Sin esto, un día reportado con el v2 y vuelto a mandar con el v1 quedaba marcado como v2 con
    los canales viejos: `leer` mostraba los canales de antes con los totales nuevos, y no sumaban
    lo mismo.
    """
    for _, pre in CANALES:
        for campo in CAMPOS_CANAL:
            setattr(stat, f'{pre}_{campo}', 0)
    for _, columna in BIENVENIDAS:
        setattr(stat, columna, 0)
    stat.report_version = 1
    return stat


def leer(stat):
    """La fila como reporte v2. Una fila v1 vuelve con `canales` y `bienvenidas` en None y los
    totales sacados de sus columnas: no se inventa en qué canal entró cada uno. Los follow-ups y sus
    respondidos (`followups_respondidos`) salen de las mismas columnas en los dos formularios."""
    v2 = (getattr(stat, 'report_version', None) or 1) >= 2
    if v2:
        canales = {}
        for canal, pre in CANALES:
            valores = {campo: _entero(getattr(stat, f'{pre}_{campo}', 0)) for campo in CAMPOS_CANAL}
            valores['cualificados'] = cualificados(valores['entrantes'], valores['no_lead'], valores['inabribles'])
            valores['aperturas'] = valores['ap_entrantes'] + valores['ap_dolor']
            canales[canal] = valores
        totales = {k: sum(c[k] for c in canales.values()) for k in TOTALES}
        bienvenidas = {k: _entero(getattr(stat, columna, 0)) for k, columna in BIENVENIDAS}
    else:
        canales = None
        bienvenidas = None
        no_lead = _entero(stat.not_lead)
        cual = _entero(stat.inbox_leads) or max(0, _entero(stat.funnel_qualification) - no_lead)
        ap_entrantes = _entero(stat.qualification_opening_submitted)
        ap_dolor = _entero(stat.pain_opening_submitted)
        totales = {
            'entrantes': _entero(stat.inbox_entrantes), 'no_lead': no_lead,
            'inabribles': _entero(stat.inbox_inabribles), 'cualificados': cual,
            'ap_entrantes': ap_entrantes, 'ap_dolor': ap_dolor, 'aperturas': ap_entrantes + ap_dolor,
            'agendas': _entero(stat.funnel_agenda),
        }

    reflexiones = stat.reflections if isinstance(stat.reflections, dict) else {}
    return {
        'id': getattr(stat, 'id', None),
        'setter_id': stat.setter_id,
        'fecha': stat.date.isoformat() if stat.date else None,
        'version': 2 if v2 else 1,
        'no_laborable': bool(stat.is_non_working_day),
        'canales': canales,
        'bienvenidas': bienvenidas,
        'totales': totales,
        'embudo': {'cualificados': totales['cualificados'],
                   **{k: _entero(getattr(stat, columna, 0)) for k, columna in EMBUDO},
                   'agendas': totales['agendas']},
        'followups': {k: _entero(getattr(stat, columna, 0)) for k, columna in FOLLOWUPS},
        'followups_respondidos': {k: _entero(getattr(stat, columna, 0)) for k, columna in RESPONDIDOS},
        'reflexion': {k: str(reflexiones.get(k) or '') for k in REFLEXION},
    }


def a_formulario(lectura):
    """Una lectura v2 de vuelta a la forma de `vacio()` (lo que manda el formulario), con el día no
    laborable: para editar una fila partiendo de lo que tiene. Una lectura v1 no tiene canales y
    devuelve None: no se puede rehacer por canal sin inventar."""
    if not lectura or lectura.get('version') != 2:
        return None
    return {
        **{canal: {campo: lectura['canales'][canal][campo] for campo in CAMPOS_CANAL} for canal, _ in CANALES},
        'bienvenidas': dict(lectura['bienvenidas']),
        'embudo': {k: lectura['embudo'][k] for k, _ in EMBUDO},
        'followups': dict(lectura['followups']),
        'followups_respondidos': dict(lectura['followups_respondidos']),
        'reflexion': dict(lectura['reflexion']),
        'is_non_working_day': lectura['no_laborable'],
    }


def avisos(lectura):
    """Los avisos de un reporte v2, los mismos que muestra el formulario (`calcular` en
    `frontend/src/pages/setter/reporte/modelo.js`): `[{paso, nivel, msg}]`.

    `err` es lo único que el formulario no deja enviar (no leads + in-abribles por encima de los
    mensajes del canal); `warn` se manda igual y queda a la vista de quien lea el reporte. Un v1 no
    tiene avisos: sus números no se cargaban por canal.
    """
    if not lectura or lectura.get('version') != 2:
        return []
    salida = []
    nombres = {'anuncios': 'Anuncios', 'inbound': 'Inbound'}
    dolor_en_aperturas = 0
    for canal, _ in CANALES:
        d = lectura['canales'][canal]
        if d['no_lead'] + d['inabribles'] > d['entrantes']:
            salida.append({'paso': 'entrantes', 'nivel': 'err',
                           'msg': f"{nombres[canal]}: no leads e in-abribles superan los {d['entrantes']} mensajes"})
        if d['ap_entrantes'] + d['ap_dolor'] > d['entrantes']:
            salida.append({'paso': 'aperturas', 'nivel': 'warn',
                           'msg': f"{nombres[canal]}: más aperturas que entrantes ({d['entrantes']})"})
        dolor_en_aperturas += d['ap_dolor']
    b = lectura['bienvenidas']
    if b['respondidas'] > b['hechas']:
        salida.append({'paso': 'entrantes', 'nivel': 'warn', 'msg': 'Bienvenidas: más respondidas que hechas'})
    if b['aperturas'] > b['respondidas']:
        salida.append({'paso': 'aperturas', 'nivel': 'warn',
                       'msg': f"Bienvenidas: más aperturas que respuestas ({b['respondidas']})"})
    e = lectura['embudo']
    etapas = [e['cualificados'], e['dolor'], e['oferta'], e['link'], e['agendas']]
    nombres_g = ['', 'Dolor', 'Oferta', 'Link', 'Agendas']
    previos = ['cualificados', 'dolor', 'oferta', 'link']
    for i in range(1, len(etapas)):
        if etapas[i] > etapas[i - 1]:
            salida.append({'paso': 'embudo', 'nivel': 'warn',
                           'msg': f'{nombres_g[i]} supera a {previos[i - 1]} ({etapas[i - 1]})'})
    if dolor_en_aperturas > e['dolor']:
        salida.append({'paso': 'embudo', 'nivel': 'warn',
                       'msg': f'Dolor es menor que las aperturas en dolor ({dolor_en_aperturas})'})
    fu, resp = lectura['followups'], lectura['followups_respondidos']
    for clave, nombre in (('entrantes', 'Entrantes'), ('dolor', 'Dolor'), ('oferta', 'Oferta'), ('link', 'Link')):
        if resp[clave] > fu[clave]:
            salida.append({'paso': 'followups', 'nivel': 'warn',
                           'msg': f'{nombre}: más respuestas que follow-ups ({fu[clave]})'})
    return salida


def sumar(lecturas):
    """Suma varias lecturas (`leer`) de un período o de un equipo.

    Los canales y las bienvenidas suman solo los reportes v2; lo que vino en reportes v1 entra en
    los totales y además aparte, en `sin_canal`, para que una vista por canal no lo pierda en
    silencio ni lo reparta inventando.
    """
    todas = [l for l in lecturas if l]
    lecturas = [l for l in todas if not l['no_laborable']]
    v2 = [l for l in lecturas if l['version'] == 2]
    v1 = [l for l in lecturas if l['version'] == 1]
    canales = {canal: {k: sum(l['canales'][canal][k] for l in v2) for k in (*CAMPOS_CANAL, 'cualificados', 'aperturas')}
               for canal, _ in CANALES}
    return {
        'reportes': len(lecturas),
        'no_laborables': len(todas) - len(lecturas),
        'reportes_v2': len(v2),
        'canales': canales,
        'sin_canal': {k: sum(l['totales'][k] for l in v1) for k in TOTALES},
        'bienvenidas': {k: sum(l['bienvenidas'][k] for l in v2) for k, _ in BIENVENIDAS},
        'totales': {k: sum(l['totales'][k] for l in lecturas) for k in TOTALES},
        'embudo': {k: sum(l['embudo'][k] for l in lecturas) for k in ('cualificados', 'dolor', 'oferta', 'link', 'agendas')},
        'followups': {k: sum(l['followups'][k] for l in lecturas) for k, _ in FOLLOWUPS},
        'followups_respondidos': {k: sum(l['followups_respondidos'][k] for l in lecturas) for k, _ in RESPONDIDOS},
    }
