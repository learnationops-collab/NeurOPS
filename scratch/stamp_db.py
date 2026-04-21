from app import db, create_app
from sqlalchemy import text

app = create_app()
with app.app_context():
    db.session.execute(text("UPDATE alembic_version SET version_num = '777workshop123'"))
    db.session.commit()
    print("Database stamped to 777workshop123")
