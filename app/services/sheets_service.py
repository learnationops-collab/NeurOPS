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
            objects = []
            for idx, item in enumerate(data_list):
                try:
                    agenda = FinancialAgenda(
                        nombre=SheetsService._to_str(item.get('nombre')),
                        registro=SheetsService._to_str(item.get('registro')),
                        fecha_meet=SheetsService._to_str(item.get('fecha_meet')),
                        whatsapp=SheetsService._to_str(item.get('whatsapp')),
                        zona_geografica=SheetsService._to_str(item.get('zona_geografica')),
                        closer=SheetsService._to_str(item.get('closer')),
                        lead=SheetsService._to_str(item.get('lead')),
                        mail=SheetsService._to_str(item.get('mail')),
                        instagram=SheetsService._to_str(item.get('instagram')),
                        date=SheetsService._parse_date(item.get('fecha_meet') or item.get('registro')),
                        raw_data=item
                    )
                    objects.append(agenda)
                except Exception as row_err:
                    logger.warning(f"[SHEETS SYNC] Fila agenda {idx} omitida: {row_err}")
            db.session.add_all(objects)
            db.session.commit()
            logger.info(f"[SHEETS SYNC] Llamadas_DB reconstruida: {len(objects)}/{len(data_list)} registros.")
        except Exception as e:
            db.session.rollback()
            raise e

    @staticmethod
    def _rebuild_sales(data_list):
        try:
            db.session.query(FinancialSale).delete()
            objects = []
            for idx, item in enumerate(data_list):
                try:
                    sale = FinancialSale(
                        email_vendedor=SheetsService._to_str(item.get('email_vendedor')),
                        nombre_cliente=SheetsService._to_str(item.get('nombre_cliente')),
                        telefono=SheetsService._to_str(item.get('telefono')),
                        mail_cliente=SheetsService._to_str(item.get('mail_cliente')),
                        tipo_pago=SheetsService._to_str(item.get('tipo_pago')),
                        monto=SheetsService._parse_float(item.get('monto')),
                        segundo_pago=SheetsService._to_str(item.get('segundo_pago')),
                        metodo_pago=SheetsService._to_str(item.get('metodo_pago')),
                        examen=SheetsService._to_str(item.get('examen')),
                        instagram=SheetsService._to_str(item.get('instagram')),
                        setter=SheetsService._to_str(item.get('estado')), # Columna M en Sheets
                        marca_temporal=SheetsService._to_str(item.get('marca_temporal')),
                        estado=SheetsService._to_str(item.get('setter') or item.get('status')) or "Completada", # Columna L en Sheets
                        date=SheetsService._parse_date(item.get('marca_temporal')),
                        raw_data=item
                    )
                    objects.append(sale)
                except Exception as row_err:
                    logger.warning(f"[SHEETS SYNC] Fila venta {idx} omitida: {row_err}")
            db.session.add_all(objects)
            db.session.commit()

            # Sincronizar el examen de las ventas a los Appointment locales correspondientes
            try:
                from app.models.booking import Appointment
                from app.models.client import Client
                from sqlalchemy import or_
                
                for sale in objects:
                    if sale.examen:
                        # Limpiar el examen (extraer la parte antes del pipe si está combinado con notas)
                        examen_clean = sale.examen.split('|')[0].strip() if '|' in sale.examen else sale.examen.strip()
                        if not examen_clean:
                            continue
                            
                        # Buscar el cliente por instagram o email
                        ig_norm = sale.instagram.strip().lstrip('@').lower() if sale.instagram else None
                        email_norm = sale.mail_cliente.strip().lower() if sale.mail_cliente else None
                        
                        client = None
                        if ig_norm or email_norm:
                            client_filters = []
                            if ig_norm:
                                client_filters.append(db.func.lower(db.func.replace(Client.instagram, '@', '')) == ig_norm)
                            if email_norm:
                                client_filters.append(db.func.lower(Client.email) == email_norm)
                            client = Client.query.filter(or_(*client_filters)).first()
                            
                        if client:
                            # Buscar su cita más reciente
                            appt = Appointment.query.filter_by(client_id=client.id).order_by(Appointment.start_time.desc()).first()
                            if appt:
                                appt.examen = examen_clean
                db.session.commit()
            except Exception as sync_err:
                logger.warning(f"[SHEETS SYNC] Error al propagar exámenes a las agendas: {sync_err}")

            logger.info(f"[SHEETS SYNC] Ventas_DB reconstruida: {len(objects)}/{len(data_list)} registros.")
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
    def _to_str(val, max_len=150):
        """Convierte a string y trunca para evitar que Postgres rechace el registro si es muy largo."""
        if val is None: return None
        s = str(val).strip()
        if not s: return None
        return s[:max_len]

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
