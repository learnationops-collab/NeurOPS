from app import create_app
from app.models import Integration
import json

app = create_app()
with app.app_context():
    it = Integration.query.filter_by(key='2chat').first()
    if it:
        print(f"Integration ID: {it.id}")
        print(f"Config: {json.dumps(it.payload_config, indent=2)}")
    else:
        print("2Chat integration not found")
