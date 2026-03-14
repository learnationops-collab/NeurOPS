import sys
import os
import requests
from datetime import datetime

# Set PYTHONPATH to include the root directory
sys.path.append(os.getcwd())

from app import create_app, db
from app.models import FinancialSale

APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbywqgVBIZxMP6NqIVbtl0hcN3F0zkED3V-4a_1Zh5MP5l9YuYUtKX7GDzUhKX4h8JXS/exec"

def sync_sales():
    print(f"Fetching data from Apps Script...")
    try:
        response = requests.get(APPS_SCRIPT_URL)
        if response.status_code != 200:
            print(f"Error fetching data: {response.status_code}")
            return
        
        data = response.json()
        print(f"Successfully fetched {len(data)} items.")
        
        app = create_app()
        with app.app_context():
            # CLEAR EXISTING DATA to avoid duplicates and fix dates
            print("Clearing existing financial sales...")
            FinancialSale.query.delete()
            
            added = 0
            for item in data:
                monto = item.get('monto')
                setter = item.get('setter')
                
                if monto is None or setter is None:
                    continue
                
                # Parse date
                sale_date = datetime.utcnow()
                fecha_str = item.get('fecha')
                if fecha_str:
                    try:
                        from dateutil import parser
                        sale_date = parser.parse(fecha_str)
                    except:
                        pass
                
                sale = FinancialSale(
                    setter_name=str(setter),
                    amount=float(monto),
                    date=sale_date,
                    raw_data=item
                )
                db.session.add(sale)
                added += 1
            
            db.session.commit()
            print(f"Successfully added {added} sales to the database with correct dates.")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    sync_sales()
