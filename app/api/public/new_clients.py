from flask import request, jsonify
from app import db
from app.models import FinancialSale, Client
from app.api.public import bp
from datetime import datetime
from sqlalchemy import func, or_

def split_tipo_pago(tp):
    if not tp:
        return "Desconocido", "No Especificado"
    if " - " in tp:
        parts = tp.split(" - ", 1)
        return parts[0].strip(), parts[1].strip()
    return "Desconocido", tp.strip()

def normalize_ig(ig_str):
    if not ig_str or not isinstance(ig_str, str) or ig_str.lower() in ('n/a', ''):
        return None
    return ig_str.strip().lstrip('@').lower()

def normalize_email(email_str):
    if not email_str or not isinstance(email_str, str) or email_str.lower() in ('n/a', ''):
        return None
    return email_str.strip().lower()

class UnionFind:
    def __init__(self):
        self.parent = {}
    
    def find(self, item):
        if item not in self.parent:
            self.parent[item] = item
            return item
        path = []
        while self.parent[item] != self.parent[self.parent[item]]:
            path.append(item)
            item = self.parent[item]
        for node in path:
            self.parent[node] = item
        return item
        
    def union(self, item1, item2):
        root1 = self.find(item1)
        root2 = self.find(item2)
        if root1 != root2:
            self.parent[root1] = root2

