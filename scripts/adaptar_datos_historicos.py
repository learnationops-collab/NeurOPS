import os
import sys
from dotenv import load_dotenv

# Asegurar que la raíz del proyecto esté en el path y cargar variables de entorno
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
load_dotenv()

# Redirecciona DATABASE_URL a la base de datos de producción si se detecta DATABASE_PRODUCTION
prod_db_url = os.environ.get('DATABASE_PRODUCTION')
if prod_db_url:
    os.environ['DATABASE_URL'] = prod_db_url
    print("--> CONEXIÓN REMOTA ACTIVA: Conectando a la base de datos de PRODUCCIÓN (PostgreSQL)...")
else:
    # En producción (Railway), DATABASE_URL ya viene inyectada directamente por el sistema operativo
    print("--> Conectando a la base de datos configurada (DATABASE_URL)...")

from app import create_app, db
from app.models import LeadAnswer

def execute_migration():
    app = create_app()
    with app.app_context():
        print("--- INICIANDO MIGRACIÓN DE ADAPTACIÓN HISTÓRICA CONVERSACIONAL ---")
        
        # Consultamos los registros que carecen de identificador conversacional
        answers = LeadAnswer.query.filter(
            (LeadAnswer.id_option_send == None) | (LeadAnswer.id_option_send == ''),
            (LeadAnswer.id_option == None) | (LeadAnswer.id_option == '')
        ).all()
        
        total_to_migrate = len(answers)
        print(f"Total registros detectados para adaptar: {total_to_migrate}")
        
        if total_to_migrate == 0:
            print("No hay registros huérfanos que requieran migración.")
            return

        modified_count = 0
        for ans in answers:
            # Mapeo inteligente en base a la cualificación conversacional del lead
            if ans.qualification == 'true':
                ans.id_option_send = "1"
                ans.id_option = "1"
            elif ans.qualification == 'false':
                ans.id_option_send = "1"
                ans.id_option = "1"
            else:  # 'null' o vacíos
                ans.id_option_send = "1"
                ans.id_option = None
            modified_count += 1
            
        try:
            print("Guardando cambios de forma transaccional en la base de datos...")
            db.session.commit()
            print("¡MIGRACIÓN COMPLETADA EXITOSAMENTE!")
            print(f"Se adaptaron {modified_count} registros históricos de LeadAnswer con éxito.")
        except Exception as e:
            db.session.rollback()
            print(f"ERROR DURANTE LA MIGRACIÓN: {e}")

if __name__ == "__main__":
    execute_migration()
