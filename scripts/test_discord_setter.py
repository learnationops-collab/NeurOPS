from app import create_app, db
from app.models import SetterDailyStats, User
from app.api.setter import _trigger_setter_report_webhook
from datetime import date

def test_webhook():
    app = create_app()
    with app.app_context():
        # Find a setter
        setter = User.query.filter_by(role='setter').first()
        if not setter:
            print("No setter found in DB")
            return
            
        print(f"Testing for setter: {setter.username}")
        
        # Find or create a mock stat
        stat = SetterDailyStats.query.filter_by(setter_id=setter.id).first()
        if not stat:
            stat = SetterDailyStats(
                setter_id=setter.id,
                date=date.today(),
                not_lead=5,
                stage_1_value=21, # "Entrantes" (mapped to Leads Totales)
                stage_2_value=9,  # "Oferta"
                stage_3_value=7,  # "Links"
                stage_4_value=2,  # "Agendas"
                stage_5_value=0,
                answers={
                    "1": "He contactado a 15 personas hoy.",
                    "2": "El script de objeciones funcionó bien."
                }
            )
            # We don't necessarily need to add to DB if we just pass the object
        
        # Mock current_user for the trigger (since it uses current_user.username)
        from flask_login import login_user
        from flask import request
        
        # We need a request context for current_user to work if we use flask-login
        # Simpler: just temporarily patch current_user or the function
        
        class MockUser:
            def __init__(self, username):
                self.username = username
        
        import app.api.setter as setter_api
        original_user = setter_api.current_user
        setter_api.current_user = MockUser(setter.username)
        
        print("Triggering webhook...")
        _trigger_setter_report_webhook(stat)
        
        # Restore (though script ends)
        setter_api.current_user = original_user
        print("Done.")

if __name__ == "__main__":
    test_webhook()