@bp.route('/public/new-clients', methods=['GET'])
def get_new_clients_dashboard():
    # Obtener parámetros de consulta
    start_date_str = request.args.get('start_date', default='', type=str).strip()
    end_date_str = request.args.get('end_date', default='', type=str).strip()
    filter_type = request.args.get('filter_type', default='new', type=str).strip().lower()
    search = request.args.get('search', default='', type=str).strip().lower()

    # Procesar rango de fechas
    start_date = None
    end_date = None
    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
        except ValueError:
            pass
    if end_date_str:
        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        except ValueError:
            pass

    # Traer todas las ventas historicas ordenadas por fecha
    sales = FinancialSale.query.order_by(FinancialSale.date.asc()).all()
    
    # Agrupacion Union-Find
    uf = UnionFind()
    for s in sales:
        ig = normalize_ig(s.instagram)
        email = normalize_email(s.mail_cliente)
        if ig and email:
            uf.union(ig, email)

    # Organizar ventas por cliente consolidado
    leads = {}
    for s in sales:
        ig = normalize_ig(s.instagram)
        email = normalize_email(s.mail_cliente)
        
        if ig:
            key = uf.find(ig)
        elif email:
            key = uf.find(email)
        else:
            key = f"sale_{s.id}"

        if key not in leads:
            leads[key] = []
        leads[key].append(s)

    clients_list = []
    
    # Procesar cada cliente consolidado
    for key, group_sales in leads.items():
        # Las ventas ya vienen ordenadas por date.asc() del query, pero nos aseguramos
        sorted_sales = sorted(group_sales, key=lambda x: x.date if x.date else datetime.min)
        if not sorted_sales:
            continue

        first_sale = sorted_sales[0]
        last_sale = sorted_sales[-1]
        
        # Fecha de inicio (primer pago)
        first_date = first_sale.date if first_sale.date else (first_sale.created_at if first_sale.created_at else datetime.min)
        first_date_str = first_date.strftime('%Y-%m-%d') if first_date != datetime.min else ''
        
        # Determinar si clasifica en el periodo del filtro
        in_period = False
        if filter_type == 'new':
            # Solo los que iniciaron en este periodo
            # Su primera venta debe calificar como tipo de ingreso
            _, first_tp = split_tipo_pago(first_sale.tipo_pago)
            first_tp_lower = first_tp.lower().strip()
            is_valid_entry = any(x in first_tp_lower for x in ['seña', 'sena', 'completo', 'parcial'])
            
            if is_valid_entry:
                if start_date and first_date < start_date:
                    continue
                if end_date and first_date > end_date:
                    continue
                in_period = True
            else:
                continue
        else:
            # Todos los que hicieron algun pago en el periodo
            for s in sorted_sales:
                s_date = s.date if s.date else (s.created_at if s.created_at else datetime.min)
                match_start = not start_date or s_date >= start_date
                match_end = not end_date or s_date <= end_date
                if match_start and match_end:
                    in_period = True
                    break
            if not in_period:
                continue

        # Si califica, computar metricas
        client_name = last_sale.nombre_cliente or first_sale.nombre_cliente or 'Desconocido'
        client_instagram = normalize_ig(last_sale.instagram) or normalize_ig(first_sale.instagram) or ''
        client_email = normalize_email(last_sale.mail_cliente) or normalize_email(first_sale.mail_cliente) or ''

        # Buscar el estado de Follow Up en la base de datos local
        db_client = None
        filters_client = []
        if client_instagram:
            filters_client.append(func.lower(func.replace(Client.instagram, '@', '')) == client_instagram)
        if client_email:
            filters_client.append(func.lower(Client.email) == client_email)
        
        if filters_client:
            db_client = Client.query.filter(or_(*filters_client)).first()
            
        follow_up_status = db_client.follow_up_status if db_client and db_client.follow_up_status else 'Por contactar'
        client_id = db_client.id if db_client else None

        # Desglose de pagos historico
        sena_amount = 0.0
        completo_amount = 0.0
        parcial_amount = 0.0
        cuotas_amount = 0.0
        cuotas_count = 0
        renovacion_amount = 0.0
        renovacion_count = 0
        upsells_amount = 0.0
        total_pagado = 0.0

        # Detalle de pagos individuales
        sena_detalle = []
        completo_detalle = []
        parcial_detalle = []
        cuotas_detalle = []
        renovacion_detalle = []
        upsells_detalle = []

        for s in sorted_sales:
            _, simple_tp = split_tipo_pago(s.tipo_pago)
            tp_lower = simple_tp.lower().strip()
            monto_val = float(s.monto or 0.0)
            s_date = s.date.strftime('%d/%m/%Y') if s.date else (s.created_at.strftime('%d/%m/%Y') if s.created_at else 'Sin fecha')
            s_metodo = s.metodo_pago or 'No Especificado'
            
            pago_item = {
                "fecha": s_date,
                "monto": round(monto_val, 2),
                "metodo": s_metodo
            }
            
            if any(x in tp_lower for x in ['seña', 'sena']):
                sena_amount += monto_val
                sena_detalle.append(pago_item)
            elif 'completo' in tp_lower:
                completo_amount += monto_val
                completo_detalle.append(pago_item)
            elif 'parcial' in tp_lower:
                parcial_amount += monto_val
                parcial_detalle.append(pago_item)
            elif 'cuota' in tp_lower:
                cuotas_amount += monto_val
                cuotas_count += 1
                cuotas_detalle.append(pago_item)
            elif 'renovacion' in tp_lower or 'renovación' in tp_lower:
                renovacion_amount += monto_val
                renovacion_count += 1
                renovacion_detalle.append(pago_item)
            elif 'upsell' in tp_lower:
                upsells_amount += monto_val
                upsells_detalle.append(pago_item)
            
            total_pagado += monto_val

        # Programa final (ultimo Upsell si lo hay, si no el del ultimo pago)
        latest_upsell = None
        for s in reversed(sorted_sales):
            _, simple_tp = split_tipo_pago(s.tipo_pago)
            if 'upsell' in simple_tp.lower():
                latest_upsell = s
                break
        
        latest_sale = latest_upsell if latest_upsell else last_sale
        prog_name, _ = split_tipo_pago(latest_sale.tipo_pago)
        
        # Calcular Total a Pagar segun el programa
        total_to_pay = 0.0
        clean_prog = prog_name.upper().strip()
        if clean_prog == 'AL':
            total_to_pay = 750.0
        elif clean_prog == 'RR':
            total_to_pay = 1500.0
        elif clean_prog == 'SI':
            total_to_pay = 2000.0

        # Deuda
        debt = max(0.0, total_to_pay - total_pagado)

        # Recopilar todos los pagos historicos del cliente para el tooltip de total_pagado
        todos_los_pagos = []
        for s in sorted_sales:
            _, simple_tp = split_tipo_pago(s.tipo_pago)
            s_date = s.date.strftime('%d/%m/%Y') if s.date else (s.created_at.strftime('%d/%m/%Y') if s.created_at else 'Sin fecha')
            todos_los_pagos.append({
                "fecha": s_date,
                "monto": round(float(s.monto or 0.0), 2),
                "tipo": simple_tp,
                "metodo": s.metodo_pago or 'No Especificado'
            })

        client_row = {
            "fecha": first_date_str,
            "nombre": client_name,
            "instagram": last_sale.instagram or first_sale.instagram or '',
            "email": last_sale.mail_cliente or first_sale.mail_cliente or '',
            "programa": prog_name,
            "pagos": {
                "sena": round(sena_amount, 2),
                "completo": round(completo_amount, 2),
                "parcial": round(parcial_amount, 2),
                "cuotas": round(cuotas_amount, 2),
                "cuotas_cant": cuotas_count,
                "renovacion": round(renovacion_amount, 2),
                "renovacion_cant": renovacion_count,
                "upsells": round(upsells_amount, 2)
            },
            "total_pagado": round(total_pagado, 2),
            "total_a_pagar": round(total_to_pay, 2),
            "deuda": round(debt, 2),
            "follow_up_status": follow_up_status,
            "client_id": client_id,
            "detalle_pagos": {
                "sena": sena_detalle,
                "completo": completo_detalle,
                "parcial": parcial_detalle,
                "cuotas": cuotas_detalle,
                "renovacion": renovacion_detalle,
                "upsells": upsells_detalle,
                "todos": todos_los_pagos
            }
        }

        # Filtrar por busqueda
        if search:
            match_name = search in client_name.lower()
            match_ig = search in (last_sale.instagram or '').lower() or search in (first_sale.instagram or '').lower()
            match_email = search in (last_sale.mail_cliente or '').lower() or search in (first_sale.mail_cliente or '').lower()
            if not (match_name or match_ig or match_email):
                continue

        clients_list.append(client_row)

    # Ordenar por fecha de inicio descendente
    clients_list.sort(key=lambda x: x['fecha'], reverse=True)
    return jsonify(clients_list), 200

