import requests
from app import create_app
from app.models import Integration

app = create_app()
with app.app_context():
    it = Integration.query.filter_by(key='2chat').first()
    if not it:
        print("Integration not found")
        exit()
        
    api_key = it.payload_config.get('api_key')
    print(f"Testing with API Key: {api_key[:10]}...")
    
    headers = {
        "X-User-API-Key": api_key,
        "Content-Type": "application/json"
    }
    
    # Check connected channels
    response = requests.get("https://api.p.2chat.io/open/whatsapp/numbers", headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        channels = response.json()
        print("\nAvailable Channels:")
        for channel in channels:
            print(f"- Number: {channel.get('phone_number')}")
            print(f"  Name: {channel.get('name')}")
            print(f"  Connected: {channel.get('is_connected')}")
            print("-" * 20)
    else:
        print(f"Error: {response.text}")
