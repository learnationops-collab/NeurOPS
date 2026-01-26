from app import create_app, db
from app.models import GoogleCalendarToken, User

app = create_app()
with app.app_context():
    print("--- Users ---")
    users = User.query.all()
    for u in users:
        print(f"User: {u.username} (ID: {u.id})")
        
    print("\n--- Tokens ---")
    tokens = GoogleCalendarToken.query.all()
    if not tokens:
        print("No tokens found.")
    for t in tokens:
        print(f"Token for UserID {t.user_id}: Exists (ID: {t.id})")
