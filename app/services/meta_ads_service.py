"""El gasto diario de cada anuncio, traído de Meta Ads (Marketing API) sin cargar nada a mano.

**Cómo se conecta.** Un token de un *usuario del sistema* del Business Manager dueño de la cuenta
publicitaria, con el permiso `ads_read` (no vence), en `META_ADS_TOKEN`, y los ids de las cuentas en
`META_AD_ACCOUNT_IDS` (separados por coma, con o sin `act_`). `META_GRAPH_VERSION` cambia la versión
de la Graph API. Sin las dos primeras variables no se sincroniza nada y la pantalla lo dice.

**Qué trae** (`sincronizar`):
  · los anuncios que gastaron en el período con su estado, su campaña, su conjunto y el TEXTO del
    creativo (`MetaAnuncio`): de ahí sale la palabra clave («Comenta QUIERO APLICAR y…»). Los que no
    gastaron no se piden: la cuenta tiene miles y no cambian ningún número;
  · el gasto de cada anuncio por día, con sus impresiones, clics y clics en el enlace
    (`MetaGastoDiario`, insights con `time_increment=1`): de ahí salen el CPM, el CPC y los clics de
    cada workshop (`workshop_meta_service`). Por defecto
    los últimos 7 días: Meta todavía ajusta el gasto de los días recientes y volver a pedirlos lo deja
    al día. Pedirlo de nuevo pisa el valor del día, no lo suma.

**Cuándo.** Una vez por día con el cron (`GET /api/marketing/anuncios/cron/meta`, con `CRON_SECRET`) y
cuando alguien toca «Sincronizar» en la pantalla. Además, `sincronizar_estado` (16/10/2026) trae solo lo
que se cambia en el Administrador de anuncios (nombres, estados, campaña y conjunto) y el gasto de los
últimos días: la pantalla lo pide con «Actualizar» y sola al volver de Meta.

**La palabra clave de cada anuncio de Meta** (`mapear_automatico`): si nadie la eligió a mano, se busca
la que el anuncio pide escribir (así se escriben: «Respondé EARN», «comentá CURSO GRATUITO»), ver
`detectar_clave`. La que no se encuentra queda «sin palabra clave» y se elige a mano en la pantalla
(`asignar_clave`), que la fija.
"""
import json
import os
import re
import time
from collections import defaultdict
from datetime import date, datetime, timedelta
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import requests

from app import db
from app.models import MetaAnuncio, MetaGastoDiario

GRAPH = 'https://graph.facebook.com'
VERSION_POR_DEFECTO = 'v24.0'
DIAS_POR_DEFECTO = 7
DIAS_MAXIMOS = 180
PAGINAS_MAXIMAS = 100
CAMPOS_DEL_ANUNCIO = ('id,name,effective_status,campaign{id,name},adset{id,name},'
                      'creative{id,name,body,title,call_to_action_type,'
                      'object_story_spec{link_data{link,call_to_action},video_data{call_to_action}},'
                      'asset_feed_spec{bodies,link_urls{website_url}}}')
# La ficha liviana (16/10/2026): lo que se cambia a mano en el Administrador de anuncios (nombre, estado,
# campaña y conjunto), sin el creativo, que es lo que pesa. `effective_status` del anuncio ya dice si su
# conjunto o su campaña están pausados (ADSET_PAUSED, CAMPAIGN_PAUSED).
CAMPOS_DE_ESTADO = 'id,name,effective_status,campaign{id,name},adset{id,name}'
CAMPOS_DE_INSIGHTS = ('ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,spend,account_currency,'
                      'impressions,clicks,inline_link_clicks,actions')

# La columna Leads de Meta: `lead` junta el píxel y los formularios de Meta; si no viene, el del píxel.
TIPOS_DE_LEAD = ('lead', 'offsite_conversion.fb_pixel_lead')


def leads_de(fila):
    """Los Leads de una fila de insights (0 si no tuvo)."""
    acciones = {a.get('action_type'): a.get('value') for a in (fila.get('actions') or [])}
    for tipo in TIPOS_DE_LEAD:
        if tipo in acciones:
            return _entero(acciones[tipo]) or 0
    return 0


FICHAS_POR_PEDIDO = 50  # el máximo de `?ids=` de la Graph API
LIMITE_MINIMO = 5
# «Please reduce the amount of data you're asking for»: la página pesa demasiado (pasa con los creativos).
CODIGO_DEMASIADOS_DATOS = 1


class ErrorDeMeta(Exception):
    """La sincronización no se pudo hacer (falta configurarla, el token venció, Meta respondió error)."""

    def __init__(self, mensaje, codigo=None):
        super().__init__(mensaje)
        self.codigo = codigo
        self.pasajero = False


def configuracion():
    token = (os.environ.get('META_ADS_TOKEN') or '').strip()
    cuentas = [c.strip().removeprefix('act_') for c in (os.environ.get('META_AD_ACCOUNT_IDS') or '').split(',')
               if c.strip()]
    version = (os.environ.get('META_GRAPH_VERSION') or '').strip() or VERSION_POR_DEFECTO
    return token, cuentas, version


def configurado():
    token, cuentas, _ = configuracion()
    return bool(token and cuentas)


