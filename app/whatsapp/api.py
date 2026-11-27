"""/api/whatsapp: la herramienta «Broadcast de WhatsApp» (ADR-W229) y las plantillas. Solo admin y operador.

  · POST /envios/revisar            → {csv, sin_alumnos?} → cuántos hay para mandar, ya recibieron, inválidos,
                                       repetidos y alumnos vigentes (sin_alumnos, por defecto: se saltean).
  · POST /envios                    → {csv, plantillas: [{nombre, idioma}], cantidad, sin_alumnos?} → manda a los próximos
                                       `cantidad`; con varias plantillas, cada número recibe una al azar.
  · GET  /envios                    → el historial: cada envío (lote) con su conteo, y el tope de hoy.
  · GET  /envios/<lote>             → los números de ese envío.
  · POST /envios/<lote>/frenar      → saca lo que todavía no salió.
  · GET  /plantillas                → las de la cuenta, con su estado de aprobación.
  · POST /plantillas                → {nombre, texto, categoria?: MARKETING|UTILITY, idioma?, ejemplo_nombre?,
                                       botones?: [texto]} (respuesta rápida)
"""
import csv
import io
import re
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.automatizaciones.transporte import ErrorDeEnvio
from app.decorators import admin_required, workshop_required
from app.whatsapp import envios, historial
from app.whatsapp.cliente import ClienteWhatsapp

bp = Blueprint('whatsapp', __name__)


def _filas(datos):
    """Los números del pedido: lista [{telefono, nombre}] o un CSV con columnas telefono/nombre (o sin encabezado)."""
    if isinstance(datos.get('numeros'), list):
        return datos['numeros']
    texto = (datos.get('csv') or '').strip()
    if not texto:
        return []
    filas = list(csv.reader(io.StringIO(texto)))
    encabezado = [c.strip().lower() for c in filas[0]] if filas else []
    if any('tel' in c or 'phone' in c or 'whats' in c or 'numero' in c for c in encabezado):
        i_tel = next(i for i, c in enumerate(encabezado) if 'tel' in c or 'phone' in c or 'whats' in c or 'numero' in c)
        i_nom = next((i for i, c in enumerate(encabezado) if 'nombre' in c or 'name' in c), None)
        filas = filas[1:]
    else:
        i_tel, i_nom = 0, 1
    return [{'telefono': f[i_tel] if len(f) > i_tel else '',
             'nombre': f[i_nom] if i_nom is not None and len(f) > i_nom else None} for f in filas if f]


def _plantillas(pedidas):
    """[(nombre, idioma, con_nombre)] de las pedidas, todas aprobadas (si no, error). con_nombre: lleva {{1}}."""
    if not pedidas:
        raise envios.EnvioInvalido('Elegí una plantilla')
    try:
        todas = ClienteWhatsapp().plantillas()
    except ErrorDeEnvio as error:
        raise envios.EnvioInvalido(f'Meta no respondió: {error}')
    salida = []
    for pedida in pedidas:
        nombre, idioma = (pedida.get('nombre') or '').strip(), (pedida.get('idioma') or 'es').strip()
        p = next((x for x in todas if x['name'] == nombre and x.get('language') == idioma), None)
        if p is None or p.get('status') != 'APPROVED':
            raise envios.EnvioInvalido(f'{nombre or "Esa plantilla"} no está aprobada')
        cuerpo = next((c.get('text') or '' for c in p.get('components') or [] if c.get('type') == 'BODY'), '')
        salida.append((nombre, idioma, '{{1}}' in cuerpo))
    return salida


def _sin(datos):
    """(sin_alumnos, sin_agendados, sin_equipo): los tres sí, salvo que el pedido diga false."""
    return tuple(datos.get(k, True) is not False for k in ('sin_alumnos', 'sin_agendados', 'sin_equipo'))


def _hoy():
    ahora = datetime.utcnow()
    return {'usados': envios.usados_hoy(ahora), 'tope': envios.TOPE_DIARIO}


@bp.route('/envios/revisar', methods=['POST'])
@login_required
@admin_required
def revisar():
    datos = request.get_json(silent=True) or {}
    r = envios.revisar(_filas(datos), *_sin(datos))
    return jsonify({**r, 'para_mandar': len(r['para_mandar']), 'hoy': _hoy()})


