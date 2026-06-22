import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, make_transient
from dotenv import load_dotenv

# Añadir el directorio raíz al path para importar la app
current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import (
    User, Campaign, AdSet, Ad, MarketingBudget, AdPeriodSpend, 
    ManychatAdLead, ManychatLead, LeadAnswer, SetterDailyStats, 
    CloserDailyStats, CloserDailyReport, DailyReportQuestion, 
    DailyReportAnswer, Expense, RecurringExpense, Client, Lead,
    Event, EventGroup, Program, Appointment, Availability, 
    WeeklyAvailability, SurveyQuestion, SurveyAnswer, Enrollment, 
    PaymentMethod, Payment, Pipeline, PipelineStage, 
    UserViewSetting, Notification, Comment, Integration, 
    PublicRegistration, FinancialSale, FinancialAgenda, 
    TriageDailyReport, TriageTrackerReport, WorkshopTemplate, 
    WorkshopButton, WorkshopTemplateSent, WorkshopInteraction,
    GoogleCalendarToken, UTMLog, LandingTracking, ConversationalMessage,
    LeadEventLog, ExcludedSale, ClientComment, event_closers,
    TeamMember, MonthlyPayroll, MonthlyPaymentMethodBalance, MonthlySaving,
    AlertRule, Alert
)

def actualizar():
    load_dotenv()
    prod_url = os.getenv('DATABASE_PRODUCTION')
    
    if not prod_url or "usuario:password" in prod_url:
        print("Error: DATABASE_PRODUCTION no está configurada correctamente en el archivo .env")
        return

    app = create_app()
    with app.app_context():
        print(f"--- Iniciando actualización limpia desde producción ---")
        
        # Motor de base de datos de producción
        prod_engine = create_engine(prod_url)
        ProdSession = sessionmaker(bind=prod_engine)
        prod_session = ProdSession()

        modelos = [
            # Independientes / Base
            User, EventGroup, Program, WorkshopTemplate, Pipeline, 
            DailyReportQuestion, Expense, RecurringExpense, 
            Campaign, ManychatLead, Integration,
            LandingTracking, ConversationalMessage, ExcludedSale,
            PaymentMethod, ManychatAdLead,
            TeamMember, MonthlyPaymentMethodBalance, MonthlySaving, AlertRule,
            
            # Dependencia Nivel 1
            Event, WorkshopButton, PipelineStage, Client, AdSet, 
            MarketingBudget, PublicRegistration, GoogleCalendarToken, UTMLog,
            Availability, WeeklyAvailability, Alert,
            
            # Dependencia Nivel 2
            Lead, Ad, WorkshopTemplateSent, UserViewSetting,
            SurveyQuestion, ClientComment, MonthlyPayroll,
            
            # Dependencia Nivel 3
            Appointment, Enrollment, AdPeriodSpend, LeadAnswer, 
            WorkshopInteraction, SetterDailyStats, CloserDailyStats,
            CloserDailyReport, TriageDailyReport, TriageTrackerReport,
            FinancialSale, FinancialAgenda, LeadEventLog,
            
            # Dependencia Nivel 4
            Payment, SurveyAnswer, Notification, Comment, DailyReportAnswer
        ]

        # 1. Limpiar datos locales en orden inverso para evitar violaciones de FK
        print("Limpiando base de datos local para evitar colisiones UNIQUE...")
        
        # Primero limpiar tabla de asociación Many-to-Many
        try:
            db.session.execute(event_closers.delete())
            db.session.commit()
            print("Limpiada tabla event_closers.")
        except Exception as e:
            db.session.rollback()
            print(f"Advertencia al limpiar event_closers: {e}")

        # Limpiar el resto de modelos
        for model in reversed(modelos):
            try:
                db.session.query(model).delete()
            except Exception as e:
                db.session.rollback()
                print(f"Advertencia al limpiar {model.__tablename__}: {e}")
        db.session.commit()
        print("Limpieza de modelos completada.")

        # 2. Copiar todos los registros desde producción
        for model in modelos:
            try:
                table_name = model.__tablename__
                print(f"Sincronizando {table_name}...", end=" ", flush=True)
                
                # Obtener todos los registros de producción
                items_prod = prod_session.query(model).all()
                
                if not items_prod:
                    print("Ok (vacia)")
                    continue
                
                for item in items_prod:
                    # Desasociar del motor de producción y marcar como transitorio
                    prod_session.expunge(item)
                    make_transient(item)
                    db.session.add(item)
                
                db.session.commit()
                print(f"Ok ({len(items_prod)} registros)")
                
            except Exception as e:
                db.session.rollback()
                print(f"Error: {e}")

        # Sincronizar event_closers (tabla de asociación Many-to-Many)
        try:
            print("Sincronizando event_closers...", end=" ", flush=True)
            items_prod = prod_session.execute(event_closers.select()).fetchall()
            if items_prod:
                insert_data = [dict(row._mapping) for row in items_prod]
                db.session.execute(event_closers.insert(), insert_data)
                db.session.commit()
                print(f"Ok ({len(items_prod)} registros)")
            else:
                print("Ok (vacía)")
        except Exception as e:
            db.session.rollback()
            print(f"Error al sincronizar event_closers: {e}")

        prod_session.close()
        print("--- Proceso finalizado con éxito ---")

if __name__ == "__main__":
    actualizar()
