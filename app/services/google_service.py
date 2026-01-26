import google.oauth2.credentials
import google_auth_oauthlib.flow
from googleapiclient.discovery import build
from flask import url_for, current_app, session
from app.models import db, GoogleCalendarToken, User
import json
import os
import datetime

# Scopes required
SCOPES = ['https://www.googleapis.com/auth/calendar', 'https://www.googleapis.com/auth/calendar.events']

class GoogleService:
    @staticmethod
    def get_flow(redirect_uri=None):
        # Use env vars directly if file not present, or construct client config
        client_config = {
            "web": {
                "client_id": os.environ.get("CLIENT_ID"),
                "client_secret": os.environ.get("CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "redirect_uris": [os.environ.get("REDIRECT_URI_PROD", "https://work.thelearnation.com/google/callback"), 
                                  os.environ.get("REDIRECT_URI_DEV", "http://127.0.0.1:5000/google/callback")]
            }
        }
        
        flow = google_auth_oauthlib.flow.Flow.from_client_config(
            client_config, scopes=SCOPES)
            
        # The redirect_uri must match EXACTLY what's in Google Console
        # We will set it dynamically based on request, but must be in authorized list
        if redirect_uri:
            flow.redirect_uri = redirect_uri
        
        return flow

    @staticmethod
    def get_credentials(user_id):
        token_entry = GoogleCalendarToken.query.filter_by(user_id=user_id).first()
        if not token_entry:
            return None
            
        info = json.loads(token_entry.token_json)
        creds = google.oauth2.credentials.Credentials.from_authorized_user_info(info, SCOPES)
        return creds

    @staticmethod
    def save_credentials(user_id, credentials):
        token_entry = GoogleCalendarToken.query.filter_by(user_id=user_id).first()
        token_json = credentials.to_json()
        
        if not token_entry:
            token_entry = GoogleCalendarToken(user_id=user_id, token_json=token_json)
            db.session.add(token_entry)
        else:
            token_entry.token_json = token_json
            token_entry.updated_at = db.func.now()
            
        db.session.commit()

    @staticmethod
    def get_service(user_id):
        creds = GoogleService.get_credentials(user_id)
        if not creds: return None
        return build('calendar', 'v3', credentials=creds)

    @staticmethod
    def list_calendars(user_id):
        service = GoogleService.get_service(user_id)
        if not service: return []
        
        try:
            page_token = None
            calendar_list = []
            while True:
                calendar_list_entry = service.calendarList().list(pageToken=page_token).execute()
                for calendar_list_entry in calendar_list_entry['items']:
                    # Only writable calendars or owner
                    if calendar_list_entry.get('accessRole') in ['owner', 'writer']:
                         calendar_list.append({
                             "id": calendar_list_entry['id'],
                             "summary": calendar_list_entry['summary'],
                             "primary": calendar_list_entry.get('primary', False)
                         })
                page_token = calendar_list_entry.get('nextPageToken')
                if not page_token:
                    break
            return calendar_list
        except Exception as e:
            print(f"Error listing calendars: {e}")
            return []

    @staticmethod
    def create_event(user_id, appointment):
        service = GoogleService.get_service(user_id)
        if not service: return None
        
        # Get target calendar ID
        token = GoogleCalendarToken.query.filter_by(user_id=user_id).first()
        calendar_id = token.google_calendar_id or 'primary'
        
        # Determine End Time (Default 45 mins + Buffer?)
        # Let's assume 1 hour for now or from Event logic
        # Ideally, appointment should have duration or end_time.
        # Assuming 1 hour default if not specified.
        # appointment.start_time is DB datetime (naive usually, or stored as UTC)
        
        # Convert to proper format
        # If start_time is naive and we assume it's UTC or Closer Timezone?
        # Booking logic stores UTC.
        
        start_time_iso = appointment.start_time.isoformat() + 'Z' # Assuming it's UTC
        end_time_dt = appointment.start_time + datetime.timedelta(minutes=60)
        end_time_iso = end_time_dt.isoformat() + 'Z'
        
        client_name = appointment.client.full_name or appointment.client.email
        closer_name = appointment.closer.username if appointment.closer else "Equipo"
        
        event = {
          'summary': f'{client_name} y {closer_name}',
          'location': 'Google Meet / Zoom',
          'description': f'Tipo: {appointment.appointment_type}',
          'start': {
            'dateTime': start_time_iso,
            # 'timeZone': 'UTC',
          },
          'end': {
            'dateTime': end_time_iso,
            # 'timeZone': 'UTC',
          },
          'reminders': {
            'useDefault': False,
            'overrides': [
              {'method': 'email', 'minutes': 24 * 60},
              {'method': 'popup', 'minutes': 10},
            ],
          },
        }

        # Add attendee if client has email
        if appointment.client.email:
            event['attendees'] = [{'email': appointment.client.email}]

        try:
            evt = service.events().insert(calendarId=calendar_id, body=event).execute()
            print(f'Event created: {evt.get("htmlLink")}')
            return evt.get('id')
        except Exception as e:
             print(f"Error creating event: {e}")
             return None

    @staticmethod
    def delete_event(user_id, event_id):
        service = GoogleService.get_service(user_id)
        if not service or not event_id: return False
        
        token = GoogleCalendarToken.query.filter_by(user_id=user_id).first()
        calendar_id = token.google_calendar_id or 'primary'
        
        try:
            service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
            print(f"Event {event_id} deleted")
            return True
        except Exception as e:
            print(f"Error deleting event: {e}")
            return False
