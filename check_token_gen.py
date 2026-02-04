from app import create_app, db
from app.models import User
import jwt
import sys

app = create_app()

with app.app_context():
    print(f"Secret Key: {app.config['SECRET_KEY']}")
    try:
        user = User(username='test_token_user', id=99999)
        token = user.get_auth_token()
        print(f"SUCCESS: Token generated: {token}")
        
        # Verify
        decoded_id = User.verify_auth_token(token)
        if decoded_id == 99999:
             print("SUCCESS: Token verified")
        else:
             print(f"ERROR: Token verification failed. Got {decoded_id}")
             sys.exit(1)
             
    except Exception as e:
        print(f"ERROR: Exception during token generation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
