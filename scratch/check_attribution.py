import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import create_app, db
from app.models import LeadAnswer, ManychatLead, FinancialSale
from sqlalchemy import func
from datetime import datetime, timedelta

app = create_app()
with app.app_context():
    # Simular el periodo 'last_month' del endpoint
    now = datetime.utcnow()
    start_dt = (now - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
    end_dt = now

    print(f"Periodo: {start_dt.date()} -> {end_dt.date()}")

    # 1. Leads en el periodo
    stats = db.session.query(
        LeadAnswer.ad_id,
        func.count(LeadAnswer.id).label('total_leads'),
    ).filter(
        LeadAnswer.ad_id != None,
        LeadAnswer.created_at >= start_dt,
        LeadAnswer.created_at <= end_dt
    ).group_by(LeadAnswer.ad_id).all()

    ad_ids = [s.ad_id for s in stats]
    print(f"\nAds con leads en el periodo: {ad_ids}")

    # 2. Ventas en el periodo
    sales_in_period = FinancialSale.query.filter(
        FinancialSale.date >= start_dt, 
        FinancialSale.date <= end_dt
    ).all()
    print(f"Ventas en el periodo: {len(sales_in_period)}")

    def normalize_ig(ig_str):
        if not ig_str or not isinstance(ig_str, str) or ig_str.lower() in ('n/a', ''):
            return None
        return ig_str.strip().lstrip('@').lower()

    # 3. Intentar atribuir cada venta
    ventas_por_ad = {}
    cash_collect_data = {}
    sin_ig = 0
    sin_lead = 0
    sin_answer = 0
    atribuidas = 0

    for sale in sales_in_period:
        ig_val = sale.instagram or (sale.raw_data or {}).get('instagram') or (sale.raw_data or {}).get('ig')
        ig_n = normalize_ig(ig_val)
        if not ig_n:
            sin_ig += 1
            continue

        matched_lead = ManychatLead.query.filter(
            func.lower(func.replace(ManychatLead.ig, '@', '')) == ig_n
        ).first()
        if not matched_lead:
            sin_lead += 1
            continue

        # Atribución GLOBAL (sin limitarse a ad_ids del periodo)
        closest = LeadAnswer.query.filter(
            LeadAnswer.lead_id == matched_lead.id,
            LeadAnswer.ad_id != None,
            LeadAnswer.created_at <= sale.date
        ).order_by(LeadAnswer.created_at.desc()).first()

        if not closest:
            sin_answer += 1
            continue

        atribuidas += 1
        ventas_por_ad[closest.ad_id] = ventas_por_ad.get(closest.ad_id, 0) + 1
        if sale.monto and float(sale.monto) > 0:
            cash_collect_data[closest.ad_id] = cash_collect_data.get(closest.ad_id, 0) + float(sale.monto)

    print(f"\n--- Resultado de atribución ---")
    print(f"Sin IG: {sin_ig} | Sin Lead: {sin_lead} | Sin Answer: {sin_answer} | Atribuidas: {atribuidas}")
    print(f"Ventas por Ad: {ventas_por_ad}")
    print(f"Cash Collect por Ad: {cash_collect_data}")
