import sys
import os

# Add parent directory to path to find 'app'
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from app.models import UserViewSetting

app = create_app()

def update_db():
    with app.app_context():
        print("Creando tablas faltantes (UserViewSetting)...")
        db.create_all()
        print("Tablas actualizadas.")

if __name__ == '__main__':
    update_db()
