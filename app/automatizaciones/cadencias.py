"""Cadencias de seguimiento por fase (ADR-W204): qué pasa cuando el lead deja de contestar.

  · Cada fase de cada embudo tiene sus seguimientos en la Guía (`guia.seguimientos`): a cuántas horas del
    último mensaje del lead sale cada uno y quién lo manda. El automático lo manda el motor (texto, y un
    botón con link si tiene); el de setter deja un aviso «toca seguimiento N» en la conversación.
  · Solo cuenta como silencio si lo último de la conversación es nuestro: si el lead escribió y nadie le
    contestó, no es un seguimiento. Cada paso sale una vez por silencio (`AutSeguimiento.cadencia/ciclo`);
    `unaVez` lo limita a una vez en la vida del lead (la invitación a un workshop).
  · Solo se mira el último paso vencido, y si venció hace menos de TOLERANCIA: al prender la cadencia no se
    les escribe a todos los silencios viejos, y si se vencieron dos juntos sale el más avanzado.
  · Un automático no sale fuera de la ventana de 24 h, ni a quien está en medio de un flujo que todavía va
    a mandar algo solo, ni a No lead o In-abrible. Lo que no sale queda anotado con el motivo.
  · Candado (`AutEmbudo.seguimientos_desde`): solo las conversaciones que empezaron después de prender los
    seguimientos (un lead nuevo, o uno que volvió a entrar por un flujo). Las de antes nunca la reciben.
  · Corre en cada vuelta del reloj del motor (`servicio.mandar_seguimientos`), solo en los embudos con los
    seguimientos prendidos. La simulación (`simulacion.py`) usa `debido` y `cuerpo` sin mandar nada.
"""
import logging
import re
from collections import defaultdict
from datetime import timedelta

from app import db
from app.automatizaciones import bandeja, embudos, escribir, fases, guia, progreso
from app.automatizaciones.modelos import AutEjecucion, AutSeguimiento, IgContacto, IgMensaje
from app.automatizaciones.transporte import ErrorDeEnvio

logger = logging.getLogger(__name__)
TOLERANCIA = timedelta(hours=2)
VENTANA_AUTO = timedelta(hours=23, minutes=50)
POR_VUELTA = 40
# El reloj del motor da una vuelta con cada DM: la cadencia se mira como mucho una vez por minuto.
CADA = timedelta(seconds=60)
_ultima = None
_VARIABLE = re.compile(r'\{\s*([a-z_][a-z0-9_]*)\s*\}')


def clave(embudo, fase, paso):
    return f'{embudo.slug}:{fase}:{paso["id"]}'[:120]


def variables_de(contacto, embudo):
    nombre = (contacto.nombre or '').strip().split(' ')[0]
    return {**(embudo.variables or {}), 'nombre': nombre, 'usuario': contacto.username or ''}


def completar(texto, variables):
    """{variable} por su valor; la que no existe queda vacía."""
    return _VARIABLE.sub(lambda m: str(variables.get(m.group(1), '') or ''), texto or '').strip()


def cuerpo(paso, variables):
    """El mensaje para la API de Instagram, o ValueError con el motivo."""
    texto = completar(paso.get('x'), variables)
    if not texto:
        raise ValueError('El texto quedó vacío')
    if not paso.get('boton'):
        return {'text': texto}
    link = completar(paso.get('link'), variables)
    if not link.startswith(('https://', 'http://')):
        raise ValueError(f'El link del botón no es válido: «{link or "vacío"}». Revisá las variables del embudo')
    return {'attachment': {'type': 'template', 'payload': {
        'template_type': 'button', 'text': texto[:guia.LARGO_PLANTILLA],
        'buttons': [{'type': 'web_url', 'url': link, 'title': paso['boton']}]}}}


def debido(pasos, ciclo, ahora):
    """(número desde 1, paso) del último paso vencido en este silencio, o None."""
    vencidos = [(i + 1, p) for i, p in enumerate(pasos) if ciclo + timedelta(hours=p['h']) <= ahora]
    return vencidos[-1] if vencidos else None


def _cadencias(embudo):
    _, contenido = guia.vigente(embudo)
    return {f: e.get('seguimientos') for f, e in (contenido.get('etapas') or {}).items()
            if e.get('seguimientos') and f not in fases.SALIDAS}


