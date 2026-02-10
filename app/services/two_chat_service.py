import requests
from app.models import Integration

class TwoChatService:
    BASE_URL = "https://api.p.2chat.io/open/whatsapp/send-message"
    
    @staticmethod
    def get_config():
        """
        Retrieves API Key and Config from Database.
        """
        integration = Integration.query.filter_by(key='2chat').first()
        if not integration or not integration.payload_config:
            raise Exception("2Chat Integration not found or not configured.")
        return integration.payload_config

    @staticmethod
    def normalize_phone(phone):
        """
        Removes all non-numeric characters from the phone number.
        Ensures it is ready for 2Chat API (international format without + or spaces).
        """
        if not phone:
            return ""
        # Keep only digits
        return "".join(filter(str.isdigit, str(phone)))

    @staticmethod
    def send_message(to_number, text, from_number=None):
        """
        Sends a text message via 2Chat.
        """
        config = TwoChatService.get_config()
        api_key = config.get('api_key')
        
        # Determine from_number: prioritized arg > config > failure
        sender = from_number or config.get('from_number')
        
        # Normalize numbers
        sender = TwoChatService.normalize_phone(sender)
        to_number = TwoChatService.normalize_phone(to_number)
        
        if not api_key:
             raise Exception("2Chat API Key not found in configuration.")
        if not sender:
             raise Exception("2Chat Sender number (from_number) not found.")
             
        headers = {
            "X-User-API-Key": api_key,
            "Content-Type": "application/json"
        }
        
        payload = {
            "to_number": to_number,
            "from_number": sender,
            "text": text
        }
        
        try:
            print(f"[2Chat] Sending from {sender} to {to_number}")
            response = requests.post(TwoChatService.BASE_URL, json=payload, headers=headers, timeout=10)
            print(f"[2Chat] Response Status: {response.status_code}")
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"[2Chat Error] {e}")
            if e.response:
                print(f"[2Chat Response] {e.response.text}")
            raise e
