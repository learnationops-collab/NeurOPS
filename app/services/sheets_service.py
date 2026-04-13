import requests
from datetime import datetime
from dateutil import parser
from app import db
from app.models.financial import FinancialAgenda, FinancialSale
import logging

logger = logging.getLogger(__name__)

class SheetsService:
    BASE_URL = "https://script.google.com/macros/s/AKfycbwoEQS0LeqUPzLnv06XKP2uTZpb72YigRnc21e4xB_2WSlWZQI_8pQ3RDUaesWzP4Qj/exec"

    @staticmethod
    def sync_from_sheets(tabla):
        """
        Lectura (GET): Borra por completo los datos locales y reconstruye la tabla.
        Maneja redireccionamientos 302 automáticamente con requests.
        """
        try:
            params = {"tabla": tabla}
            # allow_redirects=True is default in requests
            response = requests.get(SheetsService.BASE_URL, params=params, timeout=30)
            
            if response.status_code != 200:
                logger.error(f"[SHEETS SYNC] Error en respuesta: {response.status_code} - {response.text}")
                return {"status": "error", "message": f"Error del servidor: {response.status_code}"}

            data = response.json()
            if not isinstance(data, list):
                logger.error(f"[SHEETS SYNC] Formato de respuesta no es lista: {data}")
                return {"status": "error", "message": "Formato de datos inválido en la respuesta"}

            if tabla == "Agendas_DB":
                SheetsService._rebuild_agendas(data)
            elif tabla == "Ventas_DB":
                SheetsService._rebuild_sales(data)
            else:
                return {"status": "error", "message": "Tabla no reconocida"}

            return {"status": "success", "count": len(data)}

        except Exception as e:
            logger.error(f"[SHEETS SYNC] Excepción durante sincronización ({tabla}): {str(e)}")
            return {"status": "error", "message": str(e)}

    @staticmethod
    def post_to_sheets(tabla, payload):
        """
        Escritura (POST): Envía datos y si tiene éxito, dispara un GET.
        """
        try:
            # Google Apps Script prefiere que el payload vaya como JSON
            # y que el parámetro 'tabla' se pase en la URL o en el body
            response = requests.post(f"{SheetsService.BASE_URL}?tabla={tabla}", json=payload, timeout=30)

            if response.status_code in (200, 201, 302):
                # Disparar sincronización automática para refrescar localmente
                SheetsService.sync_from_sheets(tabla)
                return {"status": "success", "message": "Datos enviados y sincronizados"}
            
            logger.error(f"[SHEETS POST] Error en respuesta: {response.status_code} - {response.text}")
            return {"status": "error", "message": f"Error al enviar datos: {response.status_code}"}

        except Exception as e:
            logger.error(f"[SHEETS POST] Excepción during POST ({tabla}): {str(e)}")
            return {"status": "error", "message": str(e)}

    @staticmethod
    def _rebuild_agendas(data_list):
        try:
            # Borrar todo
            db.session.query(FinancialAgenda).delete()
            
            for item in data_list:
                # Mapeo flexible de campos (Sheets a DB)
                agenda = FinancialAgenda(
                    nombre=item.get('nombre'),
                    registro=str(item.get('registro', '')),
                    fecha_meet=str(item.get('fecha_meet', '')),
                    whatsapp=item.get('whatsapp'),
                    zona_geografica=item.get('zona_geografica'),
                    closer=item.get('closer'),
                    lead=item.get('lead'),
                    mail=item.get('mail'),
                    instagram=item.get('instagram'),
                    date=SheetsService._parse_date(item.get('fecha_meet') or item.get('registro')),
                    raw_data=item
                )
                db.session.add(agenda)
            
            db.session.commit()
            logger.info(f"[SHEETS SYNC] Agendas_DB reconstruida con {len(data_list)} registros.")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def _rebuild_sales(data_list):
        try:
            # Borrar todo
            db.session.query(FinancialSale).delete()
            
            for item in data_list:
                # Mapeo flexible de campos (Sheets a DB)
                sale = FinancialSale(
                    email_vendedor=item.get('email_vendedor'),
                    nombre_cliente=item.get('nombre_cliente'),
                    telefono=item.get('telefono'),
                    mail_cliente=item.get('mail_cliente'),
                    tipo_pago=item.get('tipo_pago'),
                    monto=SheetsService._parse_float(item.get('monto')),
                    segundo_pago=item.get('segundo_pago'),
                    metodo_pago=item.get('metodo_pago'),
                    examen=item.get('examen'),
                    instagram=item.get('instagram'),
                    setter=item.get('setter'),
                    date=SheetsService._parse_date(item.get('fecha_venta') or item.get('date') or item.get('fecha')),
                    raw_data=item
                )
                db.session.add(sale)
            
            db.session.commit()
            logger.info(f"[SHEETS SYNC] Ventas_DB reconstruida con {len(data_list)} registros.")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def _parse_date(val):
        if not val: return datetime.utcnow()
        try:
            return parser.parse(str(val))
        except:
            return datetime.utcnow()

    @staticmethod
    def _parse_float(val):
        if val is None or val == '': return 0.0
        try:
            if isinstance(val, str):
                # Limpiar caracteres de moneda si existen
                val = val.replace('$', '').replace(',', '').strip()
            return float(val)
        except (ValueError, TypeError):
            return 0.0
