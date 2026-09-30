"""Lo ultimo que NeurOPS supo de un cliente dentro de la Academia (academy.thelearnation.com).

Existe para que las tablas Clientes y Ventas del dashboard comercial se puedan filtrar y ordenar
por lo que el alumno HACE en la Academia —horas de estudio, ejecuciones entregadas, racha— y eso
no se puede preguntar en vivo al armar la tabla:

  · la Academia no tiene un endpoint masivo: es una peticion por alumno (`/users/{id}/summary`),
    mas una o varias para encontrarlo por correo cuando todavia no se sabe su id;
  · el limite es 60 peticiones por minuto por token, compartido con produccion y con la pestana
    Fulfillment de la ficha. Pedir los 500 clientes de la cartera gastaria diez minutos de limite
    en cada carga de la tabla.

Asi que se guarda una foto por cliente y la tabla lee la foto. Como se renueva (al abrir la ficha y
con un lote chico por cron) y como se lee lo explica `academy_snapshot_service`.

Las columnas tipadas son las que la tabla filtra y ordena. `datos` guarda el `performance` crudo
tal como lo devolvio la Academia, para no perder un campo nuevo que todavia no tenga columna. No se
guardan nombre, correo ni telefono del alumno: ya viven en `Client`, y copiarlos seria una segunda
fuente de verdad y mas datos personales en otra tabla.
"""
from datetime import datetime

from sqlalchemy.orm import deferred

from app import db


class AcademySnapshot(db.Model):
    __tablename__ = 'academy_snapshots'

    # Resultado del ULTIMO intento de sincronizar. Las metricas, en cambio, son las del ultimo
    # intento que salio bien: un error posterior no las borra (ver `synced_at`).
    VINCULADO = 'vinculado'     # el alumno existe y se leyo su resumen
    SIN_ACCESO = 'sin_acceso'   # ninguno de sus correos tiene cuenta en la Academia
    SIN_CORREO = 'sin_correo'   # no hay ningun correo real con el que buscarlo
    ERROR = 'error'             # la Academia respondio un error (ver `error_codigo`)

    id = db.Column(db.Integer, primary_key=True)
    # Una foto por cliente. `ondelete='CASCADE'`: la fusion de duplicados borra clientes con un
    # DELETE en bloque (`ClientDedupService.merge_clients`), y sin la cascada Postgres rechazaria
    # la fusion de cualquier duplicado que tuviera foto.
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id', ondelete='CASCADE'),
                          nullable=False, unique=True, index=True)

    # El id del alumno con el que se leyo la foto. Puede no coincidir con `Client.learnation_user_id`:
    # un id encontrado por un correo de venta sin nada que lo corrobore se guarda solo aca (ver
    # `academy_snapshot_service._vinculo_confiable`).
    learnation_user_id = db.Column(db.Integer, nullable=True)
    # El correo con el que se lo encontro. Es lo que permite reusar `learnation_user_id` sin volver
    # a preguntar mientras ese correo siga siendo de este cliente.
    email_usado = db.Column(db.String(120), nullable=True)

    resultado = db.Column(db.String(20), nullable=True)
    error_codigo = db.Column(db.Integer, nullable=True)
    error = db.Column(db.String(255), nullable=True)

    # Ultimo intento, salga bien o mal: es el orden del lote (el mas viejo primero).
    intentado_at = db.Column(db.DateTime, nullable=True)
    # Ultima vez que las metricas se leyeron bien: es la frescura que muestra la tabla.
    synced_at = db.Column(db.DateTime, nullable=True)
    # La ultima vez que se VIO actividad. La Academia no la informa: se deduce comparando fotos
    # (ver `academy_snapshot_service._registrar_datos`).
    actividad_vista_at = db.Column(db.DateTime, nullable=True)

    # Metricas de `performance` en `/users/{id}/summary` (mapeo en `academy_snapshot_service.METRICAS`).
    horas_estudio = db.Column(db.Float, nullable=True)
    progreso = db.Column(db.Float, nullable=True)
    lecciones_completadas = db.Column(db.Integer, nullable=True)
    lecciones_totales = db.Column(db.Integer, nullable=True)
    vistas_lecciones = db.Column(db.Integer, nullable=True)
    ejecuciones = db.Column(db.Integer, nullable=True)
    racha_dias = db.Column(db.Integer, nullable=True)
    pomodoros = db.Column(db.Integer, nullable=True)
    aprobacion = db.Column(db.Float, nullable=True)
    sesiones_grupales = db.Column(db.Integer, nullable=True)
    sesiones_individuales = db.Column(db.Integer, nullable=True)
    tickets_abiertos = db.Column(db.Integer, nullable=True)
    producto_activo = db.Column(db.String(150), nullable=True)

    # Diferido: la tabla lee cientos de fotos por pedido y nunca mira el crudo.
    datos = deferred(db.Column(db.JSON, nullable=True))

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<AcademySnapshot cliente={self.client_id} {self.resultado}>'
