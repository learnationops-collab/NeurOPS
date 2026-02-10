from app import create_app
from app.models import User
import json

app = create_app()
with app.app_context():
    users = User.query.all()
    print(f"Total users: {len(users)}")
    for u in users:
        # Check all attributes of the user object to see if there's any phone hidden or dynamic
        data = {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "email": u.email
        }
        # Try to find any attribute that looks like phone
        for attr in dir(u):
            if 'phone' in attr.lower() or 'number' in attr.lower():
                if not attr.startswith('_'):
                    try:
                        data[attr] = getattr(u, attr)
                    except:
                        pass
        print(json.dumps(data, indent=2))
