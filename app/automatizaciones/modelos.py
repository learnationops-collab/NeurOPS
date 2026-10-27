"""Tablas del motor de automatizaciones (prefijo aut_ para lo del motor, ig_ para lo de Instagram).

  · AutFlujo: el flujo que arma el equipo. `grafo` es el borrador que edita el lienzo; lo que corre
    es una AutFlujoVersion publicada (copia congelada), así editar no rompe a quien está en medio.
  · IgContacto: una persona que le escribió a la cuenta (por su IGSID, el id que Instagram le da
    para esta cuenta). Guarda la ventana de 24 h y la pausa del bot cuando escribe un humano.
  · AutEjecucion: un contacto recorriendo una versión de un flujo (en qué nodo está, qué espera).
  · IgMensaje: cada mensaje de la conversación, entrante o saliente, una sola vez por `mid`.
  · AutCampana: la campaña de marketing (funnel, pago u orgánica, vigencia) que manda sus palabras
    clave a un flujo. Ver `campanas.py`.
"""
from datetime import datetime, timezone

from app import db


def ahora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AutFlujo(db.Model):
    __tablename__ = 'aut_flujos'

    BORRADOR = 'borrador'
    ACTIVO = 'activo'
    PAUSADO = 'pausado'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    estado = db.Column(db.String(20), nullable=False, default=BORRADOR)
    grafo = db.Column(db.JSON, nullable=False, default=dict)
    version_publicada_id = db.Column(
        db.Integer, db.ForeignKey('aut_flujo_versiones.id', use_alter=True, name='fk_aut_flujos_version_publicada'),
        nullable=True)
    # Desde cuándo está activo: solo atrapa mensajes posteriores (la activación nunca es retroactiva).
    activo_desde = db.Column(db.DateTime, nullable=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=ahora)
    actualizado_en = db.Column(db.DateTime, nullable=False, default=ahora, onupdate=ahora)

    version_publicada = db.relationship('AutFlujoVersion', foreign_keys=[version_publicada_id], post_update=True)


class AutFlujoVersion(db.Model):
    __tablename__ = 'aut_flujo_versiones'

    id = db.Column(db.Integer, primary_key=True)
    flujo_id = db.Column(db.Integer, db.ForeignKey('aut_flujos.id', ondelete='CASCADE'), nullable=False, index=True)
    numero = db.Column(db.Integer, nullable=False)
    grafo = db.Column(db.JSON, nullable=False)
    publicada_en = db.Column(db.DateTime, nullable=False, default=ahora)

    flujo = db.relationship('AutFlujo', foreign_keys=[flujo_id])

    __table_args__ = (db.UniqueConstraint('flujo_id', 'numero', name='uq_aut_flujo_versiones_numero'),)


class IgContacto(db.Model):
    __tablename__ = 'ig_contactos'

    id = db.Column(db.Integer, primary_key=True)
    igsid = db.Column(db.String(64), nullable=False, unique=True)
    username = db.Column(db.String(100))
    nombre = db.Column(db.String(150))
    # Último mensaje del contacto: abre la ventana de 24 h en la que se le puede escribir.
    ultimo_entrante_en = db.Column(db.DateTime, nullable=True)
    # Hasta cuándo el bot no le habla (escribió una persona del equipo).
    bot_pausado_hasta = db.Column(db.DateTime, nullable=True)
    variables = db.Column(db.JSON, nullable=False, default=dict)
    creado_en = db.Column(db.DateTime, nullable=False, default=ahora)


class AutEjecucion(db.Model):
    __tablename__ = 'aut_ejecuciones'

    EN_CURSO = 'en_curso'
    ESPERANDO_RESPUESTA = 'esperando_respuesta'
    ESPERANDO_TIEMPO = 'esperando_tiempo'
    TERMINADA = 'terminada'
    CANCELADA = 'cancelada'
    VENTANA_VENCIDA = 'ventana_vencida'
    ERROR = 'error'
    # Un setter la movió fuera de la ventana de 24 h: arranca cuando el lead vuelva a escribir (`acciones.py`).
    PENDIENTE = 'pendiente'
    ABIERTOS = (EN_CURSO, ESPERANDO_RESPUESTA, ESPERANDO_TIEMPO)

    id = db.Column(db.Integer, primary_key=True)
    contacto_id = db.Column(db.Integer, db.ForeignKey('ig_contactos.id', ondelete='CASCADE'), nullable=False, index=True)
    version_id = db.Column(db.Integer, db.ForeignKey('aut_flujo_versiones.id'), nullable=False, index=True)
    estado = db.Column(db.String(20), nullable=False, default=EN_CURSO, index=True)
    nodo_actual = db.Column(db.String(64), nullable=True)
    # Cuándo vence la espera actual (un nodo «esperar» o el «sin respuesta» de un mensaje).
    despertar_en = db.Column(db.DateTime, nullable=True, index=True)
    # Comentario que la disparó: el primer mensaje tiene que ir como respuesta privada a ese comentario.
    comentario_id = db.Column(db.String(64), nullable=True)
    detalle = db.Column(db.String(300), nullable=True)
    iniciada_en = db.Column(db.DateTime, nullable=False, default=ahora)
    actualizada_en = db.Column(db.DateTime, nullable=False, default=ahora, onupdate=ahora)

    # Por qué entró: la campaña y la palabra clave (normalizada) que lo trajeron, fijas desde el inicio.
    campana_id = db.Column(db.Integer, db.ForeignKey('aut_campanas.id', ondelete='SET NULL'), nullable=True, index=True)
    clave = db.Column(db.String(100), nullable=True)
    # Cómo terminó calificado en esta entrada (None: todavía no se sabe). Lo escribe `registro.py`.
    califica = db.Column(db.Boolean, nullable=True)
    # El setter que le tocó por el reparto de la campaña (`reparto.py`).
    setter_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    # El anuncio de Meta (`MetaAnuncio.meta_ad_id`) del que vino el DM que la empezó, si vino de uno.
    meta_ad_id = db.Column(db.String(40), nullable=True, index=True)

    contacto = db.relationship('IgContacto')
    version = db.relationship('AutFlujoVersion')


