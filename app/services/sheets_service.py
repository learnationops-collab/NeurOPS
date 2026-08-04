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
    def sync_from_sheets(tabla, force=False):
        """
        Lectura (GET): Borra por completo los datos locales y reconstruye la tabla.
        Maneja redireccionamientos 302 automáticamente con requests.
        """
        if tabla == "Ventas_DB" and not force:
            return {"status": "disabled", "message": "La sincronización destructiva desde Google Sheets ha sido deshabilitada en favor de la base de datos local permanente."}

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
        Escritura (POST): Envía datos con acción 'insert', los guarda localmente y los propaga a Google Sheets.
        """
        # Si es Ventas_DB, guardamos en la base de datos local de forma inmediata
        if tabla == "Ventas_DB":
            try:
                from app.models.financial import FinancialSale
                from datetime import datetime
                
                sale_date = datetime.utcnow()
                marca_temp = payload.get('marca_temporal')
                if marca_temp:
                    sale_date = SheetsService._parse_date(marca_temp)
                    
                sale = FinancialSale(
                    email_vendedor=SheetsService._to_str(payload.get('email_vendedor')),
                    nombre_cliente=SheetsService._to_str(payload.get('nombre_cliente')),
                    telefono=SheetsService._to_str(payload.get('telefono')),
                    mail_cliente=SheetsService._to_str(payload.get('mail_cliente')),
                    tipo_pago=SheetsService._to_str(payload.get('tipo_pago')),
                    monto=SheetsService._parse_float(payload.get('monto')),
                    segundo_pago=SheetsService._to_str(payload.get('segundo_pago')),
                    metodo_pago=SheetsService._to_str(payload.get('metodo_pago')),
                    examen=SheetsService._to_str(payload.get('examen')),
                    instagram=SheetsService._to_str(payload.get('instagram')),
                    setter=SheetsService._to_str(payload.get('setter')),
                    marca_temporal=SheetsService._to_str(marca_temp),
                    estado="Completada" if (payload.get('estado') or 'Completada').strip().lower() in ('completada', 'confirmada') else (payload.get('estado') or 'Completada'),
                    sold_in_call=payload.get('sold_in_call') == True or payload.get('sold_in_call') in ('true', 'True', '1', 1),
                    date=sale_date
                )
                db.session.add(sale)
                db.session.commit()
                logger.info("[SHEETS POST] Venta registrada exitosamente en base de datos local.")
                
                # Verificar conversión de seña a venta real
                try:
                    from app.services.closer_service import CloserService
                    tipo_pago_val = payload.get('tipo_pago') or ''
                    client_data = {
                        'email': payload.get('mail_cliente'),
                        'phone': payload.get('telefono'),
                        'instagram': payload.get('instagram'),
                        'name': payload.get('nombre_cliente')
                    }
                    sale_data = {
                        'payment_type': tipo_pago_val,
                        'payment_type_friendly': tipo_pago_val,
                        'amount': float(payload.get('monto') or 0.0),
                        'closer_name': payload.get('email_vendedor') or payload.get('setter') or 'N/A',
                        'program_name': tipo_pago_val.split(' - ')[0] if ' - ' in str(tipo_pago_val) else tipo_pago_val,
                        'financial_sale_id': sale.id
                    }
                    CloserService.check_and_notify_down_payment_conversion(client_data, sale_data)
                except Exception as conv_err:
                    logger.error(f"[Down Payment Conversion Sheets Hook Error] {conv_err}")

                # Reflejar la venta también en Enrollment/Payment (sistema de cuotas/inscripciones),
                # que "Declarar Venta" no tocaba pese a ser lo que alimenta el dashboard personal
                # del closer dentro de su propio mazo. FinancialSale sigue siendo la fuente de las
                # métricas de admin (no se toca esa ruta); esto es un espejo, no un reemplazo.
                try:
                    SheetsService._sync_enrollment_payment(payload, sale)
                except Exception as sync_err:
                    logger.error(f"[Enrollment/Payment Sync Error] {sync_err}")

                # Enviar webhook a n8n en segundo plano si está activo
                enviar_webhook = payload.get('enviar_webhook', True)
                if enviar_webhook in (True, 'true', 'True', 1, '1', 'on'):
                    SheetsService._trigger_n8n_webhook(payload)
                else:
                    logger.info("[N8N WEBHOOK] Envío omitido por petición del usuario/payload.")
            except Exception as db_err:
                db.session.rollback()
                logger.error(f"[SHEETS POST] Error al guardar venta local: {db_err}")
                return {"status": "error", "message": f"Error local de base de datos: {str(db_err)}"}

        try:
            body = {"accion": "insert", "tabla": tabla, "datos": payload}
            response = requests.post(SheetsService.BASE_URL, json=body, timeout=30)

            if response.status_code in (200, 201, 302):
                return {"status": "success", "message": "Venta registrada localmente y en Google Sheets"}
            
            logger.error(f"[SHEETS POST] Error en respuesta: {response.status_code} - {response.text}")
            return {"status": "success", "message": "Venta registrada localmente, pero falló el envío a Google Sheets."}

        except Exception as e:
            logger.error(f"[SHEETS POST] Excepción during POST ({tabla}): {str(e)}")
            return {"status": "success", "message": "Venta registrada localmente. Google Sheets inaccesible."}

    @staticmethod
    def _sync_enrollment_payment(payload, sale):
        """Refleja una venta de 'Ventas_DB' (ya guardada como FinancialSale) también en
        Enrollment/Payment, para que el dashboard personal del closer (que lee de ahí, no de
        FinancialSale) y el sistema de cuotas queden consistentes con lo que el closer declaró.
        No falla la venta si algo acá no encaja (programa/closer no resuelto): FinancialSale ya
        quedó guardado, que es lo que de verdad importa para las métricas de admin."""
        from app.services.booking_service import BookingService
        from app.models import Client, Program, Enrollment, Payment, PaymentMethod, User

        tipo_pago_raw = str(payload.get('tipo_pago') or '')
        if ' - ' not in tipo_pago_raw:
            return
        program_code, tipo_simple = [p.strip() for p in tipo_pago_raw.split(' - ', 1)]
        tipo_simple_lower = tipo_simple.lower()

        PROGRAM_KEYWORDS = {'RR': 'roadmap', 'AL': 'learner', 'SI': 'iniciative'}
        keyword = PROGRAM_KEYWORDS.get(program_code.upper())
        program = None
        if keyword:
            program = Program.query.filter(Program.is_active == True, Program.name.ilike(f'%{keyword}%')).first()
        if not program:
            logger.warning(f"[Enrollment Sync] No se pudo resolver el programa activo para código '{program_code}', se omite el espejo a Enrollment/Payment.")
            return

        PAYMENT_TYPE_MAP = {
            'completo': 'full',
            'parcial': 'first_payment',
            'seña': 'down_payment',
            'cuota': 'installment',
            'renovacion': 'renewal',
            'renovación': 'renewal',
            'upsell': 'upsell',
        }
        payment_type = PAYMENT_TYPE_MAP.get(tipo_simple_lower, 'full')

        closer = None
        email_vendedor = payload.get('email_vendedor')
        if email_vendedor:
            closer = User.query.filter(db.func.lower(User.email) == email_vendedor.strip().lower()).first()

        client = BookingService.create_or_update_client({
            'name': payload.get('nombre_cliente'),
            'email': payload.get('mail_cliente'),
            'instagram': payload.get('instagram'),
            'phone': payload.get('telefono'),
        })
        if not client:
            return

        enrollment = Enrollment.query.filter_by(client_id=client.id, program_id=program.id).first()
        if not enrollment:
            enrollment = Enrollment(client_id=client.id, program_id=program.id, closer_id=closer.id if closer else None)
            db.session.add(enrollment)
            db.session.flush()
        elif closer and not enrollment.closer_id:
            enrollment.closer_id = closer.id

        payment_method = None
        metodo_pago = payload.get('metodo_pago')
        if metodo_pago:
            payment_method = PaymentMethod.query.filter(db.func.lower(PaymentMethod.name) == metodo_pago.strip().lower()).first()

        payment = Payment(
            enrollment_id=enrollment.id,
            payment_method_id=payment_method.id if payment_method else None,
            amount=float(payload.get('monto') or 0.0),
            payment_type=payment_type,
            status='completed',
            date=sale.date
        )
        db.session.add(payment)

        if payment_type in ('full', 'first_payment') and (not enrollment.enrollment_date or payment.date < enrollment.enrollment_date):
            enrollment.enrollment_date = payment.date

        db.session.commit()
        logger.info(f"[Enrollment Sync] Payment creado (enrollment_id={enrollment.id}, tipo={payment_type}, monto={payment.amount}) reflejando FinancialSale id={sale.id}.")

    @staticmethod
    def update_in_sheets(tabla, marca_temporal, payload):
        """
        Actualización (POST): Modifica una fila existente en Google Sheets identificada por su marca_temporal.
        """
        try:
            body = {
                "accion": "update",
                "tabla": tabla,
                "marca_temporal": marca_temporal,
                "datos": payload
            }
            response = requests.post(SheetsService.BASE_URL, json=body, timeout=30)

            if response.status_code in (200, 201, 302):
                logger.info(f"[SHEETS UPDATE] Venta con marca_temporal {marca_temporal} actualizada en Google Sheets.")
                return {"status": "success", "message": "Fila actualizada correctamente en Google Sheets"}
            
            logger.error(f"[SHEETS UPDATE] Error en respuesta: {response.status_code} - {response.text}")
            return {"status": "error", "message": f"Error al actualizar fila en Google Sheets: {response.status_code}"}

        except Exception as e:
            logger.error(f"[SHEETS UPDATE] Excepción during UPDATE ({tabla}): {str(e)}")
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
            from app.models.financial import ExcludedSale
            # Obtener el conjunto de marca_temporal excluidas para omitirlas
            excluded_timestamps = {e.marca_temporal for e in ExcludedSale.query.all() if e.marca_temporal}

            db.session.query(FinancialSale).delete()
            objects = []
            for idx, item in enumerate(data_list):
                try:
                    marca_temp = SheetsService._to_str(item.get('marca_temporal'))
                    if marca_temp and marca_temp in excluded_timestamps:
                        logger.info(f"[SHEETS SYNC] Venta con marca_temporal {marca_temp} omitida por exclusión manual.")
                        continue

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
                        setter=SheetsService._to_str(item.get('setter')), # Columna M en Sheets (Setter)
                        marca_temporal=marca_temp,
                        estado="Completada" if (item.get('estado') or item.get('status') or 'Completada').strip().lower() in ('completada', 'confirmada') else (item.get('estado') or item.get('status') or 'Completada'), # Columna L en Sheets (Estado)
                        sold_in_call=item.get('sold_in_call') == True or item.get('sold_in_call') in ('true', 'True', '1', 1, 'YES', 'yes', 'SI', 'si'),
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
            val_str = str(val).strip()
            if '-' in val_str and val_str.find('-') == 4:
                return parser.parse(val_str, dayfirst=False)
            if '/' in val_str:
                parts = val_str.split('/')
                if len(parts) > 0 and len(parts[0]) <= 2:
                    return parser.parse(val_str, dayfirst=True)
            return parser.parse(val_str)
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

    @staticmethod
    def _trigger_n8n_webhook(payload):
        # Envia los datos de la venta a n8n de forma asincrona
        import os
        import threading

        n8n_url = os.environ.get('N8N_WEBHOOK_URL') or os.environ.get('VENTAS_WEBHOOK')
        if not n8n_url:
            logger.info("[N8N WEBHOOK] No se configuró N8N_WEBHOOK_URL o VENTAS_WEBHOOK, omitiendo envío.")
            return

        # Mapear datos a claves en español y conservar las originales
        webhook_data = {
            "Marca temporal": payload.get('marca_temporal'),
            "Dirección de correo electrónico": payload.get('email_vendedor'),
            "Nombre": payload.get('nombre_cliente'),
            "Teléfono": payload.get('telefono'),
            "Mail": payload.get('mail_cliente'),
            "Tipo de pago": payload.get('tipo_pago'),
            "Monto abonado": payload.get('monto'),
            "Segundo Pago": payload.get('segundo_pago'),
            "Método de Pago": payload.get('metodo_pago'),
            "Examen al que se presenta": payload.get('examen'),
            "Instagram": payload.get('instagram'),
            "Setter": payload.get('setter'),
            "Estado": payload.get('estado'),
            "Documento de identidad": payload.get('documento_identidad'),
            "enviar_mensaje": payload.get('enviar_mensaje', True),

            "marca_temporal": payload.get('marca_temporal'),
            "email_vendedor": payload.get('email_vendedor'),
            "nombre_cliente": payload.get('nombre_cliente'),
            "telefono": payload.get('telefono'),
            "mail_cliente": payload.get('mail_cliente'),
            "tipo_pago": payload.get('tipo_pago'),
            "monto": payload.get('monto'),
            "segundo_pago": payload.get('segundo_pago'),
            "metodo_pago": payload.get('metodo_pago'),
            "examen": payload.get('examen'),
            "instagram": payload.get('instagram'),
            "setter": payload.get('setter'),
            "estado": payload.get('estado'),
            "documento_identidad": payload.get('documento_identidad'),
            "enviar_mensaje": payload.get('enviar_mensaje', True)
        }

        def send_request():
            try:
                response = requests.post(n8n_url, json=webhook_data, timeout=10)
                logger.info(f"[N8N WEBHOOK] Datos enviados con éxito a n8n. Estado: {response.status_code}")
            except Exception as e:
                logger.error(f"[N8N WEBHOOK] Error al enviar peticion a n8n: {e}")

        threading.Thread(target=send_request, daemon=True).start()

