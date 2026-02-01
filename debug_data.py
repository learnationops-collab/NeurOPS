from app import create_app, db
from app.models import User, Appointment, Payment, Enrollment
from sqlalchemy import func

app = create_app()

with app.app_context():
    print("--- Database Check ---")
    user_count = User.query.count()
    appt_count = Appointment.query.count()
    pay_count = Payment.query.count()
    
    print(f"Users: {user_count}")
    print(f"Appointments: {appt_count}")
    print(f"Payments: {pay_count}")
    
    if appt_count > 0:
        print("\nLast 3 Appointments:")
        for a in Appointment.query.order_by(Appointment.start_time.desc()).limit(3):
            print(f"  ID: {a.id}, Status: {a.status}, Date: {a.start_time}, Closer: {a.closer_id}")
            
    if pay_count > 0:
        print("\nLast 3 Payments:")
        for p in Payment.query.order_by(Payment.date.desc()).limit(3):
            print(f"  ID: {p.id}, Status: {p.status}, Date: {p.date}, Amount: {p.amount}")

    print("\n--- Testing Service ---")
    from app.services.dashboard_service import DashboardService
    from datetime import date
    
    # Test for 'this_month'
    start, end = DashboardService._get_date_range('this_month', None, None)
    print(f"Period: this_month ({start} to {end})")
    metrics = DashboardService.get_detailed_closer_metrics(start, end)
    print(f"Metrics (this_month): Sales={metrics['sales']}, Cash={metrics['financials']['cash_collected']}")

    # Test for 'last_month'
    start, end = DashboardService._get_date_range('last_month', None, None)
    print(f"\nPeriod: last_month ({start} to {end})")
    metrics = DashboardService.get_detailed_closer_metrics(start, end)
    print(f"Metrics (last_month): Sales={metrics['sales']}, Cash={metrics['financials']['cash_collected']}")

    # Test for 'all_time'
    start, end = DashboardService._get_date_range('all_time', None, None)
    print(f"\nPeriod: all_time ({start} to {end})")
    metrics = DashboardService.get_detailed_closer_metrics(start, end)
    print(f"Metrics (all_time): Sales={metrics['sales']}, Cash={metrics['financials']['cash_collected']}")