class IgMensaje(db.Model):
    __tablename__ = 'ig_mensajes'

    ENTRANTE = 'entrante'
    SALIENTE = 'saliente'
    # Quién lo originó: el lead, este motor, o cualquier otro emisor de la cuenta (una persona del
    # equipo desde Kommo o la app, o ManyChat mientras conviva).
    LEAD = 'lead'
    MOTOR = 'motor'
    OTRO = 'otro'

    id = db.Column(db.Integer, primary_key=True)
    contacto_id = db.Column(db.Integer, db.ForeignKey('ig_contactos.id', ondelete='CASCADE'), nullable=False, index=True)
    mid = db.Column(db.String(400), nullable=True, unique=True)
    direccion = db.Column(db.String(10), nullable=False)
    origen = db.Column(db.String(10), nullable=False)
    texto = db.Column(db.Text, nullable=True)
    contenido = db.Column(db.JSON, nullable=True)
    ejecucion_id = db.Column(db.Integer, db.ForeignKey('aut_ejecuciones.id', ondelete='SET NULL'), nullable=True)
    nodo_id = db.Column(db.String(64), nullable=True)
    enviado_en = db.Column(db.DateTime, nullable=False, default=ahora, index=True)


class AutCampana(db.Model):
    """La campaña de marketing: arriba de las campañas de Meta (puede juntar varias, o ninguna si es
    orgánica). Sus palabras clave llevan al flujo mientras esté vigente: [desde, hasta)."""
    __tablename__ = 'aut_campanas'

    EMBUDOS = ('setting', 'workshop', 'vsl', 'otro')
    TIPOS = ('pago', 'organico')
    REPARTOS = ('distribuido', 'sin_reparto')

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    embudo = db.Column(db.String(20), nullable=False, default='setting')
    tipo = db.Column(db.String(20), nullable=False, default='pago')
    flujo_id = db.Column(db.Integer, db.ForeignKey('aut_flujos.id', ondelete='SET NULL'), nullable=True, index=True)
    desde = db.Column(db.DateTime, nullable=False)
    hasta = db.Column(db.DateTime, nullable=True)  # None: sin fin
    # Cómo se reparten sus leads entre los setters (`reparto.py`). `solo_conectados` queda guardado
    # pero no filtra hasta que haya presencia (la bandeja de mensajes propia).
    reparto = db.Column(db.String(20), nullable=False, default='distribuido', server_default='distribuido')
    solo_conectados = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())
    creada_en = db.Column(db.DateTime, nullable=False, default=ahora)
    actualizada_en = db.Column(db.DateTime, nullable=False, default=ahora, onupdate=ahora)

    flujo = db.relationship('AutFlujo')
    palabras = db.relationship('AutCampanaPalabra', cascade='all, delete-orphan', order_by='AutCampanaPalabra.id')
    campanas_meta = db.relationship('AutCampanaMeta', cascade='all, delete-orphan', order_by='AutCampanaMeta.id')
    setters = db.relationship('AutCampanaSetter', cascade='all, delete-orphan', order_by='AutCampanaSetter.id')


class AutCampanaPalabra(db.Model):
    """Una palabra clave de la campaña. `clave` es la normalizada (`clave_de_palabra`, la misma de
    Marketing); `texto`, como se escribió."""
    __tablename__ = 'aut_campana_palabras'

    id = db.Column(db.Integer, primary_key=True)
    campana_id = db.Column(db.Integer, db.ForeignKey('aut_campanas.id', ondelete='CASCADE'), nullable=False, index=True)
    clave = db.Column(db.String(100), nullable=False, index=True)
    texto = db.Column(db.String(100), nullable=False)

    __table_args__ = (db.UniqueConstraint('campana_id', 'clave', name='uq_aut_campana_palabras_clave'),)


class AutCampanaMeta(db.Model):
    """Una campaña de Meta que forma parte de la campaña de marketing (`MetaAnuncio.campana_id`)."""
    __tablename__ = 'aut_campanas_meta'

    id = db.Column(db.Integer, primary_key=True)
    campana_id = db.Column(db.Integer, db.ForeignKey('aut_campanas.id', ondelete='CASCADE'), nullable=False, index=True)
    meta_campana_id = db.Column(db.String(40), nullable=False, index=True)

    __table_args__ = (db.UniqueConstraint('campana_id', 'meta_campana_id', name='uq_aut_campanas_meta'),)


class AutCampanaSetter(db.Model):
    """Un setter que participa del reparto de la campaña. Sin ninguno, participan todos los activos."""
    __tablename__ = 'aut_campana_setters'

    id = db.Column(db.Integer, primary_key=True)
    campana_id = db.Column(db.Integer, db.ForeignKey('aut_campanas.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    # Cuánto recibe respecto de los demás (70 y 30: 70 % y 30 %). Todos en 1: parejo.
    peso = db.Column(db.Integer, nullable=False, default=1, server_default='1')

    __table_args__ = (db.UniqueConstraint('campana_id', 'user_id', name='uq_aut_campana_setters'),)
