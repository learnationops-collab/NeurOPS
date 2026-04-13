import requests
from datetime import datetime
from dateutil import parser
from app import db
from app.models.financial import FinancialAgenda, FinancialSale
import logging

logger = logging.getLogger(__name__)

class SheetsService:
    BASE_URL = "https://script.google.com/macros/s/AKfycbx5Dedw8MTavNQbzgpdWLmRyFPIVeDiuaKIB-j6NsaIS1wbegR4xpHq8BXs-QR2_Fr_/exec"

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
            # El nuevo Apps Script espera { "tabla": "...", "datos": { ... } }
            body = {"tabla": tabla, "datos": payload}
            response = requests.post(SheetsService.BASE_URL, json=body, timeout=30)

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
            for idx, item in enumerate(data_list):
                try:
                    agenda = FinancialAgenda(
                        nombre=SheetsService._to_str(SheetsService._get_val(item, 'nombre')),
                        registro=SheetsService._to_str(SheetsService._get_val(item, 'registro')),
                        fecha_meet=SheetsService._to_str(SheetsService._get_val(item, 'fecha_meet')),
                        whatsapp=SheetsService._to_str(SheetsService._get_val(item, 'whatsapp')),
                        zona_geografica=SheetsService._to_str(SheetsService._get_val(item, 'zona_geografica')),
                        closer=SheetsService._to_str(SheetsService._get_val(item, 'closer')),
                        lead=SheetsService._to_str(SheetsService._get_val(item, 'lead')),
                        mail=SheetsService._to_str(SheetsService._get_val(item, 'mail')),
                        instagram=SheetsService._to_str(SheetsService._get_val(item, 'instagram')),
                        date=SheetsService._parse_date(
                            SheetsService._get_val(item, 'fecha_meet') or
                            SheetsService._get_val(item, 'registro')
                        ),
                        raw_data=item
                    )
                    db.session.add(agenda)
                except Exception as row_err:
                    logger.error(f"[SHEETS SYNC] Error en fila agenda {idx}: {row_err} - Data: {item}")
                    continue
            db.session.commit()
            logger.info(f"[SHEETS SYNC] Llamadas_DB reconstruida con {len(data_list)} registros.")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def _rebuild_sales(data_list):
        try:
            db.session.query(FinancialSale).delete()
            for idx, item in enumerate(data_list):
                try:
                    # Sanitizar todos los campos a string antes de insertarlos
                    sale = FinancialSale(
                        email_vendedor=SheetsService._to_str(SheetsService._get_val(item, 'email_vendedor')),
                        nombre_cliente=SheetsService._to_str(SheetsService._get_val(item, 'nombre_cliente')),
                        telefono=SheetsService._to_str(SheetsService._get_val(item, 'telefono')),
                        mail_cliente=SheetsService._to_str(SheetsService._get_val(item, 'mail_cliente')),
                        tipo_pago=SheetsService._to_str(SheetsService._get_val(item, 'tipo_pago')),
                        monto=SheetsService._parse_float(SheetsService._get_val(item, 'monto')),
                        segundo_pago=SheetsService._to_str(SheetsService._get_val(item, 'segundo_pago')),
                        metodo_pago=SheetsService._to_str(SheetsService._get_val(item, 'metodo_pago')),
                        examen=SheetsService._to_str(SheetsService._get_val(item, 'examen')),
                        instagram=SheetsService._to_str(SheetsService._get_val(item, 'instagram')),
                        setter=SheetsService._to_str(SheetsService._get_val(item, 'setter')),
                        date=SheetsService._parse_date(
                            SheetsService._get_val(item, 'fecha_venta') or
                            SheetsService._get_val(item, 'date') or
                            SheetsService._get_val(item, 'fecha') or
                            SheetsService._get_val(item, 'marca_temporal')
                        ),
                        raw_data=item
                    )
                    db.session.add(sale)
                except Exception as row_err:
                    logger.error(f"[SHEETS SYNC] Error en fila {idx}: {row_err} - Data: {item}")
                    continue
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
    def _to_str(val):
        """Convierte cualquier valor a string para evitar errores de tipo en PostgreSQL."""
        if val is None: return None
        s = str(val).strip()
        return s if s else None

    @staticmethod
    def _parse_date(val):
        if not val: return datetime.utcnow()
        try:
            return parser.parse(str(val))
        except:
            return datetime.utcnow()

    @staticmethod
    def _parse_float(val):
        """Convierte valores de Sheets a float de forma robusta."""
        if val is None: return 0.0
        s_val = str(val).strip()
        if not s_val or s_val.lower() in ('n/a', 'nan', 'null', '-'): return 0.0
        
        try:
            # 1. Limpieza inicial: quitar símbolo de moneda
            s_val = s_val.replace('$', '').strip()
            
            # 2. Manejo de formatos internacionales (1.500,00 vs 1,500.00)
            if ',' in s_val and '.' in s_val:
                # Caso con ambos separadores
                if s_val.find('.') < s_val.find(','):
                    # Formato europeo/latam: 1.500,25 -> 1500.25
                    s_val = s_val.replace('.', '').replace(',', '.')
                else:
                    # Formato standard: 1,500.25 -> 1500.25
                    s_val = s_val.replace(',', '')
            elif ',' in s_val:
                # Solo coma: usualmente es el decimal en Latam, pero podría ser miles en US.
                # Si hay más de un dígito tras la coma, la tratamos como decimal.
                # EXCEPTO si hay exactamente 3 dígitos tras la coma y nada antes del punto? No.
                # Regla general segura para este proyecto: coma -> punto.
                s_val = s_val.replace(',', '.')
            elif '.' in s_val:
                # Solo punto: usualmente decimal. 
                # Pero si es algo como "1.500", podría ser mil.
                parts = s_val.split('.')
                if len(parts) == 2 and len(parts[1]) == 3:
                    # Es altamente probable que sea separador de miles (ej: 1.200)
                    # si no hay decimales. Si fuera decimal sería 1.2 o 1.20.
                    # En contexto de ventas, 1.200 es más probable que 1.2
                    s_val = s_val.replace('.', '')

            return float(s_val)
        except (ValueError, TypeError):
            return 0.0
