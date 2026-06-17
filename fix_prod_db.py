import os
from dotenv import load_dotenv

load_dotenv('.env')
prod_url = os.environ.get('DATABASE_PRODUCTION')
if prod_url:
    os.environ['DATABASE_URL'] = prod_url

from app import create_app
from app.models import db, Client

app = create_app()

with app.app_context():
    count = Client.query.filter(Client.id >= 5944, Client.id <= 5999).delete()
    db.session.commit()
    print(f"Deleted {count} recently created clients in production.")
