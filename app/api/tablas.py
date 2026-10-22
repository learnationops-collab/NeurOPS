"""El motor genérico de tablas por HTTP (app/services/tablas/) y por consola, para probarlo en el servidor:

  flask tablas fuentes [clave]                         las fuentes, o los datos de una
  flask tablas consultar '<plan JSON>' [--pagina N] [--usuario nombre]

El plan es el de la Academia (app/services/tablas/plan.py). `agent/ask`, para la Academia, vive en
app/api/external/agent.py.
"""
import json
import logging

import click
from flask import Blueprint, jsonify, request
from flask_login import current_user

from app.decorators import tablas_required
from app.services.tablas import motor

logger = logging.getLogger(__name__)

bp = Blueprint('tablas', __name__)


@bp.route('/fuentes', methods=['GET'])
@tablas_required
def fuentes():
    return jsonify(motor.catalog(current_user))


@bp.route('/fuentes/<key>', methods=['GET'])
@tablas_required
def fuente(key):
    try:
        return jsonify(motor.catalog(current_user, key, request.args.get("buscar")))
    except motor.MotorError as e:
        return jsonify({'success': False, 'errores': e.errores}), 404


@bp.route('/consultar', methods=['POST'])
@tablas_required
def consultar():
    cuerpo = request.get_json(silent=True) or {}
    try:
        return jsonify(motor.run(current_user, cuerpo.get('plan'), pagina=cuerpo.get('pagina'),
                                 por_pagina=motor.SAMPLE))
    except motor.MotorError as e:
        return jsonify({'success': False, 'errores': e.errores}), 422


def _usuario(nombre):
    from app.models import User
    from app.models.user import ROLE_ADMIN

    if nombre:
        return User.query.filter_by(username=nombre).first()
    return User.query.filter_by(_role=ROLE_ADMIN).order_by(User.id).first()


def _imprimir(datos):
    click.echo(json.dumps(datos, ensure_ascii=False, indent=1, default=str))


@bp.cli.command('fuentes')
@click.argument('clave', required=False)
@click.option('--usuario', default=None, help='Con los permisos de quién (por defecto, el primer admin).')
def cli_fuentes(clave, usuario):
    try:
        _imprimir(motor.catalog(_usuario(usuario), clave or True))
    except motor.MotorError as e:
        click.echo(f'Error: {e}', err=True)


@bp.cli.command('consultar')
@click.argument('plan')
@click.option('--pagina', default=1, type=int)
@click.option('--usuario', default=None, help='Con los permisos de quién (por defecto, el primer admin).')
def cli_consultar(plan, pagina, usuario):
    try:
        _imprimir(motor.run(_usuario(usuario), json.loads(plan), pagina=pagina, por_pagina=motor.SAMPLE))
    except (motor.MotorError, json.JSONDecodeError) as e:
        click.echo(f'Error: {e}', err=True)
