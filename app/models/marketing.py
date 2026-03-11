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


class AdDailySpend(db.Model):
    __tablename__ = 'ad_daily_spends'
    id = db.Column(db.Integer, primary_key=True)
    ad_id = db.Column(db.Integer, db.ForeignKey('ads.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    spend = db.Column(db.Float, default=0.0)
    entrantes = db.Column(db.Integer, default=0)
    agendas = db.Column(db.Integer, default=0)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Evitar duplicados de gasto por anuncio por día
    __table_args__ = (db.UniqueConstraint('ad_id', 'date', name='uq_ad_daily_spend'),)

    ad = db.relationship('Ad', backref=db.backref('daily_spends', lazy='dynamic'))


class ManychatAdLead(db.Model):
    """Lead recibido desde ManyChat, vinculado a un anuncio por ad_id/keyword."""
    __tablename__ = 'manychat_ad_leads'
    id = db.Column(db.Integer, primary_key=True)
    manychat_id = db.Column(db.String(100), unique=True, nullable=False)
    lead_name = db.Column(db.String(150))
    ad_id = db.Column(db.Integer, nullable=True)  # Sin FK, acepta cualquier valor
    keyword = db.Column(db.String(100))
    qualification = db.Column(db.String(10), default='null')  # 'true', 'false', 'null'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

