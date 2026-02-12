import sys
import os
from datetime import date

# Add app directory to path
sys.path.append(os.getcwd())

from app import create_app, db
from app.models import SetterDailyStats, User, DailyReportQuestion
from app.services.image_service import ImageService
from app.api.setter import _trigger_setter_report_webhook
from sqlalchemy import func

def verify_premium():
    app = create_app()
    with app.app_context():
        # Get a dummy user
        setter = User.query.filter_by(role='setter').first()
        if not setter:
            print("ERROR: No setter found")
            return

        # Ensure we have some questions to mock
        questions = DailyReportQuestion.query.filter_by(role='setter').all()
        if not questions:
            print("Warning: No qualitative questions found, creating some for test...")
            q1 = DailyReportQuestion(text="¿Qué tal el día?", role='setter', order=1)
            q2 = DailyReportQuestion(text="¿Alguna objeción común?", role='setter', order=2)
            db.session.add_all([q1, q2])
            db.session.commit()
            questions = [q1, q2]

        # Mock stat object with qualitative answers
        answers_mock = {
            str(questions[0].id): "Ha sido un día productivo, muchos prospectos interesados en la oferta inicial.",
            str(questions[1].id): "Varios prospectos preguntaron por el precio antes de agendar."
        }

        # Prepare dummy appointment to test "Agendados" stage
        from app.models.booking import Appointment
        from datetime import datetime, time
        
        # We need a closer to assign the appointment
        closer = User.query.filter_by(role='closer').first()
        if not closer:
            closer = User(username="closertest", role="closer", is_active=True)
            db.session.add(closer)
            db.session.commit()
            
        from app.models.client import Client
        client = Client.query.first()
        if not client:
            client = Client(full_name="Client Test", email="client@test.com")
            db.session.add(client)
            db.session.commit()

        # Create one appointment for today if not already there
        existing_appt = Appointment.query.filter_by(setter_id=setter.id).filter(func.date(Appointment.start_time) == date.today()).first()
        if not existing_appt:
            new_appt = Appointment(
                setter_id=setter.id,
                closer_id=closer.id,
                client_id=client.id,
                start_time=datetime.combine(date.today(), time(14, 0)),
                origin="Test"
            )
            db.session.add(new_appt)
            db.session.commit()
            print("Created dummy appointment for test.")

        stat = SetterDailyStats(
            setter_id=setter.id,
            date=date.today(),
            stage_1_value=30,
            stage_2_value=20,
            stage_3_value=12,
            stage_4_value=0,
            stage_5_value=0,
            not_lead=8,
            answers=answers_mock
        )

        # Mocking current_user
        import app.api.setter as setter_api
        class MockUser:
            def __init__(self, username):
                self.username = username
        setter_api.current_user = MockUser(setter.username)

        print(f"Triggering premium v2 report for {setter.username}...")
        try:
            _trigger_setter_report_webhook(stat)
            print("Success! Premium v2 report sent.")
        except Exception as e:
            print(f"FAILED: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    verify_premium()
