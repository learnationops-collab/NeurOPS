"""Las campañas y conjuntos de cada palabra clave del tablero de Marketing, y lo que se guarda a mano
(archivar, agrupar). Ver `anuncios_service` (que re-exporta todo esto)."""
from collections import Counter, defaultdict
from datetime import datetime

from sqlalchemy import func

from app import db
from app.models import Ad, AdSet, Campaign, LeadAnswer, MetaAnuncio, MetaGastoDiario
from app.models.marketing import clave_de_palabra as clave_de
from app.services.anuncios_claves_service import anuncio_de_keyword, es_keyword_valida


# --- Campañas y conjuntos ----------------------------------------------------------------------
#
# Pedido de Kerwin (15/10/2026): ver la tabla por campañas y conjuntos como en Meta, «más fácil» que la carga
# vieja. Cada palabra clave tiene UNA campaña y UN conjunto, que salen, en este orden, de:
#   1. lo elegido a mano en la tabla (`Ad.agrupado_a_mano`, el conjunto en `Ad.ad_set_id`);
#   2. sus anuncios de Meta: el par campaña/conjunto donde más gastó en el período (sin gasto, el de un
#      anuncio activo o el último sincronizado);
#   3. el conjunto de la carga vieja de anuncios (hasta julio de 2026).
# Los leads, agendas y ventas de la palabra clave van enteros a esa campaña (no se pueden partir: no se sabe
# qué anuncio de Meta vio cada persona). El gasto, en cambio, se reparte exacto entre las campañas de sus
# anuncios de Meta (`gasto_por_grupo`), salvo que la agrupación sea a mano: ahí va entero a la elegida.

SIN_CONJUNTO = 'Sin conjunto'


def _conjuntos():
    """{id del conjunto: (campaña, conjunto)} de la estructura guardada (la vieja y la elegida a mano)."""
    campanas = dict(db.session.query(Campaign.id, Campaign.name).all())
    return {conjunto_id: (campanas.get(campana_id), nombre)
            for conjunto_id, nombre, campana_id in db.session.query(AdSet.id, AdSet.name, AdSet.campaign_id)}


def _grupos_de_meta(desde, hasta, meta_por_clave):
    """{clave: ({(campaña, conjunto): gasto del período}, (campaña, conjunto) de respaldo)}."""
    gasto_por_anuncio = dict(db.session.query(MetaGastoDiario.meta_ad_id, func.sum(MetaGastoDiario.gasto))
                             .filter(MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta)
                             .group_by(MetaGastoDiario.meta_ad_id).all())
    salida = {}
    for clave, de_meta in meta_por_clave.items():
        gastos = defaultdict(float)
        for m in de_meta:
            gastos[(m.campana or None, m.conjunto or None)] += float(gasto_por_anuncio.get(m.meta_ad_id) or 0)
        respaldo = max(de_meta, key=lambda m: (m.estado == 'ACTIVE', m.actualizado_at or datetime.min, m.id))
        salida[clave] = (gastos, (respaldo.campana or None, respaldo.conjunto or None))
    return salida


def _agrupacion(vigente, de_meta, conjuntos, gasto_total):
    """(campaña, conjunto, origen, reparto del gasto) de una fila; origen: 'manual' | 'meta' | 'anterior' | None."""
    manual = conjuntos.get(vigente.ad_set_id) if vigente and vigente.agrupado_a_mano else None
    if manual:
        return manual[0], manual[1], 'manual', [[manual[0], manual[1], round(gasto_total, 2)]]
    if de_meta:
        gastos, respaldo = de_meta
        principal = max(gastos.items(), key=lambda par: par[1])[0] if any(gastos.values()) else respaldo
        reparto = {par: monto for par, monto in gastos.items() if monto}
        # Lo cargado a mano en el sistema viejo (días sin Meta) va a la campaña principal.
        resto = gasto_total - sum(reparto.values())
        if resto > 0.005:
            reparto[principal] = reparto.get(principal, 0) + resto
        return principal[0], principal[1], 'meta', [[c, j, round(m, 2)] for (c, j), m in reparto.items()]
    anterior = conjuntos.get(vigente.ad_set_id) if vigente else None
    if anterior:
        return anterior[0], anterior[1], 'anterior', [[anterior[0], anterior[1], round(gasto_total, 2)]]
    return None, None, None, ([[None, None, round(gasto_total, 2)]] if gasto_total else [])


