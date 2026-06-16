from datetime import datetime, date, timedelta
from app import db
from app.models import AlertRule, Alert, Ad, AdSet, Campaign, AdPeriodSpend, LeadAnswer, ManychatLead, FinancialAgenda, FinancialSale, Integration
import requests
import json
import os

class AlertService:
    @staticmethod
    def evaluate_rules():
        """
        Evalúa todas las reglas de alerta activas, genera las alertas correspondientes
        y envía notificaciones a la plataforma y Discord.
        """
        active_rules = AlertRule.query.filter_by(is_active=True).all()
        today = date.today()
        new_alerts_count = 0

        for rule in active_rules:
            try:
                # 1. Determinar rangos de fechas
                start_date, end_date = AlertService._get_dates_for_period(rule.period, today)
                
                # 2. Obtener valor actual de la métrica
                current_value = 0.0
                percentage_change = None
                
                if rule.period == 'vs_previous_week':
                    # Comparación porcentual vs semana anterior
                    start_1, end_1 = AlertService._get_dates_for_period('7_days', today)
                    start_2, end_2 = AlertService._get_dates_for_period('7_days_prior', today)
                    
                    v1 = AlertService._calculate_metric_value(rule.metric, start_1, end_1, rule.scope_type, rule.scope_value)
                    v2 = AlertService._calculate_metric_value(rule.metric, start_2, end_2, rule.scope_type, rule.scope_value)
                    
                    if v2 > 0:
                        percentage_change = ((v1 - v2) / v2) * 100
                    else:
                        percentage_change = 100.0 if v1 > 0 else 0.0
                    current_value = percentage_change
                else:
                    current_value = AlertService._calculate_metric_value(rule.metric, start_date, end_date, rule.scope_type, rule.scope_value)
                    # Calcular el porcentaje de cambio vs la semana anterior para mayor contexto (opcional)
                    try:
                        start_2, end_2 = AlertService._get_dates_for_period('7_days_prior', today)
                        v2 = AlertService._calculate_metric_value(rule.metric, start_2, end_date - timedelta(days=7), rule.scope_type, rule.scope_value)
                        if v2 > 0:
                            percentage_change = ((current_value - v2) / v2) * 100
                    except:
                        pass

                # 3. Validar si se cumple la condición
                triggered = False
                if rule.condition == '>':
                    triggered = current_value > rule.value
                elif rule.condition == '<':
                    triggered = current_value < rule.value
                
                if triggered:
                    # 4. Evitar duplicados (no crear si ya existe una alerta activa para la misma regla hoy)
                    time_threshold = datetime.utcnow() - timedelta(hours=24)
                    existing_alert = Alert.query.filter(
                        Alert.rule_id == rule.id,
                        Alert.is_resolved == False,
                        Alert.created_at >= time_threshold
                    ).first()
                    
                    if not existing_alert:
                        # Crear la alerta
                        alert = AlertService._create_alert_record(rule, current_value, percentage_change)
                        new_alerts_count += 1
                        
                        # Notificar a Discord
                        if rule.notify_discord:
                            AlertService._send_to_discord(alert)
                            
            except Exception as e:
                import logging
                logging.getLogger(__name__).error(f"Error al evaluar la regla {rule.id} ({rule.name}): {str(e)}")
                db.session.rollback()

        return new_alerts_count

    @staticmethod
    def _get_dates_for_period(period, today):
        if period == '7_days':
            return today - timedelta(days=6), today
        elif period == '7_days_prior':
            return today - timedelta(days=13), today - timedelta(days=7)
        elif period == '1_day':
            return today - timedelta(days=1), today - timedelta(days=1)
        # Default de seguridad
        return today, today

    @staticmethod
    def _calculate_metric_value(metric, start_date, end_date, scope_type, scope_value):
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())
        
        # Resolver anuncios (Ads) asociados al ámbito (Scope)
        ads = []
        if scope_type == 'keyword' and scope_value:
            ads = Ad.query.filter(Ad.keyword.ilike(scope_value.strip())).all()
        elif scope_type == 'campaign' and scope_value:
            campaign = Campaign.query.filter(Campaign.name.ilike(scope_value.strip())).first()
            if campaign:
                ads = Ad.query.join(AdSet).filter(AdSet.campaign_id == campaign.id).all()
        elif scope_type == 'ad' and scope_value:
            ads = Ad.query.filter(Ad.name.ilike(scope_value.strip())).all()
        else:
            ads = Ad.query.all()
            
        ad_ids = [a.id for a in ads]
        
        # Métricas de Marketing
        if metric in ('cpl', 'cpql', 'leads', 'inversion'):
            if not ad_ids:
                return 0.0
                
            # Calcular inversión (spend) prorrateada
            spend = AlertService._calculate_spend_for_ads(ads, start_date, end_date)
            
            # Leads
            leads_count = LeadAnswer.query.filter(
                LeadAnswer.ad_id.in_(ad_ids),
                LeadAnswer.created_at >= start_dt,
                LeadAnswer.created_at <= end_dt
            ).count()
            
            if metric == 'inversion':
                return round(spend, 2)
            elif metric == 'leads':
                return float(leads_count)
            elif metric == 'cpl':
                return round(spend / leads_count, 2) if leads_count > 0 else 0.0
            elif metric == 'cpql':
                qual_count = LeadAnswer.query.filter(
                    LeadAnswer.ad_id.in_(ad_ids),
                    LeadAnswer.qualification == 'true',
                    LeadAnswer.created_at >= start_dt,
                    LeadAnswer.created_at <= end_dt
                ).count()
                return round(spend / qual_count, 2) if qual_count > 0 else 0.0

        # Métricas de Agendas y Ventas
        elif metric in ('agendas', 'ventas', 'cash_collect'):
            # Obtener IGs asociados a los leads de este ámbito
            ig_list = []
            if scope_type != 'all' and ad_ids:
                ig_rows = db.session.query(ManychatLead.ig).join(LeadAnswer, LeadAnswer.lead_id == ManychatLead.id)\
                            .filter(LeadAnswer.ad_id.in_(ad_ids), ManychatLead.ig != None).all()
                ig_list = [row.ig.strip().lstrip('@').lower() for row in ig_rows if row.ig]

            # Agendas
            if metric == 'agendas':
                query = FinancialAgenda.query.filter(
                    FinancialAgenda.date >= start_dt,
                    FinancialAgenda.date <= end_dt
                )
                if scope_type != 'all' and ig_list:
                    # Filtrar agendas por IG coincidente
                    agendas = query.all()
                    match_count = 0
                    for ag in agendas:
                        ig_val = ag.instagram or (ag.raw_data or {}).get('instagram') or (ag.raw_data or {}).get('ig')
                        if ig_val and ig_val.strip().lstrip('@').lower() in ig_list:
                            match_count += 1
                    return float(match_count)
                return float(query.count())
                
            # Ventas / Recaudación
            elif metric in ('ventas', 'cash_collect'):
                query = FinancialSale.query.filter(
                    FinancialSale.date >= start_dt,
                    FinancialSale.date <= end_dt,
                    db.or_(FinancialSale.estado == 'Completada', FinancialSale.estado == None, FinancialSale.estado == '')
                )
                if scope_type != 'all' and ig_list:
                    sales = query.all()
                    matched_sales = []
                    for s in sales:
                        ig_val = s.instagram or (s.raw_data or {}).get('instagram') or (s.raw_data or {}).get('ig')
                        if ig_val and ig_val.strip().lstrip('@').lower() in ig_list:
                            matched_sales.append(s)
                    if metric == 'cash_collect':
                        return sum(float(s.monto or 0.0) for s in matched_sales)
                    return float(len(matched_sales))
                
                if metric == 'cash_collect':
                    return sum(float(s.monto or 0.0) for s in query.all())
                return float(query.count())

        return 0.0

    @staticmethod
    def _calculate_spend_for_ads(ad_list, start_date, end_date):
        ad_ids = [a.id for a in ad_list]
        adset_ids = list(set(a.ad_set_id for a in ad_list if a.ad_set_id))
        campaign_ids = list(set(a.ad_set.campaign_id for a in ad_list if a.ad_set and a.ad_set.campaign_id))
        
        spends = AdPeriodSpend.query.filter(
            db.or_(
                AdPeriodSpend.ad_id.in_(ad_ids),
                AdPeriodSpend.ad_set_id.in_(adset_ids),
                AdPeriodSpend.campaign_id.in_(campaign_ids)
            ),
            AdPeriodSpend.start_date <= end_date,
            AdPeriodSpend.end_date >= start_date
        ).all()
        
        spend_by_ad = {}
        spend_by_adset = {}
        spend_by_campaign = {}
        
        for ps in spends:
            overlap_start = max(ps.start_date, start_date)
            overlap_end = min(ps.end_date, end_date)
            overlap_days = (overlap_end - overlap_start).days + 1
            total_days = (ps.end_date - ps.start_date).days + 1
            if total_days > 0 and overlap_days > 0:
                prorated_spend = ps.spend * (overlap_days / total_days)
                if ps.ad_id:
                    spend_by_ad[ps.ad_id] = spend_by_ad.get(ps.ad_id, 0.0) + prorated_spend
                if ps.ad_set_id:
                    spend_by_adset[ps.ad_set_id] = spend_by_adset.get(ps.ad_set_id, 0.0) + prorated_spend
                if ps.campaign_id:
                    spend_by_campaign[ps.campaign_id] = spend_by_campaign.get(ps.campaign_id, 0.0) + prorated_spend
                    
        ads_per_adset = {}
        for a in Ad.query.filter(Ad.ad_set_id.in_(adset_ids)).all():
            ads_per_adset[a.ad_set_id] = ads_per_adset.get(a.ad_set_id, 0) + 1
            
        ads_per_campaign = {}
        for a_set in AdSet.query.filter(AdSet.campaign_id.in_(campaign_ids)).all():
            count = ads_per_adset.get(a_set.id, 0)
            ads_per_campaign[a_set.campaign_id] = ads_per_campaign.get(a_set.campaign_id, 0) + count
            
        total_spend = 0.0
        today = date.today()
        for ad in ad_list:
            if spend_by_ad.get(ad.id, 0.0) > 0.0:
                total_spend += spend_by_ad[ad.id]
            elif ad.ad_set_id and spend_by_adset.get(ad.ad_set_id, 0.0) > 0.0:
                total_spend += spend_by_adset[ad.ad_set_id] / max(1, ads_per_adset.get(ad.ad_set_id, 1))
            elif ad.ad_set and spend_by_campaign.get(ad.ad_set.campaign_id, 0.0) > 0.0:
                total_spend += spend_by_campaign[ad.ad_set.campaign_id] / max(1, ads_per_campaign.get(ad.ad_set.campaign_id, 1))
            else:
                # Fallback prorrateado del spend histórico
                days_range = (end_date - start_date).days + 1
                ad_days = (today - (ad.created_at.date() if ad.created_at else today)).days + 1
                daily_rate = (ad.total_spend or 0.0) / max(1, ad_days)
                total_spend += daily_rate * days_range
                
        return total_spend

    @staticmethod
    def _create_alert_record(rule, current_value, percentage_change):
        # Mapeo de nombres descriptivos
        metric_labels = {
            'cpl': 'CPL (Costo por lead)',
            'cpql': 'CPQL (Costo por lead cualificado)',
            'leads': 'Leads totales',
            'inversion': 'Inversión',
            'agendas': 'Agendas creadas',
            'ventas': 'Ventas concretadas',
            'cash_collect': 'Cash Collect'
        }
        
        lbl_metric = metric_labels.get(rule.metric, rule.metric.upper())
        lbl_condition = 'superó' if rule.condition == '>' else 'cayó por debajo de'
        lbl_symbol = '$' if rule.metric in ('cpl', 'cpql', 'inversion', 'cash_collect') else ''
        
        title = f"Desviación en {lbl_metric}"
        if rule.metric == 'cpl' and rule.condition == '>':
            title = "El costo por lead ha subido"
        elif rule.metric == 'leads' and rule.condition == '<':
            title = "Disminución en volumen de leads"
        elif rule.metric == 'inversion' and rule.condition == '>':
            title = "Inversión diaria alta"
        elif rule.metric == 'agendas' and rule.condition == '<':
            title = "Agendas bajas"

        scope_desc = "Todas las campañas"
        if rule.scope_type == 'keyword':
            scope_desc = f"Palabra clave: {rule.scope_value}"
        elif rule.scope_type == 'campaign':
            scope_desc = f"Campaña: {rule.scope_value}"
        elif rule.scope_type == 'ad':
            scope_desc = f"Anuncio: {rule.scope_value}"

        explanation = f"El {lbl_metric} actual ({lbl_symbol}{current_value:,.2f}) {lbl_condition} el límite establecido de {lbl_symbol}{rule.value:,.2f} ({rule.period.replace('_', ' ')})."
        
        # Acciones recomendadas
        recommended_action = (
            "• Revisar la relevancia del anuncio y concordancia de la keyword.\n"
            "• Optimizar la landing page para mejorar el porcentaje de conversión.\n"
            "• Ajustar la estrategia de puja o segmentación del público objetivo."
        )
        if rule.metric == 'inversion':
            recommended_action = (
                "• Verificar si se ha superado el presupuesto diario configurado en Meta.\n"
                "• Pausar temporalmente anuncios de bajo rendimiento.\n"
                "• Ajustar límites de gasto diario en la campaña."
            )
        elif rule.metric == 'agendas':
            recommended_action = (
                "• Evaluar la tenacidad del setting y tiempos de respuesta de los setters.\n"
                "• Verificar el flujo automatizado del bot en ManyChat.\n"
                "• Ajustar la oferta y llamadas a la acción."
            )

        # Enlace directo
        target_url = "/admin/marketing"
        if rule.scope_type == 'keyword':
            target_url = f"/admin/marketing?keyword={rule.scope_value}"

        alert = Alert(
            rule_id=rule.id,
            title=title,
            metric=rule.metric,
            severity=rule.severity,
            scope_value=scope_desc,
            current_value=float(current_value),
            expected_limit=float(rule.value),
            percentage_change=float(percentage_change) if percentage_change is not None else None,
            associated_item=rule.scope_value,
            explanation=explanation,
            recommended_action=recommended_action,
            target_url=target_url,
            is_resolved=False
        )
        db.session.add(alert)
        db.session.commit()
        return alert

    @staticmethod
    def _send_to_discord(alert):
        """Envía una alerta de severidad crítica o advertencia al canal de Discord."""
        try:
            # Buscar webhook en la base de datos o env
            webhook_url = os.environ.get('DISCORD_ALERTS_WEBHOOK')
            if not webhook_url:
                integration = Integration.query.filter_by(key='discord_alerts').first()
                if integration:
                    webhook_url = integration.url_prod if integration.active_env == 'prod' else integration.url_dev

            # Fallback al canal predeterminado de reportes si no hay ninguno configurado
            if not webhook_url:
                webhook_url = "https://discord.com/api/webhooks/1482070325641347288/fFK0OKoDIRngTIzh1kl81_Um8GrtFg62Z3TK4Rq0qgjQtU3jNqlOOLZ4lw1c_0qV0drX"

            # Elegir color del embed según severidad
            colors = {
                'critical': 15548997,  # Rojo
                'warning': 16753920,   # Naranja/Amarillo
                'info': 3447003,       # Azul
                'opportunity': 3066993  # Verde
            }
            color = colors.get(alert.severity.lower(), 12370112)

            symbol = '$' if alert.metric in ('cpl', 'cpql', 'inversion', 'cash_collect') else ''
            pct_text = f" ({alert.percentage_change:+.1f}%)" if alert.percentage_change is not None else ""

            embed = {
                "title": f"🚨 ALERTA: {alert.title.upper()}",
                "description": alert.explanation,
                "color": color,
                "fields": [
                    {"name": "Ámbito / Elemento", "value": alert.scope_value or "General", "inline": True},
                    {"name": "Severidad", "value": alert.severity.upper(), "inline": True},
                    {"name": "Valor Actual", "value": f"{symbol}{alert.current_value:,.2f}{pct_text}", "inline": True},
                    {"name": "Límite Esperado", "value": f"{symbol}{alert.expected_limit:,.2f}", "inline": True},
                    {"name": "Acciones Sugeridas", "value": alert.recommended_action or "Ninguna", "inline": False}
                ],
                "timestamp": datetime.utcnow().isoformat()
            }

            # Si hay una URL en Railway, podemos agregar el botón de ir al dashboard
            domain = "https://work.thelearnation.com"
            payload = {
                "content": f"⚠️ **Nueva Alerta en NeurOPS Platform**",
                "embeds": [embed],
                "components": [
                    {
                        "type": 1,
                        "components": [
                            {
                                "type": 2,
                                "label": "Abrir en Plataforma",
                                "style": 5,
                                "url": f"{domain}{alert.target_url}"
                            }
                        ]
                    }
                ]
            }

            res = requests.post(webhook_url, json=payload, timeout=10)
            if res.status_code in (200, 204):
                alert.discord_sent = True
                db.session.commit()
                print(f"[AlertService] Alerta de Discord enviada con éxito. Status: {res.status_code}")
            else:
                print(f"[AlertService] Error enviando a Discord. Status: {res.status_code}. Response: {res.text}")

        except Exception as e:
            print(f"[AlertService] Excepción enviando notificación de Discord: {str(e)}")
