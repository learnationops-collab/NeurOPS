"""El gasto diario de cada anuncio, traído de Meta Ads (Marketing API) sin cargar nada a mano.

**Cómo se conecta.** Un token de un *usuario del sistema* del Business Manager dueño de la cuenta
publicitaria, con el permiso `ads_read` (no vence), en `META_ADS_TOKEN`, y los ids de las cuentas en
`META_AD_ACCOUNT_IDS` (separados por coma, con o sin `act_`). `META_GRAPH_VERSION` cambia la versión
de la Graph API. Sin las dos primeras variables no se sincroniza nada y la pantalla lo dice.

**Qué trae** (`sincronizar`):
  · los anuncios que gastaron en el período con su estado, su campaña, su conjunto y el TEXTO del
    creativo (`MetaAnuncio`): de ahí sale la palabra clave («Comenta QUIERO APLICAR y…»). Los que no
    gastaron no se piden: la cuenta tiene miles y no cambian ningún número;
  · el gasto de cada anuncio por día (`MetaGastoDiario`, insights con `time_increment=1`). Por defecto
    los últimos 7 días: Meta todavía ajusta el gasto de los días recientes y volver a pedirlos lo deja
    al día. Pedirlo de nuevo pisa el valor del día, no lo suma.

**Cuándo.** Una vez por día con el cron (`GET /api/marketing/anuncios/cron/meta`, con `CRON_SECRET`) y
cuando alguien toca «Sincronizar» en la pantalla.

**La palabra clave de cada anuncio de Meta** (`mapear_automatico`): si nadie la eligió a mano, se busca
la que el anuncio pide escribir (así se escriben: «Respondé EARN», «comentá CURSO GRATUITO»), ver
`detectar_clave`. La que no se encuentra queda «sin palabra clave» y se elige a mano en la pantalla
(`asignar_clave`), que la fija.
"""
import json
import os
import re
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
CAMPOS_DEL_ANUNCIO = ('id,name,effective_status,campaign{name},adset{name},'
                      'creative{id,name,body,title,asset_feed_spec{bodies}}')


FICHAS_POR_PEDIDO = 50  # el máximo de `?ids=` de la Graph API
LIMITE_MINIMO = 5
# «Please reduce the amount of data you're asking for»: la página pesa demasiado (pasa con los creativos).
CODIGO_DEMASIADOS_DATOS = 1


class ErrorDeMeta(Exception):
    """La sincronización no se pudo hacer (falta configurarla, el token venció, Meta respondió error)."""

    def __init__(self, mensaje, codigo=None):
        super().__init__(mensaje)
        self.codigo = codigo


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

def _pedir(url, params=None):
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
        raise ErrorDeMeta(mensaje, error.get('code'))
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


