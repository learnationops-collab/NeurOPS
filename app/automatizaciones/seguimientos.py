"""Seguimientos condicionales (Estrategia 16/11/2026): «si no responde en X horas, mandarle esto».

  · Los programa una persona del equipo desde el chat: un texto o un audio de la biblioteca, y en cuántas horas.
  · Los manda el reloj del motor en cada vuelta (`servicio.tick`), con las mismas reglas que escribir a mano
    (`escribir.enviar`): control del hilo y pausa del bot. Solo salen solos dentro de las 24 h: Meta permite
    HUMAN_AGENT únicamente a una persona que manda en el momento (ADR-W282). Si a la hora elegida ya pasaron,
    quedan como «Toca seguimiento» con su texto y la persona lo manda con un clic (`mandar_aviso`, ADR-W283).
  · La condición se mira al momento de mandar: si el lead escribió después de que se programó, se cancela.
  · Lo que Instagram rechaza (ventana cerrada, error de Meta) queda en `error` con el motivo, a la vista.
"""
import logging
from datetime import timedelta

from app import db
from app.automatizaciones import escribir
from app.automatizaciones.acciones import AccionInvalida
from app.automatizaciones.modelos import AutSeguimiento, IgContacto, IgMensaje

# Más allá de esto la ventana de Instagram ya está cerrada (HUMAN_AGENT vale 7 días desde el último mensaje).
HORAS_MAXIMAS = 6 * 24
POR_VUELTA = 50
logger = logging.getLogger(__name__)


def programar(contacto, autor_id, horas, ahora, texto=None, audio=None, url_audio=None, pausar=True):
    try:
        horas = float(horas)
    except (TypeError, ValueError):
        raise AccionInvalida('Elegí en cuántas horas')
    if not 0 < horas <= HORAS_MAXIMAS:
        raise AccionInvalida(f'Elegí entre unos minutos y {HORAS_MAXIMAS // 24} días')
    if audio is None:
        escribir.cuerpo_de(texto)  # valida el texto ahora, no cuando ya no está quien lo escribió
    enviar_en = ahora + timedelta(hours=horas)
    estado = escribir.ventana(contacto, enviar_en)
    if estado == 'cerrada':
        raise AccionInvalida('Para esa hora ya pasaron 7 días desde su último mensaje: Instagram no deja escribirle')
    if estado != 'abierta' and _es_whatsapp(contacto):
        raise AccionInvalida('Para esa hora ya pasaron 24 h: WhatsApp solo deja escribirle con una plantilla')
    s = AutSeguimiento(contacto_id=contacto.id, autor_id=autor_id, texto=None if audio else texto.strip(),
                       audio_id=audio.id if audio else None, url_audio=url_audio,
                       nombre_audio=audio.name if audio else None, pausar=pausar,
                       enviar_en=enviar_en)
    db.session.add(s)
    db.session.flush()
    return s


def resumen(s, vigente=False):
    return {'id': s.id, 'texto': s.texto, 'audio': s.nombre_audio, 'estado': s.estado, 'detalle': s.detalle,
            'enviar_en': s.enviar_en.isoformat() + 'Z', 'autor': s.autor.username if s.autor else None,
            'cadencia': s.cadencia, 'vigente': vigente}


def _del_equipo_despues(contacto_ids):
    """{contacto_id: último mensaje del equipo (no el bot)}."""
    return dict(db.session.query(IgMensaje.contacto_id, db.func.max(IgMensaje.enviado_en))
                .filter(IgMensaje.contacto_id.in_(contacto_ids), IgMensaje.origen == IgMensaje.OTRO)
                .group_by(IgMensaje.contacto_id).all())


def _es_whatsapp(contacto):
    from app.whatsapp.cliente import es_whatsapp
    return es_whatsapp(contacto.igsid)


def _vigentes(contactos):
    """{contacto_id: el aviso vigente}: del silencio actual y sin que nadie del equipo le haya escrito después."""
    por_id = {c.id: c for c in contactos}
    if not por_id:
        return {}
    filas = (AutSeguimiento.query.filter(AutSeguimiento.contacto_id.in_(list(por_id)),
                                         AutSeguimiento.estado == AutSeguimiento.AVISO)
             .order_by(AutSeguimiento.resuelto_en).all())
    equipo = _del_equipo_despues(list(por_id))
    salida = {}
    for s in filas:
        c = por_id[s.contacto_id]
        if s.ciclo == c.ultimo_entrante_en and not (equipo.get(c.id) and equipo[c.id] > s.resuelto_en):
            salida[c.id] = s
    return salida


def _rotulo(s):
    if s.cadencia:  # el de la cadencia de su fase (ADR-W204): «Toca seguimiento N»
        return f'{s.texto}: lo pide la cadencia de su fase'
    que = f'🎤 {s.nombre_audio}' if s.nombre_audio else f'«{(s.texto or "")[:80]}»'
    return f'Lo programó {s.autor.username if s.autor else "el equipo"}: {que}'


