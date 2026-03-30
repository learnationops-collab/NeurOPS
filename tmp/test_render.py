import os
import sys
from dotenv import load_dotenv
sys.path.insert(0, os.path.abspath('.'))
load_dotenv()

from app import create_app
from app.services.image_service import ImageService
from datetime import datetime
import io

def safe_percent(val, denom):
    return round((val / denom * 100), 1) if denom > 0 else 0

class MockCloserStat:
    def __init__(self):
        self.closer_name = "Nacho Test"
        self.date_str = "30/03/2026"
        
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

app = create_app()
with app.app_context():
    stat = MockCloserStat()
    
    total_attended = 7
    total_scheduled = 8
    total_sales = 2
    total_cash = 1500.0
    
    img_data = {
        "closer_name": stat.closer_name,
        "date_str": stat.date_str,
        "general": {
            "slots": stat.slots,
            "offers_made": stat.offers_made,
            "decision_makers": stat.decision_makers,
            "rescheduled_calls": stat.rescheduled_calls
        },
        "rates": {
            "show_rate": safe_percent(total_attended, total_scheduled),
            "pitch_rate": safe_percent(stat.offers_made, total_attended),
            "close_rate": safe_percent(total_sales, total_attended),
            "offer_to_sale": safe_percent(total_sales, stat.offers_made)
        },
        "agendas": {
            "totals": {
                "scheduled": total_scheduled,
                "attended": total_attended,
                "no_show": 1,
                "canceled": 0,
                "rescheduled": 0,
            },
            "first_call": {
                "scheduled": stat.first_call_scheduled,
                "attended": stat.first_call_attended,
                "no_show": stat.first_call_no_show,
                "canceled": stat.first_call_canceled,
                "rescheduled": stat.first_call_rescheduled,
            },
            "second_call": {
                "scheduled": stat.second_call_scheduled,
                "attended": stat.second_call_attended,
                "no_show": stat.second_call_no_show,
                "canceled": stat.second_call_canceled,
                "rescheduled": stat.second_call_rescheduled,
            }
        },
        "sales": {
            "totals": {
                "count": total_sales,
                "cash": total_cash,
                "in_call_count": 1,
                "in_call_cash": 1000.0,
            },
            "pif": {"count": stat.pif_count, "cash": stat.pif_cash_collected, "in_call_count": stat.pif_in_call_count, "in_call_cash": stat.pif_in_call_cash},
            "split": {"count": stat.split_count, "cash": stat.split_cash_collected, "in_call_count": stat.split_in_call_count, "in_call_cash": stat.split_in_call_cash},
            "deposit": {"count": 0, "cash": 0.0, "in_call_count": 0, "in_call_cash": 0.0}
        },
        "follow_up": {
            "hot_sent": stat.follow_ups_hot_sent,
            "hot_replied": stat.follow_ups_hot_replied,
            "hot_response_pct": safe_percent(stat.follow_ups_hot_replied, stat.follow_ups_hot_sent),
            "cold_sent": stat.follow_ups_cold_sent,
            "cold_replied": stat.follow_ups_cold_replied,
            "cold_response_pct": safe_percent(stat.follow_ups_cold_replied, stat.follow_ups_cold_sent),
            "total_sent": stat.follow_ups_sent,
            "total_replied": stat.follow_ups_replied,
        }
    }
    
    print("Generating image...")
    buf = ImageService.generate_closer_report_card(img_data)
    with open("test_render_closer.png", "wb") as f:
        f.write(buf.read())
    print("Done generating test_render_closer.png")
