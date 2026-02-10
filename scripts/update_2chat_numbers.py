from app import create_app
from app.models import Integration, db
import json

app = create_app()
with app.app_context():
    it = Integration.query.filter_by(key='2chat').first()
    if it:
        config = it.payload_config or {}
        
        # New sender numbers list
        sender_numbers = [
            {"label": "Principal", "phone": "+5492346459264"},
            {"label": "Jean Calo", "phone": "+525620873819"}
        ]
        
        config["sender_numbers"] = sender_numbers
        config["from_number"] = "+5492346459264" # Keep default
        
        it.payload_config = config
        db.session.commit()
        print("Updated 2Chat configuration with multiple numbers:")
        print(json.dumps(config, indent=2))
    else:
        print("2Chat integration not found")
