from app import create_app
from app.models import User, Client, Lead
import json

app = create_app()
with app.app_context():
    print("--- Searching 'Jean Calo' ---")
    
    # Search in Users
    u = User.query.filter(User.username.ilike('%Jean%')).all()
    print(f"Users found: {[user.username for user in u]}")
    
    # Search in Clients
    c = Client.query.filter(Client.full_name.ilike('%Jean%')).all()
    print(f"Clients found: {[client.full_name for client in c]}")
    
    # Search in Leads
    l = Lead.query.filter(Lead.name.ilike('%Jean%')).all()
    print(f"Leads found: {[lead.name for lead in l]}")
    
    # Also check if there's a specific 'Jean Calo' record to see its data
    jc = Client.query.filter(Client.full_name.ilike('%Jean Calo%')).first()
    if jc:
        print(f"\nJean Calo (Client) Data:")
        print(f"Phone: {jc.phone}")
        print(f"Email: {jc.email}")
