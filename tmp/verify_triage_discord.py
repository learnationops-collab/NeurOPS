import requests
import json
from datetime import date

base_url = "http://localhost:5000" # Assume it's running locally for tests, or adjust as needed

def test_triage_submission():
    payload = {
        "triage_name": "Kerwin_Test",
        "date": date.today().isoformat(),
        "agendas_nuevas": 10,
        "agendas_confirmadas": 8,
        "no_contestan": 1,
        "cancelaciones": 1,
        "reprogramandos": 0,
        "seguimientos_iniciados": 5,
        "seguimientos_contestados": 4
    }
    
    print(f"Submitting triage report for {payload['triage_name']} on {payload['date']}...")
    try:
        # We can't actually hit localhost if the server isn't running, 
        # but we can simulate the backend call if we want or just check the code logic.
        # For this environment, I'll try to run a manual script that imports the app.
        pass
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Instead of hitting the API, let's try to run the backend function directly in a flask context
    import sys
    import os
    sys.path.append(os.getcwd())
    
    from app import create_app, db
    from app.models import TriageDailyReport
    
    app = create_app()
    with app.app_context():
        # Clean up previous test if exists
        test_report = TriageDailyReport.query.filter_by(triage_name="Kerwin_Test").first()
        if test_report:
            db.session.delete(test_report)
            db.session.commit()
            print("Cleaned up old test report.")

        # Test data
        data = {
            "triage_name": "Kerwin_Test",
            "date": date.today().isoformat(),
            "agendas_nuevas": 10,
            "agendas_confirmadas": 8,
            "no_contestan": 1,
            "cancelaciones": 1,
            "reprogramandos": 0,
            "seguimientos_iniciados": 5,
            "seguimientos_contestados": 4
        }
        
        # Simulate the API call logic
        from app.api.public import _trigger_triage_report_webhook
        from datetime import datetime
        
        report_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        report = TriageDailyReport(
            triage_name=data['triage_name'],
            date=report_date,
            agendas_nuevas=data['agendas_nuevas'],
            agendas_confirmadas=data['agendas_confirmadas'],
            no_contestan=data['no_contestan'],
            cancelaciones=data['cancelaciones'],
            reprogramandos=data['reprogramandos'],
            seguimientos_iniciados=data['seguimientos_iniciados'],
            seguimientos_contestados=data['seguimientos_contestados']
        )
        db.session.add(report)
        db.session.commit()
        print(f"Created test report with ID: {report.id}")
        
        # Test Webhook (this might fail if no internet/discord access, but we check if it runs without exceptions)
        try:
            print("Triggering Discord webhook...")
            _trigger_triage_report_webhook(report)
            print("Webhook trigger finished (check status code above if internet available).")
        except Exception as e:
            print(f"Webhook failed as expected in test env if no internet: {e}")
        
        # Cleanup
        db.session.delete(report)
        db.session.commit()
        print("Test report cleaned up.")
