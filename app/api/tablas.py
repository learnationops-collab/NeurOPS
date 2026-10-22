"""El motor genérico de tablas por HTTP (app/services/tablas/) y por consola, para probarlo en el servidor:

  flask tablas fuentes [clave]                     las fuentes, o los campos de una
  flask tablas consultar '<definición JSON>' [--usuario nombre]
"""
import json
import logging

import click
from flask import Blueprint, jsonify, request
from flask_login import current_user

from app.decorators import tablas_required
from app.services.tablas import motor
from app.services.tablas.condiciones import CondicionError

logger = logging.getLogger(__name__)

bp = Blueprint('tablas', __name__)


@bp.route('/fuentes', methods=['GET'])
@tablas_required
def fuentes():
    return jsonify(motor.describe(current_user))


@bp.route('/fuentes/<key>', methods=['GET'])
@tablas_required
def fuente(key):
    try:
        return jsonify(motor.describe(current_user, key))
    except CondicionError as e:
        return jsonify({'error': str(e)}), 404


@bp.route('/consultar', methods=['POST'])
@tablas_required
def consultar():
    try:
        return jsonify(motor.run(current_user, request.get_json(silent=True)))
    except CondicionError as e:
        return jsonify({'error': str(e)}), 400


def _usuario(nombre):
    from app.models import User
    from app.models.user import ROLE_ADMIN

    if nombre:
        return User.query.filter_by(username=nombre).first()
    return User.query.filter_by(_role=ROLE_ADMIN).order_by(User.id).first()


@bp.cli.command('fuentes')
@click.argument('clave', required=False)
@click.option('--usuario', default=None, help='Con los permisos de quién (por defecto, el primer admin).')
def cli_fuentes(clave, usuario):
    click.echo(json.dumps(motor.describe(_usuario(usuario), clave), ensure_ascii=False, indent=1))


@bp.cli.command('consultar')
@click.argument('definicion')
@click.option('--usuario', default=None, help='Con los permisos de quién (por defecto, el primer admin).')
def cli_consultar(definicion, usuario):
    try:
        click.echo(json.dumps(motor.run(_usuario(usuario), json.loads(definicion)), ensure_ascii=False, indent=1))
    except (CondicionError, json.JSONDecodeError) as e:
        click.echo(f'Error: {e}', err=True)
