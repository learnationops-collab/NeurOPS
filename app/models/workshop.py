from datetime import datetime
from app import db

class WorkshopTemplate(db.Model):
    """Representa una plantilla de mensaje enviada vía ManyChat (Broadcast/Flow)"""
    __tablename__ = 'workshop_templates'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    external_id = db.Column(db.String(100), unique=True, nullable=True) # ID de ManyChat
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    buttons = db.relationship('WorkshopButton', backref='template', lazy='dynamic', cascade="all, delete-orphan")
    sends = db.relationship('WorkshopTemplateSent', backref='template', lazy='dynamic', cascade="all, delete-orphan")

class WorkshopButton(db.Model):
    """Botones interactivos dentro de una plantilla"""
    __tablename__ = 'workshop_buttons'
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('workshop_templates.id'), nullable=False)
    label = db.Column(db.String(100), nullable=False) # Texto del botón
    identifier = db.Column(db.String(100), nullable=False) # Valor que enviará ManyChat (ej: 'ver_clase_1')
    
    interactions = db.relationship('WorkshopInteraction', backref='button', lazy='dynamic', cascade="all, delete-orphan")

class WorkshopTemplateSent(db.Model):
    """Registro de envíos de plantillas (Agregado por día)"""
    __tablename__ = 'workshop_template_sends'
    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(db.Integer, db.ForeignKey('workshop_templates.id'), nullable=False)
    date = db.Column(db.Date, nullable=False, default=datetime.utcnow().date)
    count = db.Column(db.Integer, default=0) # Cuántas veces se envió la plantilla este día

    __table_args__ = (db.UniqueConstraint('template_id', 'date', name='_template_date_uc'),)

