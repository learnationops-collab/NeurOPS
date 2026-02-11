import sys
import os
sys.path.append(os.getcwd())
from app import create_app
from app.models import User

app = create_app()
app.testing = True

with app.test_client() as client:
    token = None
    with app.app_context():
        u = User.query.get(1)
        if not u:
            u = User.query.filter_by(role='admin').first()
        if u:
            print(f"Logging in as {u.username} ({u.role})")
            token = u.get_auth_token()
        else:
            print("No admin user found!")
            
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
            
    endpoints = [
        '/api/admin/db/payment-methods',
        '/api/admin/funnels/groups',
        '/api/admin/funnels/events',
        '/api/admin/users'
    ]
    
    for ep in endpoints:
        print(f"\nTesting {ep}...")
        try:
            response = client.get(ep, headers=headers)
            print(f"Status: {response.status_code}")
            if response.status_code == 500:
                 # Print first 200 chars of error to avoid spam
                 print(f"Data: {response.data[:200]}...")
        except Exception as e:
            print(f"Error: {e}")
