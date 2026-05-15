import os
import sys
import logging

# Añadir el directorio raíz al path para importar la app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app
from app.services.sheets_service import SheetsService

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('SyncCron')

def main():
    app = create_app()
    with app.app_context():
        logger.info("--- Iniciando sincronización programada de Google Sheets ---")
        
        # Sincronizar Ventas
        try:
            res_ventas = SheetsService.sync_from_sheets('Ventas_DB')
            if res_ventas.get('status') == 'success':
                logger.info(f"Ventas_DB sincronizada: {res_ventas.get('message')}")
            else:
                logger.error(f"Error sincronizando Ventas_DB: {res_ventas.get('message')}")
        except Exception as e:
            logger.error(f"Excepción sincronizando Ventas_DB: {e}")

        # Sincronizar Agendas (Llamadas_DB)
        try:
            res_agendas = SheetsService.sync_from_sheets('Llamadas_DB')
            if res_agendas.get('status') == 'success':
                logger.info(f"Llamadas_DB (Agendas) sincronizada: {res_agendas.get('message')}")
            else:
                logger.error(f"Error sincronizando Llamadas_DB: {res_agendas.get('message')}")
        except Exception as e:
            logger.error(f"Excepción sincronizando Llamadas_DB: {e}")
            
        logger.info("--- Sincronización finalizada ---")

if __name__ == "__main__":
    main()
