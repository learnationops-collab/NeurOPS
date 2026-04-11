
from app import create_app, db
from sqlalchemy import inspect, text

app = create_app()
with app.app_context():
    insp = inspect(db.engine)
    tables = insp.get_table_names()
    print(f"Audit of all tables:")
    for t in tables:
        try:
            count = db.session.execute(text(f'SELECT count(*) FROM {t}')).scalar()
            print(f"  {t}: {count}")
        except Exception as e:
            print(f"  {t}: Error {e}")
