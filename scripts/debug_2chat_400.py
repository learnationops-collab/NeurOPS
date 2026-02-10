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
    # Use the numbers provided by the user in the latest config
    # Jean Calo: +525620873819
    # Principal: +5492346459264
    
    senders = ["+525620873819", "+5492346459264"]
    test_to = "1543876119789" # Used earlier in the thread
    
    headers = {
        "X-User-API-Key": api_key,
        "Content-Type": "application/json"
    }
    
    for sender in senders:
        print(f"\nTrying sender: {sender}")
        payload = {
            "to_number": test_to,
            "from_number": sender,
            "text": f"Prueba desde script para {sender}"
        }
        
        response = requests.post("https://api.p.2chat.io/open/whatsapp/send-message", json=payload, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