@bp.route('/envios', methods=['POST'])
@login_required
@admin_required
def enviar():
    datos = request.get_json(silent=True) or {}
    try:
        cantidad = int(datos.get('cantidad') or 0)
        plantillas = _plantillas([p for p in datos.get('plantillas') or [] if isinstance(p, dict)])
        lote, n = envios.crear_lote(_filas(datos), plantillas, cantidad, current_user.id, datetime.utcnow(),
                                    *_sin(datos))
    except (TypeError, ValueError) as error:
        return jsonify({'message': str(error) if isinstance(error, envios.EnvioInvalido) else 'Cantidad inválida'}), 400
    return jsonify({'lote': lote, 'cantidad': n, 'hoy': _hoy()}), 201


@bp.route('/envios', methods=['GET'])
@login_required
@admin_required
def listar():
    return jsonify({'lotes': historial.lotes(), 'hoy': _hoy()})


@bp.route('/envios/<lote>', methods=['GET'])
@login_required
@admin_required
def numeros(lote):
    return jsonify({'numeros': historial.numeros(lote)})


@bp.route('/envios/<lote>/frenar', methods=['POST'])
@login_required
@admin_required
def frenar(lote):
    return jsonify({'frenados': envios.frenar(lote), 'hoy': _hoy()})


@bp.route('/plantillas', methods=['GET'])
@login_required
@workshop_required
def plantillas():
    try:
        return jsonify({'plantillas': ClienteWhatsapp().plantillas()})
    except ErrorDeEnvio as error:
        return jsonify({'message': str(error)}), 502


BOTONES_MAX, LARGO_BOTON = 10, 25


def _botones(pedidos):
    """(textos, problema) de los botones de respuesta rápida: los límites de Meta (10, de 25 caracteres)."""
    if not pedidos:
        return [], None
    if not isinstance(pedidos, list):
        return [], 'Los botones van como lista de textos'
    botones = [(b or '').strip() if isinstance(b, str) else '' for b in pedidos]
    if '' in botones:
        return [], 'Hay un botón vacío'
    if len(botones) > BOTONES_MAX:
        return [], f'Van hasta {BOTONES_MAX} botones'
    largo = next((b for b in botones if len(b) > LARGO_BOTON), None)
    if largo:
        return [], f'«{largo}» pasa los {LARGO_BOTON} caracteres'
    if len(set(botones)) != len(botones):
        return [], 'Hay dos botones iguales'
    return botones, None


@bp.route('/plantillas', methods=['POST'])
@login_required
@workshop_required
def crear_plantilla():
    """Una plantilla de texto. Si el texto lleva {{1}}, `ejemplo_nombre` es el ejemplo que pide Meta.
    `botones`: textos de respuesta rápida; al enviarla no llevan parámetros y el toque llega como texto."""
    datos = request.get_json(silent=True) or {}
    nombre, texto = (datos.get('nombre') or '').strip().lower(), (datos.get('texto') or '').strip()
    if not nombre or not texto:
        return jsonify({'message': 'Falta el nombre o el texto'}), 400
    botones, problema = _botones(datos.get('botones'))
    if problema:
        return jsonify({'message': problema}), 400
    cuerpo = {'type': 'BODY', 'text': texto}
    variables = sorted({int(n) for n in re.findall(r'\{\{(\d+)\}\}', texto)})
    if variables != list(range(1, len(variables) + 1)):
        return jsonify({'message': 'Las variables van en orden: {{1}}, {{2}}, {{3}}…'}), 400
    if variables:
        # `ejemplos`: uno por variable (lo pide Meta); el primero cae en `ejemplo_nombre` si no llega.
        ejemplos = [str(e).strip() for e in datos.get('ejemplos') or [] if str(e).strip()]
        ejemplos = (ejemplos or [datos.get('ejemplo_nombre') or 'Laura'])
        ejemplos += ['ejemplo'] * (len(variables) - len(ejemplos))
        cuerpo['example'] = {'body_text': [ejemplos[:len(variables)]]}
    componentes = [cuerpo]
    if botones:
        componentes.append({'type': 'BUTTONS', 'buttons': [{'type': 'QUICK_REPLY', 'text': b} for b in botones]})
    categoria = datos.get('categoria') if datos.get('categoria') in ('MARKETING', 'UTILITY') else 'MARKETING'
    try:
        respuesta = ClienteWhatsapp().crear_plantilla(nombre, datos.get('idioma') or 'es', categoria, componentes)
    except ErrorDeEnvio as error:
        return jsonify({'message': str(error)}), 400
    return jsonify(respuesta), 201


from app.whatsapp import api_plantillas  # noqa: E402,F401  (registra sus rutas en este blueprint)
from app.whatsapp import api_taller  # noqa: E402,F401
