"""Partes de la respuesta de GET /public/lead-roadmap (`lead_roadmap.get_lead_roadmap`) que se arman aparte."""
from datetime import datetime

from app.models import Client
from app.models.marketing import LeadAnswer

from .lead_roadmap_helpers import format_date_es


def build_activity(lead_profile, arrived_stage, manychat_lead, financial_agendas, appointments,
                   financial_sales, comments, client):
    # Construir Historial de Actividad Cronológica
    activity = []

    # 1. Llegada
    activity.append({
        "date": lead_profile["created_at"],
        "event": "Llegó al embudo",
        "detail": f"Prospecto ingresó al sistema. Origen resuelto: {arrived_stage['details']['origen']}",
        "origin": "ManyChat" if manychat_lead else "Sistema"
    })

    # 2. Respuestas de bot
    if manychat_lead:
        answers = LeadAnswer.query.filter_by(lead_id=manychat_lead.id).all()
        for la in answers:
            activity.append({
                "date": la.created_at.isoformat() if la.created_at else lead_profile["created_at"],
                "event": "Interacción Bot",
                "detail": f"Keyword: {la.keyword} | Opción: {la.id_option_send or 'Seleccionada'} (Calificación: {la.qualification})",
                "origin": "ManyChat"
            })

    # 3. Agendas
    seen_agenda_dates = set()
    for fa in financial_agendas:
        fecha_formateada = ""
        if fa.date:
            fecha_formateada = format_date_es(fa.date)
        elif fa.fecha_meet:
            fecha_formateada = fa.fecha_meet.split('T')[0]
        else:
            fecha_formateada = "N/A"

        if fecha_formateada in seen_agenda_dates and fecha_formateada != "N/A":
            continue
        seen_agenda_dates.add(fecha_formateada)

        activity.append({
            "id": fa.id,
            "event_type": "agenda",
            "date": fa.registro if fa.registro else (fa.date.isoformat() if fa.date else (fa.created_at.isoformat() if fa.created_at else lead_profile["created_at"])),
            "event": "Agenda Creada",
            "detail": f"Cita programada para {fecha_formateada} con closer: {fa.closer or 'Sin asignar'} (Fuente: {fa.nombre})",
            "origin": "Calendly / Webhook"
        })

    # 4. Appointments locales
    for appt in appointments:
        if appt.result or appt.start_time < datetime.utcnow():
            activity.append({
                "date": appt.start_time.isoformat(),
                "event": "Llamada Realizada",
                "detail": f"Resultado: {appt.result or 'Terminada'}. Notas: {appt.closer_notes or 'Sin notas'}",
                "origin": "Closer"
            })

    # 5. Ventas financieras
    seen_sale_dates = set()
    for fs in financial_sales:
        fecha_venta_str = fs.date.strftime('%Y-%m-%d') if fs.date else "N/A"
        if fecha_venta_str in seen_sale_dates and fecha_venta_str != "N/A":
            continue
        seen_sale_dates.add(fecha_venta_str)

        activity.append({
            "id": fs.id,
            "event_type": "sale",
            "date": fs.date.isoformat() if fs.date else lead_profile["created_at"],
            "event": "Venta Registrada",
            "detail": f"Declarada venta de {fs.tipo_pago} por ${fs.monto} via {fs.metodo_pago} (Estado: {fs.estado or 'Completada'})",
            "origin": "Closer"
        })

    # 6. Comentarios / Notas Internas
    for c in comments:
        activity.append({
            "date": c.created_at.isoformat(),
            "event": f"Nota de {c.author_rel.username if c.author_rel else 'Desconocido'}",
            "detail": c.text,
            "origin": "Notas Internas"
        })

    # 6b. Calificación manual
    if client and (client.dolores or client.objeciones or client.observaciones):
        detail_parts = []
        if client.dolores:
            detail_parts.append(f"Dolores: {client.dolores}")
        if client.objeciones:
            detail_parts.append(f"Objeciones: {client.objeciones}")
        if client.observaciones:
            detail_parts.append(f"Obs. Call Confirmer: {client.observaciones}")
            
        activity.append({
            "date": client.created_at.isoformat() if client.created_at else lead_profile["created_at"],
            "event": "Calificación Registrada",
            "detail": " | ".join(detail_parts),
            "origin": "Call Confirmer"
        })

    # Ordenar por fecha descendentemente
    activity.sort(key=lambda x: x["date"] or "", reverse=True)
    return activity


