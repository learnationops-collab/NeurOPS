"""Diagnóstico TEMPORAL del motor (21/10/2026): exporta en JSON lo que se miraba por `railway ssh`
mientras Railway tiene el SSH caído. Sin sesión: lo protege un token en la URL (?t=...), del que acá
solo vive el sha256. Solo lectura. Borrar este archivo y su registro cuando vuelva el SSH.

GET /api/diagnostico-inbox?t=TOKEN&horas=24
"""
import hashlib
import hmac
from collections import Counter
from datetime import timedelta

from flask import Blueprint, jsonify, request

from app.automatizaciones import servicio
from app.automatizaciones.campanas import vigente
from app.automatizaciones.modelos import AutCampana, AutEjecucion, AutFlujo, IgContacto, IgMensaje, ahora
from app.models.instagram import InstagramWebhookEvento
from app.models.marketing import clave_de_palabra

bp = Blueprint('diagnostico_inbox', __name__)

TOKEN_SHA256 = '01e958ad7048df981063fc7d0d3b987088ec67d04feb3151e5632504e798ce58'
MAX_HORAS = 72
TEXTO = 300


def _iso(fecha):
    return fecha.isoformat() + 'Z' if fecha else None


def _token_valido():
    dado = hashlib.sha256((request.args.get('t') or '').encode()).hexdigest()
    return hmac.compare_digest(dado, TOKEN_SHA256)


def _contacto(c):
    return {'id': c.id, 'username': c.username, 'nombre': c.nombre, 'bot_pausado_hasta': _iso(c.bot_pausado_hasta),
            'ultimo_entrante_en': _iso(c.ultimo_entrante_en)}


def _ejecucion(e):
    return {'id': e.id, 'contacto_id': e.contacto_id, 'flujo': e.version.flujo.nombre, 'version_id': e.version_id,
            'campana_id': e.campana_id, 'clave': e.clave, 'estado': e.estado, 'nodo': e.nodo_actual,
            'detalle': e.detalle, 'califica': e.califica, 'setter_id': e.setter_id, 'meta_ad_id': e.meta_ad_id,
            'iniciada_en': _iso(e.iniciada_en), 'actualizada_en': _iso(e.actualizada_en),
            'despertar_en': _iso(e.despertar_en)}


@bp.route('', methods=['GET'])
def exportar():
    if not _token_valido():
        return jsonify({'message': 'Not found'}), 404
    try:
        horas = min(max(int(request.args.get('horas', 24)), 1), MAX_HORAS)
    except ValueError:
        horas = 24
    momento = ahora()
    desde = momento - timedelta(hours=horas)

    campanas = AutCampana.query.order_by(AutCampana.id).all()
    claves = {p.clave: c.id for c in campanas if vigente(c, momento) for p in c.palabras}
    ejecuciones = AutEjecucion.query.filter(AutEjecucion.actualizada_en >= desde).order_by(AutEjecucion.id).all()
    mensajes = IgMensaje.query.filter(IgMensaje.enviado_en >= desde).order_by(IgMensaje.enviado_en, IgMensaje.id).all()
    eventos = (InstagramWebhookEvento.query.filter(InstagramWebhookEvento.recibido_en >= desde)
               .order_by(InstagramWebhookEvento.id.desc()).all())
    ids = {m.contacto_id for m in mensajes} | {e.contacto_id for e in ejecuciones}
    contactos = IgContacto.query.filter(IgContacto.id.in_(ids)).all() if ids else []

    # Cada DM que es una palabra de campaña vigente: ¿arrancó una ejecución? (lo que reporta el setter)
    palabras = []
    for m in mensajes:
        clave = clave_de_palabra(m.texto) if m.direccion == IgMensaje.ENTRANTE else None
        if clave not in claves:
            continue
        ejecucion = next((e for e in ejecuciones if e.contacto_id == m.contacto_id and e.clave == clave
                          and abs((e.iniciada_en - m.enviado_en).total_seconds()) < 120), None)
        respuesta = next((s for s in mensajes if s.contacto_id == m.contacto_id and s.direccion == IgMensaje.SALIENTE
                          and m.enviado_en <= s.enviado_en <= m.enviado_en + timedelta(minutes=3)), None)
        palabras.append({'contacto_id': m.contacto_id, 'clave': clave, 'en': _iso(m.enviado_en),
                         'ejecucion_id': ejecucion.id if ejecucion else None,
                         'primera_respuesta': respuesta and {'origen': respuesta.origen, 'en': _iso(respuesta.enviado_en)}})

    return jsonify({
        'ahora': _iso(momento), 'desde': _iso(desde), 'modo': servicio.modo(),
        'flujos': [{'id': f.id, 'nombre': f.nombre, 'estado': f.estado, 'version_publicada_id': f.version_publicada_id,
                    'activo_desde': _iso(f.activo_desde)} for f in AutFlujo.query.order_by(AutFlujo.id)],
        'campanas': [{'id': c.id, 'nombre': c.nombre, 'flujo_id': c.flujo_id, 'desde': _iso(c.desde), 'hasta': _iso(c.hasta),
                      'vigente': vigente(c, momento), 'palabras': [p.clave for p in c.palabras],
                      'campanas_meta': [m.meta_campana_id for m in c.campanas_meta]} for c in campanas],
        'webhook': {
            'recibidos': len(eventos),
            'sin_procesar': InstagramWebhookEvento.query.filter(InstagramWebhookEvento.procesado_en.is_(None)).count(),
            'por_hora': sorted(Counter(e.recibido_en.strftime('%Y-%m-%d %H:00') for e in eventos).items()),
            'resultados': Counter(e.resultado for e in eventos).most_common(30),
            'errores': [{'id': e.id, 'recibido_en': _iso(e.recibido_en), 'resultado': e.resultado}
                        for e in eventos if (e.resultado or '').startswith('error')][:50],
            'ultimos': [{'id': e.id, 'recibido_en': _iso(e.recibido_en), 'procesado_en': _iso(e.procesado_en),
                         'tipos': e.tipos, 'resultado': e.resultado} for e in eventos[:40]],
        },
        'palabras_de_campana': palabras,
        'ejecuciones': [_ejecucion(e) for e in ejecuciones],
        'contactos': [_contacto(c) for c in contactos],
        'mensajes': [{'contacto_id': m.contacto_id, 'direccion': m.direccion, 'origen': m.origen,
                      'ejecucion_id': m.ejecucion_id, 'nodo': m.nodo_id, 'texto': (m.texto or '')[:TEXTO] or None,
                      'adjuntos': bool(m.contenido), 'en': _iso(m.enviado_en)} for m in mensajes],
    })
