from app import create_app, db
from app.models import SetterDailyStats

app = create_app()
with app.app_context():
    stats = SetterDailyStats.query.order_by(SetterDailyStats.id.desc()).limit(5).all()
    for s in stats:
        print(f"ID: {s.id}, Date: {s.date}, Reflections: {s.reflections}")
