from app import create_app, db
from app.models import User, Program, PaymentMethod, DailyReportQuestion, ROLE_ADMIN
import os

def seed_database():
    app = create_app()
    with app.app_context():
        print("🌱 Iniciando Seeder de Base de Datos...")
        
        # 1. Crear / Resetear Admin
        admin_email = "admin@learnation.com"
        admin_user = User.query.filter_by(email=admin_email).first()
        
        if admin_user:
            print(f"🔄 Usuario admin encontrado. Reseteando contraseña y asegurando rol admin...")
            admin_user.set_password("admin123")
            admin_user.role = ROLE_ADMIN
        else:
            print(f"👤 Creando nuevo superadmin: {admin_email}")
            admin_user = User(
                username="admin",
                email=admin_email,
                role=ROLE_ADMIN
            )
            admin_user.set_password("admin123")
            db.session.add(admin_user)
            
        # 2. Programas Iniciales
        programs = [
            {"name": "Mentoria Learnation", "price": 1000.0},
            {"name": "Curso Workers Pro", "price": 500.0},
            {"name": "NeuroOps Masterclass", "price": 150.0}
        ]
        
        for p_data in programs:
            if not Program.query.filter_by(name=p_data['name']).first():
                print(f"📦 Añadiendo programa: {p_data['name']}")
                p = Program(name=p_data['name'], price=p_data['price'])
                db.session.add(p)

        # 3. Metodos de Pago
        methods = [
            {"name": "Stripe", "fee_p": 2.9, "fee_f": 0.30},
            {"name": "PayPal", "fee_p": 5.4, "fee_f": 0.30},
            {"name": "Transferencia / Zelle", "fee_p": 0.0, "fee_f": 0.0}
        ]
        
        for m_data in methods:
            if not PaymentMethod.query.filter_by(name=m_data['name']).first():
                print(f"💳 Añadiendo metodo: {m_data['name']}")
                m = PaymentMethod(
                    name=m_data['name'], 
                    commission_percent=m_data['fee_p'], 
                    commission_fixed=m_data['fee_f']
                )
                db.session.add(m)

        # 4. Preguntas Reporte Diario
        questions = [
            {"text": "¿Cuantas llamadas tuviste?", "type": "number", "order": 1},
            {"text": "¿Cual fue tu mayor victoria hoy?", "type": "text", "order": 2},
            {"text": "¿Necesitas ayuda con algun lead?", "type": "text", "order": 3}
        ]
        
        for q_data in questions:
            if not DailyReportQuestion.query.filter_by(text=q_data['text']).first():
                print(f"❓ Añadiendo pregunta: {q_data['text']}")
                q = DailyReportQuestion(
                    text=q_data['text'], 
                    question_type=q_data['type'], 
                    order=q_data['order']
                )
                db.session.add(q)

        db.session.commit()
        print("✅ Seeding completado con exito.")
        print("\n--- CREDENCIALES ---")
        print(f"User: admin")
        print(f"Pass: admin123")
        print("--------------------")

if __name__ == "__main__":
    seed_database()
