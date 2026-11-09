"""El resultado de cada llamada reportada, al canal #onboardings de fulfillment (ADR-W121).

Sale cuando el closer reporta en la ficha (POST /ficha/<id>/resultado), en el mazo viejo o cuando el triage
reporta su llamada. La venta no pasa por acá: «Sí, cerró» va por la ruta de venta y la avisa venta.py.
El texto lleva nombre y número (para buscar en Discord junto a la agenda); el resto va en la imagen.
"""
from datetime import timezone
from zoneinfo import ZoneInfo

from flask import current_app

from app import db
from app.services.discord_avisos.tarjeta import Aviso, avisar, corto

ZONA_EQUIPO = 'America/La_Paz'
DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

# closer_result guardado -> (estado, tono)
ESTADOS = {
    'Show up': ('Asistió', 'verde'),
    'Asistió': ('Asistió', 'verde'),
    'No Show': ('No asistió', 'rojo'),
    'Cancelado': ('Canceló', 'amarillo'),
    'Cancelada': ('Canceló', 'amarillo'),
    'Reagendado': ('Reagendó', 'azul'),
    'Reprogramada': ('Reagendó', 'azul'),
    'Lead Perdido': ('Perdido', 'rojo'),
    'No Lead': ('No es lead', 'gris'),
}


def _texto(datos, *claves):
    """El primer texto no vacío entre las claves de `datos`, de `respuestas` y de `deck`."""
    fuentes = [datos, datos.get('respuestas') if isinstance(datos.get('respuestas'), dict) else {},
               datos.get('deck') if isinstance(datos.get('deck'), dict) else {}]
    for clave in claves:
        for f in fuentes:
            v = f.get(clave)
            if isinstance(v, str) and v.strip():
                return v.strip()
    return ''


def _cuando(dt):
    if not dt:
        return ''
    local = dt.replace(tzinfo=timezone.utc).astimezone(ZoneInfo(ZONA_EQUIPO))
    return f"{DIAS[local.weekday()]} {local.strftime('%d/%m %H:%M')} (Bolivia)"


def _tipo_de_llamada(appt):
    from app.services.momentum_academia import es_momentum

    if es_momentum(appt):
        tipo = ((appt.agenda_payload or {}).get('academia') or {}).get('tipo')
        return 'Momentum de seña' if tipo == 'sena' else 'Momentum de cierre'
    try:
        from app.services.triage_service import es_de_triage
        if es_de_triage(appt):
            return 'Llamada de triage'
    except Exception:  # noqa: BLE001
        pass
    return 'Llamada de venta'


def armar(appt, datos, usuario):
    """El Aviso del reporte que se acaba de guardar en `appt`."""
    from app.models import User
    from app.services.ficha_acciones_service import _no_cerro

    payload = appt.agenda_payload or {}
    lead = payload.get('lead') or {}
    cliente = appt.client
    nombre = lead.get('nombre') or (cliente.full_name if cliente else '') or 'Lead'
    telefono = lead.get('telefono') or (getattr(cliente, 'phone', '') if cliente else '') or ''
    estado, tono = ESTADOS.get((appt.closer_result or '').strip(), (appt.closer_result or 'Reportada', 'gris'))
    deck = datos.get('deck') if isinstance(datos.get('deck'), dict) else {}
    if estado == 'Asistió' and _no_cerro(datos, deck):
        estado, tono = 'No cerró', 'amarillo'
    closer = db.session.get(User, appt.closer_id) if appt.closer_id else None
    setter = db.session.get(User, appt.setter_id) if appt.setter_id else None
    tipo = _tipo_de_llamada(appt)

    chips = [{'icono': 'cal', 'texto': _cuando(appt.start_time)}]
    seg = (payload.get('segmento_lead') or {}).get('segmento')
    if seg:
        chips.append({'marca': seg, 'texto': f'Segmento {seg}'})
    cajas = [{'titulo': 'Closer', 'valor': closer.username if closer else '-', 'color': 'azul', 'icono': 'personas'},
             {'titulo': 'Reportó', 'valor': usuario.username if usuario else '-', 'color': 'verde', 'icono': 'check'}]
    if setter:
        cajas.append({'titulo': 'Origen', 'valor': setter.username, 'color': 'verde', 'icono': 'bandeja'})

    tiles = []
    objecion = _texto(datos, 'objecion', 'motivo_sin_oferta', 'motivo_estado', 'motivo')
    if objecion:
        tiles.append({'icono': 'x', 'titulo': 'Objeción' if estado == 'No cerró' else 'Motivo', 'sub': corto(objecion, 160)})
    nota = _texto(datos, 'closer_notes', 'notes', 'nota', 'notas')
    if nota and nota != objecion:
        tiles.append({'icono': 'nota', 'titulo': 'Nota del closer', 'sub': corto(nota, 160)})
    seguimiento = _texto(datos, 'fecha_seguimiento', 'next_followup', 'nueva_fecha_agenda')
    if seguimiento:
        tiles.append({'icono': 'flecha', 'titulo': 'Nueva fecha' if estado == 'Reagendó' else 'Próximo seguimiento',
                      'sub': seguimiento})

    return Aviso(emoji='📞', titulo=f'{tipo} · {estado}', nombre=nombre, telefono=telefono, evento=tipo,
                 estado=estado, tono=tono, chips=chips, cajas=cajas, tiles=tiles, pie=f'Resultado · agenda #{appt.id}')


def avisar_resultado(appt, datos, usuario):
    """Avisa el resultado de la llamada. Un mismo resultado guardado de nuevo (corregir una nota) no se repite:
    el último avisado queda en `agenda_payload.discord_resultado`. Nunca lanza."""
    try:
        if not appt or not (appt.closer_result or '').strip():
            return False
        aviso = armar(appt, datos or {}, usuario)
        payload = dict(appt.agenda_payload or {})
        if payload.get('discord_resultado') == aviso.estado:
            return False
        payload['discord_resultado'] = aviso.estado
        appt.agenda_payload = payload
        db.session.commit()
        return avisar('onboarding', aviso, etiqueta='RESULTADO')
    except Exception as e:  # noqa: BLE001
        db.session.rollback()
        current_app.logger.error(f'[RESULTADO] No se pudo avisar la agenda #{getattr(appt, "id", None)}: {e}')
        return False
