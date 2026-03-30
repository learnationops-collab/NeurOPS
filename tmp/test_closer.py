import os
import sys
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath('.'))
load_dotenv()

from app import create_app
from app.api.public.closer import _trigger_closer_report_discord
from datetime import datetime

class MockCloser:
    username = "Nacho Test"

class MockCloserStat:
    def __init__(self):
        self.closer = MockCloser()
        self.date = datetime.now()
        
        # Generales
        self.slots = 10
        self.offers_made = 5
        self.decision_makers = 4
        self.rescheduled_calls = 2
        
        # Agendas C1
        self.first_call_scheduled = 5
        self.first_call_attended = 4
        self.first_call_no_show = 1
        self.first_call_rescheduled = 0
        self.first_call_canceled = 0
        
        # Agendas C2
        self.second_call_scheduled = 3
        self.second_call_attended = 3
        self.second_call_no_show = 0
        self.second_call_rescheduled = 0
        self.second_call_canceled = 0
        
        # Sales
        self.pif_count = 1
        self.pif_cash_collected = 1000.0
        self.pif_in_call_count = 1
        self.pif_in_call_cash = 1000.0
        
        self.split_count = 1
        self.split_cash_collected = 500.0
        self.split_in_call_count = 0
        self.split_in_call_cash = 0.0
        
        self.deposit_count = 0
        self.deposit_cash_collected = 0.0
        self.deposit_in_call_count = 0
        self.deposit_in_call_cash = 0.0
        
        # Follow ups
        self.follow_ups_hot_sent = 5
        self.follow_ups_hot_replied = 3
        self.follow_ups_cold_sent = 10
        self.follow_ups_cold_replied = 2
        self.follow_ups_sent = 15
        self.follow_ups_replied = 5
        
        # Reflexions
        self.reflection_victory = "Buena conexión con los prospectos. Pude meter 2 ventas."
        self.reflection_opportunity = "Me faltó un poco de fuerza en los seguimientos fríos."

app = create_app()
with app.app_context():
    stat = MockCloserStat()
    print("Triggering closer webhook with extended height...", flush=True)
    try:
        url = os.environ.get('DISCORD_WEBHOOK_URL_CLOSERS')
        if not url:
            print("ERROR: Could not find DISCORD_WEBHOOK_URL_CLOSERS in .env")
        else:
            _trigger_closer_report_discord(stat)
            print("Webhook command finished.")
    except Exception as e:
        print(f"Error: {e}")