def _fichas(base, ids, token):
    """La ficha (nombre, estado, campaña, conjunto, creativo) de cada anuncio, de a FICHAS_POR_PEDIDO
    con `?ids=`. Si Meta rechaza un grupo (un anuncio borrado lo tira entero, o pesa demasiado) se parte
    en dos hasta aislar al que falla, que queda afuera. Devuelve {meta_ad_id: ficha}."""
    fichas = {}

    def pedir(grupo):
        try:
            datos = _pedir(f'{base}/', {'ids': ','.join(grupo), 'fields': CAMPOS_DEL_ANUNCIO,
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


def _texto_del_creativo(creativo):
    creativo = creativo or {}
    partes = [creativo.get('body')]
    for cuerpo in ((creativo.get('asset_feed_spec') or {}).get('bodies') or []):
        partes.append((cuerpo or {}).get('text'))
    partes += [creativo.get('title')]
    texto = '\n'.join(p for p in partes if p)
    # Algunos creativos (los «compartir publicación») no traen el texto suelto, pero su nombre lo copia.
    return texto or creativo.get('name') or ''


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
    anuncio.creative_id = str(creativo.get('id') or anuncio.creative_id or '') or None
    anuncio.texto = _texto_del_creativo(creativo) or anuncio.texto
    anuncio.estado = fila.get('effective_status') or anuncio.estado
    anuncio.actualizado_at = datetime.utcnow()
    return anuncio


def sincronizar(desde=None, hasta=None):
    """Trae de Meta los anuncios y el gasto por día de [desde, hasta] (por defecto, la última semana).
    Devuelve un resumen. Hace commit."""
    token, cuentas, version = configuracion()
    if not (token and cuentas):
        if modo_muestra():
            raise ErrorDeMeta('Son datos de muestra: para traer los de verdad hay que cargar META_ADS_TOKEN.')
        raise ErrorDeMeta('Falta conectar Meta Ads: configurá META_ADS_TOKEN y META_AD_ACCOUNT_IDS.')
    hasta = hasta or date.today()
    desde = desde or hasta - timedelta(days=DIAS_POR_DEFECTO - 1)
    if desde > hasta:
        desde, hasta = hasta, desde
    if (hasta - desde).days + 1 > DIAS_MAXIMOS:
        desde = hasta - timedelta(days=DIAS_MAXIMOS - 1)

    base = f'{GRAPH}/{version}'
    anuncios, filas_de_gasto, gasto_total = 0, 0, 0.0
    existentes = {a.meta_ad_id: a for a in MetaAnuncio.query.all()}
    for cuenta in cuentas:
        insights = list(_paginas(f'{base}/act_{cuenta}/insights', {
            'level': 'ad',
            'time_increment': 1,
            'time_range': json.dumps({'since': desde.isoformat(), 'until': hasta.isoformat()}),
            'fields': 'ad_id,ad_name,campaign_name,adset_name,spend,account_currency',
            'limit': 500,
            'access_token': token,
        }))
        # Solo los anuncios que gastaron en el período: la cuenta real tiene unos 2000 y recorrerlos
        # todos pasaba los 120 s que gunicorn le da a un pedido (el botón y el cron se cortaban).
        de_insights = {}
        for fila in insights:
            if fila.get('ad_id'):
                de_insights.setdefault(str(fila['ad_id']), fila)
        fichas = _fichas(base, sorted(de_insights), token)
        for meta_ad_id, fila in de_insights.items():
            if meta_ad_id in fichas:
                _guardar_anuncio(fichas[meta_ad_id], cuenta, existentes)
            elif not (existentes.get(meta_ad_id) and existentes[meta_ad_id].texto):
                # Borrado o sin acceso: queda con el nombre, la campaña y el conjunto de los insights.
                _guardar_anuncio({'id': meta_ad_id, 'name': fila.get('ad_name'),
                                  'campaign': {'name': fila.get('campaign_name')},
                                  'adset': {'name': fila.get('adset_name')}}, cuenta, existentes)
            else:
                existentes[meta_ad_id].cuenta_id = cuenta
            anuncios += 1

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
            registro.actualizado_at = datetime.utcnow()
            filas_de_gasto += 1
            gasto_total += gasto

    db.session.flush()
    mapear_automatico()
    db.session.commit()
    return {'desde': desde.isoformat(), 'hasta': hasta.isoformat(), 'anuncios': anuncios,
            'filas_de_gasto': filas_de_gasto, 'gasto': round(gasto_total, 2)}


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
         la campaña): el conjunto «LPF - TA - PSI: Guía Steps» es la palabra clave «Guia Steps».
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
    return None


def mapear_automatico():
    """Recalcula la palabra clave de los anuncios de Meta que nadie asignó a mano. No hace commit."""
    from app.services.anuncios_service import claves_conocidas

    pendientes = MetaAnuncio.query.filter(db.or_(MetaAnuncio.mapeo.is_(None), MetaAnuncio.mapeo == 'auto')).all()
    if not pendientes:
        return 0
    claves = claves_conocidas()
    cambios = 0
    for anuncio in pendientes:
        nueva = detectar_clave(anuncio.texto, anuncio.nombre, claves, (anuncio.conjunto, anuncio.campana))
        if nueva != anuncio.clave:
            anuncio.clave = nueva
            cambios += 1
        anuncio.mapeo = 'auto' if nueva else None
    return cambios


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
    db.session.commit()
    return anuncio


def listado(desde, hasta):
    """Los anuncios de Meta que gastaron en [desde, hasta], para la pestaña de conexión (los que no
    gastaron no mueven ningún número y la cuenta real tiene miles)."""
    gasto = dict(db.session.query(MetaGastoDiario.meta_ad_id, db.func.sum(MetaGastoDiario.gasto))
                 .filter(MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta)
                 .group_by(MetaGastoDiario.meta_ad_id).having(db.func.sum(MetaGastoDiario.gasto) > 0).all())
    filas = []
    for anuncio in MetaAnuncio.query.filter(MetaAnuncio.meta_ad_id.in_(list(gasto))).all():
        filas.append({
            'meta_ad_id': anuncio.meta_ad_id,
            'nombre': anuncio.nombre,
            'campana': anuncio.campana,
            'conjunto': anuncio.conjunto,
            'estado': anuncio.estado,
            'texto': (anuncio.texto or '')[:280],
            'clave': anuncio.clave,
            'mapeo': anuncio.mapeo,
            'gasto': round(float(gasto.get(anuncio.meta_ad_id) or 0), 2),
        })
    filas.sort(key=lambda f: (f['estado'] != 'ACTIVE', -f['gasto'], f['nombre'] or ''))
    return filas