class WorkshopInteraction(db.Model):
    """Interacción individual de un lead con un botón de la plantilla"""
    __tablename__ = 'workshop_interactions'
    id = db.Column(db.Integer, primary_key=True)
    button_id = db.Column(db.Integer, db.ForeignKey('workshop_buttons.id'), nullable=False)
    lead_id = db.Column(db.Integer, db.ForeignKey('manychat_leads.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # El Lead puede interactuar múltiples veces o con diferentes botones

class WorkshopEvent(db.Model):
    """Representa el registro consolidado de un taller o webinar con sus métricas manuales e integradas."""
    __tablename__ = 'workshop_events'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, unique=True)
    name = db.Column(db.String(100), nullable=False)

    # Métricas Manuales
    inversion = db.Column(db.Float, default=0.0)
    cpm = db.Column(db.Float, default=0.0)
    cpc = db.Column(db.Float, default=0.0)
    clics = db.Column(db.Integer, default=0)
    leads = db.Column(db.Integer, default=0)
    whatsapp_leads = db.Column(db.Integer, default=0)
    show_up = db.Column(db.Integer, default=0)
    pitch_leads = db.Column(db.Integer, default=0)
    pitch_final_leads = db.Column(db.Integer, default=0)

    # Métricas Automáticas (Editables)
    aplicaciones_form = db.Column(db.Integer, default=0)
    agendas_exitosas = db.Column(db.Integer, default=0)
    show_up_sales_call = db.Column(db.Integer, default=0)
    sales = db.Column(db.Integer, default=0)
    cash_collected = db.Column(db.Float, default=0.0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    @property
    def impresiones(self):
        if self.cpm and self.cpm > 0:
            return (self.inversion / self.cpm) * 1000
        return 0.0

    @property
    def ctr(self):
        imp = self.impresiones
        if imp > 0:
            return (self.clics / imp) * 100
        return 0.0

    @property
    def conversion_leads(self):
        if self.clics and self.clics > 0:
            return (self.leads / self.clics) * 100
        return 0.0

    @property
    def cpl(self):
        if self.leads and self.leads > 0:
            return self.inversion / self.leads
        return 0.0

    @property
    def tx_entrada_whatsapp(self):
        if self.leads and self.leads > 0:
            return (self.whatsapp_leads / self.leads) * 100
        return 0.0

    @property
    def show_up_rate(self):
        if self.whatsapp_leads and self.whatsapp_leads > 0:
            return (self.show_up / self.whatsapp_leads) * 100
        return 0.0

    @property
    def retencion_clase(self):
        if self.show_up and self.show_up > 0:
            return (self.pitch_leads / self.show_up) * 100
        return 0.0

    @property
    def retencion_pitch(self):
        if self.pitch_leads and self.pitch_leads > 0:
            return (self.pitch_final_leads / self.pitch_leads) * 100
        return 0.0

    @property
    def pct_aplicacion(self):
        if self.pitch_final_leads and self.pitch_final_leads > 0:
            return (self.aplicaciones_form / self.pitch_final_leads) * 100
        return 0.0

    @property
    def pct_aplicacion_agenda(self):
        if self.aplicaciones_form and self.aplicaciones_form > 0:
            return (self.agendas_exitosas / self.aplicaciones_form) * 100
        return 0.0

    @property
    def pct_conversion_agendas(self):
        if self.pitch_final_leads and self.pitch_final_leads > 0:
            return (self.agendas_exitosas / self.pitch_final_leads) * 100
        return 0.0

    @property
    def costo_por_agenda(self):
        if self.agendas_exitosas and self.agendas_exitosas > 0:
            return self.inversion / self.agendas_exitosas
        return 0.0

    @property
    def pct_show_up_sales_call(self):
        if self.aplicaciones_form and self.aplicaciones_form > 0:
            return (self.show_up_sales_call / self.aplicaciones_form) * 100
        return 0.0

    @property
    def pct_close_rate(self):
        if self.show_up_sales_call and self.show_up_sales_call > 0:
            return (self.sales / self.show_up_sales_call) * 100
        return 0.0

    @property
    def ticket_promedio(self):
        if self.sales and self.sales > 0:
            return self.cash_collected / self.sales
        return 0.0

    @property
    def roas(self):
        if self.inversion and self.inversion > 0:
            return self.cash_collected / self.inversion
        return 0.0

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date.isoformat(),
            "name": self.name,
            "inversion": self.inversion,
            "cpm": self.cpm,
            "cpc": self.cpc,
            "clics": self.clics,
            "leads": self.leads,
            "whatsapp_leads": self.whatsapp_leads,
            "show_up": self.show_up,
            "pitch_leads": self.pitch_leads,
            "pitch_final_leads": self.pitch_final_leads,
            "aplicaciones_form": self.aplicaciones_form,
            "agendas_exitosas": self.agendas_exitosas,
            "show_up_sales_call": self.show_up_sales_call,
            "sales": self.sales,
            "cash_collected": self.cash_collected,

            # Calculadas
            "impresiones": round(self.impresiones, 2),
            "ctr": round(self.ctr, 2),
            "conversion_leads": round(self.conversion_leads, 2),
            "cpl": round(self.cpl, 2),
            "tx_entrada_whatsapp": round(self.tx_entrada_whatsapp, 2),
            "show_up_rate": round(self.show_up_rate, 2),
            "retencion_clase": round(self.retencion_clase, 2),
            "retencion_pitch": round(self.retencion_pitch, 2),
            "pct_aplicacion": round(self.pct_aplicacion, 2),
            "pct_aplicacion_agenda": round(self.pct_aplicacion_agenda, 2),
            "pct_conversion_agendas": round(self.pct_conversion_agendas, 2),
            "costo_por_agenda": round(self.costo_por_agenda, 2),
            "pct_show_up_sales_call": round(self.pct_show_up_sales_call, 2),
            "pct_close_rate": round(self.pct_close_rate, 2),
            "ticket_promedio": round(self.ticket_promedio, 2),
            "roas": round(self.roas, 2),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class WorkshopGoals(db.Model):
    """Metas del sistema para las 8 etapas del embudo de un workshop (fila única,
    patrón singleton) — usadas por el Diagnóstico, el Simulador y el Plan de
    Acciones del dashboard para calcular la "fuga principal" y el impacto
    estimado de cada mejora. Valores por defecto calcados de las metas que ya
    aparecían hardcodeadas en el detalle de evento (`meta 70.0%`, etc.)."""
    __tablename__ = 'workshop_goals'
    id = db.Column(db.Integer, primary_key=True)
    meta_whatsapp = db.Column(db.Float, default=70.0)
    meta_asistencia = db.Column(db.Float, default=30.0)
    meta_retencion_clase = db.Column(db.Float, default=70.0)
    meta_retencion_pitch = db.Column(db.Float, default=50.0)
    meta_conversion_form = db.Column(db.Float, default=60.0)
    meta_agendamiento = db.Column(db.Float, default=85.0)
    meta_show_up_citas = db.Column(db.Float, default=60.0)
    meta_close_rate = db.Column(db.Float, default=20.0)
    # Cuántos puntos porcentuales por debajo de la meta todavía cuentan como
    # "al límite" en vez de "fuga" — evita que un embudo saludable con ruido
    # normal se pinte todo en rojo.
    banda_limite = db.Column(db.Float, default=5.0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "meta_whatsapp": self.meta_whatsapp,
            "meta_asistencia": self.meta_asistencia,
            "meta_retencion_clase": self.meta_retencion_clase,
            "meta_retencion_pitch": self.meta_retencion_pitch,
            "meta_conversion_form": self.meta_conversion_form,
            "meta_agendamiento": self.meta_agendamiento,
            "meta_show_up_citas": self.meta_show_up_citas,
            "meta_close_rate": self.meta_close_rate,
            "banda_limite": self.banda_limite,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class WorkshopAction(db.Model):
    """Ítem del plan de acciones del dashboard de Workshop — una mejora concreta
    atada (opcionalmente) a una de las 8 etapas del embudo, priorizada con un
    puntaje ICE-like (Valor/Velocidad/Simplicidad/Urgencia, 1-5 cada uno)."""
    __tablename__ = 'workshop_actions'
    id = db.Column(db.Integer, primary_key=True)
    stage_key = db.Column(db.String(40), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    note = db.Column(db.Text, nullable=True)
    value_score = db.Column(db.Integer, default=3)
    speed_score = db.Column(db.Integer, default=3)
    simplicity_score = db.Column(db.Integer, default=3)
    urgency_score = db.Column(db.Integer, default=3)
    # Cuántos puntos porcentuales apunta a mover la etapa si se ejecuta —
    # alimenta la estimación de impacto en ventas/cash (mismo modelo lineal
    # que el Simulador).
    target_delta_pp = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='pending')  # pending | done
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    creator = db.relationship('User', foreign_keys=[created_by_id])

    def to_dict(self):
        scores = [self.value_score, self.speed_score, self.simplicity_score, self.urgency_score]
        return {
            "id": self.id,
            "stage_key": self.stage_key,
            "title": self.title,
            "note": self.note,
            "value_score": self.value_score,
            "speed_score": self.speed_score,
            "simplicity_score": self.simplicity_score,
            "urgency_score": self.urgency_score,
            # Heurística propia de priorización (promedio simple de los 4 puntajes) —
            # no busca replicar el "score" de ninguna otra herramienta, sirve solo
            # para ordenar, no es una predicción.
            "score": round(sum(scores) / len(scores), 1),
            "target_delta_pp": self.target_delta_pp,
            "status": self.status,
            "created_by": self.creator.username if self.creator else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }

