from app import create_app, db
from app.models.marketing import LandingTracking

app = create_app()
with app.app_context():
    count = LandingTracking.query.count()
    print(f"Total registros: {count}")
    visits = LandingTracking.query.order_by(LandingTracking.created_at.desc()).limit(20).all()
    print("Ultimas 20 visitas:")
    for v in visits:
        print(f"ID: {v.id} | Path: {v.page_path} | Source: {v.utm_source}")
