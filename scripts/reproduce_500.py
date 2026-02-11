import sys
import os
sys.path.append(os.getcwd())
from app import create_app

app = create_app()
app.testing = True

with app.test_client() as client:
    # Need to mock login?
    # Or strict login_required will block us.
    # We can try to login if we have a user, or disable login_required for debugging temporarily.
    # But disabling login_required involves editing code.
    # Let's try to bypass or login.
    
    # Login as admin (User 1)
    from flask_login import login_user
    from app.models import User
    
    print("Checking imports...")
    try:
        from app.models.user import ROLE_OPERATOR, ROLE_SALES_ADMIN
        print(f"Imported roles: OP={ROLE_OPERATOR}, SA={ROLE_SALES_ADMIN}")
    except Exception as e:
        print(f"IMPORT ERROR: {e}")
        import traceback
        traceback.print_exc()

    token = None
    with app.app_context():
        u = User.query.get(1)
        if not u:
            print("User 1 not found, trying to find any admin")
            u = User.query.filter_by(role='admin').first()
            
        if u:
            print(f"Logging in as {u.username} ({u.role})")
            token = u.get_auth_token()
        else:
            print("No admin user found!")
            
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
            
    print("Testing /api/admin/db/questions?role=closer...")
    try:
        response = client.get('/api/admin/db/questions?role=closer', headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 500:
             print(f"Data: {response.data}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

    print("\nTesting /api/admin/db/programs...")
    try:
        response = client.get('/api/admin/db/programs', headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 500:
             print(f"Data: {response.data}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
