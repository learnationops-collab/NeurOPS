"""Cómo le va a cada campaña en un período, con lo que guarda el motor (19/10/2026).

Una **entrada** es una ejecución que empezó por la campaña (`AutEjecucion.campana_id`). Cada entrada
dura hasta la siguiente de la misma persona (o hasta ahora), y lo que pasa en ese tramo es de ella:

  · **Respondieron**: escribió o tocó un botón después de entrar.
  · **Calificados / descalificados**: `AutEjecucion.califica` (lo escribe `registro.py`).
  · **Agendas**: agendas creadas en el tramo de un cliente con el Instagram del contacto (sin el
    marcador «Cualificado» del setter), una por persona.
  · **Gasto**: lo que Meta gastó en los días del período, dentro de la vigencia, en las campañas de
    Meta asociadas.

No mira ManyChat ni las tablas de Marketing: así un dato viejo de la misma palabra no se mezcla.
"""
from collections import defaultdict
from datetime import datetime, time

from app import db
from app.automatizaciones.modelos import AutCampana, AutEjecucion, IgContacto, IgMensaje
from app.models import Appointment, Client, MetaAnuncio, MetaGastoDiario
from app.services.comercial_service import no_es_marcador
from app.services.identity_service import normalize_ig


def _division(a, b):
    return round(a / b, 2) if b else None


def _vacia():
    return {'entradas': 0, 'personas': 0, 'respondieron': 0, 'calificados': 0, 'descalificados': 0,
            'agendas': 0, 'gasto': 0.0}


def _tramos(ejecuciones, ahora):
    """{ejecucion.id: (inicio, fin)}: cada entrada dura hasta la siguiente de la misma persona."""
    por_contacto = defaultdict(list)
    for e in ejecuciones:
        por_contacto[e.contacto_id].append(e)
    tramos = {}
    for lista in por_contacto.values():
        lista.sort(key=lambda e: (e.iniciada_en, e.id))
        for actual, siguiente in zip(lista, lista[1:] + [None]):
            tramos[actual.id] = (actual.iniciada_en, siguiente.iniciada_en if siguiente else ahora)
    return tramos


def _respondieron(ejecuciones, tramos):
    contactos = {e.contacto_id for e in ejecuciones}
    entrantes = defaultdict(list)
    if contactos:
        for contacto_id, enviado in db.session.query(IgMensaje.contacto_id, IgMensaje.enviado_en).filter(
                IgMensaje.contacto_id.in_(contactos), IgMensaje.direccion == IgMensaje.ENTRANTE):
            entrantes[contacto_id].append(enviado)
    return {e.id for e in ejecuciones
            if any(tramos[e.id][0] < m <= tramos[e.id][1] for m in entrantes[e.contacto_id])}


def _agendas(ejecuciones, tramos):
    """{ejecucion.id: cuántas personas agendaron en su tramo} (0 o 1)."""
    usuario = {c.id: normalize_ig(c.username) for c in IgContacto.query.filter(
        IgContacto.id.in_({e.contacto_id for e in ejecuciones})).all()} if ejecuciones else {}
    igs = {ig for ig in usuario.values() if ig}
    if not igs:
        return {}
    inicio = min(t[0] for t in tramos.values())
    ig_columna = db.func.lower(db.func.replace(Client.instagram, '@', ''))
    citas = defaultdict(list)
    for ig, creada in (db.session.query(ig_columna, Appointment.created_at)
                       .join(Client, Client.id == Appointment.client_id)
                       .filter(ig_columna.in_(igs), Appointment.created_at > inicio, no_es_marcador())):
        citas[normalize_ig(ig)].append(creada)
    return {e.id: 1 for e in ejecuciones
            if any(tramos[e.id][0] < c <= tramos[e.id][1] for c in citas.get(usuario.get(e.contacto_id), ()))}


def _gasto(campana, desde, hasta):
    ids = [m.meta_campana_id for m in campana.campanas_meta]
    if not ids:
        return 0.0
    primero = max(desde, campana.desde.date())
    ultimo = min(hasta, campana.hasta.date()) if campana.hasta else hasta
    if ultimo < primero:
        return 0.0
    total = (db.session.query(db.func.sum(MetaGastoDiario.gasto))
             .join(MetaAnuncio, MetaAnuncio.meta_ad_id == MetaGastoDiario.meta_ad_id)
             .filter(MetaAnuncio.campana_id.in_(ids), MetaGastoDiario.fecha >= primero,
                     MetaGastoDiario.fecha <= ultimo).scalar())
    return float(total or 0)


def de_campanas(desde, hasta, ahora):
    """{campana_id: métricas} del período [desde, hasta] (fechas, ambos incluidos)."""
    desde_dt, hasta_dt = datetime.combine(desde, time.min), datetime.combine(hasta, time.max)
    todas = AutEjecucion.query.filter(AutEjecucion.campana_id.isnot(None)).all()
    tramos = _tramos(todas, ahora)
    del_periodo = [e for e in todas if desde_dt <= e.iniciada_en <= hasta_dt]
    respondieron = _respondieron(del_periodo, tramos)
    agendas = _agendas(del_periodo, {e.id: tramos[e.id] for e in del_periodo})

    resultado = {}
    for campana in AutCampana.query.all():
        suyas = [e for e in del_periodo if e.campana_id == campana.id]
        m = _vacia()
        m['entradas'] = len(suyas)
        m['personas'] = len({e.contacto_id for e in suyas})
        m['respondieron'] = sum(1 for e in suyas if e.id in respondieron)
        m['calificados'] = sum(1 for e in suyas if e.califica is True)
        m['descalificados'] = sum(1 for e in suyas if e.califica is False)
        m['agendas'] = len({e.contacto_id for e in suyas if agendas.get(e.id)})
        m['gasto'] = round(_gasto(campana, desde, hasta), 2)
        m['costo_entrada'] = _division(m['gasto'], m['entradas']) if m['gasto'] else None
        m['costo_calificado'] = _division(m['gasto'], m['calificados']) if m['gasto'] else None
        m['costo_agenda'] = _division(m['gasto'], m['agendas']) if m['gasto'] else None
        resultado[campana.id] = m
    return resultado
