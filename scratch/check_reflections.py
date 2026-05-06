from app import create_app, db
from app.models import SetterDailyStats

app = create_app()
with app.app_context():
    last_stat = SetterDailyStats.query.order_by(SetterDailyStats.id.desc()).first()
    if last_stat:
        print(f"ID: {last_stat.id}")
        print(f"Date: {last_stat.date}")
        print(f"Reflections: {last_stat.reflections}")
    else:
        print("No stats found.")
