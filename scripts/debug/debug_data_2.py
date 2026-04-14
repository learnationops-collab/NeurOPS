
from app import create_app, db
from app.models import MarketingBudget, ManychatAdLead, ManychatLead, LeadAnswer, Ad, AdSet, Campaign, AdPeriodSpend

app = create_app()
with app.app_context():
    print(f"MarketingBudget rows: {MarketingBudget.query.count()}")
    for b in MarketingBudget.query.limit(5).all():
        print(f"  Budget: {b.budget} | Spent: {b.spent} | Source: {b.source} | Date: {b.date}")

    print(f"\nManychatAdLead rows: {ManychatAdLead.query.count()}")
    for l in ManychatAdLead.query.limit(5).all():
        print(f"  AdID: {l.ad_id} | Name: {l.lead_name} | Created: {l.created_at}")

    print(f"\nManychatLead rows: {ManychatLead.query.count()}")
    print(f"LeadAnswer rows: {LeadAnswer.query.count()}")
    
    # Check if there are any AdPeriodSpends even historical
    print(f"\nAdPeriodSpend total rows: {AdPeriodSpend.query.count()}")
