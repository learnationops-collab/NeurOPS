import os
import sys
import tempfile
from sqlalchemy import create_engine, inspect
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
    JobApplication, JobApplicationVote, ClarityWeight,
    AssistantApplication, AssistantClarityWeight, BugReport, BugReportMessage,
    PlaybookRoadmap, PlaybookModule, PlaybookLesson, PlaybookQuestion,
    PlaybookOption, PlaybookLessonProgress, PlaybookCompletion,
    ReporteDirector, ReporteDirectorPersona, WorkshopGoals, WorkshopAction
)

def safe(text):
    """Texto imprimible en la consola de Windows (cp1252). Los mensajes de error de SQLAlchemy
    incluyen las filas que fallaron, y ahí aparecen emojis y acentos de datos reales: sin esto
    el propio `print` del except revienta con UnicodeEncodeError y tapa el error original."""
    enc = (sys.stdout.encoding or 'utf-8')
    return str(text).encode(enc, errors='replace').decode(enc, errors='replace')


# Sin keepalives el proxy público de Railway corta las conexiones que tardan.
_KEEPALIVE = dict(keepalives=1, keepalives_idle=30, keepalives_interval=10,
                  keepalives_count=5, connect_timeout=30)


def _columnas(conn, tabla):
    with conn.cursor() as cur:
        cur.execute("SELECT column_name FROM information_schema.columns "
                    "WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
                    (tabla,))
        return [r[0] for r in cur.fetchall()]