def _opciones_de_agrupacion(filas, conjuntos):
    """[{campana, conjuntos: [...]}] para elegir a mano: las campañas que usa la tabla y las guardadas."""
    por_campana = defaultdict(set)
    for campana, conjunto in conjuntos.values():
        if campana:
            por_campana[campana].add(conjunto)
    for fila in filas:
        if fila['campana']:
            por_campana[fila['campana']].add(fila['conjunto'])
    for campana, conjunto in db.session.query(MetaAnuncio.campana, MetaAnuncio.conjunto).distinct():
        if campana:
            por_campana[campana].add(conjunto)
    return [{'campana': c, 'conjuntos': sorted({j for j in js if j})}
            for c, js in sorted(por_campana.items(), key=lambda par: par[0].lower())]


def _como_se_escribe(claves):
    """{clave: la escritura más usada en los webhooks}: el nombre de una palabra clave que llegó antes
    de que existiera el anuncio (no tiene uno de donde sacarlo)."""
    if not claves:
        return {}
    conteo = defaultdict(Counter)
    for keyword, n in db.session.query(LeadAnswer.keyword, func.count(LeadAnswer.id)) \
            .filter(LeadAnswer.keyword.isnot(None)).group_by(LeadAnswer.keyword):
        clave = clave_de(keyword) if es_keyword_valida(keyword) else None
        if clave in claves:
            conteo[clave][keyword.strip()] += n
    return {clave: c.most_common(1)[0][0] for clave, c in conteo.items()}


# --- Escritura -----------------------------------------------------------------------------------

def _anuncios_de(clave):
    """Los anuncios de una palabra clave; si llegó antes de que existiera el suyo, se lo crea (para poder
    guardarle una marca)."""
    if not clave:
        raise ValueError('Falta la palabra clave.')
    anuncios = Ad.query.filter(Ad.clave == clave).all()
    if not anuncios:
        escritura = _como_se_escribe({clave}).get(clave, clave)
        anuncio = anuncio_de_keyword(escritura)
        if not anuncio:
            raise ValueError('Esa palabra clave no existe.')
        anuncios = [anuncio]
    return anuncios


def archivar(clave, archivado):
    """Esconde (o vuelve a mostrar) una palabra clave en el tablero. Hace commit."""
    for anuncio in _anuncios_de(clave):
        anuncio.status = 'archived' if archivado else 'active'
    db.session.commit()
    return {'clave': clave, 'archivado': bool(archivado)}


def agrupar(clave, campana, conjunto):
    """Elige a mano la campaña y el conjunto de una palabra clave (los crea si no existen, sin distinguir
    mayúsculas). Sin campaña, vuelve a la automática (la de Meta). Hace commit."""
    anuncios = _anuncios_de(clave)
    campana = (campana or '').strip()[:100]
    conjunto = (conjunto or '').strip()[:100] or SIN_CONJUNTO
    if not campana:
        for anuncio in anuncios:
            if anuncio.agrupado_a_mano:
                anuncio.ad_set_id = None
            anuncio.agrupado_a_mano = False
        db.session.commit()
        return {'clave': clave, 'campana': None, 'conjunto': None}
    # Sin tildes ni mayúsculas, como las palabras clave: el `lower()` de SQLite no baja «Í».
    registro = next((c for c in Campaign.query.order_by(Campaign.id).all()
                     if clave_de(c.name) == clave_de(campana)), None)
    if not registro:
        registro = Campaign(name=campana, status='active')
        db.session.add(registro)
        db.session.flush()
    grupo = next((g for g in AdSet.query.filter(AdSet.campaign_id == registro.id).order_by(AdSet.id).all()
                  if clave_de(g.name) == clave_de(conjunto)), None)
    if not grupo:
        grupo = AdSet(campaign_id=registro.id, name=conjunto, status='active')
        db.session.add(grupo)
        db.session.flush()
    for anuncio in anuncios:
        anuncio.ad_set_id = grupo.id
        anuncio.agrupado_a_mano = True
    db.session.commit()
    return {'clave': clave, 'campana': registro.name, 'conjunto': grupo.name}
