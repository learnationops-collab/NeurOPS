
import os
from app import create_app, db
from app.models import Ad, AdSet, Campaign, AdPeriodSpend, FinancialSale, LeadAnswer, ManychatLead
from datetime import datetime, timedelta

app = create_app()
with app.app_context():
    print(f"Total Ads: {Ad.query.count()}")
    print(f"Total AdSets: {AdSet.query.count()}")
    print(f"Total Campaigns: {Campaign.query.count()}")
    print(f"Total AdPeriodSpend: {AdPeriodSpend.query.count()}")
    print(f"Total FinancialSale: {FinancialSale.query.count()}")
    print(f"Total LeadAnswer: {LeadAnswer.query.count()}")
    
    # Check some data in AdPeriodSpend
    last_spends = AdPeriodSpend.query.order_by(AdPeriodSpend.start_date.desc()).limit(5).all()
    print("\nLast 5 AdPeriodSpends:")
    for s in last_spends:
        target = f"Ad:{s.ad_id}" if s.ad_id else f"Set:{s.ad_set_id}" if s.ad_set_id else f"Camp:{s.campaign_id}"
        print(f"  ID:{s.id} | {target} | {s.start_date} to {s.end_date} | Spend: {s.spend}")

    # Check some sales
    last_sales = FinancialSale.query.order_by(FinancialSale.date.desc()).limit(5).all()
    print("\nLast 5 FinancialSales:")
    for sale in last_sales:
        print(f"  ID:{sale.id} | Date:{sale.date} | IG:{sale.instagram} | Amount:{sale.amount}")

    # Check a ManychatLead match
    if last_sales:
        ig = last_sales[0].instagram
        if ig:
            ig_norm = ig.strip().lstrip('@').lower()
            lead = ManychatLead.query.filter(db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_norm).first()
            print(f"\nLead match for IG {ig}: {'Found' if lead else 'Not Found'}")
            if lead:
                answers = LeadAnswer.query.filter_by(lead_id=lead.id).count()
                print(f"  Answers for lead: {answers}")
