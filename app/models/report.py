from datetime import datetime
from app import db

class Expense(db.Model):
    __tablename__ = 'expenses'
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    category = db.Column(db.String(50), default='variable')
    is_recurring = db.Column(db.Boolean, default=False)

class RecurringExpense(db.Model):
    __tablename__ = 'recurring_expenses'
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(255), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    day_of_month = db.Column(db.Integer, default=1)
    is_active = db.Column(db.Boolean, default=True)

class DailyReportQuestion(db.Model):
    __tablename__ = 'daily_report_questions'
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(255), nullable=False)
    question_type = db.Column(db.String(50), default='text')
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    role = db.Column(db.String(20), default='closer')

class DailyReportAnswer(db.Model):
    __tablename__ = 'daily_report_answers'
    id = db.Column(db.Integer, primary_key=True)
    daily_stats_id = db.Column(db.Integer, db.ForeignKey('closer_daily_stats.id'), nullable=True)
    setter_stats_id = db.Column(db.Integer, db.ForeignKey('setter_daily_stats.id'), nullable=True)
    question_id = db.Column(db.Integer, db.ForeignKey('daily_report_questions.id'), nullable=False)
    answer = db.Column(db.Text)
    
    question = db.relationship('DailyReportQuestion')
    daily_stats = db.relationship('CloserDailyStats', backref=db.backref('answers', lazy='dynamic'))
    setter_stats = db.relationship('SetterDailyStats', backref=db.backref('answers', lazy='dynamic'))

class SetterDailyStageMetric(db.Model):
    __tablename__ = 'setter_daily_stage_metrics'
    id = db.Column(db.Integer, primary_key=True)
    daily_stats_id = db.Column(db.Integer, db.ForeignKey('setter_daily_stats.id'), nullable=False)
    stage_id = db.Column(db.Integer, db.ForeignKey('pipeline_stages.id'), nullable=False)
    value = db.Column(db.Integer, default=0)
    
    daily_stats = db.relationship('SetterDailyStats', backref=db.backref('stage_metrics', lazy='dynamic'))
    stage = db.relationship('PipelineStage')
    
    __table_args__ = (db.UniqueConstraint('daily_stats_id', 'stage_id', name='_setter_daily_stage_uc'),)

class SetterDailyStats(db.Model):
    __tablename__ = 'setter_daily_stats'
    id = db.Column(db.Integer, primary_key=True)
    setter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    
    inbound_leads = db.Column(db.Integer, default=0)
    openings = db.Column(db.Integer, default=0)
    not_lead = db.Column(db.Integer, default=0)
    new_offers = db.Column(db.Integer, default=0)
    links_sent = db.Column(db.Integer, default=0)
    appointments_booked = db.Column(db.Integer, default=0)
    follow_ups = db.Column(db.Integer, default=0)
    
    setter = db.relationship('User', backref=db.backref('setter_daily_stats', lazy='dynamic'))
    __table_args__ = (db.UniqueConstraint('setter_id', 'date', name='_setter_date_uc'),)

class CloserDailyStats(db.Model):
    __tablename__ = 'closer_daily_stats'
    id = db.Column(db.Integer, primary_key=True)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    
    calls_scheduled = db.Column(db.Integer, default=0)
    calls_completed = db.Column(db.Integer, default=0)
    calls_no_show = db.Column(db.Integer, default=0)
    calls_canceled = db.Column(db.Integer, default=0)
    
    sales_count = db.Column(db.Integer, default=0)
    sales_amount = db.Column(db.Float, default=0.0)
    cash_collected = db.Column(db.Float, default=0.0)
    
    slots_defined = db.Column(db.Integer, default=0)
    self_generated_bookings = db.Column(db.Integer, default=0)  
    
    closer = db.relationship('User', backref=db.backref('daily_stats', lazy='dynamic'))
    __table_args__ = (db.UniqueConstraint('closer_id', 'date', name='_closer_date_uc'),)
