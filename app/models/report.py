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
    daily_stats = db.relationship('CloserDailyStats', backref=db.backref('qualitative_answers', lazy='dynamic'))
    # Removed setter_stats relationship to avoid conflict with 'answers' JSON column in SetterDailyStats

class SetterDailyStats(db.Model):
    __tablename__ = 'setter_daily_stats'
    id = db.Column(db.Integer, primary_key=True)
    setter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    
    not_lead = db.Column(db.Integer, default=0)

    # Hardcoded Funnel Fields
    inbox_entrantes = db.Column(db.Integer, default=0)
    inbox_inabribles = db.Column(db.Integer, default=0)
    inbox_leads = db.Column(db.Integer, default=0)
    
    opening_submitted = db.Column(db.Integer, default=0)
    opening_responded = db.Column(db.Integer, default=0)
    
    funnel_qualification = db.Column(db.Integer, default=0)
    funnel_pain = db.Column(db.Integer, default=0)
    funnel_offer = db.Column(db.Integer, default=0)
    funnel_link = db.Column(db.Integer, default=0)
    funnel_agenda = db.Column(db.Integer, default=0)
    
    follow_up_submitted = db.Column(db.Integer, default=0)
    follow_up_responded = db.Column(db.Integer, default=0)

    # Fixed Funnel Stages (Max 5) - Managed as Legacy/Optional
    stage_1_value = db.Column(db.Integer, default=0)
    stage_2_value = db.Column(db.Integer, default=0)
    stage_3_value = db.Column(db.Integer, default=0)
    stage_4_value = db.Column(db.Integer, default=0)
    stage_5_value = db.Column(db.Integer, default=0)
    
    # Qualitative answers stored as a JSON dictionary: {question_id: answer_text}
    answers = db.Column(db.JSON, nullable=True)
    
    setter = db.relationship('User', foreign_keys=[setter_id], overlaps="setter_daily_stats_rel")
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
    
    closer = db.relationship('User', foreign_keys=[closer_id], overlaps="closer_daily_stats_rel")
    __table_args__ = (db.UniqueConstraint('closer_id', 'date', name='_closer_date_uc'),)
