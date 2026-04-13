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

            if tabla == "Llamadas_DB":
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
            db.session.query(FinancialAgenda).delete()
            for item in data_list:
                agenda = FinancialAgenda(
                    nombre=SheetsService._get_val(item, 'nombre'),
                    registro=str(SheetsService._get_val(item, 'registro') or ''),
                    fecha_meet=str(SheetsService._get_val(item, 'fecha_meet') or ''),
                    whatsapp=SheetsService._get_val(item, 'whatsapp'),
                    zona_geografica=SheetsService._get_val(item, 'zona_geografica'),
                    closer=SheetsService._get_val(item, 'closer'),
                    lead=SheetsService._get_val(item, 'lead'),
                    mail=SheetsService._get_val(item, 'mail'),
                    instagram=SheetsService._get_val(item, 'instagram'),
                    date=SheetsService._parse_date(SheetsService._get_val(item, 'fecha_meet') or SheetsService._get_val(item, 'registro')),
                    raw_data=item
                )
                db.session.add(agenda)
            db.session.commit()
            logger.info(f"[SHEETS SYNC] Llamadas_DB reconstruida con {len(data_list)} registros.")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def _rebuild_sales(data_list):
        try:
            db.session.query(FinancialSale).delete()
            for item in data_list:
                sale = FinancialSale(
                    email_vendedor=SheetsService._get_val(item, 'email_vendedor'),
                    nombre_cliente=SheetsService._get_val(item, 'nombre_cliente'),
                    telefono=SheetsService._get_val(item, 'telefono'),
                    mail_cliente=SheetsService._get_val(item, 'mail_cliente'),
                    tipo_pago=SheetsService._get_val(item, 'tipo_pago'),
                    monto=SheetsService._parse_float(SheetsService._get_val(item, 'monto')),
                    segundo_pago=SheetsService._get_val(item, 'segundo_pago'),
                    metodo_pago=SheetsService._get_val(item, 'metodo_pago'),
                    examen=SheetsService._get_val(item, 'examen'),
                    instagram=SheetsService._get_val(item, 'instagram'),
                    setter=SheetsService._get_val(item, 'setter'),
                    date=SheetsService._parse_date(SheetsService._get_val(item, 'fecha_venta') or SheetsService._get_val(item, 'date') or SheetsService._get_val(item, 'fecha') or SheetsService._get_val(item, 'marca_temporal')),
                    raw_data=item
                )
                db.session.add(sale)
            db.session.commit()
            logger.info(f"[SHEETS SYNC] Ventas_DB reconstruida con {len(data_list)} registros.")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def _get_val(item, key):
        if not item or not isinstance(item, dict): return None
        if key in item: return item[key]
        key_lower = key.lower()
        for k in item.keys():
            if k.lower() == key_lower:
                return item[k]
        return None

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
