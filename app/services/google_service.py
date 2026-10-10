"""Google Calendar de cada usuario: conectarlo (OAuth), elegir el calendario y crear/borrar eventos.

Variables de entorno:
  GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  el cliente OAuth «Aplicación web» de Google Cloud.
      Todavía se leen CLIENT_ID / CLIENT_SECRET si las nuevas no están (nombres viejos).
  GOOGLE_REDIRECT_URI  opcional. Por defecto, <dominio del request>/google/callback, que es lo
      correcto en producción, develop y local. Esa URL tiene que estar autorizada en el cliente.

Un token que Google rechaza (revocado, vencido o emitido por otro cliente) se marca con
`vencido_en`: deja de contar como conectado y se avisa al usuario y a admin para que reconecte.
"""

import datetime
import json
import os
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import google.oauth2.credentials
import google_auth_oauthlib.flow
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from flask import current_app, has_request_context, request

from app.models import db, GoogleCalendarToken, Notification

SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']

# Errores de Google que significan «este token ya no sirve, hay que reconectar». Otros (red,
# cliente mal configurado) no marcan el token: reconectar no los arreglaría.
ERRORES_DE_TOKEN = ('invalid_grant', 'unauthorized_client')


def _iso_utc(dt):
    """datetime UTC sin zona → '2026-10-05T13:00:00Z'."""
    return dt.replace(microsecond=0).isoformat() + 'Z'


def _ms_iso(texto):
    return int(datetime.datetime.fromisoformat(texto.replace('Z', '+00:00')).timestamp() * 1000)


def _ms_punto(punto, zona):
    """El inicio o fin de un evento en ms. Un evento de día entero va de medianoche a medianoche en la
    zona del calendario. None si no se entiende."""
    punto = punto or {}
    try:
        if punto.get('dateTime'):
            return _ms_iso(punto['dateTime'])
        if punto.get('date'):
            try:
                tz = ZoneInfo(punto.get('timeZone') or zona)
            except (ZoneInfoNotFoundError, ValueError):
                tz = datetime.timezone.utc
            return int(datetime.datetime.fromisoformat(punto['date']).replace(tzinfo=tz).timestamp() * 1000)
    except ValueError:
        return None
    return None


def _cliente():
    return (
        os.environ.get('GOOGLE_CLIENT_ID') or os.environ.get('CLIENT_ID'),
        os.environ.get('GOOGLE_CLIENT_SECRET') or os.environ.get('CLIENT_SECRET'),
    )


