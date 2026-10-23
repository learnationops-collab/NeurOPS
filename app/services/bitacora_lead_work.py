"""Lo que Work sabe de un lead, como entradas de su bitácora (ver `bitacora_lead_service`).

Cada entrada: `{id, fecha (datetime UTC), grupo, que, detalle, tono, por, tramo}`. `tramo` va solo
cuando la entrada es de un momento por naturaleza (la conversación es siempre Pre call); el resto lo
ubica la fecha.
"""
from datetime import date, datetime, timedelta

from sqlalchemy import or_

from app.models import (Ad, Appointment, Conversation, ConversationalMessage, FinancialSale, LeadAnswer, Sale,
                        Subscription, SubscriptionEvent)

PRE_CALL = 'pre_call'
TOPE_INTERACCIONES = 150
REPETIDA = timedelta(minutes=10)

_TIPO_VENTA = {'new': 'Venta nueva', 'renewal': 'Renovación', 'upsell': 'Upsell'}
_EVENTO_SUSCRIPCION = {
    'alta': 'Arranca el acceso', 'renovacion': 'Renovación del acceso', 'conversion': 'La seña pasa a completo',
    'extension': 'Se extiende el acceso', 'prorroga': 'Prórroga', 'correccion': 'Corrección del acceso',
    'quitado': 'Se quita el acceso',
}


def entrada(id_, fecha, grupo, que, detalle=None, tono='idle', por=None, tramo=None):
    return {'id': id_, 'fecha': fecha, 'grupo': grupo, 'que': que, 'detalle': detalle or None,
            'tono': tono, 'por': por, 'tramo': tramo}


def _dia(valor):
    """Una fecha de texto ('2026-10-23' o con hora) o un date, como datetime; None si no se lee."""
    if isinstance(valor, datetime):
        return valor
    if isinstance(valor, date):
        return datetime(valor.year, valor.month, valor.day)
    try:
        return datetime.fromisoformat(str(valor).strip()[:19]) if valor else None
    except ValueError:
        return None


def _plata(n):
    return f'${round(n or 0):,}'.replace(',', '.')


def conversacion(person_uuid):
    """El ida y vuelta con el bot de Instagram: primer contacto, palabras clave y pasos del flujo."""
    if not person_uuid:
        return []
    convs = Conversation.query.filter_by(person_uuid=person_uuid).all()
    if not convs:
        return []
    from app.automatizaciones.campanas import campana_de

    out = []
    for c in convs:
        out.append(entrada(f'conv:{c.id}', c.created_at, 'Conversación', f'Primer contacto por {c.channel.title()}',
                           ' · '.join(p for p in (c.ig and f'@{c.ig}', c.setter and f'setter {c.setter}') if p),
                           'info', tramo=PRE_CALL))
    respuestas = (LeadAnswer.query.filter(LeadAnswer.conversation_id.in_([c.id for c in convs]))
                  .order_by(LeadAnswer.created_at).limit(TOPE_INTERACCIONES).all())
    ids_msj = {r.id_option_send for r in respuestas} | {r.id_option for r in respuestas}
    titulos = {m.message_id: m.title for m in
               ConversationalMessage.query.filter(ConversationalMessage.message_id.in_(ids_msj - {None})).all()}
    anuncios = {a.id: a.name for a in
                Ad.query.filter(Ad.id.in_({r.ad_id for r in respuestas if r.ad_id})).all()}
    ultima_palabra = {}
    for r in respuestas:
        # La misma palabra en la misma conversación a minutos de distancia es un doble registro, no
        # otro ingreso: se muestra una vez.
        previa = ultima_palabra.get((r.conversation_id, r.keyword))
        repetida = bool(r.keyword and previa and r.created_at - previa < REPETIDA)
        if r.keyword:
            ultima_palabra[(r.conversation_id, r.keyword)] = r.created_at
        if r.keyword and not repetida:
            campana, _ = campana_de(r.keyword, r.created_at)
            detalle = ' · '.join(p for p in (campana and f'campaña {campana.nombre}',
                                             anuncios.get(r.ad_id) and f'anuncio {anuncios[r.ad_id]}') if p)
            out.append(entrada(f'kw:{r.id}', r.created_at, 'Conversación', f'Escribió «{r.keyword}»', detalle,
                               'brand-primary', tramo=PRE_CALL))
        if r.id_option_send:
            out.append(entrada(f'env:{r.id}', r.created_at, 'Conversación',
                               f'El bot mandó «{titulos.get(r.id_option_send, r.id_option_send)}»', tramo=PRE_CALL))
        if r.id_option:
            out.append(entrada(f'resp:{r.id}', r.updated_at or r.created_at, 'Conversación',
                               f'Respondió «{titulos.get(r.id_option, r.id_option)}»', tramo=PRE_CALL))
        if r.qualification in ('true', 'false'):
            ok = r.qualification == 'true'
            out.append(entrada(f'cal:{r.id}', r.updated_at or r.created_at, 'Conversación',
                               'Cualificado' if ok else 'No cualificado', tono='success' if ok else 'warning',
                               tramo=PRE_CALL))
    return out