def modo_muestra():
    """Servidor de prueba sin token (15/10/2026, pedido de Kerwin para presentar la pantalla): con
    `META_ADS_DEMO=true` la pantalla se ve conectada con los anuncios y el gasto que se cargaron de muestra
    (una foto real de la cuenta). No sincroniza nada; con el token cargado deja de valer y la primera
    sincronización reemplaza esos días (ver `sincronizar`)."""
    return (os.environ.get('META_ADS_DEMO') or '').strip().lower() == 'true' and not configurado()


def ultima_sincronizacion():
    ultima = db.session.query(db.func.max(MetaGastoDiario.actualizado_at)).scalar()
    anuncios = db.session.query(db.func.max(MetaAnuncio.actualizado_at)).scalar()
    candidatas = [x for x in (ultima, anuncios) if x]
    return max(candidatas) if candidatas else None


# --- La Graph API --------------------------------------------------------------------------------

# Segundos antes de cada reintento de un error pasajero de Meta («Service temporarily unavailable»,
# código 2, o los que Meta marca `is_transient`): el 15/10/2026 cortó una sincronización de 180 días a
# la mitad y se perdió entera (es una sola transacción).
ESPERAS_DE_REINTENTO = (3, 10)
CODIGOS_PASAJEROS = {2}


def _pedir(url, params=None):
    for espera in (*ESPERAS_DE_REINTENTO, None):
        try:
            return _pedir_una_vez(url, params)
        except ErrorDeMeta as error:
            if espera is None or not error.pasajero:
                raise
            time.sleep(espera)


def _pedir_una_vez(url, params=None):
    try:
        respuesta = requests.get(url, params=params, timeout=40)
    except requests.RequestException as error:
        raise ErrorDeMeta(f'No se pudo hablar con Meta: {error.__class__.__name__}') from None
    try:
        datos = respuesta.json()
    except ValueError:
        raise ErrorDeMeta(f'Meta respondió algo que no es JSON (HTTP {respuesta.status_code}).') from None
    if respuesta.status_code >= 400 or 'error' in datos:
        error = datos.get('error') or {}
        mensaje = error.get('message') or f'HTTP {respuesta.status_code}'
        if error.get('code') == 190:
            mensaje = f'El token de Meta venció o no es válido ({mensaje}).'
        fallo = ErrorDeMeta(mensaje, error.get('code'))
        fallo.pasajero = bool(error.get('is_transient')) or error.get('code') in CODIGOS_PASAJEROS
        raise fallo
    return datos


def _con_limite(url, params, limite):
    """La misma página pidiendo `limite` filas (el `limit` va en `params` o, en `paging.next`, en la URL)."""
    if params is not None:
        return url, {**params, 'limit': limite}
    partes = urlsplit(url)
    consulta = [(k, v) for k, v in parse_qsl(partes.query, keep_blank_values=True) if k != 'limit']
    return urlunsplit(partes._replace(query=urlencode(consulta + [('limit', limite)]))), None


