"""Una fila por intento que cuenta para un límite (login fallido, envío de un formulario público).

Vive en la base y no en memoria porque gunicorn corre varios workers: un contador por proceso se
reparte entre ellos y no frena nada. `clave` dice qué se limita y a quién (ej. 'login:ip:1.2.3.4',
'login:user:ana'). Las filas de más de un día se borran solas (app/services/limite_intentos.py).
"""
from datetime import datetime

from app import db


class IntentoLimitado(db.Model):
    __tablename__ = 'intentos_limitados'

    id = db.Column(db.Integer, primary_key=True)
    clave = db.Column(db.String(200), nullable=False, index=True)
    creado = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
