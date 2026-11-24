"""/api/whatsapp: difusiones (broadcast) y plantillas. Solo admin.

  · GET  /difusiones                 → lista con el conteo por estado.
  · POST /difusiones                 → {nombre, plantilla, idioma?, con_nombre?, destino?, tope_diario?, numeros: [{telefono, nombre}] | csv}
  · POST /difusiones/<id>/numeros    → suma números (mismo formato).
  · PATCH /difusiones/<id>           → {estado?: activa|pausada, tope_diario?}
  · GET  /plantillas                 → las de la cuenta, con su estado de aprobación.
  · POST /plantillas                 → {nombre, texto, categoria?: MARKETING|UTILITY, idioma?, ejemplo_nombre?}
"""
import csv
import io

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.automatizaciones.transporte import ErrorDeEnvio
from app.decorators import admin_required
from app.models.whatsapp import WaDifusion
from app.whatsapp import difusion as dif
from app.whatsapp.cliente import ClienteWhatsapp

bp = Blueprint('whatsapp', __name__)
DESTINOS = ('setting', 'workshop')
TOPE_MAXIMO = 250  # lo que deja Meta sin verificar el negocio


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


def _tope(valor, por_defecto=30):
    try:
        return max(1, min(int(valor), TOPE_MAXIMO))
    except (TypeError, ValueError):
        return por_defecto


@bp.route('/difusiones', methods=['GET'])
@login_required
@admin_required
def listar():
    return jsonify({'difusiones': [dif.resumen(d) for d in WaDifusion.query.order_by(WaDifusion.id.desc()).all()]})


@bp.route('/difusiones', methods=['POST'])
@login_required
@admin_required
def crear():
    datos = request.get_json(silent=True) or {}
    nombre, plantilla = (datos.get('nombre') or '').strip(), (datos.get('plantilla') or '').strip()
    if not nombre or not plantilla:
        return jsonify({'message': 'Falta el nombre o la plantilla'}), 400
    destino = datos.get('destino') if datos.get('destino') in DESTINOS else 'setting'
    difusion = WaDifusion(nombre=nombre[:150], plantilla=plantilla[:120], idioma=(datos.get('idioma') or 'es')[:10],
                          con_nombre=datos.get('con_nombre', True) is not False, destino=destino,
                          tope_diario=_tope(datos.get('tope_diario')), creado_por_id=current_user.id)
    db.session.add(difusion)
    db.session.flush()
    carga = dif.cargar(difusion, _filas(datos))
    db.session.commit()
    return jsonify({'difusion': dif.resumen(difusion), 'carga': carga}), 201


@bp.route('/difusiones/<int:difusion_id>/numeros', methods=['POST'])
@login_required
@admin_required
def sumar_numeros(difusion_id):
    difusion = db.session.get(WaDifusion, difusion_id)
    if difusion is None:
        return jsonify({'message': 'Not found'}), 404
    carga = dif.cargar(difusion, _filas(request.get_json(silent=True) or {}))
    if difusion.estado == WaDifusion.TERMINADA and carga['agregados']:
        difusion.estado = WaDifusion.PAUSADA
    db.session.commit()
    return jsonify({'difusion': dif.resumen(difusion), 'carga': carga})


@bp.route('/difusiones/<int:difusion_id>', methods=['PATCH'])
@login_required
@admin_required
def editar(difusion_id):
    difusion = db.session.get(WaDifusion, difusion_id)
    if difusion is None:
        return jsonify({'message': 'Not found'}), 404
    datos = request.get_json(silent=True) or {}
    if datos.get('estado') in (WaDifusion.ACTIVA, WaDifusion.PAUSADA):
        difusion.estado = datos['estado']
    if 'tope_diario' in datos:
        difusion.tope_diario = _tope(datos['tope_diario'], difusion.tope_diario)
    db.session.commit()
    return jsonify({'difusion': dif.resumen(difusion)})


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
