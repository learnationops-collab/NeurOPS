import sys
import os

# Create scripts folder if running from root
sys.path.append(os.getcwd())

from app import create_app, db
from app.models import User

app = create_app()

with app.app_context():
    print("Resetting Credentials...")
    
    # 1. Admin
    admin = User.query.filter_by(email='admin@neurops.com').first()
    if not admin:
        print("Creating Admin...")
        admin = User(username='admin', email='admin@neurops.com', role='admin')
        db.session.add(admin)
    admin.set_password('admin123')
    admin.is_active = True
    print(f"Admin: admin@neurops.com / admin123 (Updated)")

    # 2. Closer
    closer = User.query.filter_by(email='closer@neurops.com').first()
    if not closer:
        print("Creating Closer...")
        closer = User(username='closer', email='closer@neurops.com', role='closer')
        db.session.add(closer)
    closer.set_password('closer123')
    closer.is_active = True
    print(f"Closer: closer@neurops.com / closer123 (Updated)")

    db.session.commit()
    print("Done! Credentials Reset.")
