from app import db
from app.models import User, Client, Appointment, Enrollment, Payment, SurveyAnswer, Program, PaymentMethod, FinancialSale
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
                    result=random.choice(['Terminada', 'No Show', None, 'Reprogramada']),
                    origin=random.choice(origins)
                )
                db.session.add(appt)
                appts.append(appt)

            db.session.flush()

            # 3. Generate Sales (Enrollments)
            completed_appts = [a for a in appts if a.result == 'Terminada']
            if not completed_appts:
                completed_appts = appts

            # No siempre hay tantas agendas 'Terminada' como ventas pedidas (depende del azar de
            # arriba): se genera lo que se pueda y se informa lo que de verdad se creo, no lo pedido.
            sales_generated = min(sale_count, len(completed_appts))
            for i in range(sales_generated):
                appt = completed_appts[i]
                client = appt.client
                program = random.choice(programs)
                
                # Un pago de ejemplo (Etapa 2c): FinancialSale de la persona del cliente; `sale_service` lo
                # ubica en su venta. Ya no se crea el espejo Enrollment/Payment.
                codigo = next((c for c, clave in (('RR', 'roadmap'), ('AL', 'learner'), ('SI', 'iniciative'))
                               if clave in (program.name or '').lower()), 'RR')
                closer = db.session.get(User, appt.closer_id) if appt.closer_id else None
                db.session.add(FinancialSale(
                    client_id=client.id, person=client.person, email_vendedor=closer.email if closer else None,
                    nombre_cliente=client.full_name, mail_cliente=client.email,
                    tipo_pago=f"{codigo} - {random.choice(['Completo', 'Parcial', 'Seña', 'Cuota', 'Renovación'])}",
                    monto=(program.price or 0) / 2, metodo_pago=random.choice(methods).name,
                    estado='Completada', date=appt.start_time + timedelta(hours=1)))

            db.session.commit()
            return True, f"Se generaron {client_count} leads, {appt_count} agendas y {sales_generated} ventas."
        except Exception as e:
            db.session.rollback()
            return False, f"Error al generar datos: {str(e)}"