@bp.route('/public/clients/follow-up', methods=['POST'])
def update_client_follow_up():
    data = request.get_json() or {}
    instagram = data.get('instagram', '').strip()
    email = data.get('email', '').strip()
    nombre_cliente = data.get('nombre_cliente', '').strip()
    status = data.get('follow_up_status', '').strip()

    if not status:
        return jsonify({"error": "El estado de follow up es requerido"}), 400

    valid_statuses = ['Por contactar', 'Seguimiento', 'Exitoso', 'Fallido']
    if status not in valid_statuses:
        return jsonify({"error": f"Estado inválido. Debe ser uno de: {', '.join(valid_statuses)}"}), 400

    # Normalizar busqueda
    ig_norm = normalize_ig(instagram)
    email_norm = normalize_email(email)

    if not ig_norm and not email_norm:
        return jsonify({"error": "Se requiere instagram o email para identificar al cliente"}), 400

    # Buscar si ya existe
    client = None
    filters_client = []
    if ig_norm:
        filters_client.append(func.lower(func.replace(Client.instagram, '@', '')) == ig_norm)
    if email_norm:
        filters_client.append(func.lower(Client.email) == email_norm)
    
    if filters_client:
        client = Client.query.filter(or_(*filters_client)).first()

    try:
        if client:
            client.follow_up_status = status
            db.session.commit()
            return jsonify({
                "message": "Estado de follow up actualizado correctamente",
                "client_id": client.id,
                "follow_up_status": client.follow_up_status
            }), 200
        else:
            # Crear nuevo cliente
            new_client = Client(
                full_name=nombre_cliente or 'Desconocido',
                email=email if email else f"no_email_{int(datetime.utcnow().timestamp())}@neurops.com",
                instagram=instagram if instagram else None,
                follow_up_status=status
            )
            db.session.add(new_client)
            db.session.commit()
            return jsonify({
                "message": "Cliente creado y estado de follow up asignado",
                "client_id": new_client.id,
                "follow_up_status": new_client.follow_up_status
            }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al actualizar base de datos: {str(e)}"}), 500
