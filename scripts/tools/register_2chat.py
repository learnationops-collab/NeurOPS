from app import create_app, db
from app.models import Integration

app = create_app()

with app.app_context():
    # User Provided Data
    API_KEY = "UAK57f28d03-4cc2-4e53-9d12-8c470c09885a"
    TEST_NUMBER = "1543876119789"
    FROM_NUMBER = "+5492346459264"
    
    # Check if exists
    integration = Integration.query.filter_by(key='2chat').first()
    
    if not integration:
        print("Creating new 2Chat Integration...")
        integration = Integration(
            key="2chat",
            name="2Chat WhatsApp",
            active_env="prod"
        )
        db.session.add(integration)
    else:
        print("Updating existing 2Chat Integration...")
        
    # Update Config
    integration.url_prod = "https://api.p.2chat.io/open/whatsapp/send-message"
    integration.url_dev = "https://api.p.2chat.io/open/whatsapp/send-message"
    
    # Store API Key securely in JSON config
    integration.payload_config = {
        "api_key": API_KEY,
        "test_number": TEST_NUMBER,
        "from_number": FROM_NUMBER
    }
    
    db.session.commit()
    print("2Chat Integration registered successfully.")
