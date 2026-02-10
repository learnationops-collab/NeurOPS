import requests
from app import create_app
from app.models import Integration
import json

app = create_app()
with app.app_context():
    it = Integration.query.filter_by(key='2chat').first()
    if not it:
        print("Integration not found")
        exit()
        
    api_key = it.payload_config.get('api_key')
    
    # Target number (Argentina)
    test_to = "5492346459264" # No +
    
    # Sender variants for Mexico (Jean Calo)
    senders = [
        "+525620873819",
        "525620873819",
        "+5215620873819",
        "5215620873819",
        "+5492346459264",
        "5492346459264"
    ]
    
    headers = {
        "X-User-API-Key": api_key,
        "Content-Type": "application/json"
    }
    
    for sender in senders:
        print(f"\nVariant: {sender}")
        payload = {
            "to_number": test_to,
            "from_number": sender,
            "text": f"Prueba formato {sender}"
        }
        
        try:
            response = requests.post("https://api.p.2chat.io/open/whatsapp/send-message", json=payload, headers=headers, timeout=5)
            print(f"Status: {response.status_code}")
            print(f"Response: {response.text}")
        except Exception as e:
            print(f"Error: {e}")
