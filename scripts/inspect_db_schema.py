from app import create_app, db
from sqlalchemy import inspect

app = create_app()
with app.app_context():
    inspector = inspect(db.engine)
    columns = inspector.get_columns('users')
    print("Columns in 'users' table:")
    for column in columns:
        print(f"- {column['name']} ({column['type']})")
