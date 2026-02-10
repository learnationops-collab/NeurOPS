from app import create_app
from app.services.booking_service import BookingService
from app.models import Appointment, Client, User
from datetime import datetime

app = create_app()

with app.app_context():
    # Mock Objects
    class MockClient:
        full_name = "Test Client (Image)"
        phone = "+1234567890"
        email = "test@example.com"
        id = 999

    class MockUser:
        username = "TestCloser"
        timezone = "America/La_Paz"
        id = 999

    class MockAppointment:
        start_time = datetime.utcnow()
        origin = "Test Script"
        client = MockClient()
        closer = MockUser()
        created_at = datetime.utcnow()

    mock_appt = MockAppointment()
    
    print("Triggering Webhook with Image Generation...")
    # This should send to the real Discord URL configured in DB
    BookingService.trigger_agenda_webhook(mock_appt)
    print("Done.")
