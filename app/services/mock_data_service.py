from app import db
from app.models import User, LeadProfile, Program, Enrollment, Payment, Appointment, CloserDailyStats, DailyReportQuestion, DailyReportAnswer, PaymentMethod, Event
from datetime import datetime, date, time, timedelta
import random

class MockDataService:
    @staticmethod
    def generate_bulk_data(lead_count=5, create_sales=True):
        """
        Generates dummy data for testing:
        - Ensures basic config (Program, PaymentMethod, Closer)
        - Creates 'lead_count' leads
        - Creates appointments for today (mix of scheduled/completed)
        - Optionally creates sales/payments for some leads
        - Generates a daily report for today
        """
        print(f"Generating {lead_count} leads, Sales={create_sales}")
        
        # 1. Ensure Basics
        program = Program.query.first()
        if not program:
            program = Program(name="Neuro-Mastery Pro", price=1500.0)
            db.session.add(program)
        
        pm = PaymentMethod.query.first()
        if not pm:
            pm = PaymentMethod(name="Stripe", commission_percent=2.9, commission_fixed=0.3)
            db.session.add(pm)
            
        closer = User.query.filter_by(role='closer').first()
        if not closer:
            closer = User(username="closer_test", email="closer@test.com", role='closer')
            closer.set_password("test1234")
            db.session.add(closer)
            
        db.session.commit()
        
        event = Event.query.first()
        today = date.today()
        
        # Track counters for the report
        scheduled_count = 0
        completed_count = 0
        sales_count = 0
        revenue = 0.0
        
        # 2. Loop
        for i in range(lead_count):
            suffix = random.randint(1000, 9999)
            lead_name = f"mock_{suffix}"
            
            # Check exist
            if User.query.filter_by(username=lead_name).first():
                continue
                
            lead = User(username=lead_name, email=f"{lead_name}@example.com", role='lead')
            db.session.add(lead)
            db.session.flush()
            
            profile = LeadProfile(user_id=lead.id, phone=f"555{suffix}", status='agenda')
            db.session.add(profile)
            
            # Create Appointment
            # Randomize time
            hour = 9 + (i % 8)
            start_dt = datetime.combine(today, time(hour, 0))
            
            is_completed = (i % 2 == 0) # Every other is completed
            
            appt = Appointment(
                closer_id=closer.id,
                lead_id=lead.id,
                event_id=event.id if event else None,
                start_time=start_dt,
                status='completed' if is_completed else 'scheduled',
                appointment_type='Primera agenda',
                presentation_done=is_completed
            )
            db.session.add(appt)
            
            scheduled_count += 1
            if is_completed:
                completed_count += 1
            
            # Sale?
            if create_sales and is_completed and (i % 3 == 0):
                enr = Enrollment(student_id=lead.id, program_id=program.id, closer_id=closer.id, status='active', total_agreed=program.price)
                db.session.add(enr)
                db.session.flush()
                
                pay = Payment(enrollment_id=enr.id, payment_method_id=pm.id, amount=program.price, status='completed', payment_type='full', date=datetime.now())
                db.session.add(pay)
                
                lead.role = 'student'
                profile.status = 'completed'
                
                sales_count += 1
                revenue += program.price

        db.session.commit()
        
        # 3. Daily Report (Upsert)
        stats = CloserDailyStats.query.filter_by(closer_id=closer.id, date=today).first()
        if not stats:
            stats = CloserDailyStats(closer_id=closer.id, date=today)
            db.session.add(stats)
        
        # Update accumulators (adding to existing if run multiple times? Or overwrite?)
        # Let's overwrite for clarity or add. The request implies "generate massive data", so maybe add.
        # But for the report, if we just generated X appts, the report should reflect the TOTAL for the day.
        # Simple approach: Increment
        stats.calls_scheduled += scheduled_count
        stats.calls_completed += completed_count
        stats.sales_count += sales_count
        stats.sales_amount += revenue
        stats.cash_collected += revenue
        
        db.session.commit()
        
        # 4. Answers (Only if new stats)
        questions = DailyReportQuestion.query.all()
        if questions:
            for q in questions:
                # Check if answered
                if not stats.answers.filter_by(question_id=q.id).first():
                    val = "10" if q.question_type == 'number' else "Sí"
                    ans = DailyReportAnswer(daily_stats_id=stats.id, question_id=q.id, answer=val)
                    db.session.add(ans)
            db.session.commit()
            
        return f"Generated {lead_count} leads, {sales_count} sales."
