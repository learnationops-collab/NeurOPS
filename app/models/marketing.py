from datetime import datetime
from app import db

class Campaign(db.Model):
    __tablename__ = 'campaigns'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    external_id = db.Column(db.String(100), unique=True)
    type = db.Column(db.String(20))
    traffic = db.Column(db.String(50))
    funnel_type = db.Column(db.String(50))
    objective = db.Column(db.String(100))
    status = db.Column(db.String(20))
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    ad_sets = db.relationship('AdSet', backref='campaign', lazy='dynamic', cascade="all, delete-orphan")

class AdSet(db.Model):
    __tablename__ = 'ad_sets'
    id = db.Column(db.Integer, primary_key=True)
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaigns.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    external_id = db.Column(db.String(100), unique=True)
    audience = db.Column(db.String(200))
    conversion_event = db.Column(db.String(100))
    status = db.Column(db.String(20))
    details = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    ads = db.relationship('Ad', backref='ad_set', lazy='dynamic', cascade="all, delete-orphan")

class Ad(db.Model):
    __tablename__ = 'ads'
    id = db.Column(db.Integer, primary_key=True)
    ad_set_id = db.Column(db.Integer, db.ForeignKey('ad_sets.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    external_id = db.Column(db.String(100), unique=True)
    keyword = db.Column(db.String(100))
    stage = db.Column(db.String(50))
    status = db.Column(db.String(20))
    details = db.Column(db.Text)
    total_spend = db.Column(db.Float, default=0.0)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class MarketingBudget(db.Model):
    __tablename__ = 'marketing_budgets'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    budget = db.Column(db.Float, default=0.0)
    spent = db.Column(db.Float, default=0.0)
    source = db.Column(db.String(50))


class AdPeriodSpend(db.Model):
    __tablename__ = 'ad_period_spends'
    id = db.Column(db.Integer, primary_key=True)
    ad_id = db.Column(db.Integer, db.ForeignKey('ads.id'), nullable=True) # Ahora es opcional
    campaign_id = db.Column(db.Integer, db.ForeignKey('campaigns.id'), nullable=True)
    ad_set_id = db.Column(db.Integer, db.ForeignKey('ad_sets.id'), nullable=True)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    spend = db.Column(db.Float, default=0.0)
    entrantes = db.Column(db.Integer, default=0) # Legacy
    agendas = db.Column(db.Integer, default=0) # Legacy
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    ad = db.relationship('Ad', backref=db.backref('period_spends', lazy='dynamic'))
    campaign = db.relationship('Campaign', backref=db.backref('period_spends', lazy='dynamic'))
    ad_set = db.relationship('AdSet', backref=db.backref('period_spends', lazy='dynamic'))


class ManychatAdLead(db.Model):
    """Old lead table. Preserved for data migration."""
    __tablename__ = 'manychat_ad_leads'
    id = db.Column(db.Integer, primary_key=True)
    manychat_id = db.Column(db.String(100), nullable=False)
    lead_name = db.Column(db.String(150))
    ad_id = db.Column(db.Integer, nullable=True)  # Sin FK, acepta cualquier valor
    keyword = db.Column(db.String(100))
    qualification = db.Column(db.String(10), default='null')  # 'true', 'false', 'null'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ManychatLead(db.Model):
    """Información persistente y única del prospecto que ingresó vía ManyChat"""
    __tablename__ = 'manychat_leads'
    id = db.Column(db.Integer, primary_key=True)
    manychat_id = db.Column(db.String(100), unique=True, nullable=False)
    name = db.Column(db.String(150))
    ig = db.Column(db.String(100))
    follower = db.Column(db.Boolean, default=False)
    last_stage = db.Column(db.Integer, nullable=True)  # Última etapa numérica del funnel (ManyChat)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Un Lead puede interactuar con múltiples anuncios/webhooks
    answers = db.relationship('LeadAnswer', backref='lead', lazy='dynamic', cascade="all, delete-orphan")


class LeadAnswer(db.Model):
    """Respuesta/Interacción específica de un Lead a un Anuncio"""
    __tablename__ = 'lead_answers'
    id = db.Column(db.Integer, primary_key=True)
    lead_id = db.Column(db.Integer, db.ForeignKey('manychat_leads.id'), nullable=False)
    ad_id = db.Column(db.Integer, nullable=True)  # Sin FK rígida para admitir ads no registrados todavía
    keyword = db.Column(db.String(100))
    fecha_recibida = db.Column(db.String(50)) # Fecha string que pasa manychat
    opening = db.Column(db.String(100))
    variante = db.Column(db.String(100))
    qualification = db.Column(db.String(10), default='null')  # 'true', 'false', 'null'
    id_option = db.Column(db.String(100))
    id_question = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class UTMLog(db.Model):
    __tablename__ = 'utm_logs'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    base_url = db.Column(db.String(500), nullable=False)
    final_url = db.Column(db.String(1000), nullable=False)
    utm_source = db.Column(db.String(50))
    utm_medium = db.Column(db.String(50))
    utm_campaign = db.Column(db.String(100))
    utm_content = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('utm_logs', lazy='dynamic'))
