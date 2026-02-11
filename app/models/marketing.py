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
