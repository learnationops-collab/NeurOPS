import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from app import create_app, db
from app.models import SetterDailyStats, User

app = create_app()
with app.app_context():
    print(f"Total Users: {User.query.count()}")
    print(f"Total SetterDailyStats: {SetterDailyStats.query.count()}")
    
    # Check for recent stats
    stats = SetterDailyStats.query.order_by(SetterDailyStats.date.desc()).limit(20).all()
    print("\nRecent Stats (Last 20):")
    for s in stats:
        setter = User.query.get(s.setter_id)
        print(f"ID: {s.id}, Setter: {setter.username if setter else 'Unknown'} (ID: {s.setter_id}), Date: {s.date}, Agendas: {s.appointments_booked}")
    
    # Check for specific setters
    setters = User.query.filter_by(role='setter').all()
    print("\nSetters in DB:")
    for u in setters:
        count = SetterDailyStats.query.filter_by(setter_id=u.id).count()
        print(f"ID: {u.id}, Username: {u.username}, Stats Count: {count}")
