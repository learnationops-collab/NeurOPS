from datetime import datetime, timedelta, date
from sqlalchemy import func
from app import db
from app.models import (
    Campaign, AdSet, Ad, LeadAnswer, ManychatLead,
    FinancialAgenda, FinancialSale, AdPeriodSpend
)

class MarketingService:
    @staticmethod
    def ensure_inbound_ad_exists():
        """Garantiza que el anuncio Inbound ficticio exista en la BD."""
        try:
            # 1. Buscar o crear campaña
            campaign = Campaign.query.filter_by(name='Inbound').first()
            if not campaign:
                campaign = Campaign(
                    name='Inbound',
                    status='active',
                    type='organic',
                    external_id='CAM-INBOUND'
                )
                db.session.add(campaign)
                db.session.flush()

            # 2. Buscar o crear AdSet
            ad_set = AdSet.query.filter_by(campaign_id=campaign.id, name='Inbound Grupo').first()
            if not ad_set:
                ad_set = AdSet(
                    name='Inbound Grupo',
                    campaign_id=campaign.id,
                    status='active',
                    external_id='SET-INBOUND'
                )
                db.session.add(ad_set)
                db.session.flush()

            # 3. Buscar o crear anuncio
            ad = Ad.query.filter_by(ad_set_id=ad_set.id, keyword='Inbound').first()
            if not ad:
                ad = Ad(
                    name='Inbound',
                    ad_set_id=ad_set.id,
                    keyword='Inbound',
                    status='active',
                    total_spend=0.0,
                    external_id='ADS-INBOUND'
                )
                db.session.add(ad)
                db.session.commit()
            elif ad.name != 'Inbound':
                ad.name = 'Inbound'
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            import logging
            logging.getLogger(__name__).error(f"Error al asegurar ad Inbound en servicio: {str(e)}")

    @staticmethod
    def get_ad_performance_data(period, start_str=None, end_str=None):
        """Calcula métricas de rendimiento por anuncio y datos sin asignar."""
        MarketingService.ensure_inbound_ad_exists()

        today = date.today()

        # Determinar fechas de inicio y fin
        if start_str and end_str:
            try:
                start_dt = datetime.combine(datetime.strptime(start_str, '%Y-%m-%d').date(), datetime.min.time())
                end_dt   = datetime.combine(datetime.strptime(end_str, '%Y-%m-%d').date(), datetime.max.time())
            except ValueError:
                start_dt = datetime.combine(today - timedelta(days=30), datetime.min.time())
                end_dt   = datetime.combine(today, datetime.max.time())
        elif period == 'yesterday':
            start_dt = datetime.combine(today - timedelta(days=1), datetime.min.time())
            end_dt   = datetime.combine(today - timedelta(days=1), datetime.max.time())
        elif period == 'last_week':
            start_dt = datetime.combine(today - timedelta(days=7), datetime.min.time())
            end_dt   = datetime.combine(today, datetime.max.time())
        else: # last_month (defecto)
            start_dt = datetime.combine(today - timedelta(days=30), datetime.min.time())
            end_dt   = datetime.combine(today, datetime.max.time())

        start_date_only = start_dt.date()
        end_date_only   = end_dt.date()

        def normalize_ig(ig_str):
            if not ig_str or not isinstance(ig_str, str) or ig_str.lower() in ('n/a', ''):
                return None
            return ig_str.strip().lstrip('@').lower()

        # 1. Obtener todos los anuncios, conjuntos y campañas
        ads_raw = db.session.query(Ad, AdSet, Campaign)\
            .outerjoin(AdSet, Ad.ad_set_id == AdSet.id)\
            .outerjoin(Campaign, AdSet.campaign_id == Campaign.id)\
            .all()

        ads_map = {a.id: a for a, _, _ in ads_raw}
        adset_map = {a.id: s for a, s, _ in ads_raw}
        campaign_map = {a.id: c for a, _, c in ads_raw}
        ad_ids = list(ads_map.keys())

        # 2. Leads por anuncio en el periodo
        lead_stats = db.session.query(
            LeadAnswer.ad_id,
            func.count(LeadAnswer.id).label('total_leads')
        ).filter(
            LeadAnswer.ad_id != None,
            LeadAnswer.created_at >= start_dt,
            LeadAnswer.created_at <= end_dt
        ).group_by(LeadAnswer.ad_id).all()
        leads_by_ad = {r.ad_id: r.total_leads for r in lead_stats}

        # 3. Gasto (spend) por anuncio en el periodo
        # a) Gasto directo
        ad_spends_direct = db.session.query(
            AdPeriodSpend.ad_id,
            func.sum(AdPeriodSpend.spend).label('total')
        ).filter(
            AdPeriodSpend.ad_id.in_(ad_ids),
            AdPeriodSpend.start_date >= start_date_only,
            AdPeriodSpend.end_date   <= end_date_only
        ).group_by(AdPeriodSpend.ad_id).all()
        spend_by_ad = {r.ad_id: float(r.total or 0) for r in ad_spends_direct}

        # b) Gasto por ad_set
        adset_ids = list({adset_map[aid].id for aid in ad_ids if adset_map.get(aid)})
        if adset_ids:
            adset_spends = db.session.query(
                AdPeriodSpend.ad_set_id,
                func.sum(AdPeriodSpend.spend).label('total')
            ).filter(
                AdPeriodSpend.ad_set_id.in_(adset_ids),
                AdPeriodSpend.start_date >= start_date_only,
                AdPeriodSpend.end_date   <= end_date_only
            ).group_by(AdPeriodSpend.ad_set_id).all()
            adset_spend_map = {r.ad_set_id: float(r.total or 0) for r in adset_spends}

            ads_per_adset = {}
            for aid in ad_ids:
                s = adset_map.get(aid)
                if s:
                    ads_per_adset[s.id] = ads_per_adset.get(s.id, 0) + 1
        else:
            adset_spend_map = {}
            ads_per_adset = {}

        # c) Gasto por campaign
        campaign_ids = list({campaign_map[aid].id for aid in ad_ids if campaign_map.get(aid)})
        if campaign_ids:
            campaign_spends = db.session.query(
                AdPeriodSpend.campaign_id,
                func.sum(AdPeriodSpend.spend).label('total')
            ).filter(
                AdPeriodSpend.campaign_id.in_(campaign_ids),
                AdPeriodSpend.start_date >= start_date_only,
                AdPeriodSpend.end_date   <= end_date_only
            ).group_by(AdPeriodSpend.campaign_id).all()
            campaign_spend_map = {r.campaign_id: float(r.total or 0) for r in campaign_spends}

            ads_per_campaign = {}
            for aid in ad_ids:
                c = campaign_map.get(aid)
                if c:
                    ads_per_campaign[c.id] = ads_per_campaign.get(c.id, 0) + 1
        else:
            campaign_spend_map = {}
            ads_per_campaign = {}

        def resolve_spend(ad_id: int) -> float:
            # 1. Directo por periodo
            if spend_by_ad.get(ad_id, 0) > 0:
                return spend_by_ad[ad_id]
            # 2. Prorrateado por AdSet
            s = adset_map.get(ad_id)
            if s and adset_spend_map.get(s.id, 0) > 0:
                count = ads_per_adset.get(s.id, 1)
                return round(adset_spend_map[s.id] / count, 2)
            # 3. Prorrateado por Campaña
            c = campaign_map.get(ad_id)
            if c and campaign_spend_map.get(c.id, 0) > 0:
                count = ads_per_campaign.get(c.id, 1)
                return round(campaign_spend_map[c.id] / count, 2)
            # 4. Histórico
            ad = ads_map.get(ad_id)
            return float(ad.total_spend or 0.0) if ad else 0.0

        # 4. Agendas atribuidas y sin asignar
        agendas_in_period = FinancialAgenda.query.filter(
            FinancialAgenda.date >= start_dt,
            FinancialAgenda.date <= end_dt
        ).all()

        agendas_por_ad = {}
        agendas_sin_asignar = 0

        for agenda in agendas_in_period:
            ig_val = agenda.instagram or (agenda.raw_data or {}).get('instagram') or (agenda.raw_data or {}).get('ig')
            ig_norm = normalize_ig(ig_val)

            matched_lead = None
            if ig_norm:
                matched_lead = ManychatLead.query.filter(
                    db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_norm
                ).first()

            if not matched_lead:
                nombre_norm = (agenda.nombre or '').strip().lower()
                if nombre_norm:
                    matched_lead = ManychatLead.query.filter(
                        db.func.lower(ManychatLead.name) == nombre_norm
                    ).first()

            if not matched_lead:
                agendas_sin_asignar += 1
                continue

            closest = LeadAnswer.query.filter(
                LeadAnswer.lead_id == matched_lead.id,
                LeadAnswer.ad_id != None,
                LeadAnswer.created_at <= agenda.date
            ).order_by(LeadAnswer.created_at.desc()).first()

            if closest and closest.ad_id:
                agendas_por_ad[closest.ad_id] = agendas_por_ad.get(closest.ad_id, 0) + 1
            else:
                agendas_sin_asignar += 1

        # 5. Ventas, Cash Collect atribuidos y sin asignar
        sales_in_period = FinancialSale.query.filter(
            FinancialSale.date >= start_dt,
            FinancialSale.date <= end_dt
        ).all()

        ventas_por_ad = {}
        monto_por_ad = {}
        ventas_sin_asignar = 0
        monto_sin_asignar = 0.0

        for sale in sales_in_period:
            ig_val = sale.instagram or (sale.raw_data or {}).get('instagram') or (sale.raw_data or {}).get('ig')
            ig_norm = normalize_ig(ig_val)

            matched_lead = None
            if ig_norm:
                matched_lead = ManychatLead.query.filter(
                    db.func.lower(db.func.replace(ManychatLead.ig, '@', '')) == ig_norm
                ).first()

            if not matched_lead:
                nombre_norm = (sale.nombre_cliente or '').strip().lower()
                if nombre_norm:
                    matched_lead = ManychatLead.query.filter(
                        db.func.lower(ManychatLead.name) == nombre_norm
                    ).first()

            if not matched_lead:
                ventas_sin_asignar += 1
                monto_sin_asignar += float(sale.monto or 0.0)
                continue

            closest = LeadAnswer.query.filter(
                LeadAnswer.lead_id == matched_lead.id,
                LeadAnswer.ad_id != None,
                LeadAnswer.created_at <= sale.date
            ).order_by(LeadAnswer.created_at.desc()).first()

            if closest and closest.ad_id:
                ventas_por_ad[closest.ad_id] = ventas_por_ad.get(closest.ad_id, 0) + 1
                monto_por_ad[closest.ad_id] = monto_por_ad.get(closest.ad_id, 0.0) + float(sale.monto or 0.0)
            else:
                ventas_sin_asignar += 1
                monto_sin_asignar += float(sale.monto or 0.0)

        # 6. Construir resultado final
        result = []

        for ad_id in ad_ids:
            ad = ads_map[ad_id]
            leads_count = leads_by_ad.get(ad_id, 0)
            spend = resolve_spend(ad_id)
            agendas_count = agendas_por_ad.get(ad_id, 0)
            ventas_count = ventas_por_ad.get(ad_id, 0)
            cash_collect = round(monto_por_ad.get(ad_id, 0.0), 2)

            # Omitir anuncios inactivos sin métricas
            if leads_count == 0 and spend == 0.0 and agendas_count == 0 and ventas_count == 0 and cash_collect == 0.0:
                continue

            adset = adset_map.get(ad_id)
            campaign = campaign_map.get(ad_id)

            cpl = round(spend / leads_count, 2) if leads_count > 0 and spend > 0 else 0
            cpa = round(spend / agendas_count, 2) if agendas_count > 0 and spend > 0 else 0
            cpv = round(spend / ventas_count, 2) if ventas_count > 0 and spend > 0 else 0
            roas = round(cash_collect / spend, 2) if spend > 0 else 0.0

            result.append({
                'ad_id': ad_id,
                'ad_name': ad.name,
                'adset_name': adset.name if adset else '—',
                'campaign_name': campaign.name if campaign else '—',
                'spend': spend,
                'leads': leads_count,
                'cpl': cpl,
                'agendas': agendas_count,
                'cpa': cpa,
                'ventas': ventas_count,
                'cpv': cpv,
                'cash_collect': cash_collect,
                'roas': roas
            })

        # Añadir fila especial "Ventas desatribuidas"
        if agendas_sin_asignar > 0 or ventas_sin_asignar > 0 or monto_sin_asignar > 0:
            result.append({
                'ad_id': 0,
                'ad_name': 'Ventas desatribuidas',
                'adset_name': '—',
                'campaign_name': '—',
                'spend': 0.0,
                'leads': 0,
                'cpl': 0.0,
                'agendas': agendas_sin_asignar,
                'cpa': 0.0,
                'ventas': ventas_sin_asignar,
                'cpv': 0.0,
                'cash_collect': round(monto_sin_asignar, 2),
                'roas': 0.0
            })

        # Ordenar por leads de mayor a menor
        result.sort(key=lambda x: x['leads'], reverse=True)
        return result
