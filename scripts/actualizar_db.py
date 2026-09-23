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

# BUG real encontrado (27/ago/2026): `config.py` calcula `SQLALCHEMY_DATABASE_URI` a nivel de
# módulo, en el momento en que se importa por primera vez — no en el momento en que Flask arma
# la app. `from app import create_app, db`, más abajo, dispara esa primera importación de
# `config.py` ANTES de que `actualizar()` llegue a pisar `DATABASE_URL` con el destino elegido
# (`--target staging`). Resultado: `--target staging` siempre terminaba escribiendo sobre la
# SQLite local, sin avisar. Se resuelve el target acá arriba, antes de cualquier import de `app`,
# para que `DATABASE_URL` ya tenga el valor correcto cuando `config.py` lo lea por primera vez.
load_dotenv()
_target_arg = 'local'
for _i, _a in enumerate(sys.argv):
    if _a == '--target' and _i + 1 < len(sys.argv):
        _target_arg = sys.argv[_i + 1]
    elif _a.startswith('--target='):
        _target_arg = _a.split('=', 1)[1]
if _target_arg in ('staging', 'testing'):
    _dest_url = os.getenv('DATABASE_STAGING') or os.getenv('DATABASE_TESTING')
    if _dest_url:
        os.environ['DATABASE_URL'] = _dest_url

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
    FeatureToggle, InstallmentPlan, LandingSession, WorkshopEvent, WorkshopLead,
    JobApplication, JobApplicationVote, ClarityWeight
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
        return False

    if target in ('staging', 'testing'):
        dest_url = os.getenv('DATABASE_STAGING') or os.getenv('DATABASE_TESTING')
        if not dest_url:
            print("Error: Configura DATABASE_STAGING en tu archivo .env con la URL de Postgres de Railway Testing.")
            return False
        os.environ['DATABASE_URL'] = dest_url
        target_name = "Railway Staging (PostgreSQL)"
    else:
        target_name = "Local (SQLite)"

    # Cada tabla que no se pudo copiar. El script solía terminar SIEMPRE con "finalizado con
    # éxito" aunque el bucle de copia hubiera impreso un `Error:` por tabla, así que una corrida
    # que dejó siete tablas vacías se leía igual que una corrida perfecta (pasó el 23/09/2026
    # contra staging). Ahora los fallos se juntan acá, se listan al final y el proceso sale con
    # código distinto de cero.
    fallos = []

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
            WorkshopEvent, JobApplication, ClarityWeight,

            # Dependencia Nivel 1
            Event, WorkshopButton, PipelineStage, Client, AdSet,
            MarketingBudget, PublicRegistration, GoogleCalendarToken, UTMLog,
            Availability, WeeklyAvailability, Alert, CloserAlias, FeatureToggle,
            JobApplicationVote,

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
                # BUG real encontrado (27/ago/2026, causó una pérdida real de datos en testing):
                # la lectura que falla es la de `prod_session` (línea de arriba), no la de
                # `db.session` — pero acá solo se hacía rollback del destino. Una vez que
                # `prod_session` queda en transacción abortada (típico: el modelo local tiene una
                # columna nueva que producción todavía no tiene, por una migración pendiente de
                # desplegar ahí), TODAS las consultas siguientes contra `prod_session` fallan
                # igual — así que cada modelo restante del bucle "falla" con el mismo error,
                # sin copiar nada. Como la limpieza (paso 1) ya había borrado esas tablas del
                # destino, el resultado neto es que quedan completamente vacías sin avisar de
                # forma obvia (el log sigue imprimiendo "Error: ..." por cada una, pero es fácil
                # no leerlos todos). Sin este rollback, un solo desfasaje de esquema entre local
                # y producción podía vaciar en cascada todos los modelos sincronizados después.
                try:
                    prod_session.rollback()
                except Exception:
                    pass
                fallos.append((model.__tablename__, safe(e)))
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
            fallos.append(('event_closers', safe(e)))
            print(f"Error al sincronizar event_closers: {e}")

        # Contraste final contra producción: el log por tabla puede mentir por omisión (una tabla
        # que se limpió y después falló al copiar imprime su error, pero es fácil no leerlo entre
        # ochenta líneas). Acá se compara fila a fila y se marca como fallo toda tabla que quedó
        # vacía teniendo datos en producción.
        print("Verificando la copia contra producción...")
        for model in modelos:
            tabla = model.__tablename__
            try:
                n_prod = prod_session.query(model).count()
                n_dest = db.session.query(model).count()
            except Exception as e:
                prod_session.rollback()
                db.session.rollback()
                fallos.append((tabla, f"no se pudo verificar: {safe(e)}"))
                continue
            if n_prod and not n_dest:
                fallos.append((tabla, f"quedó VACÍA (producción tiene {n_prod})"))
            elif n_dest < n_prod:
                # Producción sigue recibiendo datos mientras corre la copia, así que un faltante
                # de unas pocas filas es deriva normal, no un fallo.
                print(f"  {tabla}: {n_dest} de {n_prod} (faltan {n_prod - n_dest}, deriva en vivo)")

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

        if fallos:
            print(f"--- Proceso finalizado CON {len(fallos)} ERROR(ES) ---")
            for tabla, err in fallos:
                print(f"  {tabla}: {err}")
            print("La base de destino NO es una copia fiel de producción. Revisá las tablas de arriba.")
            return False

        print("--- Proceso finalizado con éxito ---")
        return True

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Actualizar base de datos desde Producción hacia Local o Staging.")
    parser.add_argument('--target', choices=['local', 'staging', 'testing'], default='local',
                        help="Destino de la copia: 'local' (por defecto) o 'staging' (Railway Testing)")
    args = parser.parse_args()
    sys.exit(0 if actualizar(target=args.target) else 1)
