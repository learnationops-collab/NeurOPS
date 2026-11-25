"""/api/whatsapp: la herramienta «Broadcast de WhatsApp» (ADR-W229) y las plantillas. Solo admin y operador.

  · POST /envios/revisar            → {csv} → cuántos hay para mandar, ya recibieron, inválidos, repetidos.
  · POST /envios                    → {csv, plantillas: [{nombre, idioma}], cantidad} → manda a los próximos
                                       `cantidad`; con varias plantillas, cada número recibe una al azar.
  · GET  /envios                    → el historial: cada envío (lote) con su conteo, y el tope de hoy.
  · GET  /envios/<lote>             → los números de ese envío.
  · POST /envios/<lote>/frenar      → saca lo que todavía no salió.
  · GET  /plantillas                → las de la cuenta, con su estado de aprobación.
  · POST /plantillas                → {nombre, texto, categoria?: MARKETING|UTILITY, idioma?, ejemplo_nombre?}
"""
import csv
import io
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.automatizaciones.transporte import ErrorDeEnvio
from app.decorators import admin_required
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


def _hoy():
    ahora = datetime.utcnow()
    return {'usados': envios.usados_hoy(ahora), 'tope': envios.TOPE_DIARIO}


@bp.route('/envios/revisar', methods=['POST'])
@login_required
@admin_required
def revisar():
    r = envios.revisar(_filas(request.get_json(silent=True) or {}))
    return jsonify({**r, 'para_mandar': len(r['para_mandar']), 'hoy': _hoy()})


@bp.route('/envios', methods=['POST'])
@login_required
@admin_required
def enviar():
    datos = request.get_json(silent=True) or {}
    try:
        cantidad = int(datos.get('cantidad') or 0)
        plantillas = _plantillas([p for p in datos.get('plantillas') or [] if isinstance(p, dict)])
        lote, n = envios.crear_lote(_filas(datos), plantillas, cantidad, current_user.id, datetime.utcnow())
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
@admin_required
def plantillas():
    try:
        return jsonify({'plantillas': ClienteWhatsapp().plantillas()})
    except ErrorDeEnvio as error:
        return jsonify({'message': str(error)}), 502


@bp.route('/plantillas', methods=['POST'])
@login_required
@admin_required
def crear_plantilla():
    """Una plantilla de texto. Si el texto lleva {{1}}, `ejemplo_nombre` es el ejemplo que pide Meta."""
    datos = request.get_json(silent=True) or {}
    nombre, texto = (datos.get('nombre') or '').strip().lower(), (datos.get('texto') or '').strip()
    if not nombre or not texto:
        return jsonify({'message': 'Falta el nombre o el texto'}), 400
    cuerpo = {'type': 'BODY', 'text': texto}
    if '{{1}}' in texto:
        cuerpo['example'] = {'body_text': [[datos.get('ejemplo_nombre') or 'Laura']]}
    categoria = datos.get('categoria') if datos.get('categoria') in ('MARKETING', 'UTILITY') else 'MARKETING'
    try:
        respuesta = ClienteWhatsapp().crear_plantilla(nombre, datos.get('idioma') or 'es', categoria, [cuerpo])
    except ErrorDeEnvio as error:
        return jsonify({'message': str(error)}), 400
    return jsonify(respuesta), 201