class GoogleService:
    @staticmethod
    def redirect_uri():
        """A dónde vuelve Google después del permiso. Tiene que estar autorizada en el cliente."""
        fija = os.environ.get('GOOGLE_REDIRECT_URI')
        if fija:
            return fija
        if not has_request_context():
            raise RuntimeError('Sin GOOGLE_REDIRECT_URI ni request no se puede armar la URL de vuelta.')
        return request.url_root.rstrip('/') + '/google/callback'

    @staticmethod
    def get_flow(redirect_uri, scopes=SCOPES):
        client_id, client_secret = _cliente()
        config = {
            'web': {
                'client_id': client_id,
                'client_secret': client_secret,
                'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                'token_uri': 'https://oauth2.googleapis.com/token',
                'redirect_uris': [redirect_uri],
            }
        }
        flow = google_auth_oauthlib.flow.Flow.from_client_config(config, scopes=scopes)
        flow.redirect_uri = redirect_uri
        return flow

    @staticmethod
    def token_vigente(user_id):
        """El token del usuario si existe y Google no lo rechazó."""
        token = GoogleCalendarToken.query.filter_by(user_id=user_id).first()
        return token if token and token.vencido_en is None else None

    @staticmethod
    def get_credentials(user_id):
        """Credenciales listas para usar, renovadas si hacía falta. None si no hay token vigente o si
        Google lo rechaza al renovarlo (y entonces queda marcado como vencido)."""
        token = GoogleService.token_vigente(user_id)
        if not token:
            return None
        creds = google.oauth2.credentials.Credentials.from_authorized_user_info(json.loads(token.token_json), SCOPES)
        if creds.valid:
            return creds
        if not creds.refresh_token:
            GoogleService._marcar_vencido(token, 'no tiene refresh token')
            return None
        try:
            creds.refresh(Request())
        except RefreshError as e:
            if any(codigo in str(e) for codigo in ERRORES_DE_TOKEN):
                GoogleService._marcar_vencido(token, str(e))
                return None
            raise
        token.token_json = creds.to_json()
        db.session.commit()
        return creds

    @staticmethod
    def _marcar_vencido(token, motivo):
        if token.vencido_en is not None:
            return
        current_app.logger.warning(f'[GOOGLE] Token del usuario #{token.user_id} rechazado: {motivo}')
        token.vencido_en = datetime.datetime.utcnow()
        nombre = token.user.username if token.user else f'#{token.user_id}'
        db.session.add(
            Notification(
                subject='Google Calendar desconectado',
                content=(
                    f'Google dejó de aceptar la conexión con el calendario de {nombre}. Hasta que vuelva '
                    'a conectarlo (Configuración › Google Calendar) no recibe agendas nuevas ni se '
                    'crean sus eventos con Meet.'
                ),
                target_users=['role:admin', int(token.user_id)],
                associated_id=token.user_id,
                associated_type='user',
            )
        )
        db.session.commit()

    @staticmethod
    def save_credentials(user_id, credentials):
        token = GoogleCalendarToken.query.filter_by(user_id=user_id).first()
        if not token:
            token = GoogleCalendarToken(user_id=user_id, token_json=credentials.to_json())
            db.session.add(token)
        else:
            token.token_json = credentials.to_json()
            token.vencido_en = None
        db.session.commit()

    @staticmethod
    def get_service(user_id):
        creds = GoogleService.get_credentials(user_id)
        if not creds:
            return None
        return build('calendar', 'v3', credentials=creds, cache_discovery=False)

    @staticmethod
    def _calendario(user_id):
        token = GoogleCalendarToken.query.filter_by(user_id=user_id).first()
        return (token.google_calendar_id if token else None) or 'primary'

    @staticmethod
    def list_calendars(user_id, todos=False):
        """Calendarios donde el usuario puede escribir (con `todos`, también los que solo puede leer:
        sirven para revisar conflictos). [] si no hay conexión o Google falla."""
        service = GoogleService.get_service(user_id)
        if not service:
            return []
        roles = ('owner', 'writer', 'reader', 'freeBusyReader') if todos else ('owner', 'writer')
        try:
            calendarios, pagina = [], None
            while True:
                respuesta = service.calendarList().list(pageToken=pagina).execute()
                for c in respuesta.get('items', []):
                    if c.get('accessRole') in roles:
                        calendarios.append({
                            'id': c['id'], 'summary': c.get('summaryOverride') or c['summary'], 'primary': c.get('primary', False),
                            'escribe': c.get('accessRole') in ('owner', 'writer'),
                        })
                pagina = respuesta.get('nextPageToken')
                if not pagina:
                    return calendarios
        except Exception as e:  # noqa: BLE001  (la pantalla de configuración no puede romperse por Google)
            current_app.logger.warning(f'[GOOGLE] No se pudieron listar los calendarios del usuario #{user_id}: {e}')
            return []

    @staticmethod
    def create_event(user_id, appointment):
        """Evento simple de 60 minutos, sin Meet (agendas manuales y reprogramaciones de NeurOPS)."""
        service = GoogleService.get_service(user_id)
        if not service:
            return None

        inicio = appointment.start_time  # UTC sin zona
        fin = inicio + datetime.timedelta(minutes=60)
        client_name = appointment.client.full_name or appointment.client.email
        closer_name = appointment.closer.username if appointment.closer else 'Equipo'
        event = {
            'summary': f'{client_name} y {closer_name}',
            'location': 'Google Meet / Zoom',
            'description': f"Tipo: {getattr(appointment, 'appointment_type', getattr(appointment, 'origin', 'Primera agenda'))}",
            'start': {'dateTime': inicio.isoformat() + 'Z'},
            'end': {'dateTime': fin.isoformat() + 'Z'},
            'reminders': {
                'useDefault': False,
                'overrides': [{'method': 'email', 'minutes': 24 * 60}, {'method': 'popup', 'minutes': 10}],
            },
        }
        if appointment.client.email:
            event['attendees'] = [{'email': appointment.client.email}]

        try:
            evt = service.events().insert(calendarId=GoogleService._calendario(user_id), body=event).execute()
            return evt.get('id')
        except Exception as e:  # noqa: BLE001  (la agenda ya está guardada; el evento es accesorio)
            current_app.logger.warning(f'[GOOGLE] No se pudo crear el evento del usuario #{user_id}: {e}')
            return None

    @staticmethod
    def crear_evento_con_meet(user_id, inicio_utc, fin_utc, titulo, descripcion, invitado_email=None):
        """Crea el evento en el calendario elegido del usuario, con link de Google Meet, e invita a
        `invitado_email` (Google le manda la invitacion por mail). Lo usa Agendas 2.0.

        inicio_utc/fin_utc: datetime UTC sin zona. Devuelve (event_id, link_de_meet). A diferencia de
        create_event, NO se traga los errores: quien llama decide que hacer si Google falla."""
        import uuid

        service = GoogleService.get_service(user_id)
        if not service:
            raise RuntimeError('El usuario no tiene Google Calendar conectado.')
        cuerpo = {
            'summary': titulo,
            'description': descripcion,
            'start': {'dateTime': inicio_utc.isoformat() + 'Z'},
            'end': {'dateTime': fin_utc.isoformat() + 'Z'},
            'conferenceData': {
                'createRequest': {'requestId': uuid.uuid4().hex, 'conferenceSolutionKey': {'type': 'hangoutsMeet'}}
            },
            'reminders': {
                'useDefault': False,
                'overrides': [{'method': 'email', 'minutes': 24 * 60}, {'method': 'popup', 'minutes': 10}],
            },
        }
        if invitado_email:
            cuerpo['attendees'] = [{'email': invitado_email}]
        evt = service.events().insert(
            calendarId=GoogleService._calendario(user_id),
            body=cuerpo,
            conferenceDataVersion=1,
            sendUpdates='all' if invitado_email else 'none',
        ).execute()
        meet = evt.get('hangoutLink') or next(
            (p.get('uri') for p in (evt.get('conferenceData') or {}).get('entryPoints', []) if p.get('entryPointType') == 'video'),
            None,
        )
        return evt.get('id'), meet

    @staticmethod
    def calendarios_de_conflicto(token):
        """Los calendarios que se revisan antes de ofrecer al usuario: los que eligió o, si no eligió,
        el de destino y el principal."""
        if token is None:
            return []
        elegidos = token.calendarios_conflicto
        if isinstance(elegidos, list):
            return [c for c in elegidos if isinstance(c, str) and c][:20]
        return list(dict.fromkeys([token.google_calendar_id or 'primary', 'primary']))

    @staticmethod
    def franjas_ocupadas(user_id, desde, hasta):
        """[(inicio, fin)] en ms de lo que el usuario tiene ocupado en sus calendarios de conflicto
        entre `desde` y `hasta` (datetime UTC sin zona). Los eventos marcados como «Disponible» y los
        cancelados no cuentan (así responde freebusy). None si no se pudo saber: quien llama sigue
        como si no hubiera nada (se prefiere ofrecer de más a perder agendas)."""
        token = GoogleService.token_vigente(user_id)
        calendarios = GoogleService.calendarios_de_conflicto(token)
        if not calendarios:
            return []
        try:
            service = GoogleService.get_service(user_id)
        except Exception as e:  # noqa: BLE001  (un token que no se puede leer no frena a nadie)
            current_app.logger.warning(f'[GOOGLE] Sin servicio para leer la ocupación del usuario #{user_id}: {e}')
            return None
        if not service:
            return None

        def iso(dt):
            return dt.replace(microsecond=0).isoformat() + 'Z'

        def ms(texto):
            return int(datetime.datetime.fromisoformat(texto.replace('Z', '+00:00')).timestamp() * 1000)

        try:
            r = service.freebusy().query(body={
                'timeMin': iso(desde), 'timeMax': iso(hasta), 'items': [{'id': c} for c in calendarios],
            }).execute()
        except Exception as e:  # noqa: BLE001
            current_app.logger.warning(f'[GOOGLE] No se pudo leer la ocupación del usuario #{user_id}: {e}')
            return None
        franjas = []
        for cal in (r.get('calendars') or {}).values():
            # Un calendario que ya no existe o no se puede leer viene con `errors`: se ignora.
            for b in cal.get('busy') or []:
                try:
                    franjas.append((ms(b['start']), ms(b['end'])))
                except (KeyError, ValueError):
                    continue
        return sorted(franjas)

    @staticmethod
    def eventos_ocupados(user_id, desde, hasta):
        """[{inicio, fin, titulo}] (ms) de los eventos que ocupan al usuario en sus calendarios de
        conflicto entre `desde` y `hasta` (datetime UTC sin zona), con su título para Available. Cuenta
        lo mismo que freebusy: no los cancelados, los marcados «Disponible» ni los que rechazó. Un evento
        privado o confidencial va sin título (None), igual que lo de un calendario del que solo se ve
        libre/ocupado (se lee con freebusy). None si no se pudo saber."""
        token = GoogleService.token_vigente(user_id)
        calendarios = GoogleService.calendarios_de_conflicto(token)
        if not calendarios:
            return []
        try:
            service = GoogleService.get_service(user_id)
        except Exception as e:  # noqa: BLE001
            current_app.logger.warning(f'[GOOGLE] Sin servicio para leer los eventos del usuario #{user_id}: {e}')
            return None
        if not service:
            return None
        eventos, solo_ocupado = [], []
        for cal in calendarios:
            try:
                eventos += GoogleService._eventos_de(service, cal, desde, hasta)
            except Exception as e:  # noqa: BLE001
                # Un calendario que ya no existe se ignora (como en freebusy); si no deja ver los eventos,
                # se pide solo lo ocupado.
                if getattr(getattr(e, 'resp', None), 'status', None) in (404, 410):
                    continue
                solo_ocupado.append(cal)
        if solo_ocupado:
            try:
                r = service.freebusy().query(body={
                    'timeMin': _iso_utc(desde), 'timeMax': _iso_utc(hasta), 'items': [{'id': c} for c in solo_ocupado],
                }).execute()
            except Exception as e:  # noqa: BLE001
                current_app.logger.warning(f'[GOOGLE] No se pudieron leer los eventos del usuario #{user_id}: {e}')
                return None
            for cal in (r.get('calendars') or {}).values():
                for b in cal.get('busy') or []:
                    try:
                        eventos.append({'inicio': _ms_iso(b['start']), 'fin': _ms_iso(b['end']), 'titulo': None})
                    except (KeyError, ValueError):
                        continue
        return sorted(eventos, key=lambda x: (x['inicio'], x['fin']))

    @staticmethod
    def _eventos_de(service, calendario, desde, hasta):
        """Los eventos que ocupan en un calendario (los recurrentes, cada uno por separado)."""
        out, pagina = [], None
        while True:
            r = service.events().list(
                calendarId=calendario, timeMin=_iso_utc(desde), timeMax=_iso_utc(hasta), singleEvents=True,
                maxResults=250, pageToken=pagina,
                fields='timeZone,nextPageToken,'
                       'items(summary,start,end,status,transparency,visibility,attendees(self,responseStatus))',
            ).execute()
            zona = r.get('timeZone') or 'UTC'
            for e in r.get('items') or []:
                if e.get('status') == 'cancelled' or e.get('transparency') == 'transparent':
                    continue
                if any(a.get('self') and a.get('responseStatus') == 'declined' for a in e.get('attendees') or []):
                    continue
                inicio, fin = _ms_punto(e.get('start'), zona), _ms_punto(e.get('end'), zona)
                if inicio is None or fin is None or fin <= inicio:
                    continue
                privado = e.get('visibility') in ('private', 'confidential')
                titulo = None if privado else (e.get('summary') or '').strip() or None
                out.append({'inicio': inicio, 'fin': fin, 'titulo': titulo})
            pagina = r.get('nextPageToken')
            if not pagina:
                return out

    @staticmethod
    def evento_cancelado(user_id, event_id):
        """True solo si Google confirma que el evento se canceló o se borró. Ante cualquier duda (sin
        token, sin red, 404 porque se cambió de calendario) devuelve False: la agenda sigue contando."""
        service = GoogleService.get_service(user_id)
        if not service or not event_id:
            return False
        try:
            evt = service.events().get(calendarId=GoogleService._calendario(user_id), eventId=event_id).execute()
        except Exception as e:  # noqa: BLE001
            if getattr(getattr(e, 'resp', None), 'status', None) == 410:
                return True
            current_app.logger.warning(f'[GOOGLE] No se pudo leer el evento {event_id} del usuario #{user_id}: {e}')
            return False
        return (evt or {}).get('status') == 'cancelled'

    @staticmethod
    def delete_event(user_id, event_id):
        service = GoogleService.get_service(user_id)
        if not service or not event_id:
            return False
        try:
            service.events().delete(calendarId=GoogleService._calendario(user_id), eventId=event_id).execute()
            return True
        except Exception as e:  # noqa: BLE001  (un evento ya borrado a mano no puede frenar nada)
            current_app.logger.warning(f'[GOOGLE] No se pudo borrar el evento {event_id} del usuario #{user_id}: {e}')
            return False
