from app import db
from app.models import User, Client, Appointment, Enrollment, Payment, SurveyAnswer, Program, PaymentMethod
from datetime import datetime, timedelta
import random

class AdminOperationService:
    @staticmethod
    def clear_business_data():
        try:
            db.session.query(SurveyAnswer).delete()
            db.session.query(Payment).delete()
            db.session.query(Enrollment).delete()
            db.session.query(Appointment).delete()
            db.session.query(Client).delete()
            db.session.commit()
            return True, "Datos de negocio eliminados correctamente."
        except Exception as e:
            db.session.rollback()
            return False, f"Error al limpiar datos: {str(e)}"

    @staticmethod
    def generate_mock_data(client_count=20, appt_count=15, sale_count=5):
        try:
            closers = User.query.filter_by(role='closer').all()
            if not closers:
                return False, "No hay closers en el sistema para asignar datos."
            
            programs = Program.query.filter_by(is_active=True).all()
            if not programs:
                return False, "No hay programas activos."

            methods = PaymentMethod.query.filter_by(is_active=True).all()
            if not methods:
                return False, "No hay metodos de pago activos."

            names = ["Juan Perez", "Maria Garcia", "Carlos Lopez", "Ana Martinez", "Pedro Sanchez", "Laura Rodriguez", "Diego Gomez", "Elena Diaz", "Miguel Angel", "Sofia Ruiz", "Javier Hernandez", "Lucia Torres", "David Castro", "Paula Navarro", "Sergio Blanco", "Valentina Morales", "Mateo Ortega", "Isabella Jimenez", "Lucas Vega", "Camila Rios"]
            origins = ["vsl", "instagram", "facebook", "youtube", "closer", "organic"]
            
            # 1. Generate Clients
            clients = []
            for i in range(client_count):
                name = random.choice(names) + f" {random.randint(10,99)}"
                email = f"lead_{random.randint(1000,9999)}@example.com"
                client = Client(
                    full_name=name,
                    email=email,
                    phone=f"+54911{random.randint(10000000,99999999)}",
                    instagram=f"@{name.lower().replace(' ', '_')}",
                    created_at=datetime.utcnow() - timedelta(days=random.randint(0, 30))
                )
                db.session.add(client)
                clients.append(client)
            
            db.session.flush()

            # 2. Generate Appointments
            appts = []
            for i in range(appt_count):
                client = random.choice(clients)
                closer = random.choice(closers)
                days_offset = random.randint(-15, 5)
                start_time = datetime.utcnow().replace(hour=random.randint(9, 18), minute=0, second=0, microsecond=0) + timedelta(days=days_offset)
                
                appt = Appointment(
                    client_id=client.id,
                    closer_id=closer.id,
                    start_time=start_time,
                    status=random.choice(['completed', 'no_show', 'scheduled', 'confirmed']),
                    appointment_type=random.choice(['Primera agenda', 'Segunda agenda']),
                    origin=random.choice(origins)
                )
                db.session.add(appt)
                appts.append(appt)

            db.session.flush()

            # 3. Generate Sales (Enrollments)
            completed_appts = [a for a in appts if a.status == 'completed']
            if not completed_appts:
                completed_appts = appts
                
            for i in range(min(sale_count, len(completed_appts))):
                appt = completed_appts[i]
                client = appt.client
                program = random.choice(programs)
                
                enrollment = Enrollment(
                    client_id=client.id,
                    program_id=program.id,
                    closer_id=appt.closer_id,
                    enrollment_date=appt.start_time + timedelta(hours=1)
                )
                db.session.add(enrollment)
                db.session.flush()

                payment = Payment(
                    enrollment_id=enrollment.id,
                    payment_method_id=random.choice(methods).id,
                    amount=program.price / 2,
                    date=enrollment.enrollment_date,
                    payment_type=random.choice(['Primer Pago', 'Renovación', 'Pago Completo', 'Cuota', 'Seña']),
                    status='completed'
                )
                db.session.add(payment)

            db.session.commit()
            return True, f"Se generaron {client_count} leads, {appt_count} agendas y {sale_count} ventas."
        except Exception as e:
            db.session.rollback()
            return False, f"Error al generar datos: {str(e)}"
