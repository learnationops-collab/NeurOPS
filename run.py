from app import create_app, db
from app.models import User, LeadProfile, Program, Enrollment, Payment, Appointment
from dotenv import load_dotenv
import os

load_dotenv()

import click

app = create_app()

@app.shell_context_processor
def make_shell_context():
    return {
        'db': db, 
        'User': User, 
        'LeadProfile': LeadProfile, 
        'Program': Program, 
        'Enrollment': Enrollment, 
        'Payment': Payment, 
        'Appointment': Appointment
    }

@app.cli.command("create-admin")
@click.argument("username")
@click.argument("password")
def create_admin(username, password):
    """Creates a new admin user."""
    user = User(username=username, email=f"{username}@admin.com", role='admin')
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    print(f"Admin user {username} created successfully.")

if __name__ == '__main__':
    app.run(debug=True)
