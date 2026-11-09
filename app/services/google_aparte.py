"""Una autorización de Google aparte, para un solo permiso (ADR-W123, ADR-W128): el correo (`gmail.send`) y la
configuración de las reuniones de Meet (`meetings.space.settings`), las dos de team@.

Sin `include_granted_scopes`: no suma ni toca las autorizaciones de Calendar o del Drive de las notas. El token
vive en `integrations` (payload_config: {email, token_json, conectada_en, conectada_ts, vencida_en?,
ultimo_error?}). Se conecta con un link firmado (vence en 24 h, sirve una vez) que abre quien tiene la cuenta;
vuelve por /google/callback (app/api/google_calendar.py → app/api/google_aparte.py).
"""
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime

import google.oauth2.credentials
from flask import current_app, request
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

from app import db
from app.models import Integration
from app.services.google_service import ERRORES_DE_TOKEN

logger = logging.getLogger(__name__)

VIGENCIA_LINK_S = 24 * 3600
BASICOS = ['openid', 'https://www.googleapis.com/auth/userinfo.email']


class SinConexion(Exception):
    """No hay cuenta conectada (o Google la rechazó)."""


@dataclass(frozen=True)
class Autorizacion:
    clave: str  # la de `integrations` y la de la ruta /google/<clave>/conectar/<firma>
    nombre: str
    permiso: str  # el scope propio
    para_que: str  # «los mails de la plataforma salen desde», para la página de vuelta
    aviso: str  # qué deja de andar si Google la rechaza

    @property
    def scopes(self):
        return [*BASICOS, self.permiso]

    def _integracion(self, crear=False):
        i = Integration.query.filter_by(key=self.clave).first()
        if not i and crear:
            i = Integration(key=self.clave, name=self.nombre, payload_config={})
            db.session.add(i)
        return i

    def _config(self):
        i = self._integracion()
        return dict(i.payload_config or {}) if i else {}

    def _guardar(self, **cambios):
        c = self._config()
        c.update(cambios)
        self._integracion(crear=True).payload_config = c
        db.session.commit()

    def estado(self):
        c = self._config()
        return {'conectada': bool(c.get('token_json')) and not c.get('vencida_en'), 'email': c.get('email'),
                'conectada_en': c.get('conectada_en'), 'vencida_en': c.get('vencida_en'),
                'ultimo_error': c.get('ultimo_error')}

    # --- Link firmado -----------------------------------------------------------------------------

    def _firmador(self):
        from itsdangerous import URLSafeTimedSerializer

        return URLSafeTimedSerializer(current_app.config['SECRET_KEY'], salt=f'google-aparte-{self.clave}')

    def link_para_conectar(self, base=None):
        base = (base or request.host_url).rstrip('/')
        return f'{base}/google/{self.clave}/conectar/' + self._firmador().dumps({'t': int(time.time())})

    def leer_firma(self, firma):
        """Motivo para mostrar si la firma no sirve; None si sirve."""
        from itsdangerous import BadSignature

        try:
            datos = self._firmador().loads(firma, max_age=VIGENCIA_LINK_S)
        except BadSignature:
            return 'El link para conectar venció. Pedí uno nuevo.'
        if (self._config().get('conectada_ts') or 0) >= datos.get('t', 0):
            return 'Este link ya se usó. Pedí uno nuevo.'
        return None

    # --- Token ------------------------------------------------------------------------------------

    def guardar_credenciales(self, creds):
        email = None
        try:
            info = build('oauth2', 'v2', credentials=creds, cache_discovery=False).userinfo().get().execute()
            email = (info.get('email') or '').lower() or None
        except Exception as e:  # noqa: BLE001  (sin el email la conexión sirve igual)
            logger.warning(f'[{self.clave.upper()}] No se pudo leer el email de la cuenta conectada: {e}')
        self._guardar(email=email, token_json=creds.to_json(), conectada_en=datetime.utcnow().isoformat() + 'Z',
                      conectada_ts=int(time.time()), vencida_en=None, ultimo_error=None)
        return email

    def credenciales(self):
        c = self._config()
        if not c.get('token_json') or c.get('vencida_en'):
            raise SinConexion(f'No hay una cuenta conectada para {self.nombre}.')
        creds = google.oauth2.credentials.Credentials.from_authorized_user_info(json.loads(c['token_json']), self.scopes)
        if creds.valid:
            return creds
        try:
            creds.refresh(Request())
        except RefreshError as e:
            if any(codigo in str(e) for codigo in ERRORES_DE_TOKEN):
                self._vencer(str(e))
                raise SinConexion(f'Google dejó de aceptar la cuenta de {self.nombre}.') from e
            raise
        self._guardar(token_json=creds.to_json())
        return creds

    def _vencer(self, motivo):
        from app.services import avisos_service

        logger.warning(f'[{self.clave.upper()}] Google rechazó el token: {motivo}')
        self._guardar(vencida_en=datetime.utcnow().isoformat() + 'Z', ultimo_error=motivo[:300])
        avisos_service.avisar('google_desconectado', *avisos_service.destino(['admin']), f'{self.nombre}: desconectado',
                              f'Google dejó de aceptar la cuenta conectada. {self.aviso}')
        db.session.commit()


CORREO = Autorizacion('correo', 'Correo saliente (Gmail)', 'https://www.googleapis.com/auth/gmail.send',
                      'los mails de la plataforma salen desde',
                      'Hasta que se vuelva a conectar, los mails de la Academia no salen.')
MEET = Autorizacion('meet', 'Reuniones de Meet (notas automáticas)', 'https://www.googleapis.com/auth/meetings.space.settings',
                    'las Momentum activan solas las notas, la transcripción y la grabación con',
                    'Hasta que se vuelva a conectar, las Momentum no activan solas las notas de Gemini.')
POR_CLAVE = {a.clave: a for a in (CORREO, MEET)}
