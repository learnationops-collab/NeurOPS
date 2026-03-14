import sys
import os

# Set PYTHONPATH to include the root directory
sys.path.append(os.getcwd())

from app import create_app, db
from app.models import FinancialSale

app = create_app()
with app.app_context():
    try:
        sales = FinancialSale.query.all()
        print(f"DEBUG_START")
        print(f"Total sales found: {len(sales)}")
        for s in sales:
            print(f"SALE|{s.id}|{s.setter_name}|{s.amount}|{s.date}")
        print(f"DEBUG_END")
    except Exception as e:
        print(f"ERROR: {e}")
