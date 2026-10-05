"""Tablas de Agendas 2.0 (prefijo sched_): la configuracion de Thalamus.

Los documentos de Thalamus (funnels, formularios, personas, prioridades, eventos, roles) se guardan
como JSON normalizado, el mismo esquema que el frontend (nucleo/normalizar.py). Las agendas NO viven
aca: se escriben en la operacion (Appointment + su espejo FinancialAgenda), ver operacion.py.
"""

from datetime import datetime, timezone

from sqlalchemy.orm import declared_attr

from app import db


def _ahora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class _Documento:
    """Columnas comunes de un documento de Thalamus."""

    id = db.Column(db.String(40), primary_key=True)
    datos = db.Column(db.JSON, nullable=False, default=dict)
    orden = db.Column(db.Float, nullable=False, default=0)
    creado_en = db.Column(db.DateTime, nullable=False, default=_ahora)
    actualizado_en = db.Column(db.DateTime, nullable=False, default=_ahora, onupdate=_ahora)

    @declared_attr
    def actualizado_por_id(cls):  # noqa: N805  (declared_attr recibe la clase)
        return db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    def doc(self):
        return {**(self.datos or {}), 'id': self.id}


class SchedFunnel(_Documento, db.Model):
    __tablename__ = 'sched_funnels'


class SchedFormulario(_Documento, db.Model):
    __tablename__ = 'sched_formularios'


class SchedGrupo(_Documento, db.Model):
    """Una prioridad de closers (en el frontend, coleccion `grupos`)."""

    __tablename__ = 'sched_grupos'


class SchedEvento(_Documento, db.Model):
    __tablename__ = 'sched_eventos'


class SchedRol(_Documento, db.Model):
    __tablename__ = 'sched_roles'


class SchedPersona(_Documento, db.Model):
    """Una persona del equipo de Thalamus. `user_id` la une a su cuenta de la app cuando el email
    coincide: es lo que va a usar el paso 3 para saber a que closer real va una reserva."""

    __tablename__ = 'sched_personas'
    email = db.Column(db.String(120), nullable=True, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)


MODELOS = {
    'funnels': SchedFunnel,
    'formularios': SchedFormulario,
    'personas': SchedPersona,
    'grupos': SchedGrupo,
    'eventos': SchedEvento,
    'roles': SchedRol,
}


class SchedConfig(db.Model):
    """Configuracion global por clave: `integraciones` y `version` (contador de cambios)."""

    __tablename__ = 'sched_config'
    clave = db.Column(db.String(40), primary_key=True)
    datos = db.Column(db.JSON, nullable=False, default=dict)
    actualizado_en = db.Column(db.DateTime, nullable=False, default=_ahora, onupdate=_ahora)


class SchedPerfil(db.Model):
    """Perfil de Thalamus de cada usuario de la app (nombre, foto, a que persona de Team es)."""

    __tablename__ = 'sched_perfiles'
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    datos = db.Column(db.JSON, nullable=False, default=dict)
    actualizado_en = db.Column(db.DateTime, nullable=False, default=_ahora, onupdate=_ahora)