def _pedir_pagina(url, params):
    """Una página; si Meta dice que pesa demasiado, la pide de nuevo con la mitad de filas.
    Devuelve los datos y el límite que funcionó (las páginas siguientes lo heredan en su URL)."""
    while True:
        try:
            return _pedir(url, params)
        except ErrorDeMeta as error:
            limite = int((params or dict(parse_qsl(urlsplit(url).query))).get('limit') or 25)
            if error.codigo != CODIGO_DEMASIADOS_DATOS or limite <= LIMITE_MINIMO:
                raise
            url, params = _con_limite(url, params, max(LIMITE_MINIMO, limite // 2))


def _paginas(url, params):
    """Todas las filas de un listado, siguiendo `paging.next` (que ya trae el token y los filtros)."""
    datos = _pedir_pagina(url, params)
    for _ in range(PAGINAS_MAXIMAS):
        yield from datos.get('data') or []
        siguiente = (datos.get('paging') or {}).get('next')
        if not siguiente:
            return
        datos = _pedir_pagina(siguiente, None)


def _fichas(base, ids, token, campos=CAMPOS_DEL_ANUNCIO):
    """La ficha (nombre, estado, campaña, conjunto, creativo) de cada anuncio, de a FICHAS_POR_PEDIDO
    con `?ids=`. Si Meta rechaza un grupo (un anuncio borrado lo tira entero, o pesa demasiado) se parte
    en dos hasta aislar al que falla, que queda afuera. Devuelve {meta_ad_id: ficha}."""
    fichas = {}

    def pedir(grupo):
        try:
            datos = _pedir(f'{base}/', {'ids': ','.join(grupo), 'fields': campos,
                                        'access_token': token})
        except ErrorDeMeta as error:
            if error.codigo == 190:
                raise
            if len(grupo) > 1:
                pedir(grupo[:len(grupo) // 2])
                pedir(grupo[len(grupo) // 2:])
            return
        fichas.update({str(k): v for k, v in datos.items() if isinstance(v, dict) and v.get('id')})

    for i in range(0, len(ids), FICHAS_POR_PEDIDO):
        pedir(ids[i:i + FICHAS_POR_PEDIDO])
    return fichas


def _destino_del_creativo(creativo):
    """Adónde lleva el anuncio: el link del creativo (el del botón, el de la publicación o el del
    catálogo de variantes) o, si no trae ninguno, «cta:<tipo del botón>» (INSTAGRAM_MESSAGE…)."""
    creativo = creativo or {}
    historia = creativo.get('object_story_spec') or {}
    links = [(historia.get('link_data') or {}).get('link')]
    for parte in ('link_data', 'video_data'):
        boton = (historia.get(parte) or {}).get('call_to_action') or {}
        links.append((boton.get('value') or {}).get('link'))
    links += [u.get('website_url') for u in (creativo.get('asset_feed_spec') or {}).get('link_urls') or []]
    link = next((l for l in links if l), None)
    if link:
        return link[:500]
    return f"cta:{creativo['call_to_action_type']}" if creativo.get('call_to_action_type') else None


def _texto_del_creativo(creativo):
    creativo = creativo or {}
    partes = [creativo.get('body')]
    for cuerpo in ((creativo.get('asset_feed_spec') or {}).get('bodies') or []):
        partes.append((cuerpo or {}).get('text'))
    partes += [creativo.get('title')]
    texto = '\n'.join(p for p in partes if p)
    # Algunos creativos (los «compartir publicación») no traen el texto suelto, pero su nombre lo copia.
    return texto or creativo.get('name') or ''


def _entero(valor):
    """Meta manda los conteos como texto («1863»); sin el campo, 0 (no hubo)."""
    try:
        return int(float(valor or 0))
    except (TypeError, ValueError):
        return 0


def _guardar_anuncio(fila, cuenta, existentes):
    """`existentes` ({meta_ad_id: MetaAnuncio}) se lee una vez por sincronización: una consulta por
    anuncio son cientos de idas y vueltas a la base."""
    anuncio = existentes.get(str(fila['id']))
    if not anuncio:
        anuncio = existentes[str(fila['id'])] = MetaAnuncio(meta_ad_id=str(fila['id']))
        db.session.add(anuncio)
    creativo = fila.get('creative') or {}
    anuncio.cuenta_id = cuenta
    anuncio.nombre = (fila.get('name') or anuncio.nombre or '')[:255]
    anuncio.campana = ((fila.get('campaign') or {}).get('name') or anuncio.campana or '')[:255]
    anuncio.conjunto = ((fila.get('adset') or {}).get('name') or anuncio.conjunto or '')[:255]
    anuncio.campana_id = str((fila.get('campaign') or {}).get('id') or anuncio.campana_id or '') or None
    anuncio.conjunto_id = str((fila.get('adset') or {}).get('id') or anuncio.conjunto_id or '') or None
    anuncio.creative_id = str(creativo.get('id') or anuncio.creative_id or '') or None
    anuncio.texto = _texto_del_creativo(creativo) or anuncio.texto
    anuncio.destino = _destino_del_creativo(creativo) or anuncio.destino
    anuncio.estado = fila.get('effective_status') or anuncio.estado
    anuncio.actualizado_at = datetime.utcnow()
    return anuncio


def _ventana(desde, hasta, dias_por_defecto):
    hasta = hasta or date.today()
    desde = desde or hasta - timedelta(days=dias_por_defecto - 1)
    if desde > hasta:
        desde, hasta = hasta, desde
    if (hasta - desde).days + 1 > DIAS_MAXIMOS:
        desde = hasta - timedelta(days=DIAS_MAXIMOS - 1)
    return desde, hasta


def _exigir_configuracion():
    """(token, cuentas, url base de la Graph API), o ErrorDeMeta si falta conectar."""
    token, cuentas, version = configuracion()
    if not (token and cuentas):
        if modo_muestra():
            raise ErrorDeMeta('Son datos de muestra: para traer los de verdad hay que cargar META_ADS_TOKEN.')
        raise ErrorDeMeta('Falta conectar Meta Ads: configurá META_ADS_TOKEN y META_AD_ACCOUNT_IDS.')
    return token, cuentas, f'{GRAPH}/{version}'


def _insights(base, cuenta, desde, hasta, token):
    """El gasto de cada anuncio de la cuenta, por día, en [desde, hasta]."""
    return list(_paginas(f'{base}/act_{cuenta}/insights', {
        'level': 'ad',
        'time_increment': 1,
        'time_range': json.dumps({'since': desde.isoformat(), 'until': hasta.isoformat()}),
        'fields': CAMPOS_DE_INSIGHTS,
        'limit': 500,
        'access_token': token,
    }))


def _por_anuncio(insights):
    """{meta_ad_id: su primera fila de insights}."""
    de_insights = {}
    for fila in insights:
        if fila.get('ad_id'):
            de_insights.setdefault(str(fila['ad_id']), fila)
    return de_insights


def _guardar_de_insights(meta_ad_id, fila, fichas, cuenta, existentes):
    """Guarda un anuncio que gastó: con su ficha si Meta la dio; si no (borrado o sin acceso), con el
    nombre, la campaña y el conjunto que dicen los insights."""
    if meta_ad_id in fichas:
        _guardar_anuncio(fichas[meta_ad_id], cuenta, existentes)
    elif not (existentes.get(meta_ad_id) and existentes[meta_ad_id].texto):
        _guardar_anuncio({'id': meta_ad_id, 'name': fila.get('ad_name'),
                          'campaign': {'id': fila.get('campaign_id'), 'name': fila.get('campaign_name')},
                          'adset': {'id': fila.get('adset_id'), 'name': fila.get('adset_name')}},
                         cuenta, existentes)
    else:
        existentes[meta_ad_id].cuenta_id = cuenta
    # Los insights dicen siempre de qué campaña y conjunto es (aunque la ficha no se pueda pedir).
    anuncio = existentes[meta_ad_id]
    anuncio.campana_id = str(fila.get('campaign_id') or anuncio.campana_id or '') or None
    anuncio.conjunto_id = str(fila.get('adset_id') or anuncio.conjunto_id or '') or None


def _guardar_gastos(cuenta, insights, desde, hasta):
    """Reemplaza el gasto de [desde, hasta] de los anuncios de la cuenta por el de los insights.
    Devuelve (filas guardadas, gasto total)."""
    filas, total = 0, 0.0
    # Los días pedidos se reemplazan enteros para los anuncios de la cuenta: un día que Meta ya no
    # devuelve (gasto en cero) no puede quedar con un valor viejo, ni con uno de muestra.
    de_la_cuenta = db.session.query(MetaAnuncio.meta_ad_id).filter(MetaAnuncio.cuenta_id == cuenta)
    MetaGastoDiario.query.filter(MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta,
                                 MetaGastoDiario.meta_ad_id.in_(de_la_cuenta.scalar_subquery())) \
        .delete(synchronize_session=False)
    # Lo que quede en la ventana es de un anuncio que todavía no era de la cuenta: se pisa igual.
    del_periodo = {(g.meta_ad_id, g.fecha): g for g in MetaGastoDiario.query.filter(
        MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta)}
    for fila in insights:
        meta_ad_id = str(fila.get('ad_id') or '')
        fecha = fila.get('date_start')
        if not meta_ad_id or not fecha:
            continue
        gasto = float(fila.get('spend') or 0)
        dia = date.fromisoformat(fecha)
        registro = del_periodo.get((meta_ad_id, dia))
        if not registro:
            registro = del_periodo[(meta_ad_id, dia)] = MetaGastoDiario(meta_ad_id=meta_ad_id, fecha=dia)
            db.session.add(registro)
        registro.gasto = gasto
        registro.moneda = (fila.get('account_currency') or '')[:3] or None
        registro.impresiones = _entero(fila.get('impressions'))
        registro.clics = _entero(fila.get('clicks'))
        registro.clics_enlace = _entero(fila.get('inline_link_clicks'))
        registro.leads = leads_de(fila)
        registro.actualizado_at = datetime.utcnow()
        filas += 1
        total += gasto
    return filas, total


def _cerrar_sincronizacion(horas=None):
    db.session.flush()
    mapear_automatico()  # respeta lo elegido a mano (mapeo / embudo_mapeo = 'manual')
    if horas:
        horas()  # después del mapeo: las horas son solo de las campañas de workshop
    from app.services import workshop_meta_service
    workshop_meta_service.recalcular()  # la inversión de cada workshop sale de este gasto
    db.session.commit()


def _horas(base, cuentas, token, desde, hasta):
    from app.services import meta_ads_horas
    meta_ads_horas.sincronizar_horas_de_cuentas(base, cuentas, token, desde, hasta)


def sincronizar(desde=None, hasta=None):
    """Trae de Meta los anuncios y el gasto por día de [desde, hasta] (por defecto, la última semana).
    Devuelve un resumen. Hace commit."""
    token, cuentas, base = _exigir_configuracion()
    desde, hasta = _ventana(desde, hasta, DIAS_POR_DEFECTO)

    anuncios, filas_de_gasto, gasto_total = 0, 0, 0.0
    existentes = {a.meta_ad_id: a for a in MetaAnuncio.query.all()}
    for cuenta in cuentas:
        insights = _insights(base, cuenta, desde, hasta, token)
        # Solo los anuncios que gastaron en el período: la cuenta real tiene unos 2000 y recorrerlos
        # todos pasaba los 120 s que gunicorn le da a un pedido (el botón y el cron se cortaban).
        de_insights = _por_anuncio(insights)
        fichas = _fichas(base, sorted(de_insights), token)
        for meta_ad_id, fila in de_insights.items():
            _guardar_de_insights(meta_ad_id, fila, fichas, cuenta, existentes)
            anuncios += 1
        filas, gasto = _guardar_gastos(cuenta, insights, desde, hasta)
        filas_de_gasto += filas
        gasto_total += gasto

    _cerrar_sincronizacion(lambda: _horas(base, cuentas, token, desde, hasta))
    return {'desde': desde.isoformat(), 'hasta': hasta.isoformat(), 'anuncios': anuncios,
            'filas_de_gasto': filas_de_gasto, 'gasto': round(gasto_total, 2)}


# --- La sincronización liviana: lo que se cambió en Meta (16/10/2026) ----------------------------

# Kerwin (16/10/2026): «que lo que cambia en Meta se refleje en la página». Se edita en el Administrador
# de anuncios (el token es de solo lectura) y al volver la pantalla pide esto: las fichas SIN el creativo
# de los anuncios vigentes y el gasto de los últimos días (hoy incluido). Unos segundos, no los ~30 s de
# un tramo de 30 días con creativos.
DIAS_DE_ESTADO = 3
# Vigentes = gastaron en estos días o estaban activos: un pausado hace meses no cambia ningún número.
DIAS_VIGENTES = 30
# Mínimo entre dos corridas sin `forzar` (volver a la pestaña varias veces no repite el pedido).
MINUTOS_ENTRE_ESTADOS = 3
_LO_QUE_CAMBIA = ('nombre', 'estado', 'campana', 'conjunto')


def sincronizar_estado(forzar=False, dias=DIAS_DE_ESTADO):
    """Nombres, estados (activo, pausado, rechazado…), campaña y conjunto de los anuncios vigentes, y el
    gasto de los últimos `dias` días. No pisa la palabra clave ni el embudo elegidos a mano. Sin
    `forzar`, no hace nada si la última sincronización fue hace menos de MINUTOS_ENTRE_ESTADOS.
    Devuelve un resumen con `cambios`: cuántos anuncios cambiaron de nombre, estado, campaña o
    conjunto. Hace commit."""
    token, cuentas, base = _exigir_configuracion()
    ultima = ultima_sincronizacion()
    if not forzar and ultima and datetime.utcnow() - ultima < timedelta(minutes=MINUTOS_ENTRE_ESTADOS):
        return {'omitido': True, 'ultima_sincronizacion': ultima.isoformat()}
    desde, hasta = _ventana(None, None, max(1, min(int(dias), DIAS_VIGENTES)))

    existentes = {a.meta_ad_id: a for a in MetaAnuncio.query.all()}
    antes = {k: tuple(getattr(a, c) for c in _LO_QUE_CAMBIA) for k, a in existentes.items()}
    con_gasto = {k for (k,) in db.session.query(MetaGastoDiario.meta_ad_id).filter(
        MetaGastoDiario.fecha >= hasta - timedelta(days=DIAS_VIGENTES - 1), MetaGastoDiario.gasto > 0).distinct()}
    anuncios, gasto_total, tocados = 0, 0.0, set()
    for cuenta in cuentas:
        insights = _insights(base, cuenta, desde, hasta, token)
        de_insights = _por_anuncio(insights)
        vigentes = {k for k, a in existentes.items()
                    if a.cuenta_id == cuenta and (k in con_gasto or a.estado == 'ACTIVE')} | set(de_insights)
        # Uno nuevo (o que nunca trajo su texto) necesita el creativo: de ahí salen su palabra clave y
        # su embudo. Los demás, la ficha liviana.
        nuevos = sorted(k for k in vigentes if not (existentes.get(k) and existentes[k].texto))
        fichas = _fichas(base, nuevos, token) if nuevos else {}
        conocidos = sorted(vigentes - set(nuevos))
        if conocidos:
            fichas.update(_fichas(base, conocidos, token, CAMPOS_DE_ESTADO))
        for meta_ad_id in sorted(vigentes):
            if meta_ad_id in de_insights:
                _guardar_de_insights(meta_ad_id, de_insights[meta_ad_id], fichas, cuenta, existentes)
            elif meta_ad_id in fichas:
                _guardar_anuncio(fichas[meta_ad_id], cuenta, existentes)
            else:
                continue  # borrado en Meta: queda como estaba
            tocados.add(meta_ad_id)
            anuncios += 1
        _, gasto = _guardar_gastos(cuenta, insights, desde, hasta)
        gasto_total += gasto

    cambios = sum(1 for k in tocados
                  if antes.get(k) != tuple(getattr(existentes[k], c) for c in _LO_QUE_CAMBIA))
    _cerrar_sincronizacion(lambda: _horas(base, cuentas, token, desde, hasta))
    return {'omitido': False, 'desde': desde.isoformat(), 'hasta': hasta.isoformat(), 'anuncios': anuncios,
            'cambios': cambios, 'gasto': round(gasto_total, 2)}


# --- La palabra clave de cada anuncio de Meta ----------------------------------------------------

_PALABRA_O_SIGNO = re.compile(r"[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+|[^\s0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+")


def _corridas_en_mayusculas(texto):
    """Las tiras de palabras escritas en mayúsculas («QUIERO APLICAR», «SIMULACRO 100»), normalizadas.
    Un número sigue una tira pero no la empieza; una sola letra no cuenta como palabra; un signo
    («|», «-», «[») la corta: en «A9 - SISTEMA» la tira es «SISTEMA»."""
    from app.services.anuncios_service import clave_de

    corridas, actual = [], []
    for palabra in _PALABRA_O_SIGNO.findall(texto or ''):
        tiene_letras = any(c.isalpha() for c in palabra)
        en_mayusculas = tiene_letras and palabra == palabra.upper() and len(palabra) >= 2
        if en_mayusculas or (actual and palabra.isdigit()):
            actual.append(palabra)
        else:
            if actual:
                corridas.append(clave_de(' '.join(actual)))
            actual = []
    if actual:
        corridas.append(clave_de(' '.join(actual)))
    return [c for c in corridas if c]


# El verbo con el que el anuncio pide escribir la palabra clave («Comenta QUIERO APLICAR», «Respondé
# EARN», «escribí la palabra GUIA»), sin tildes. Lo que viene después en mayúsculas es la palabra clave.
_LLAMADO = re.compile(
    r"(?i:\b(?:comenta|comentame|comente|comentar|comentalo|responde|respondeme|responder|escribe|escribi|"
    r"escribime|escribeme|escribir|envia|enviame|enviar|manda|mandame|mandar|dime|decime|deja|dejame|pon|pone|"
    r"ponme)\b)[\s:,\"'«“]*(?i:la\s+palabra(?:\s+clave)?[\s:,\"'«“]*)?"
    r"((?:[A-Z0-9]{2,}|[0-9]+)(?:\s+(?:[A-Z0-9]{2,}|[0-9]+))*)")


# Los anuncios de guía por DM que no piden escribir nada («Pide gratis al DM la guía de APROBACIÓN…»):
# ManyChat les pone la palabra de la guía del país o del examen («GUIA CHILE», «GUIA MIR») y, a los
# generales, la de siempre (Kerwin 16/10/2026: estaban «Sin campaña» en Rendimiento).
_GUIA_POR_DM = re.compile(r'\bDM\b.*\bguia\b|\bguia\b.*\bDM\b', re.I | re.S)
PREFIJO_GUIA = 'GUIA '
GUIA_GENERAL = 'OBTENER GUIA'


def _sin_tildes(texto):
    import unicodedata
    return ''.join(c for c in unicodedata.normalize('NFKD', texto or '') if not unicodedata.combining(c))


def detectar_clave(texto, nombre, claves, contexto=()):
    """La palabra clave conocida que nombra un anuncio de Meta, o None.

    En orden (ver los textos reales en tests/services/test_meta_ads_service.py):
      1. lo que el anuncio pide escribir: la tira en MAYÚSCULAS después de «comenta», «respondé», etc.;
         dentro de ella, la palabra clave más larga («QUIERO APLICAR» antes que «APLICAR»);
      2. un tramo del NOMBRE en mayúsculas que ES una palabra clave entera («DM-TA-B | A9-A-H |
         APROBACIÓN»). En el texto no: «la guía de APROBACIÓN médica» es el título de la guía de otro
         embudo, no lo que el lead tiene que escribir;
      3. una palabra clave de varias palabras dentro del texto, del nombre o de `contexto` (el conjunto y
         la campaña): el conjunto «LPF - TA - PSI: Guía Steps» es la palabra clave «Guia Steps»;
      4. un anuncio de guía por DM que no pide escribir nada («Pide gratis al DM la guía…»): la guía del
         país o examen que nombra el conjunto, el nombre o el texto («Setting - Chile» -> «GUIA CHILE»,
         «…la guía de APROBACIÓN MIR» -> «GUIA MIR»); si no nombra ninguno, la general «OBTENER GUIA».
    """
    from app.services.anuncios_service import clave_de

    ordenadas = sorted(claves, key=lambda c: (-len(c), c))
    for llamado in _LLAMADO.finditer(_sin_tildes(texto)):
        pedida = f' {clave_de(llamado.group(1)) or ""} '
        for clave in ordenadas:
            if f' {clave} ' in pedida:
                return clave
    for corrida in _corridas_en_mayusculas(nombre):
        if corrida in claves:
            return corrida
    for fuente in (texto, nombre, *contexto):
        normalizada = f" {clave_de(fuente or '') or ''} "
        for clave in ordenadas:
            if ' ' in clave and f' {clave} ' in normalizada:
                return clave
    if _GUIA_POR_DM.search(_sin_tildes(texto)):
        guias = sorted(((c[len(PREFIJO_GUIA):], c) for c in claves if c.startswith(PREFIJO_GUIA)),
                       key=lambda par: (-len(par[0]), par[0]))
        for fuente in (*contexto, nombre, texto):
            palabras = f" {clave_de(fuente or '') or ''} "
            for de_que, clave in guias:
                if f' {de_que} ' in palabras:
                    return clave
        if GUIA_GENERAL in claves:
            return GUIA_GENERAL
    return None


# --- El embudo de cada anuncio de Meta (15/10/2026) ---------------------------------------------

EMBUDOS = ('setting', 'workshop', 'contratacion', 'otro')
_CONTRATACION = re.compile(r'HIRING|^ASIS', re.I)
# Lo que el anuncio pide hacer: escribir al DM (setting) o anotarse a la clase (workshop).
_AL_DM = re.compile(r'\bDM\b|\b(comenta|respond[ea]|escrib[ei])\b', re.I)
_A_LA_CLASE = re.compile(r'\bclase\b', re.I)
# El nombre de la campaña, cuando el texto no lo dice («Tocá el botón del video…»).
_CAMPANA_WORKSHOP = re.compile(r'^(WS|WB|LP FUNNEL|WORKSHOP)\b|\bLAUNCH\b', re.I)
_CAMPANA_SETTING = re.compile(r'^(DM|DMV|LM)\b|DM FUNNEL|HAND RAISER|LM FUNNEL', re.I)
# Adónde lleva (`MetaAnuncio.destino`): Instagram (el DM, donde contesta ManyChat) o las landings de la
# clase en vivo de institute.thelearnation.com (/live-class-t3/, /clase-hero/, /acceso/…).
_DESTINO_DM = re.compile(r'instagram\.com|ig\.me|m\.me/|^cta:(INSTAGRAM_MESSAGE|MESSAGE_PAGE|WHATSAPP_MESSAGE)', re.I)
# /clase-hero/ faltaba (29/10/2026): «TC5 | Clase 26» quedó con la palabra clave CLASE 26 y en Setting.
_DESTINO_CLASE = re.compile(r'thelearnation\.com/(live|clase|acceso|crear-evento|replay)', re.I)


def tipo_de_destino(destino):
    """'dm', 'clase' o None según adónde lleva el anuncio."""
    if not destino:
        return None
    if _DESTINO_CLASE.search(destino):
        return 'clase'
    if _DESTINO_DM.search(destino):
        return 'dm'
    return None


def detectar_embudo(anuncio):
    """A qué embudo va un anuncio de Meta. Kerwin (15/10): «las que dicen al DM son de setting, la que
    dice clase gratis son de workshop». Lo que más pesa es adónde LLEVA: hay anuncios que dicen «Pide
    gratis al DM» y van a la landing de la clase (el mismo texto reusado en una campaña WS). En orden:

      1. campaña HIRING o ASIS (búsquedas de personal): contratación;
      2. el link del anuncio: a la landing de la clase es workshop, a Instagram (o el botón «Enviar
         mensaje») es setting;
      3. tiene palabra clave de ManyChat: setting (muchos no dicen «DM» al principio del texto —«Si
         tus manuales están llenos de resaltador…»— pero piden escribir su palabra);
      4. el texto pide escribir al DM («Pide gratis al DM», «Comenta…», «Respondé…»): setting;
      5. el texto habla de la clase («CLASE GRATIS: cómo estudiar…»): workshop;
      6. el nombre de la campaña: WS / WB / LP FUNNEL / WORKSHOP / LAUNCH es workshop, DM / LM es
         setting;
      7. si no, None (sin clasificar): se elige a mano.
    """
    texto = _sin_tildes(anuncio.texto or '')
    campana = anuncio.campana or ''
    if _CONTRATACION.search(campana):
        return 'contratacion'
    destino = tipo_de_destino(anuncio.destino)
    if destino == 'clase':
        return 'workshop'
    if destino == 'dm':
        return 'setting'
    if anuncio.clave or _AL_DM.search(texto):
        return 'setting'
    if _A_LA_CLASE.search(texto):
        return 'workshop'
    if _CAMPANA_WORKSHOP.search(campana):
        return 'workshop'
    if _CAMPANA_SETTING.search(campana):
        return 'setting'
    return None


def mapear_automatico():
    """Recalcula la palabra clave y el embudo de los anuncios de Meta que nadie eligió a mano. No hace
    commit."""
    from app.services.anuncios_service import claves_conocidas

    cambios = 0
    pendientes = MetaAnuncio.query.filter(db.or_(MetaAnuncio.mapeo.is_(None), MetaAnuncio.mapeo == 'auto')).all()
    if pendientes:
        claves = claves_conocidas()
        for anuncio in pendientes:
            # Un anuncio que lleva a la landing de la clase no es de ninguna palabra clave de ManyChat,
            # aunque su nombre la repita («Ws Similar | Clase 26»): su gasto no va a la tabla de Setting.
            nueva = None if tipo_de_destino(anuncio.destino) == 'clase' else detectar_clave(
                anuncio.texto, anuncio.nombre, claves, (anuncio.conjunto, anuncio.campana))
            if nueva != anuncio.clave:
                anuncio.clave = nueva
                cambios += 1
            anuncio.mapeo = 'auto' if nueva else None
    # El embudo va después: depende de la palabra clave (también de la elegida a mano).
    for anuncio in MetaAnuncio.query.filter(db.or_(MetaAnuncio.embudo_mapeo.is_(None),
                                                    MetaAnuncio.embudo_mapeo == 'auto')).all():
        anuncio.embudo = detectar_embudo(anuncio)
        anuncio.embudo_mapeo = 'auto' if anuncio.embudo else None
    return cambios


def gasto_por_embudo(desde, hasta):
    """El gasto de Meta en [desde, hasta] por embudo, para Rendimiento: `[{embudo, gasto, leads (la columna
    Leads de Meta), anuncios, dias: {fecha: gasto}}]` en el orden de `EMBUDOS`, más el de los sin clasificar (`embudo: None`)
    si gastaron."""
    por = {e: {'embudo': e, 'gasto': 0.0, 'leads': 0, 'anuncios': set(), 'dias': defaultdict(float)}
           for e in (*EMBUDOS, None)}
    for embudo, meta_ad_id, fecha, gasto, leads in db.session.query(
            MetaAnuncio.embudo, MetaGastoDiario.meta_ad_id, MetaGastoDiario.fecha, MetaGastoDiario.gasto,
            MetaGastoDiario.leads) \
            .join(MetaAnuncio, MetaAnuncio.meta_ad_id == MetaGastoDiario.meta_ad_id) \
            .filter(MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta, MetaGastoDiario.gasto > 0):
        fila = por.get(embudo, por[None])
        fila['gasto'] += gasto
        fila['leads'] += leads or 0
        fila['anuncios'].add(meta_ad_id)
        fila['dias'][fecha.isoformat()] += gasto
    return [{'embudo': f['embudo'], 'gasto': round(f['gasto'], 2), 'leads': f['leads'], 'anuncios': len(f['anuncios']),
             'dias': {d: round(g, 2) for d, g in sorted(f['dias'].items())}}
            for f in por.values() if f['embudo'] in EMBUDOS or f['gasto']]


def asignar_embudo(meta_ad_id, embudo=None, automatico=False):
    """Fija a mano el embudo de un anuncio de Meta, o lo devuelve a la detección automática.
    Recalcula la inversión de los workshop (sale de los anuncios de 'workshop'). Hace commit."""
    anuncio = MetaAnuncio.query.filter_by(meta_ad_id=str(meta_ad_id)).first()
    if not anuncio:
        raise LookupError('Ese anuncio de Meta no está sincronizado.')
    if automatico:
        anuncio.embudo = detectar_embudo(anuncio)
        anuncio.embudo_mapeo = 'auto' if anuncio.embudo else None
    else:
        if embudo not in EMBUDOS:
            raise ValueError('El embudo tiene que ser setting, workshop, contratacion u otro.')
        anuncio.embudo, anuncio.embudo_mapeo = embudo, 'manual'
    db.session.flush()
    from app.services import workshop_meta_service
    workshop_meta_service.recalcular()
    db.session.commit()
    return anuncio


def asignar_clave(meta_ad_id, clave=None, automatico=False):
    """Fija a mano la palabra clave de un anuncio de Meta (o «ninguna», con `clave=None`), o lo devuelve
    a la detección automática. Hace commit."""
    from app.services.anuncios_service import claves_conocidas

    anuncio = MetaAnuncio.query.filter_by(meta_ad_id=str(meta_ad_id)).first()
    if not anuncio:
        raise LookupError('Ese anuncio de Meta no está sincronizado.')
    if automatico:
        anuncio.mapeo = None
        db.session.flush()
        mapear_automatico()
    else:
        if clave is not None and clave not in claves_conocidas():
            raise ValueError('Esa palabra clave no llegó nunca desde ManyChat.')
        anuncio.clave = clave
        anuncio.mapeo = 'manual'
        db.session.flush()
        mapear_automatico()  # con palabra clave el embudo automático pasa a ser setting
    from app.services import workshop_meta_service
    workshop_meta_service.recalcular()
    db.session.commit()
    return anuncio


def cuentas_publicitarias():
    """Las cuentas publicitarias (sin «act_»), para los enlaces al Administrador de anuncios: las
    configuradas o, en modo muestra, las de los anuncios guardados."""
    _, cuentas, _ = configuracion()
    if cuentas:
        return cuentas
    return sorted(c for (c,) in db.session.query(MetaAnuncio.cuenta_id)
                  .filter(MetaAnuncio.cuenta_id.isnot(None)).distinct())


def listado(desde, hasta):
    """Los anuncios de Meta que gastaron en [desde, hasta], para la pestaña Meta Ads (los que no
    gastaron no mueven ningún número y la cuenta real tiene miles), con sus métricas del período y los
    ids de su cuenta, campaña y conjunto: el desglose campaña › conjunto › anuncio y los enlaces al
    Administrador de anuncios salen de ahí."""
    suma = db.func.sum
    metricas = {fila[0]: fila[1:] for fila in db.session.query(
        MetaGastoDiario.meta_ad_id, suma(MetaGastoDiario.gasto), suma(MetaGastoDiario.impresiones),
        suma(MetaGastoDiario.clics), suma(MetaGastoDiario.clics_enlace))
        .filter(MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta)
        .group_by(MetaGastoDiario.meta_ad_id).having(suma(MetaGastoDiario.gasto) > 0).all()}
    filas = []
    for anuncio in MetaAnuncio.query.filter(MetaAnuncio.meta_ad_id.in_(list(metricas))).all():
        gasto, impresiones, clics, clics_enlace = metricas[anuncio.meta_ad_id]
        filas.append({
            'meta_ad_id': anuncio.meta_ad_id,
            'cuenta_id': anuncio.cuenta_id,
            'nombre': anuncio.nombre,
            'campana': anuncio.campana,
            'campana_id': anuncio.campana_id,
            'conjunto': anuncio.conjunto,
            'conjunto_id': anuncio.conjunto_id,
            'estado': anuncio.estado,
            'texto': (anuncio.texto or '')[:280],
            'clave': anuncio.clave,
            'mapeo': anuncio.mapeo,
            'embudo': anuncio.embudo,
            'embudo_mapeo': anuncio.embudo_mapeo,
            'destino': anuncio.destino,
            'gasto': round(float(gasto or 0), 2),
            'impresiones': int(impresiones or 0),
            'clics': int(clics or 0),
            'clics_enlace': int(clics_enlace or 0),
        })
    filas.sort(key=lambda f: (f['estado'] != 'ACTIVE', -f['gasto'], f['nombre'] or ''))
    return filas