def _ventas_por_programa(client):
    """[(programa, fecha de ingreso, cobrado)] de las ventas vigentes de la persona del cliente (o del
    cliente, sin persona), una por programa (Etapa 2c: reemplaza las inscripciones `Enrollment`).
    El ingreso es la venta nueva más vieja del programa; lo cobrado, los pagos completados de sus ventas."""
    from app.models import FinancialSale, Sale
    from app.services.comercial_vocabulario import venta_completada

    suyas = Sale.person_uuid == client.person_uuid if client.person_uuid else Sale.client_id == client.id
    ventas = Sale.query.filter(suyas, Sale.status == 'active').order_by(Sale.sold_at).all()
    por_programa = {}
    for v in ventas:  # en orden de venta: la primera nueva es el ingreso; sin nueva, la primera
        fila = por_programa.setdefault(v.program_code, {'ingreso': None, 'nueva': False, 'ids': []})
        fila['ids'].append(v.id)
        if fila['ingreso'] is None or (v.kind == 'new' and not fila['nueva']):
            fila['ingreso'], fila['nueva'] = v.sold_at, v.kind == 'new'
    cobrado = {}
    ids = [i for f in por_programa.values() for i in f['ids']]
    if ids:
        de_venta = {i: p for p, f in por_programa.items() for i in f['ids']}
        for pago in FinancialSale.query.filter(FinancialSale.sale_id.in_(ids)).all():
            if venta_completada(pago):
                programa = de_venta[pago.sale_id]
                cobrado[programa] = cobrado.get(programa, 0.0) + float(pago.monto or 0)
    return [(p, f['ingreso'], round(cobrado.get(p, 0.0), 2)) for p, f in por_programa.items()]


def build_programs(client, financial_sales):
    # 7. Permanencia en Programas: las ventas de la persona (antes, las inscripciones del espejo)
    from app.services.closer_service import PROGRAM_LABELS

    programs_list = []
    seen_program_names = set()

    if client:
        for programa, ingreso, total_paid in _ventas_por_programa(client):
            program_name = PROGRAM_LABELS.get(programa) or programa or "Programa a definir"
            seen_program_names.add(program_name.lower().strip())
            days_enrolled = (datetime.utcnow() - ingreso).days if ingreso else 0
            permanence_str = f"{days_enrolled} días"
            if days_enrolled >= 30:
                months = days_enrolled // 30
                rem_days = days_enrolled % 30
                permanence_str = f"{months} mes(es)"
                if rem_days > 0:
                    permanence_str += f" y {rem_days} día(s)"
                
            programs_list.append({
                "program_name": program_name,
                "enrollment_date": ingreso.isoformat() if ingreso else None,
                "total_paid": total_paid,
                "permanence": permanence_str,
                "source": "Venta"
            })

    # Integrar también desde FinancialSales
    for fs in financial_sales:
        if not fs.tipo_pago:
            continue
        p_name = fs.tipo_pago.strip()
        if p_name.lower().strip() in seen_program_names:
            continue
            
        seen_program_names.add(p_name.lower().strip())
        
        days_enrolled = (datetime.utcnow() - fs.date).days if fs.date else 0
        permanence_str = f"{days_enrolled} días"
        if days_enrolled >= 30:
            months = days_enrolled // 30
            rem_days = days_enrolled % 30
            permanence_str = f"{months} mes(es)"
            if rem_days > 0:
                permanence_str += f" y {rem_days} día(s)"
                
        total_paid_product = sum(sale.monto or 0.0 for sale in financial_sales if sale.tipo_pago and sale.tipo_pago.strip().lower() == p_name.lower())
        
        programs_list.append({
            "program_name": p_name,
            "enrollment_date": fs.date.isoformat() if fs.date else None,
            "total_paid": total_paid_product,
            "permanence": permanence_str,
            "source": "Venta Declarada"
        })
    return programs_list


def frequent_objections_and_dolores():
    # Objeciones y dolores mas frecuentes
    all_clients = Client.query.with_entities(Client.objeciones, Client.dolores).all()
    objection_counts = {}
    dolores_counts = {}
    for c_obj, c_dol in all_clients:
        if c_obj:
            for obj in c_obj.split(','):
                obj_clean = obj.strip()
                if obj_clean:
                    objection_counts[obj_clean] = objection_counts.get(obj_clean, 0) + 1
        if c_dol:
            for dol in c_dol.split(','):
                dol_clean = dol.strip()
                if dol_clean:
                    dolores_counts[dol_clean] = dolores_counts.get(dol_clean, 0) + 1

    frequent_objections = sorted(objection_counts.keys(), key=lambda k: objection_counts[k], reverse=True)[:10]
    frequent_dolores = sorted(dolores_counts.keys(), key=lambda k: dolores_counts[k], reverse=True)[:10]
    return frequent_objections, frequent_dolores
