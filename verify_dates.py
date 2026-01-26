from app import create_app
from app.models import Client

app = create_app()
with app.app_context():
    clients = Client.query.order_by(Client.created_at.desc()).limit(20).all()
    print(f"Top 20 Clients by Created At:")
    print("-" * 50)
    print(f"{'Name':<30} | {'Created At':<20}")
    print("-" * 50)
    for c in clients:
        print(f"{c.full_name[:30]:<30} | {c.created_at}")
