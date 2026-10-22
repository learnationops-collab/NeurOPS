import os
import requests


class LearnationAPIError(Exception):
    """Error al hablar con la API de la Academia (Learnation) — status_code/payload
    vienen de la respuesta HTTP real cuando la hubo (None si fue un error de red)."""
    def __init__(self, message, status_code=None, payload=None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload


class LearnationService:
    """Cliente delgado de la API pública de la Academia (academy.thelearnation.com/api/v1,
    ver docs/integracion_learnation_api.md). Token vía ACADEMY_API_TOKEN (variable de
    entorno ya configurada en este proyecto — no vive en la base de datos), mismo patrón
    que WhatchimpService."""

    BASE_URL = 'https://academy.thelearnation.com/api/v1'

    @staticmethod
    def _headers():
        token = os.environ.get('ACADEMY_API_TOKEN')
        if not token:
            raise LearnationAPIError('ACADEMY_API_TOKEN no está configurada en las variables de entorno.')
        return {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }

    @staticmethod
    def _request(method, path, timeout=15, **kwargs):
        url = f'{LearnationService.BASE_URL}{path}'
        try:
            resp = requests.request(method, url, headers=LearnationService._headers(), timeout=timeout, **kwargs)
        except requests.RequestException as e:
            raise LearnationAPIError(f'Error de red al conectar con la Academia: {e}')

        if resp.status_code >= 400:
            try:
                payload = resp.json()
            except ValueError:
                payload = {'raw': resp.text}
            message = payload.get('errors') or payload.get('message') or f'La Academia respondió {resp.status_code}'
            raise LearnationAPIError(str(message), status_code=resp.status_code, payload=payload)

        try:
            return resp.json()
        except ValueError:
            return {}

    @staticmethod
    def get_products():
        return LearnationService._request('GET', '/products')

    @staticmethod
    def check_user(email):
        return LearnationService._request('GET', '/users/check', params={'email': email})

    @staticmethod
    def upsert_user(email, name, phone=None, work_uuid=None):
        """`work_uuid`: el uuid de la persona en Work (plan_personas): la Academia lo guarda y con
        él se identifican los dos de ahí en adelante."""
        body = {'email': email, 'name': name}
        if phone:
            body['phone'] = phone
        if work_uuid:
            body['work_uuid'] = work_uuid
        return LearnationService._request('POST', '/users/upsert', json=body)

    @staticmethod
    def assign_product(learnation_user_id, product_slug, expires_at=None, closer_email=None):
        """`expires_at` (YYYY-MM-DD): NeurOPS siempre manda la fecha exacta que calculó su
        propia lógica de negocio (ver AcademyAccessService) en vez de delegarle a la Academia
        el cálculo automático por `payment_type` — ver docs/integracion_learnation_api.md §2.4.
        `closer_email`: el closer del que pasa a depender el alumno (AcademyAccessService.closer_de)."""
        body = {'product_slug': product_slug}
        if expires_at:
            body['expires_at'] = expires_at
        if closer_email:
            body['closer_email'] = closer_email
        return LearnationService._request('POST', f'/users/{learnation_user_id}/products', json=body)

    @staticmethod
    def get_student_products(learnation_user_id):
        return LearnationService._request('GET', f'/users/{learnation_user_id}/products')

    @staticmethod
    def get_student_summary(learnation_user_id):
        return LearnationService._request('GET', f'/users/{learnation_user_id}/summary')

    @staticmethod
    def get_students_progress(page=1, limit=500):
        """El avance de todos los alumnos en proceso, paginado (ver academy_snapshot_service.
        sincronizar_avance): una o dos peticiones en vez de una por alumno."""
        return LearnationService._request('GET', '/students/progress', params={'page': page, 'limit': limit})

    @staticmethod
    def report_payment(payload):
        """Avisa un pago a la Academia (ver app/services/academy_payment_sync.py). Idempotente
        del lado de la Academia por `sale_id`."""
        return LearnationService._request('POST', '/payments', json=payload)

    @staticmethod
    def report_subscription(payload):
        """Le manda a la Academia la suscripción tal como quedó en Work, que es la fuente de verdad
        (ver app/services/subscription_sync.py). La Academia la aplica tal cual, también si acorta."""
        return LearnationService._request('POST', '/subscriptions', json=payload)

    @staticmethod
    def report_payment_status(payload):
        """Avisa el estado de pago de un cliente a la Academia cuando cambia (ver
        app/services/academy_payment_status.py). La Academia guarda el último."""
        return LearnationService._request('POST', '/payment-status', json=payload)

    @staticmethod
    def report_closer_deactivated(payload):
        """Avisa que un closer se desactivó: la Academia reparte sus alumnos (AcademyAccessService.avisar_baja)."""
        return LearnationService._request('POST', '/closers/deactivated', json=payload)

    @staticmethod
    def report_momentum_result(payload):
        """Avisa el reporte de una Momentum a la Academia (ver app/services/momentum_academia.py)."""
        return LearnationService._request('POST', '/sessions/momentum-result', json=payload)

    @staticmethod
    def get_success_cases():
        """Los casos de éxito publicados para landings (el Muro de Honor): los muestra la página de
        gracias de Agendas 2.0."""
        return LearnationService._request('GET', '/success-cases')

    @staticmethod
    def agent_ask(plan=None, pregunta=None, quien=None, pagina=1):
        """Agentes pares (API de la Academia §2.14): un plan por claves lo resuelve su motor de Tablas, sin IA;
        una pregunta suelta la responde su Learnito con IA (con costo). Devuelve el paquete tal cual."""
        cuerpo = {k: v for k, v in {'plan': plan, 'pregunta': pregunta, 'quien': quien, 'pagina': pagina}.items()
                  if v is not None}
        # Su Learnito puede tardar en responder una pregunta; un plan, menos.
        return LearnationService._request('POST', '/agent/ask', json=cuerpo, timeout=90 if pregunta else 40)
