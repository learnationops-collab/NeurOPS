from app import create_app, db
from app.services.dashboard_service import DashboardService
import json
from datetime import date

app = create_app()

with app.app_context():
    print("Testing DashboardService.get_main_dashboard_data...")
    try:
        data = DashboardService.get_main_dashboard_data(period='this_month')
        
        # Check for new keys
        if 'charts' not in data:
            print("ERROR: 'charts' key missing from response")
            exit(1)
            
        charts = data['charts']
        required_keys = ['dates_labels', 'revenue_values', 'agendas_values', 'status_labels', 'status_values', 'program_labels', 'program_values', 'finance_breakdown']
        
        missing = [k for k in required_keys if k not in charts]
        
        if missing:
            print(f"ERROR: Missing chart keys: {missing}")
            exit(1)
            
        print("SUCCESS: DashboardService returned all required chart data.")
        # print(json.dumps(charts, indent=2, default=str))
        
    except Exception as e:
        print(f"ERROR: {e}")
        exit(1)
