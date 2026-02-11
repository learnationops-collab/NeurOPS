import sys
import os

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models.user import User, ROLE_SALES_ADMIN

def create_sales_admin(username, email, password):
    app = create_app()
    with app.app_context():
        # Check if user already exists
        user = User.query.filter((User.username == username) | (User.email == email)).first()
        if user:
            print(f"User {username} or email {email} already exists.")
            return

        new_user = User(username=username, email=email, role=ROLE_SALES_ADMIN)
        new_user.set_password(password)
        
        db.session.add(new_user)
        db.session.commit()
        print(f"Sales Admin user '{username}' created successfully.")

if __name__ == '__main__':
    # Use default credentials or allow overrides via args
    import argparse
    parser = argparse.ArgumentParser(description='Create a Sales Admin user')
    parser.add_argument('--username', default='salesadmin', help='Username for the new user')
    parser.add_argument('--email', default='salesadmin@example.com', help='Email for the new user')
    parser.add_argument('--password', default='salesadmin123', help='Password for the new user')
    
    args = parser.parse_args()
    create_sales_admin(args.username, args.email, args.password)