def avisos(contactos):
    """{contacto_id: por qué toca seguimiento}: la cadencia de su fase o uno programado que ya no sale solo."""
    return {cid: _rotulo(s) for cid, s in _vigentes(contactos).items()}


def de_contacto(contacto_id, ultimos=5):
    """Los programados y los últimos resueltos (para ver si salió o por qué no)."""
    programados = (AutSeguimiento.query.filter_by(contacto_id=contacto_id, estado=AutSeguimiento.PROGRAMADO)
                   .order_by(AutSeguimiento.enviar_en).all())
    resueltos = (AutSeguimiento.query.filter(AutSeguimiento.contacto_id == contacto_id,
                                             AutSeguimiento.estado != AutSeguimiento.PROGRAMADO)
                 .order_by(AutSeguimiento.resuelto_en.desc()).limit(ultimos).all())
    contacto = db.session.get(IgContacto, contacto_id)
    vigente = _vigentes([contacto]).get(contacto_id) if contacto else None
    return [resumen(s, vigente=bool(vigente and s.id == vigente.id)) for s in programados + resueltos]


def _a_aviso(s, contacto, ahora):
    """Ya pasaron las 24 h: no sale solo. Queda como «Toca seguimiento» con su texto (ADR-W283)."""
    s.estado, s.resuelto_en, s.ciclo = AutSeguimiento.AVISO, ahora, contacto.ultimo_entrante_en
    s.detalle = 'Pasaron 24 h desde su último mensaje: no sale solo, mandalo vos'


def mandar_aviso(motor, s, autor_id):
    """La persona manda en el momento el seguimiento programado que quedó como aviso. Devuelve el `IgMensaje`."""
    if s.estado != AutSeguimiento.AVISO or s.cadencia:
        raise AccionInvalida('Ese seguimiento ya no está para mandar')
    contacto = db.session.get(IgContacto, s.contacto_id)
    mensaje = escribir.enviar(motor, contacto, autor_id, texto=s.texto, url_audio=s.url_audio,
                              nombre_audio=s.nombre_audio, pausar=s.pausar)
    mensaje.seguimiento = True
    _cerrar(s, AutSeguimiento.ENVIADO, motor.ahora)
    return mensaje


def proximos(contacto_ids):
    """{contacto_id: el próximo programado (iso)}: la bandeja marca la fila de quien ya tiene uno."""
    if not contacto_ids:
        return {}
    filas = (db.session.query(AutSeguimiento.contacto_id, db.func.min(AutSeguimiento.enviar_en))
             .filter(AutSeguimiento.contacto_id.in_(contacto_ids), AutSeguimiento.estado == AutSeguimiento.PROGRAMADO)
             .group_by(AutSeguimiento.contacto_id).all())
    return {cid: en.isoformat() + 'Z' for cid, en in filas}


def _cerrar(s, estado, ahora, detalle=None):
    s.estado, s.resuelto_en, s.detalle = estado, ahora, (detalle or '')[:300] or None


def cancelar(s, ahora, detalle='Lo canceló el equipo'):
    if s.estado != AutSeguimiento.PROGRAMADO:
        raise AccionInvalida('Ese seguimiento ya no está programado')
    _cerrar(s, AutSeguimiento.CANCELADO, ahora, detalle)


def mandar_vencidos(motor):
    """Lo que llama el reloj: manda (o cancela) los seguimientos que ya tocan. Devuelve cuántos salieron."""
    ahora = motor.ahora
    vencidos = (AutSeguimiento.query.filter(AutSeguimiento.estado == AutSeguimiento.PROGRAMADO,
                                            AutSeguimiento.enviar_en <= ahora)
                .order_by(AutSeguimiento.enviar_en).limit(POR_VUELTA).all())
    enviados = 0
    for s in vencidos:
        contacto = db.session.get(IgContacto, s.contacto_id)
        if contacto.ultimo_entrante_en and contacto.ultimo_entrante_en > s.creado_en:
            _cerrar(s, AutSeguimiento.CANCELADO, ahora, 'Respondió antes: no hizo falta')
        elif escribir.ventana(contacto, ahora) in ('humana', 'instagram') and not _es_whatsapp(contacto):
            _a_aviso(s, contacto, ahora)
        else:
            try:
                escribir.enviar(motor, contacto, s.autor_id, texto=s.texto, url_audio=s.url_audio,
                                nombre_audio=s.nombre_audio, pausar=s.pausar, a_mano=False)
                _cerrar(s, AutSeguimiento.ENVIADO, ahora)
                enviados += 1
            except AccionInvalida as error:
                _cerrar(s, AutSeguimiento.ERROR, ahora, str(error))
            except Exception as error:  # red caída, etc.: queda en error a la vista, no se reintenta solo
                logger.error(f'[MOTOR IG] Seguimiento {s.id}: {error}')
                _cerrar(s, AutSeguimiento.ERROR, ahora, f'No se pudo mandar: {error}')
        # Uno por uno: si la vuelta se corta, lo que ya salió no se vuelve a mandar.
        db.session.commit()
    return enviados