def _fases(embudo, contactos, ahora):
    """{contacto_id: fase}. En Conversión, la efectiva (`progreso`); en los demás, la marcada o la primera."""
    if not embudos.es_conversion(embudo):
        primera = (embudos.fases_de(embudo) or [{}])[0].get('id')
        return {c.id: c.fase or primera for c in contactos}
    ids = [c.id for c in contactos]
    primeros = dict(db.session.query(IgMensaje.contacto_id, db.func.min(IgMensaje.enviado_en))
                    .filter(IgMensaje.contacto_id.in_(ids)).group_by(IgMensaje.contacto_id).all())
    avance = progreso.de_contactos(contactos, bandeja.ultimas_ejecuciones(ids), ahora, None, primeros)
    return {cid: a.get('fase') for cid, a in avance.items()}


def _candidatos(embudo, horas_max, ahora):
    """Los leads del embudo en silencio: lo último de la conversación es nuestro."""
    guardado = embudos.id_guardado(embudo)
    q = IgContacto.query.filter(IgContacto.ultimo_entrante_en >= ahora - timedelta(hours=horas_max) - TOLERANCIA)
    q = q.filter(IgContacto.embudo_id.is_(None) if guardado is None else IgContacto.embudo_id == guardado)
    contactos = q.all()
    if not contactos:
        return []
    desde = embudo.seguimientos_desde
    if desde:
        volvieron = {cid for (cid,) in db.session.query(AutEjecucion.contacto_id).filter(
            AutEjecucion.contacto_id.in_([c.id for c in contactos]), AutEjecucion.iniciada_en >= desde).distinct()}
        contactos = [c for c in contactos if c.creado_en >= desde or c.id in volvieron]
        if not contactos:
            return []
    ultimos = dict(db.session.query(IgMensaje.contacto_id, db.func.max(IgMensaje.enviado_en))
                   .filter(IgMensaje.contacto_id.in_([c.id for c in contactos]),
                           IgMensaje.direccion == IgMensaje.SALIENTE).group_by(IgMensaje.contacto_id).all())
    return [c for c in contactos if ultimos.get(c.id) and ultimos[c.id] > c.ultimo_entrante_en]


def _ocupado_en_flujo(contacto_id):
    """Está en un flujo que todavía va a mandar algo solo (una espera, o el «sin respuesta» de un paso)."""
    e = (AutEjecucion.query.filter(AutEjecucion.contacto_id == contacto_id, AutEjecucion.estado.in_(AutEjecucion.ABIERTOS))
         .order_by(AutEjecucion.id.desc()).first())
    return bool(e and (e.estado != AutEjecucion.ESPERANDO_RESPUESTA or e.despertar_en))


def _anotar(contacto, cad, ciclo, ahora, estado, texto=None, detalle=None, vencio=None):
    db.session.add(AutSeguimiento(contacto_id=contacto.id, cadencia=cad, ciclo=ciclo, texto=texto, pausar=False,
                                  enviar_en=vencio or ahora, estado=estado, resuelto_en=ahora,
                                  detalle=(detalle or '')[:300] or None))


def _ya_recibio(contacto_id, cad):
    return AutSeguimiento.query.filter_by(contacto_id=contacto_id, cadencia=cad, estado=AutSeguimiento.ENVIADO).first()


def _mandar_auto(motor, contacto, embudo, paso, cad, ciclo, vencio):
    ahora = motor.ahora
    if ahora - ciclo >= VENTANA_AUTO:
        return _anotar(contacto, cad, ciclo, ahora, AutSeguimiento.ERROR, paso['x'], 'Ventana de 24 h cerrada', vencio)
    if paso.get('unaVez') and _ya_recibio(contacto.id, cad):
        return _anotar(contacto, cad, ciclo, ahora, AutSeguimiento.CANCELADO, paso['x'], 'Ya lo recibió antes', vencio)
    try:
        mensaje = cuerpo(paso, variables_de(contacto, embudo))
        mid = escribir._mandar(motor, contacto, mensaje, None)
    except ValueError as error:
        return _anotar(contacto, cad, ciclo, ahora, AutSeguimiento.ERROR, paso['x'], str(error), vencio)
    except ErrorDeEnvio as error:
        return _anotar(contacto, cad, ciclo, ahora, AutSeguimiento.ERROR, paso['x'], f'Instagram no lo aceptó: {error}', vencio)
    visible = mensaje.get('text') or mensaje['attachment']['payload']['text']
    db.session.add(IgMensaje(contacto_id=contacto.id, mid=mid, direccion=IgMensaje.SALIENTE, origen=IgMensaje.MOTOR,
                             texto=visible, contenido=mensaje, enviado_en=ahora, nodo_id='seguimiento'))
    _anotar(contacto, cad, ciclo, ahora, AutSeguimiento.ENVIADO, visible, vencio=vencio)
    return True


