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

Correcciones del dueño (15/10/2026):

- **Leads.** Hasta ese día los cualificados no se cargaban: eran entrantes − no leads − in-abribles,
  así que el que no contestó contaba como cualificado («hay personas que no contestan»). Ahora el
  setter carga los leads de cada canal: cualificados = leads, y lo que sobra
  (entrantes − no leads − in-abribles − leads) son los que no contestaron. Es lo que medía el v1,
  donde «Cualificación» eran los que respondieron.
- **Respuestas a las aperturas.** Cuántos respondieron las aperturas en entrantes y en dolor de
  cada canal, y las de las bienvenidas: «de esas aperturas que hiciste, ¿cuántas te respondieron?».

Esos campos son opcionales en la fila (NULL = el reporte no los cargó, todo lo de antes): un reporte
viejo sigue con la cuenta vieja de cualificados, y su respuesta a aperturas no existe —no es cero—,
así que no entra en la tasa.

Los totales del v1 se siguen llenando (`inbox_entrantes`, `not_lead`, `inbox_leads`,
`funnel_qualification`, `funnel_agenda`, aperturas enviadas), así que lo que ya leía esas columnas
—la Vista General de /admin/ventas, Discord, el historial— sigue cuadrando con un reporte v2.

Este módulo es la única puerta: el endpoint del reporte escribe con `escribir`, y quien analiza
(«Mis datos», Comparativas) lee con `leer` y suma con `sumar`, que también entienden las filas v1
(sin canales: solo totales).
"""

CANALES = (('anuncios', 'ads'), ('inbound', 'inb'))
CAMPOS_CANAL = ('entrantes', 'no_lead', 'inabribles', 'ap_entrantes', 'ap_dolor', 'agendas')
# Los del 15/10/2026: NULL en la fila si el reporte no los cargó (ver arriba).
OPCIONALES_CANAL = ('leads', 'ap_entrantes_resp', 'ap_dolor_resp')
BIENVENIDAS = (('hechas', 'bnv_hechas'), ('respondidas', 'bnv_respondidas'), ('aperturas', 'bnv_aperturas'))
# Cuántos respondieron las aperturas de las bienvenidas: opcional como los de arriba.
BNV_RESPUESTAS = ('aperturas_resp', 'bnv_aperturas_resp')
EMBUDO = (('dolor', 'funnel_pain'), ('oferta', 'funnel_offer'), ('link', 'funnel_link'))
FOLLOWUPS = (('entrantes', 'qualification_fu'), ('dolor', 'pain_fu'), ('oferta', 'offer_fu'), ('link', 'link_fu'))
# Cuántos respondieron cada follow-up: las columnas `*_fur` del v1, con el mismo significado.
RESPONDIDOS = (('entrantes', 'qualification_fur'), ('dolor', 'pain_fur'), ('oferta', 'offer_fur'), ('link', 'link_fur'))
REFLEXION = ('flujo_trabajo', 'win_del_dia')

# Lo que se suma entre reportes (todo menos la reflexión). `no_contestaron` de un reporte de antes
# del 15/10 es 0: esos estaban adentro de sus cualificados, así cualificados + no contestaron + no
# leads + in-abribles siguen siendo los entrantes.
TOTALES = ('entrantes', 'no_lead', 'inabribles', 'cualificados', 'no_contestaron', 'ap_entrantes', 'ap_dolor',
           'aperturas', 'agendas')

# Columnas que solo carga el v1 y el formulario nuevo no pide: las aperturas en oferta y en link
# (enviadas y respondidas), el follow-up post-agenda (enviados y respondidos), la eficacia de las dos
# preguntas, las etapas del pipeline viejo y las respuestas cualitativas. Un día reportado con el v1
# y vuelto a mandar con el v2 no puede arrastrarlas: la fila diría «9 aperturas respondidas» de un
# reporte que ya no existe, y la tasa de respuesta de la Vista General las mezclaría. Las respuestas
# a los follow-ups de las cuatro etapas, y desde el 15/10 las de las aperturas en entrantes y en
# dolor, ya no son solo del v1: `escribir` las llena con lo del v2.
SOLO_V1 = (
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


def _opcional(valor):
    """Un campo del 15/10: None si no vino (el reporte no lo cargó); si vino, como `_entero`."""
    return None if valor is None else _entero(valor)


def cualificados(entrantes, no_lead, inabribles, leads=None):
    """Los leads que cargó el setter; sin ellos (un reporte de antes del 15/10), la cuenta de antes:
    entrantes − no leads − in-abribles."""
    if leads is not None:
        return _entero(leads)
    return max(0, _entero(entrantes) - _entero(no_lead) - _entero(inabribles))


def no_contestaron(entrantes, no_lead, inabribles, leads=None):
    """Los entrantes que no son leads cualificados, ni no leads, ni in-abribles: no contestaron. 0 sin leads
    cargados: en ese reporte estaban adentro de los cualificados."""
    if leads is None:
        return 0
    return max(0, _entero(entrantes) - _entero(no_lead) - _entero(inabribles) - _entero(leads))


def _suma_opcional(valores):
    """La suma de los que se cargaron, o None si ninguno."""
    cargados = [v for v in valores if v is not None]
    return sum(cargados) if cargados else None


def vacio():
    """Un reporte v2 en cero: la forma que manda el formulario. Sin los campos opcionales del 15/10
    (`OPCIONALES_CANAL`, `aperturas_resp`): el formulario los manda siempre, y quien no los manda
    queda con la cuenta de antes (ver `cualificados`)."""
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
    tot = dict.fromkeys(('entrantes', 'no_lead', 'inabribles', 'cualificados', 'ap_entrantes', 'ap_dolor', 'agendas',
                         'ap_entrantes_resp', 'ap_dolor_resp'), 0)
    for canal, pre in CANALES:
        del_canal = datos.get(canal) or {}
        valores = {campo: _entero(del_canal.get(campo)) for campo in CAMPOS_CANAL}
        for campo, valor in valores.items():
            setattr(stat, f'{pre}_{campo}', valor)
            tot[campo] += valor
        # Un cliente que no los manda (el formulario de antes del 15/10) los deja en NULL.
        opcionales = {campo: _opcional(del_canal.get(campo)) for campo in OPCIONALES_CANAL}
        for campo, valor in opcionales.items():
            setattr(stat, f'{pre}_{campo}', valor)
            if campo != 'leads':
                tot[campo] += valor or 0
        tot['cualificados'] += cualificados(valores['entrantes'], valores['no_lead'], valores['inabribles'],
                                            opcionales['leads'])

    bienvenidas = datos.get('bienvenidas') or {}
    for clave, columna in BIENVENIDAS:
        setattr(stat, columna, _entero(bienvenidas.get(clave)))
    setattr(stat, BNV_RESPUESTAS[1], _opcional(bienvenidas.get(BNV_RESPUESTAS[0])))
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
    # Las respuestas a esas aperturas, en las columnas del v1 que ya las guardaban.
    stat.qualification_opening_responded = tot['ap_entrantes_resp']
    stat.pain_opening_responded = tot['ap_dolor_resp']
    stat.opening_responded = tot['ap_entrantes_resp'] + tot['ap_dolor_resp']
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
        for campo in OPCIONALES_CANAL:
            setattr(stat, f'{pre}_{campo}', None)
    for _, columna in BIENVENIDAS:
        setattr(stat, columna, 0)
    setattr(stat, BNV_RESPUESTAS[1], None)
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
            valores.update({campo: _opcional(getattr(stat, f'{pre}_{campo}', None)) for campo in OPCIONALES_CANAL})
            base = (valores['entrantes'], valores['no_lead'], valores['inabribles'], valores['leads'])
            valores['cualificados'] = cualificados(*base)
            valores['no_contestaron'] = no_contestaron(*base)
            valores['aperturas'] = valores['ap_entrantes'] + valores['ap_dolor']
            # None si el reporte no cargó las respuestas (no es «nadie respondió»).
            valores['ap_respondidas'] = _suma_opcional((valores['ap_entrantes_resp'], valores['ap_dolor_resp']))
            canales[canal] = valores
        totales = {k: sum(c[k] for c in canales.values()) for k in TOTALES}
        totales['ap_respondidas'] = _suma_opcional(c['ap_respondidas'] for c in canales.values())
        bienvenidas = {k: _entero(getattr(stat, columna, 0)) for k, columna in BIENVENIDAS}
        bienvenidas[BNV_RESPUESTAS[0]] = _opcional(getattr(stat, BNV_RESPUESTAS[1], None))
    else:
        canales = None
        bienvenidas = None
        no_lead = _entero(stat.not_lead)
        cual = _entero(stat.inbox_leads) or max(0, _entero(stat.funnel_qualification) - no_lead)
        ap_entrantes = _entero(stat.qualification_opening_submitted)
        ap_dolor = _entero(stat.pain_opening_submitted)
        totales = {
            'entrantes': _entero(stat.inbox_entrantes), 'no_lead': no_lead,
            'inabribles': _entero(stat.inbox_inabribles), 'cualificados': cual, 'no_contestaron': 0,
            'ap_entrantes': ap_entrantes, 'ap_dolor': ap_dolor, 'aperturas': ap_entrantes + ap_dolor,
            'agendas': _entero(stat.funnel_agenda),
            # El v1 ya pedía cuántos respondieron cada apertura (enviadas / respondidas).
            'ap_respondidas': _entero(stat.qualification_opening_responded) + _entero(stat.pain_opening_responded),
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
        **{canal: {campo: lectura['canales'][canal][campo] for campo in (*CAMPOS_CANAL, *OPCIONALES_CANAL)}
           for canal, _ in CANALES},
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
        if d['no_lead'] + d['inabribles'] + (d.get('leads') or 0) > d['entrantes']:
            quienes = 'leads cualificados, no leads e in-abribles' if d.get('leads') is not None else 'no leads e in-abribles'
            salida.append({'paso': 'entrantes', 'nivel': 'err',
                           'msg': f"{nombres[canal]}: {quienes} superan los {d['entrantes']} mensajes"})
        if d['ap_entrantes'] + d['ap_dolor'] > d['entrantes']:
            salida.append({'paso': 'aperturas', 'nivel': 'warn',
                           'msg': f"{nombres[canal]}: más aperturas que entrantes ({d['entrantes']})"})
        for clave, nombre in (('ap_entrantes', 'en entrantes'), ('ap_dolor', 'en dolor')):
            if (d.get(f'{clave}_resp') or 0) > d[clave]:
                salida.append({'paso': 'aperturas', 'nivel': 'warn',
                               'msg': f"{nombres[canal]}: más respuestas que aperturas {nombre} ({d[clave]})"})
        dolor_en_aperturas += d['ap_dolor']
    b = lectura['bienvenidas']
    if b['respondidas'] > b['hechas']:
        salida.append({'paso': 'entrantes', 'nivel': 'warn', 'msg': 'Bienvenidas: más respondidas que hechas'})
    if b['aperturas'] > b['respondidas']:
        salida.append({'paso': 'aperturas', 'nivel': 'warn',
                       'msg': f"Bienvenidas: más aperturas que respuestas ({b['respondidas']})"})
    if (b.get('aperturas_resp') or 0) > b['aperturas']:
        salida.append({'paso': 'aperturas', 'nivel': 'warn',
                       'msg': f"Bienvenidas: más respuestas que aperturas ({b['aperturas']})"})
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
    canales = {canal: {k: sum(l['canales'][canal][k] for l in v2)
                       for k in (*CAMPOS_CANAL, 'cualificados', 'no_contestaron', 'aperturas')}
               for canal, _ in CANALES}

    def respuesta(pares):
        """Aperturas y respondidas, solo de los reportes que cargaron cuántos respondieron: un reporte
        sin ese dato no baja la tasa con un cero que no es cierto. `respondidas` None si ninguno."""
        con_dato = [(a, r) for a, r in pares if r is not None]
        return {'aperturas': sum(a for a, _ in con_dato),
                'respondidas': sum(r for _, r in con_dato) if con_dato else None}

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
        # «De esas aperturas que hiciste, ¿cuántas te respondieron?» (15/10/2026). `total` también
        # trae los v1, que ya cargaban enviadas / respondidas; los canales y las bienvenidas, solo v2.
        'respuesta_aperturas': {
            **{canal: respuesta((l['canales'][canal]['aperturas'], l['canales'][canal]['ap_respondidas'])
                                for l in v2) for canal, _ in CANALES},
            'sin_canal': respuesta((l['totales']['aperturas'], l['totales']['ap_respondidas']) for l in v1),
            'total': respuesta((l['totales']['aperturas'], l['totales']['ap_respondidas']) for l in lecturas),
            'bienvenidas': respuesta((l['bienvenidas']['aperturas'], l['bienvenidas']['aperturas_resp'])
                                     for l in v2),
        },
    }
