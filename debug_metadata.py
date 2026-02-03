from app import create_app, db
from app.models import Campaign, AdSet, Ad

app = create_app()
with app.app_context():
    print("Tables in SQLAlchemy metadata:")
    for table in db.metadata.tables:
        print(f"- {table}")
    
    print("\nChecking ForeignKey for AdSet:")
    for fk in db.metadata.tables['ad_sets'].foreign_keys:
        print(f"- {fk}")
