from app import create_app, db
from app.models import FinancialSale

app = create_app()
with app.app_context():
    sales = FinancialSale.query.all()
    print(f"Total sales found: {len(sales)}")
    for s in sales:
        print(f"ID: {s.id}, Setter: {s.setter_name}, Amount: {s.amount}, Date: {s.date}")
