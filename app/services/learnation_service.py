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
    def _request(method, path, **kwargs):
        url = f'{LearnationService.BASE_URL}{path}'
        try:
            resp = requests.request(method, url, headers=LearnationService._headers(), timeout=15, **kwargs)
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
    def upsert_user(email, name, phone=None):
        body = {'email': email, 'name': name}
        if phone:
            body['phone'] = phone
        return LearnationService._request('POST', '/users/upsert', json=body)

    @staticmethod
    def assign_product(learnation_user_id, product_slug, expires_at=None):
        """`expires_at` (YYYY-MM-DD): NeurOPS siempre manda la fecha exacta que calculó su
        propia lógica de negocio (ver AcademyAccessService) en vez de delegarle a la Academia
        el cálculo automático por `payment_type` — ver docs/integracion_learnation_api.md §2.4."""
        body = {'product_slug': product_slug}
        if expires_at:
            body['expires_at'] = expires_at
        return LearnationService._request('POST', f'/users/{learnation_user_id}/products', json=body)

    @staticmethod
    def get_student_products(learnation_user_id):
        return LearnationService._request('GET', f'/users/{learnation_user_id}/products')

    @staticmethod
    def get_student_summary(learnation_user_id):
        return LearnationService._request('GET', f'/users/{learnation_user_id}/summary')
