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
    AlertRule, Alert, ClientMergeLog, CloserAlias, CommentNotification,
    FeatureToggle, InstallmentPlan, LandingSession, WorkshopEvent, WorkshopLead
)

def safe(text):
    """Texto imprimible en la consola de Windows (cp1252). Los mensajes de error de SQLAlchemy
    incluyen las filas que fallaron, y ahí aparecen emojis y acentos de datos reales: sin esto
    el propio `print` del except revienta con UnicodeEncodeError y tapa el error original."""
    enc = (sys.stdout.encoding or 'utf-8')
    return str(text).encode(enc, errors='replace').decode(enc, errors='replace')


def actualizar(target='local'):
    load_dotenv()
    prod_url = os.getenv('DATABASE_PRODUCTION')
    
    if not prod_url or "usuario:password" in prod_url:
        print("Error: DATABASE_PRODUCTION no está configurada correctamente en el archivo .env")
        return

    if target in ('staging', 'testing'):
        dest_url = os.getenv('DATABASE_STAGING') or os.getenv('DATABASE_TESTING')
        if not dest_url:
            print("Error: Configura DATABASE_STAGING en tu archivo .env con la URL de Postgres de Railway Testing.")
            return
        os.environ['DATABASE_URL'] = dest_url
        target_name = "Railway Staging (PostgreSQL)"
    else:
        target_name = "Local (SQLite)"

    app = create_app()
    with app.app_context():
        print(f"--- Iniciando actualización limpia desde producción hacia [{target_name}] ---")
        try:
            from flask_migrate import upgrade as db_upgrade
            print("Asegurando estructura de tablas con migraciones...")
            db_upgrade()
        except Exception as mig_err:
            print(f"Advertencia al ejecutar migraciones previa a la sincronización: {mig_err}")
        
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
            WorkshopEvent,
            
            # Dependencia Nivel 1
            Event, WorkshopButton, PipelineStage, Client, AdSet, 
            MarketingBudget, PublicRegistration, GoogleCalendarToken, UTMLog,
            Availability, WeeklyAvailability, Alert, CloserAlias, FeatureToggle,
            
            # Dependencia Nivel 2
            Lead, Ad, WorkshopTemplateSent, UserViewSetting,
            SurveyQuestion, ClientComment, MonthlyPayroll,
            ClientMergeLog, WorkshopLead,
            
            # Dependencia Nivel 3
            Appointment, Enrollment, AdPeriodSpend, LeadAnswer, 
            WorkshopInteraction, SetterDailyStats, CloserDailyStats,
            CloserDailyReport, TriageDailyReport, TriageTrackerReport,
            FinancialSale, FinancialAgenda, LeadEventLog, LandingSession,
            
            # Dependencia Nivel 4
            Payment, SurveyAnswer, Notification, Comment, DailyReportAnswer,
            InstallmentPlan, CommentNotification
        ]

        # 1. Limpiar datos locales en orden inverso para evitar violaciones de FK
        print("Limpiando base de datos destino para evitar colisiones UNIQUE...")
        
        # Primero limpiar tabla de asociación Many-to-Many
        try:
            db.session.execute(event_closers.delete())
            db.session.commit()
            print("Limpiada tabla event_closers.")
        except Exception as e:
            db.session.rollback()
            print(safe(f"Advertencia al limpiar event_closers: {e}"))

        # Limpiar el resto de modelos. Se hace commit por modelo, no uno solo al final: el
        # `rollback()` del except deshacía TODOS los borrados acumulados en la transacción, no
        # solo el que falló. Con una tabla inexistente en local (una migración sin aplicar, por
        # ejemplo) el borrado quedaba a medias y la copia posterior moría con UNIQUE constraint
        # sobre tablas que ya se creían vacías.
        for model in reversed(modelos):
            try:
                db.session.query(model).delete()
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                print(safe(f"Advertencia al limpiar {model.__tablename__}: {e}"))
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
                print(safe(f"Error: {e}"))

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
        
        # 3. Normalización post-sincronización de closers y alias
        try:
            from scripts.normalizar_closers import normalizar_closers
            normalizar_closers()
        except Exception as norm_err:
            print(f"Error al ejecutar normalización de closers: {norm_err}")

        # 4. Ajustar secuencias en PostgreSQL si el destino es PostgreSQL
        if db.engine.dialect.name == 'postgresql':
            print("Ajustando secuencias autonumeradas en PostgreSQL...")
            for model in modelos:
                try:
                    table_name = model.__tablename__
                    db.session.execute(db.text(
                        f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), COALESCE(MAX(id), 1)) FROM {table_name}"
                    ))
                    db.session.commit()
                except Exception:
                    db.session.rollback()
            print("Secuencias de PostgreSQL sincronizadas.")

        print("--- Proceso finalizado con éxito ---")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Actualizar base de datos desde Producción hacia Local o Staging.")
    parser.add_argument('--target', choices=['local', 'staging', 'testing'], default='local', 
                        help="Destino de la copia: 'local' (por defecto) o 'staging' (Railway Testing)")
    args = parser.parse_args()
    actualizar(target=args.target)
