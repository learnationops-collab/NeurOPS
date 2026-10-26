"""Respaldo de la base con pg_dump (26/10/2026).

Antes se armaba un script SQL a mano (sin escapar comillas dentro de los JSON) y se restauraba
ejecutando el archivo subido entero: un «O'Brien» rompía la restauración y el texto de un formulario
público terminaba como SQL ejecutable. Ahora el respaldo es un `pg_dump -Fc` y la restauración se hace
a mano con `pg_restore` (ver docs/seguridad_despliegue.md), nunca desde la web.
"""
import datetime
import logging
import os
import shutil
import subprocess
import tempfile

import sqlalchemy as sa
from flask import Blueprint, Response, current_app, jsonify, request

from app import db

# Admin u operador (10/10/2026): el respaldo pasó del panel de «Administración», que se retiró, a
# Operaciones › Datos. La clave de BACKUP_SECRET_KEY se sigue pidiendo igual.
from app.decorators import _iguales_en_tiempo_constante, operator_required

logger = logging.getLogger(__name__)

bp = Blueprint('backup', __name__)

# Largo minimo de la clave configurada: una variable con "1234" no debe abrir la puerta.
LARGO_MINIMO_DE_CLAVE = 20
# La clave va en un header y no en la ruta: en la ruta quedaba en los logs de acceso.
CABECERA_DE_CLAVE = 'X-Backup-Key'
TAMANO_DE_BLOQUE = 64 * 1024
# Variables de libpq que salen de los parámetros de la URL (Railway puede mandar sslmode).
PARAMETROS_LIBPQ = {'sslmode': 'PGSSLMODE', 'sslrootcert': 'PGSSLROOTCERT', 'options': 'PGOPTIONS'}


def _rechazar_si_la_clave_no_vale():
    """None si la clave es correcta; si no, la respuesta que hay que devolver.

    La clave sale de BACKUP_SECRET_KEY y NUNCA del codigo: estuvo escrita en el repositorio y en el
    bundle publico de la web. Sin la variable (o con una demasiado corta) la funcion queda APAGADA
    (503), jamas abierta. Se compara en tiempo constante.
    """
    esperada = os.environ.get('BACKUP_SECRET_KEY', '')
    if len(esperada) < LARGO_MINIMO_DE_CLAVE:
        return jsonify({
            "message": f"Backup deshabilitado: falta BACKUP_SECRET_KEY (minimo {LARGO_MINIMO_DE_CLAVE} caracteres)."
        }), 503
    provista = request.headers.get(CABECERA_DE_CLAVE, '')
    if not _iguales_en_tiempo_constante(provista, esperada):
        return jsonify({"message": "Invalid secret key. Access Denied."}), 403
    return None


@bp.route('/preview', methods=['GET'])
@operator_required
def preview_db():
    """Tablas de la base y su cantidad de registros."""
    rechazo = _rechazar_si_la_clave_no_vale()
    if rechazo:
        return rechazo

    try:
        stats = []
        for table in db.metadata.sorted_tables:
            count = db.session.execute(sa.select(sa.func.count()).select_from(table)).scalar()
            stats.append({"name": table.name, "count": count})
        return jsonify({"tables": stats}), 200
    except Exception as e:
        logger.error(f"[BACKUP] vista previa fallida: {type(e).__name__}")
        return jsonify({"message": "No se pudo leer la base."}), 500


def _entorno_de_pg_dump():
    """Entorno para pg_dump con la conexión en variables PG*: la URL (con la contraseña) no va en los
    argumentos, que cualquier proceso del contenedor ve. None si la base no es PostgreSQL."""
    url = sa.engine.make_url(current_app.config['SQLALCHEMY_DATABASE_URI'])
    if not url.drivername.startswith('postgres'):
        return None
    entorno = dict(os.environ)
    valores = {
        'PGHOST': url.host, 'PGPORT': url.port, 'PGUSER': url.username,
        'PGPASSWORD': url.password, 'PGDATABASE': url.database,
    }
    for nombre, variable in PARAMETROS_LIBPQ.items():
        valores[variable] = url.query.get(nombre)
    entorno.update({k: str(v) for k, v in valores.items() if v})
    entorno.setdefault('PGCONNECT_TIMEOUT', '15')
    return entorno


def _error_de_pg_dump(errores):
    """Lo que pg_dump dejó en stderr, recortado. libpq no escribe la contraseña en sus errores."""
    errores.seek(0)
    return errores.read().decode('utf-8', 'replace').strip()[-500:]


def _cortar(proceso, errores):
    if proceso.poll() is None:
        proceso.kill()
    proceso.wait()
    proceso.stdout.close()
    errores.close()


@bp.route('/export', methods=['GET'])
@operator_required
def export_db():
    """Descarga un `pg_dump -Fc` de toda la base, en streaming."""
    rechazo = _rechazar_si_la_clave_no_vale()
    if rechazo:
        return rechazo

    entorno = _entorno_de_pg_dump()
    if entorno is None:
        return jsonify({"message": "El respaldo con pg_dump solo funciona con PostgreSQL."}), 503
    ejecutable = shutil.which('pg_dump')
    if not ejecutable:
        logger.error("[BACKUP] pg_dump no está instalado en el servidor")
        return jsonify({"message": "pg_dump no está instalado en el servidor."}), 500

    # stderr a un archivo: si se llenara un pipe sin leer, pg_dump se trabaría.
    errores = tempfile.TemporaryFile()
    try:
        proceso = subprocess.Popen([ejecutable, '--format=custom', '--no-password'], env=entorno,
                                   stdout=subprocess.PIPE, stderr=errores)
    except OSError as e:
        errores.close()
        logger.error(f"[BACKUP] no se pudo lanzar pg_dump: {e}")
        return jsonify({"message": "Backup failed"}), 500

    # El primer bloque se lee antes de responder: si pg_dump falla al conectar, todavía hay un 500 claro.
    primero = proceso.stdout.read1(TAMANO_DE_BLOQUE)
    if not primero:
        codigo = proceso.wait()
        logger.error(f"[BACKUP] pg_dump terminó con {codigo} sin datos: {_error_de_pg_dump(errores)}")
        _cortar(proceso, errores)
        return jsonify({"message": "Backup failed"}), 500

    def transmitir():
        try:
            bloque = primero
            while bloque:
                yield bloque
                bloque = proceso.stdout.read1(TAMANO_DE_BLOQUE)
            codigo = proceso.wait()
            if codigo != 0:
                # La descarga queda truncada; pg_restore la rechaza al leerla.
                logger.error(f"[BACKUP] pg_dump terminó con {codigo} a mitad: {_error_de_pg_dump(errores)}")
        finally:
            # También si el navegador corta la descarga.
            _cortar(proceso, errores)

    nombre = f"neurops_backup_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.dump"
    return Response(transmitir(), mimetype='application/octet-stream',
                    headers={'Content-Disposition': f'attachment; filename={nombre}',
                             'Cache-Control': 'no-store'})