def _uno(motor, contacto, embudo, fase, pasos, hechos):
    ahora, ciclo = motor.ahora, contacto.ultimo_entrante_en
    toca = debido(pasos, ciclo, ahora)
    if not toca:
        return False
    numero, paso = toca
    vencio = ciclo + timedelta(hours=paso['h'])
    cad = clave(embudo, fase, paso)
    if ahora - vencio > TOLERANCIA or (contacto.id, cad, ciclo) in hechos:
        return False
    if paso['quien'] == 'setter':
        _anotar(contacto, cad, ciclo, ahora, AutSeguimiento.AVISO, f'Toca seguimiento {numero}', paso.get('nota'), vencio)
        return False
    if _ocupado_en_flujo(contacto.id):
        return False  # se vuelve a mirar en la próxima vuelta, mientras no pase la tolerancia
    return _mandar_auto(motor, contacto, embudo, paso, cad, ciclo, vencio) is True


def _embudo(motor, embudo):
    cads = _cadencias(embudo)
    if not cads:
        return 0
    horas_max = max(p['h'] for pasos in cads.values() for p in pasos)
    contactos = _candidatos(embudo, horas_max, motor.ahora)
    if not contactos:
        return 0
    de_fase = _fases(embudo, contactos, motor.ahora)
    hechos = {(cid, cad, ciclo) for cid, cad, ciclo in db.session.query(
        AutSeguimiento.contacto_id, AutSeguimiento.cadencia, AutSeguimiento.ciclo)
        .filter(AutSeguimiento.contacto_id.in_([c.id for c in contactos]), AutSeguimiento.cadencia.isnot(None))}
    enviados = 0
    for c in contactos[:POR_VUELTA * 10]:
        fase = de_fase.get(c.id)
        if fase not in cads:
            continue
        try:
            enviados += _uno(motor, c, embudo, fase, cads[fase], hechos)
            db.session.commit()  # uno por uno: si la vuelta se corta, lo que salió no se repite
        except Exception as error:
            db.session.rollback()
            logger.error(f'[MOTOR IG] Cadencia de {c.id}: {error}')
        if enviados >= POR_VUELTA:
            break
    return enviados


def mandar(motor):
    """Lo que llama el reloj. Devuelve cuántos automáticos salieron."""
    global _ultima
    if _ultima is not None and motor.ahora - _ultima < CADA:
        return 0
    _ultima = motor.ahora
    return sum(_embudo(motor, e) for e in embudos.todos() if e.seguimientos_activos)


def metricas(embudo, dias=7, ahora=None):
    """{clave: {enviados, avisos, no_salieron, respondieron}} de los últimos `dias`."""
    from app.automatizaciones.modelos import ahora as reloj
    desde = (ahora or reloj()) - timedelta(days=dias)
    filas = (db.session.query(AutSeguimiento.cadencia, AutSeguimiento.estado, AutSeguimiento.resuelto_en,
                              IgContacto.ultimo_entrante_en)
             .join(IgContacto, IgContacto.id == AutSeguimiento.contacto_id)
             .filter(AutSeguimiento.cadencia.like(f'{embudo.slug}:%'), AutSeguimiento.creado_en >= desde).all())
    salida = defaultdict(lambda: {'enviados': 0, 'avisos': 0, 'no_salieron': 0, 'respondieron': 0})
    for cad, estado, en, ultimo in filas:
        m = salida[cad]
        if estado == AutSeguimiento.ENVIADO:
            m['enviados'] += 1
        elif estado == AutSeguimiento.AVISO:
            m['avisos'] += 1
        else:
            m['no_salieron'] += 1
            continue
        if ultimo and en and ultimo > en:
            m['respondieron'] += 1
    return dict(salida)