def agendas(appts, chips):
    """Cuándo agendó (Pre call) y cómo fue cada llamada y su seguimiento. `chips`: {appointment_id: chip}
    del historial de la ficha, para que el estado diga lo mismo en las dos pestañas."""
    out = []
    for a in appts:
        closer = a.closer.username if a.closer else None
        if a.created_at:
            out.append(entrada(f'agendo:{a.id}', a.created_at, 'Agenda', 'Agendó la llamada',
                               ' · '.join(p for p in (a.origin, a.start_time and
                                                      f'para el {a.start_time:%d/%m %H:%M} UTC') if p),
                               'info', tramo=PRE_CALL))
        if a.start_time:
            chip = chips.get(a.id) or {}
            out.append(entrada(f'llamada:{a.id}', a.start_time, 'Llamada',
                               f'Llamada{f" con {closer}" if closer else ""}: {chip.get("label", "sin estado")}',
                               a.seguimiento_sub if not a.fecha_seguimiento else None,
                               chip.get('tone', 'idle'), por=closer))
        if a.fecha_seguimiento and _dia(a.fecha_seguimiento):
            hecho = bool(a.seguimiento_realizado)
            out.append(entrada(f'seg:{a.id}', _dia(a.fecha_seguimiento), 'Seguimiento',
                               f'Seguimiento {"hecho" if hecho else "programado"}', a.seguimiento_sub,
                               'success' if hecho else 'warning', por=closer))
    return out


def ventas_y_pagos(client, pagos):
    """Las ventas (con su estado), cada pago y los cambios del acceso que registró Work."""
    out = []
    ventas = Sale.query.filter(or_(Sale.client_id == client.id, Sale.person_uuid == client.person_uuid)
                               if client.person_uuid else Sale.client_id == client.id).all()
    for v in ventas:
        cancelada = v.status == 'cancelled'
        out.append(entrada(f'venta:{v.id}', v.sold_at, 'Venta',
                           f'{_TIPO_VENTA.get(v.kind, v.kind)}{f" {v.program_code}" if v.program_code else ""}'
                           f'{" (cancelada)" if cancelada else ""}',
                           v.agreed_total and f'acordado {_plata(v.agreed_total)}',
                           'error' if cancelada else 'success', por=v.closer_email))
    for p in pagos:
        out.append(entrada(f'pago:{p.id}', _dia(p.date), 'Pago', f'Pago: {p.tipo_pago or "sin tipo"}',
                           ' · '.join(x for x in (_plata(p.monto), p.metodo_pago) if x), 'success',
                           por=p.email_vendedor))
    eventos = (SubscriptionEvent.query.join(Subscription)
               .filter(Subscription.client_id == client.id).all())
    for e in eventos:
        out.append(entrada(f'acceso:{e.id}', e.created_at, 'Acceso', _EVENTO_SUSCRIPCION.get(e.kind, e.kind),
                           ' · '.join(x for x in (e.subscription.product_slug, f'hasta {e.to_date:%d/%m/%Y}',
                                                  e.reason) if x),
                           'error' if e.kind == 'quitado' else 'info', por=e.actor_email))
    return out


def inicio_academia(client):
    """El día que arrancó su primer acceso a la Academia, o None."""
    sub = (Subscription.query.filter_by(client_id=client.id)
           .order_by(Subscription.starts_at.asc()).first())
    return _dia(sub.starts_at) if sub else None


def pagos_del_cliente(client):
    from app.services.sales_consistency_service import filtro_de_pagos

    return (FinancialSale.query.filter(filtro_de_pagos(client))
            .order_by(FinancialSale.date.asc(), FinancialSale.id.asc()).all())


def agendas_del_cliente(client):
    return Appointment.query.filter_by(client_id=client.id).order_by(Appointment.start_time.asc()).all()
