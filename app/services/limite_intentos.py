"""Límite de intentos guardado en la base (tabla `intentos_limitados`), compartido entre los workers.

`excedido` cuenta los intentos de una clave dentro de la ventana; `registrar` suma uno. Se usa al
principio de la vista, antes de cualquier otra escritura: `registrar` hace commit y no puede llevarse
cambios a medias del pedido. Si la base falla, se deja pasar (mejor un formulario sin límite que un
formulario caído) y queda en el log.

Se apaga con RATE_LIMIT_ENABLED=0 (config.py); los tests lo apagan en tests/conftest.py.
"""
import logging
import random
from datetime import datetime, timedelta
from functools import wraps

import sqlalchemy as sa
from flask import current_app, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash

from app import db
from app.models import IntentoLimitado

logger = logging.getLogger(__name__)

MENSAJE = 'Demasiados intentos. Probá de nuevo en unos minutos.'
# Las filas viejas se borran en ~1 de cada 200 registros: no hace falta otra tarea programada.
RETENCION = timedelta(days=1)
PROBABILIDAD_LIMPIEZA = 0.005


def activo():
    return current_app.config.get('RATE_LIMIT_ENABLED', True)


def ip_cliente():
    # Detrás del proxy de Railway, ProxyFix(x_for=1) ya deja en remote_addr la IP real. El primer valor
    # de X-Forwarded-For lo escribe el visitante y no sirve para limitar.
    return (request.remote_addr or '?')[:64]


def excedido(clave, maximo, ventana_segundos):
    if not activo():
        return False
    desde = datetime.utcnow() - timedelta(seconds=ventana_segundos)
    try:
        n = db.session.scalar(
            sa.select(sa.func.count(IntentoLimitado.id))
            .where(IntentoLimitado.clave == clave, IntentoLimitado.creado >= desde)
        )
        return (n or 0) >= maximo
    except Exception as e:
        db.session.rollback()
        logger.error(f'[LIMITE] No se pudo contar {clave}: {e}')
        return False


def registrar(*claves):
    if not activo():
        return
    try:
        ahora = datetime.utcnow()
        db.session.add_all([IntentoLimitado(clave=c[:200], creado=ahora) for c in claves])
        if random.random() < PROBABILIDAD_LIMPIEZA:
            db.session.execute(sa.delete(IntentoLimitado).where(IntentoLimitado.creado < ahora - RETENCION))
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f'[LIMITE] No se pudo registrar {claves}: {e}')


def respuesta_429():
    return jsonify({'message': MENSAJE}), 429


# Login: solo cuentan los FALLIDOS. (intentos, segundos)
LOGIN_POR_IP = (20, 15 * 60)
LOGIN_POR_USUARIO = (8, 15 * 60)
_hash_falso = None


def login_limitado(username):
    """Las claves del login (IP y usuario), o None si alguna ya superó su límite."""
    por_ip = f'login:ip:{ip_cliente()}'
    por_usuario = f'login:user:{username.strip().lower()[:150]}'
    if excedido(por_ip, *LOGIN_POR_IP) or excedido(por_usuario, *LOGIN_POR_USUARIO):
        logger.warning(f'[LIMITE] Login frenado: {por_ip} / {por_usuario}')
        return None
    return por_ip, por_usuario


def clave_falsa(password):
    """Calcula un hash aunque el usuario no exista, para que la respuesta tarde lo mismo."""
    global _hash_falso
    if _hash_falso is None:
        _hash_falso = generate_password_hash('clave-que-no-es-de-nadie')
    check_password_hash(_hash_falso, password)


def limitar(nombre, maximo, ventana_segundos):
    """Decorador para las rutas públicas (va debajo de @bp.route): cada pedido cuenta, por IP. Un usuario
    logueado o un sistema con su secreto (es_llamada_de_confianza) no tiene límite."""
    def decorador(vista):
        @wraps(vista)
        def envoltura(*args, **kwargs):
            from app.access_policy import es_llamada_de_confianza
            if activo() and not es_llamada_de_confianza():
                clave = f'{nombre}:ip:{ip_cliente()}'
                if excedido(clave, maximo, ventana_segundos):
                    logger.warning(f'[LIMITE] {clave} superó {maximo} en {ventana_segundos}s')
                    return respuesta_429()
                registrar(clave)
            return vista(*args, **kwargs)
        return envoltura
    return decorador
