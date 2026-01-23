from app import create_app, db
from app.models import User, LeadProfile, Program, Enrollment, Payment, Appointment, CloserDailyStats, DailyReportQuestion, DailyReportAnswer, PaymentMethod, Event
from datetime import datetime, timedelta, date, time
import random

app = create_app()
app.app_context().push()

def create_mock_data():
    print("Starting mock data generation...")

    # 1. Ensure a Program exists
    program = Program.query.first()
    if not program:
        program = Program(name="Neuro-Mastery Pro", price=1500.0)
        db.session.add(program)
        db.session.commit()
    
    # 2. Ensure a Payment Method exists
    pm = PaymentMethod.query.first()
    if not pm:
        pm = PaymentMethod(name="Stripe", commission_percent=2.9, commission_fixed=0.3)
        db.session.add(pm)
        db.session.commit()

    # 3. Create/Get a Closer
    closer = User.query.filter_by(role='closer').first()
    if not closer:
        closer = User(username="closer_test", email="closer@test.com", role='closer')
        closer.set_password("test1234")
        db.session.add(closer)
        db.session.commit()
    
    # 4. Create dummy Leads and Appointments
    event = Event.query.first()
    today = date.today()
    
    for i in range(5):
        # Create Lead
        lead_name = f"lead_mock_{i}"
        lead = User(username=lead_name, email=f"{lead_name}@test.com", role='lead')
        db.session.add(lead)
        db.session.flush() # Get ID
        
        profile = LeadProfile(user_id=lead.id, phone=f"1234567{i}", status='agenda')
        db.session.add(profile)
        
        # Create Appointment for today
        appt = Appointment(
            closer_id=closer.id,
            lead_id=lead.id,
            event_id=event.id if event else None,
            start_time=datetime.combine(today, time(10 + i, 0)),
            status='completed' if i < 3 else 'scheduled',
            appointment_type='Primera agenda',
            presentation_done=(i < 2)
        )
        db.session.add(appt)
        
        # If completed and presentation done, maybe a sale?
        if i == 0:
            enr = Enrollment(student_id=lead.id, program_id=program.id, closer_id=closer.id, status='active', total_agreed=1500.0)
            db.session.add(enr)
            db.session.flush()
            pay = Payment(enrollment_id=enr.id, payment_method_id=pm.id, amount=1500.0, status='completed', payment_type='full')
            db.session.add(pay)
            lead.role = 'student'
            profile.status = 'completed'

    # 5. Generate CloserDailyStats for today
    stats = CloserDailyStats.query.filter_by(closer_id=closer.id, date=today).first()
    if not stats:
        stats = CloserDailyStats(
            closer_id=closer.id,
            date=today,
            calls_scheduled=5,
            calls_completed=3,
            sales_count=1,
            sales_amount=1500.0,
            cash_collected=1500.0
        )
        db.session.add(stats)
    
    db.session.commit()
    
    # 6. Add some mock answers if questions exist
    questions = DailyReportQuestion.query.all()
    if questions and stats:
        for q in questions:
            ans_val = "10" if q.question_type == 'number' else ("Sí" if q.question_type == 'boolean' else "Todo bien")
            ans = DailyReportAnswer(daily_stats_id=stats.id, question_id=q.id, answer=ans_val)
            db.session.add(ans)
        db.session.commit()

    print("Mock data generated successfully!")

if __name__ == "__main__":
    create_mock_data()
