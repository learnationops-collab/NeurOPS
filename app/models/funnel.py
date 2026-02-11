from datetime import datetime
from app import db

# Association Table for Many-to-Many Event <-> Closer
event_closers = db.Table('event_closers',
    db.Column('event_id', db.Integer, db.ForeignKey('events.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('users.id'), primary_key=True)
)

class EventGroup(db.Model):
    __tablename__ = 'event_groups'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    events = db.relationship('Event', backref='group', lazy='dynamic')

    def __repr__(self):
        return f'<EventGroup {self.name}>'

class Event(db.Model):
    __tablename__ = 'events'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    utm_source = db.Column(db.String(64), unique=True, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    duration_minutes = db.Column(db.Integer, default=30)
    buffer_minutes = db.Column(db.Integer, default=15)
    group_id = db.Column(db.Integer, db.ForeignKey('event_groups.id'))
    funnel_steps = db.Column(db.JSON)
    min_score = db.Column(db.Integer, default=0)
    redirect_url_fail = db.Column(db.String(255))
    redirect_url_success = db.Column(db.String(255))
    
    setter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    setter = db.relationship('User', foreign_keys=[setter_id], backref='events_set_default')

    closers = db.relationship('User', secondary=event_closers, lazy='subquery',
        backref=db.backref('assigned_events', lazy=True))

    def __repr__(self):
        return f'<Event {self.name}>'

class Program(db.Model):
    __tablename__ = 'programs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    price = db.Column(db.Float, nullable=False)
    is_active = db.Column(db.Boolean, default=True)

    enrollments = db.relationship('Enrollment', backref='program', lazy='dynamic')

    def __repr__(self):
        return f'<Program {self.name}>'