class CopiadorPostgres:
    """Copia tablas entre dos PostgreSQL con COPY, reusando una conexión por punta.

    El camino por ORM (`query(Model).all()`) materializa la tabla entera en memoria del lado del
    cliente. Sobre el proxy público de Railway eso revienta con `server closed the connection
    unexpectedly` en cuanto la tabla es grande: el 23/09/2026 murió en landing_trackings (31k),
    manychat_leads (14k), lead_answers (15k) y financial_sales. COPY manda las filas por el
    socket sin materializarlas y con las mismas tablas no falló una sola vez.

    Las conexiones se abren una vez y se reusan. La primera versión abría un par por tabla: con
    85 tablas son 170 aperturas seguidas contra el proxy, que a mitad de camino empezó a
    rechazarlas con `timeout expired` y tumbó 9 tablas de la corrida.
    """

    def __init__(self, origen_url, destino_url):
        self.origen_url = origen_url
        self.destino_url = destino_url
        self.origen = None
        self.destino = None

    def _conectar(self):
        import psycopg2
        if self.origen is None or self.origen.closed:
            self.origen = psycopg2.connect(self.origen_url, **_KEEPALIVE)
            self.origen.set_session(readonly=True)
        if self.destino is None or self.destino.closed:
            self.destino = psycopg2.connect(self.destino_url, **_KEEPALIVE)
        return self.origen, self.destino

    def cerrar(self):
        for conn in (self.origen, self.destino):
            try:
                if conn is not None and not conn.closed:
                    conn.close()
            except Exception:
                pass
        self.origen = self.destino = None

    def copiar(self, tabla):
        """Devuelve cuántas filas quedaron en la tabla de destino."""
        import psycopg2
        # Que una conexión se haya caído entre tabla y tabla recién se descubre al usarla, así
        # que vale un reintento con conexiones nuevas antes de dar la tabla por perdida.
        for intento in (1, 2):
            try:
                return self._copiar(tabla)
            except psycopg2.Error:
                self.cerrar()
                if intento == 2:
                    raise

    def _copiar(self, tabla):
        import psycopg2
        origen, destino = self._conectar()
        try:
            cols_origen = _columnas(origen, tabla)
            cols_destino = _columnas(destino, tabla)
            # Intersección en el orden del destino: una columna que existe de un solo lado
            # (migración sin desplegar) no debe romper la copia de toda la tabla.
            cols = [c for c in cols_destino if c in cols_origen]
            if not cols:
                raise RuntimeError(f"{tabla}: sin columnas en común entre origen y destino")
            lista = ', '.join(f'"{c}"' for c in cols)

            with tempfile.TemporaryFile() as buf:
                with origen.cursor() as cur:
                    cur.copy_expert(
                        f'COPY (SELECT {lista} FROM "{tabla}") TO STDOUT WITH (FORMAT csv)', buf)
                buf.seek(0)
                with destino.cursor() as cur:
                    # Apaga los triggers de FK durante la carga, así el orden entre tablas deja
                    # de importar. El rol `postgres` de Railway puede; si no, se sigue igual y el
                    # orden de `modelos` (ya ordenado por dependencias) alcanza.
                    try:
                        cur.execute("SET session_replication_role = replica")
                    except psycopg2.Error:
                        destino.rollback()
                    # El borrado va en la misma transacción que la carga: si la copia falla, el
                    # rollback devuelve la tabla a como estaba en vez de dejarla vacía.
                    cur.execute(f'DELETE FROM "{tabla}"')
                    cur.copy_expert(f'COPY "{tabla}" ({lista}) FROM STDIN WITH (FORMAT csv)', buf)
                destino.commit()

            with destino.cursor() as cur:
                cur.execute(f'SELECT COUNT(*) FROM "{tabla}"')
                return cur.fetchone()[0]
        except Exception:
            try:
                destino.rollback()
            except Exception:
                pass
            raise


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
            AssistantClarityWeight, PlaybookRoadmap, WorkshopGoals,

            # Dependencia Nivel 1
            Event, WorkshopButton, PipelineStage, Client, AdSet,
            MarketingBudget, PublicRegistration, GoogleCalendarToken, UTMLog,
            Availability, WeeklyAvailability, Alert, CloserAlias, FeatureToggle,
            JobApplicationVote,
            AssistantApplication, BugReport, PlaybookModule, WorkshopAction,
            ReporteDirector,

            # Dependencia Nivel 2
            Lead, Ad, WorkshopTemplateSent, UserViewSetting,
            SurveyQuestion, ClientComment, MonthlyPayroll,
            ClientMergeLog, WorkshopLead,
            BugReportMessage, PlaybookLesson, ReporteDirectorPersona,

            # Dependencia Nivel 3
            Appointment, Enrollment, AdPeriodSpend, LeadAnswer,
            WorkshopInteraction, SetterDailyStats, CloserDailyStats,
            CloserDailyReport, TriageDailyReport, TriageTrackerReport,
            FinancialSale, FinancialAgenda, LeadEventLog, LandingSession,
            PlaybookQuestion, PlaybookLessonProgress, PlaybookCompletion,

            # Dependencia Nivel 4
            Payment, SurveyAnswer, Notification, Comment, DailyReportAnswer,
            InstallmentPlan, CommentNotification,
            PlaybookOption
        ]

        # Solo se toca lo que se va a poder copiar. La limpieza y la copia eran dos pasos
        # independientes, así que una tabla que existe en el destino pero todavía no en
        # producción (una migración desplegada acá y no allá) se vaciaba en el paso 1 y en el
        # paso 2 fallaba con "no existe": la tabla quedaba vacía y nadie la volvía a llenar.
        tablas_prod = set(inspect(prod_engine).get_table_names())
        ausentes = [m.__tablename__ for m in modelos if m.__tablename__ not in tablas_prod]
        if ausentes:
            print(f"Omitidas (no existen en producción, se dejan intactas): {', '.join(ausentes)}")
            modelos = [m for m in modelos if m.__tablename__ in tablas_prod]

        # Con COPY, cada tabla se borra y se recarga dentro de una sola transacción, así que la
        # limpieza global previa sobra — y además es justo la que deja tablas vacías cuando la
        # copia posterior falla.
        usar_copy = db.engine.dialect.name == 'postgresql'
        copiador = CopiadorPostgres(
            prod_url, db.engine.url.render_as_string(hide_password=False)) if usar_copy else None

        # 1. Limpiar datos locales en orden inverso para evitar violaciones de FK
        if not usar_copy:
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
            # solo el que falló. Con una tabla inexistente en local (una migración sin aplicar,
            # por ejemplo) el borrado quedaba a medias y la copia posterior moría con UNIQUE
            # constraint sobre tablas que ya se creían vacías.
            for model in reversed(modelos):
                try:
                    db.session.query(model).delete()
                    db.session.commit()
                except Exception as e:
                    db.session.rollback()
                    print(safe(f"Advertencia al limpiar {model.__tablename__}: {e}"))
            print("Limpieza de modelos completada.")

        # 2a. Destino PostgreSQL: COPY por tabla, cada una en su propia transacción.
        if usar_copy:
            for model in modelos:
                tabla = model.__tablename__
                print(f"Sincronizando {tabla}...", end=" ", flush=True)
                try:
                    print(f"Ok ({copiador.copiar(tabla)} registros)")
                except Exception as e:
                    fallos.append((tabla, safe(e)))
                    print(safe(f"Error: {e}"))

        # 2b. Destino SQLite: no hay COPY, se copia por ORM.
        for model in (() if usar_copy else modelos):
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

        # Sincronizar event_closers (tabla de asociación Many-to-Many, no tiene modelo propio)
        try:
            print("Sincronizando event_closers...", end=" ", flush=True)
            if usar_copy:
                print(f"Ok ({copiador.copiar('event_closers')} registros)")
            else:
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
        if copiador is not None:
            copiador.cerrar()
        
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
