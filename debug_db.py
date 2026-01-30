from app import create_app, db
from app.models import SetterDailyStats, User

app = create_app()
with app.app_context():
    print(f"Total SetterDailyStats: {SetterDailyStats.query.count()}")
    stats = SetterDailyStats.query.limit(10).all()
    for s in stats:
        print(f"ID: {s.id}, SetterID: {s.setter_id}, Date: {s.date}, Agendas: {s.appointments_booked}")
    
    setters = User.query.filter_by(role='setter').all()
    print("\nSetters in DB:")
    for u in setters:
        print(f"ID: {u.id}, Username: {u.username}")
