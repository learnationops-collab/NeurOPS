"""Los seguimientos que el equipo ya le hizo a una conversación (filtro del Inbox, ADR-W254).

Un seguimiento es un mensaje del equipo (no el bot) que sale después de SEGUIMIENTO_H horas sin que el lead
contestara el mensaje anterior del equipo. Cuenta en la fase del setting en que estaba la conversación en ese
momento (`ig_fases`, sin las salidas No lead e In-abrible; sin ninguna marca, Conexión: ya le había escrito el
equipo). Es la misma regla del reporte del setter (`reporte_inbox`), así el filtro y el reporte dan lo mismo.
"""
from collections import defaultdict
from datetime import timedelta

from app.automatizaciones import fases as fases_mod
from app.automatizaciones.modelos import IgFase, IgMensaje

SEGUIMIENTO_H = 12
SIN_MARCA = 'conexion'


def fase_en(cambios, momento):
    """La fase del embudo marcada en `momento` (la última antes; las salidas no la cambian), o None."""
    fase = None
    for en, f in cambios:
        if en > momento:
            break
        if f in fases_mod.EMBUDO:
            fase = f
    return fase


def de_conversacion(msgs, cambios, cuenta=None):
    """[(en, fase, respondido)] de una conversación.

    `msgs`: [(en, es_lead)] sin los del bot, en orden. `cambios`: [(en, fase)] en orden. `cuenta(en)`: si ese
    mensaje del equipo suma (el reporte saca lo que mandó otro setter desde el Inbox); sin él, todos.
    """
    ultimo_lead = max((en for en, lead in msgs if lead), default=None)
    salida, previo = [], None
    for en, lead in msgs:
        if lead:
            previo = None
            continue
        if cuenta and not cuenta(en):
            continue
        if previo and en - previo >= timedelta(hours=SEGUIMIENTO_H):
            salida.append((en, fase_en(cambios, en), bool(ultimo_lead and ultimo_lead > en)))
        previo = en
    return salida


def por_fase(contacto_ids):
    """{contacto_id: {fase: {n, en, resp}}}: cuántos por fase, cuándo fue el último y si lo contestó."""
    if not contacto_ids:
        return {}
    msgs = defaultdict(list)
    for cid, en, direccion, origen in (IgMensaje.query.with_entities(
            IgMensaje.contacto_id, IgMensaje.enviado_en, IgMensaje.direccion, IgMensaje.origen)
            .filter(IgMensaje.contacto_id.in_(contacto_ids)).order_by(IgMensaje.enviado_en)):
        if origen != IgMensaje.MOTOR:
            msgs[cid].append((en, direccion == IgMensaje.ENTRANTE))
    cambios = defaultdict(list)
    for cid, en, fase in (IgFase.query.with_entities(IgFase.contacto_id, IgFase.en, IgFase.fase)
                          .filter(IgFase.contacto_id.in_(contacto_ids)).order_by(IgFase.en)):
        cambios[cid].append((en, fase))
    salida = {}
    for cid, lista in msgs.items():
        hechos = de_conversacion(lista, cambios.get(cid, []))
        if not hechos:
            continue
        del_contacto = {}
        for en, fase, resp in hechos:  # en orden: el último de cada fase pisa al anterior
            previo = del_contacto.get(fase or SIN_MARCA, {'n': 0})
            del_contacto[fase or SIN_MARCA] = {'n': previo['n'] + 1, 'en': en.isoformat() + 'Z', 'resp': resp}
        salida[cid] = del_contacto
    return salida
