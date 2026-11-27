"""Eventos crudos que Meta manda al webhook de WhatsApp Cloud (app propia «Learnation Contacts»).

Igual que con Instagram: primero se guarda cada notificación tal como llegó (mensajes entrantes y
estados de los enviados) y después se procesa. Si el procesamiento falla, el evento sigue acá y se
puede reprocesar (regla de pérdida cero).
"""
from datetime import datetime

from app import db


class WhatsappWebhookEvento(db.Model):
    __tablename__ = 'whatsapp_webhook_eventos'

    id = db.Column(db.Integer, primary_key=True)
    recibido_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    # 'messages', 'statuses', 'messages,statuses'... para listar sin abrir el JSON.
    tipos = db.Column(db.String(200), nullable=False, default='')
    payload = db.Column(db.JSON, nullable=False)
    procesado_en = db.Column(db.DateTime, nullable=True, index=True)
    resultado = db.Column(db.String(200), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'recibido_en': self.recibido_en.isoformat() + 'Z',
            'tipos': self.tipos,
            'payload': self.payload,
            'procesado_en': self.procesado_en.isoformat() + 'Z' if self.procesado_en else None,
            'resultado': self.resultado,
        }


class WaEnvio(db.Model):
    """Un número al que se le mandó (o se le está mandando) una plantilla desde la herramienta «Broadcast de
    WhatsApp» (ADR-W229). Una sola tabla: cada «Enviar» es un `lote`; los estados los va actualizando el webhook
    (enviado → entregado → leído), y si responde queda su conversación y lo primero que escribió (`respuesta`).
    Mandar no crea contactos: en el Inbox aparecen solo los que contestan.
    """
    __tablename__ = 'wa_envios'

    PENDIENTE, ENVIADO, ENTREGADO, LEIDO, RESPONDIO, FALLO = (
        'pendiente', 'enviado', 'entregado', 'leido', 'respondio', 'fallo')
    # Orden de avance: un estado viejo que llega tarde no pisa a uno posterior.
    ORDEN = {PENDIENTE: 0, ENVIADO: 1, ENTREGADO: 2, LEIDO: 3, RESPONDIO: 4, FALLO: 5}

    id = db.Column(db.Integer, primary_key=True)
    lote = db.Column(db.String(36), nullable=False, index=True)
    plantilla = db.Column(db.String(120), nullable=False)
    idioma = db.Column(db.String(10), nullable=False, default='es')
    con_nombre = db.Column(db.Boolean, nullable=False, default=True)  # la plantilla lleva {{1}} con el nombre
    telefono = db.Column(db.String(20), nullable=False, index=True)  # solo dígitos, con código de país
    nombre = db.Column(db.String(150), nullable=True)
    estado = db.Column(db.String(20), nullable=False, default=PENDIENTE, index=True)
    wamid = db.Column(db.String(200), nullable=True, unique=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    enviado_en = db.Column(db.DateTime, nullable=True, index=True)
    actualizado_en = db.Column(db.DateTime, nullable=True)
    error = db.Column(db.String(300), nullable=True)
    respuesta = db.Column(db.String(200), nullable=True)
    enviado_por_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    contacto_id = db.Column(db.Integer, db.ForeignKey('ig_contactos.id', ondelete='SET NULL'), nullable=True)
    # Del broadcast de un taller (ADR-W259): el paso que lo mandó, lo que va en {{1}}, {{2}}… («{nombre}» se
    # completa al mandar) y hasta cuándo puede salir (pasado eso, un recordatorio ya no sirve).
    paso_id = db.Column(db.Integer, db.ForeignKey('wa_pasos_taller.id', ondelete='SET NULL'), nullable=True, index=True)
    parametros = db.Column(db.JSON, nullable=True)
    vence_en = db.Column(db.DateTime, nullable=True)


class WaRespuestaBoton(db.Model):
    """Qué pasa cuando tocan un botón de una plantilla (herramienta «Broadcast de WhatsApp», pestaña Plantillas).
    Vive en Work y no en Meta: se cambia sin pasar por revisión. `texto` sale solo; `botones` [{titulo, va_a}]
    son los del mensaje que sale (hasta 3, de 20 caracteres), y `va_a` es el botón de la plantilla cuya respuesta
    sigue (None: queda para el setter). `asignar_a` y `etiqueta` se aplican a la conversación."""
    __tablename__ = 'wa_respuestas_boton'

    id = db.Column(db.Integer, primary_key=True)
    plantilla = db.Column(db.String(120), nullable=False, index=True)
    boton = db.Column(db.String(25), nullable=False)
    texto = db.Column(db.Text, nullable=True)
    botones = db.Column(db.JSON, nullable=True)
    asignar_a = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    etiqueta = db.Column(db.String(60), nullable=True)  # la primera de `etiquetas` (lo que leía el código viejo)
    # ADR-W265: las etiquetas que pone y las que saca al tocarlo (como ManyChat). Sacar una que no tiene no hace nada.
    etiquetas = db.Column(db.JSON, nullable=True)
    quitar = db.Column(db.JSON, nullable=True)
    # Cuántos segundos espera el mensaje antes de salir (0: al instante). Asignar y etiquetar no esperan.
    demora_segundos = db.Column(db.Integer, nullable=False, default=0, server_default="0")
    actualizado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('plantilla', 'boton', name='uq_wa_respuestas_boton'),)


class WaPlantillaConfig(db.Model):
    """Lo que vale para todos los botones de una plantilla (ADR-W260). Con `opcion_unica`, después de elegir un botón
    de un mensaje (la plantilla de un envío o una de sus respuestas), tocar otro de ese mismo mensaje no sigue: sale
    `texto_repetida` ({opcion} = lo que eligió)."""
    __tablename__ = 'wa_plantillas_config'

    id = db.Column(db.Integer, primary_key=True)
    plantilla = db.Column(db.String(120), nullable=False, unique=True)
    opcion_unica = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())
    texto_repetida = db.Column(db.Text, nullable=True)
    actualizado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class WaRespuestaPendiente(db.Model):
    """La respuesta a un botón que espera su demora (`WaRespuestaBoton.demora_segundos`). La manda el reloj del
    motor cuando llega `enviar_en` y se borra. Una por contacto: un toque nuevo reemplaza la que esperaba."""
    __tablename__ = 'wa_respuestas_pendientes'

    id = db.Column(db.Integer, primary_key=True)
    contacto_id = db.Column(db.Integer, db.ForeignKey('ig_contactos.id', ondelete='CASCADE'), nullable=False, unique=True)
    regla_id = db.Column(db.Integer, db.ForeignKey('wa_respuestas_boton.id', ondelete='CASCADE'), nullable=False)
    enviar_en = db.Column(db.DateTime, nullable=False, index=True)
    # 'respuesta': el mensaje de la regla; 'despues': el que sale al abrir su link (ADR-W261).
    cual = db.Column(db.String(10), nullable=False, default='respuesta', server_default='respuesta')
