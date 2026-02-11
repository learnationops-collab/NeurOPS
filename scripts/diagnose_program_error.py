import sys
import os
sys.path.append(os.getcwd())
from app import create_app, db
from app.models import Program

app = create_app()

with app.app_context():
    try:
        print("Querying programs...")
        programs = Program.query.all()
        for p in programs:
            print(f"ID: {p.id}, Name: {p.name}, Price: {p.price}, Active: {p.is_active}")
        print("Success!")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
