from flask import request, jsonify
from app.models import db, FinancialSale, ExcludedSale, FinancialAgenda
from datetime import datetime
from . import bp
from sqlalchemy import or_, func, case

def split_tipo_pago(tp):
    # Separa el programa del tipo de pago simple
    if not tp:
        return "Desconocido", "No Especificado"
    if " - " in tp:
        parts = tp.split(" - ", 1)
        return parts[0].strip(), parts[1].strip()
    return "Desconocido", tp.strip()

def parse_financial_data(item):
    errors = []
    
    setter = str(item.get('setter') or '').strip()
    if not setter:
        errors.append("Falta el setter (Columna K).")
        
    monto = item.get('monto') or item.get('amount') or item.get('value')
    if monto is None or str(monto).strip() == '':
        errors.append("Falta el monto abonado.")
        monto_val = 0.0
    else:
        try:
            monto_val = float(monto)
        except ValueError:
            errors.append(f"Monto inválido: {monto}")
            monto_val = 0.0
        
    tipo_pago = str(item.get('tipo_pago', '')).strip()
    
    producto = 'N/A'
    tipo_de_pago = 'N/A'
    
    # Procesar formato {programa} - {tipo_de_pago}
    parts = [p.strip() for p in tipo_pago.split('-')]
    if len(parts) >= 2:
        code = parts[0].upper()
        pay_type = parts[1]
        
        if code == "RR":
            producto = "Residency Roadmap"
        elif code == "AL":
            producto = "Ace Learners"
        elif code == "SI":
            producto = "Specialist Iniciative"
        else:
            producto = parts[0]
            errors.append(f"Código de producto desconocido: {code}")
            
        pay_type_lower = pay_type.lower()
        if "completo" in pay_type_lower or "pif" in pay_type_lower:
            tipo_de_pago = "Completo"
        elif "cuota" in pay_type_lower or "parcial" in pay_type_lower or "primer pago" in pay_type_lower:
            tipo_de_pago = "Cuota / Primer Pago"
        elif "seña" in pay_type_lower or "sena" in pay_type_lower:
            tipo_de_pago = "Seña"
        elif "renovacion" in pay_type_lower or "renovación" in pay_type_lower:
            tipo_de_pago = "Renovacion"
        else:
            tipo_de_pago = pay_type.title()
            errors.append(f"Tipo de pago desconocido: {pay_type}")
    else:
        # Fallback para registros sin el guión
        if "seña" in tipo_pago.lower() or "sena" in tipo_pago.lower():
            producto = "Seña"
            tipo_de_pago = "Seña"
        else:
            if tipo_pago:
                errors.append(f"Formato de tipo de pago inválido: {tipo_pago}")
            else:
                errors.append("Falta el tipo de pago.")

    return {
        "setter": setter or "Desconocido",
        "monto": monto_val,
        "producto": producto,
        "tipo_de_pago": tipo_de_pago,
        "instagram": str(item.get('instagram') or item.get('ig') or '').strip().lstrip('@').lower() or 'N/A',
        "status": 'error' if errors else 'valid',
        "error_notes": " | ".join(errors) if errors else None
    }

@bp.route('/public/financial-sales', methods=['POST'])
def receive_financial_sales():
    # Recibe datos de ventas desde Excel/Apps Script
    from flask import current_app
    import json
    
    data = request.get_json() or {}
    current_app.logger.info(f"[FINANCIAL] Received data: {json.dumps(data)[:500]}...")

    items = data if isinstance(data, list) else [data]
    saved = 0
    errors = []
    
    for item in items:
        monto = item.get('monto') or item.get('amount') or item.get('value')
        setter = item.get('setter') or item.get('setter_name') or item.get('vendedor')
        
        if monto is None or setter is None:
            current_app.logger.warning(f"[FINANCIAL] Skipping item due to missing fields: {item}")
            errors.append({"item": item, "error": "Missing monto/amount or setter"})
            continue

        sale_date = datetime.utcnow()
        fecha_str = item.get('fecha') or item.get('date')
        if fecha_str:
            try:
                from dateutil import parser
                sale_date = parser.parse(str(fecha_str))
            except Exception as e:
                current_app.logger.error(f"[FINANCIAL] Date parsing error for '{fecha_str}': {e}")

        try:
            sale = FinancialSale(
                setter=str(setter),
                monto=float(monto),
                date=sale_date,
                nombre_cliente=item.get('nombre_cliente') or item.get('cliente') or 'Desconocido',
                email_vendedor=item.get('email_vendedor') or item.get('vendedor_mail'),
                instagram=item.get('instagram') or item.get('ig') or 'N/A',
                estado=item.get('estado') or item.get('status') or 'Completada',
                raw_data=item
            )
            db.session.add(sale)
            saved += 1
        except Exception as e:
            current_app.logger.error(f"[FINANCIAL] Error creating record: {e}")
            errors.append({"item": item, "error": str(e)})
        
    try:
        db.session.commit()
        current_app.logger.info(f"[FINANCIAL] Successfully saved {saved} records")
        return jsonify({
            "message": f"{saved} sales records saved",
            "saved": saved,
            "errors": errors
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"[FINANCIAL] Database commit error: {e}")
        return jsonify({"error": str(e)}), 500

@bp.route('/public/financial-sales/new', methods=['POST'])
def create_new_financial_sale():
    # Registra manualmente una nueva venta en la DB local y la propaga a Google Sheets
    from app.services.sheets_service import SheetsService
    data = request.get_json() or {}
    
    if not data.get('nombre_cliente') or not data.get('monto'):
        return jsonify({"error": "Nombre del cliente y monto son requeridos"}), 400
        
    try:
        # Formatear el payload para SheetsService.post_to_sheets
        payload = {
            "email_vendedor": data.get('email_vendedor') or 'Sin asignar',
            "nombre_cliente": data.get('nombre_cliente'),
            "telefono": data.get('telefono') or '',
            "mail_cliente": data.get('mail_cliente') or '',
            "tipo_pago": data.get('tipo_pago') or 'No Especificado',
            "monto": float(data.get('monto') or 0.0),
            "segundo_pago": data.get('segundo_pago') or '',
            "metodo_pago": data.get('metodo_pago') or 'No Especificado',
            "examen": data.get('examen') or '',
            "instagram": data.get('instagram') or 'N/A',
            "setter": data.get('setter') or '',
            "estado": data.get('estado') or 'Confirmada',
            "marca_temporal": data.get('marca_temporal') or datetime.utcnow().strftime('%d/%m/%Y %H:%M:%S')
        }
        
        result = SheetsService.post_to_sheets("Ventas_DB", payload)
        if result["status"] == "success":
            return jsonify({"message": "Venta registrada con éxito", "status": "success"}), 201
        return jsonify({"error": result.get("message") or "Error al propagar a Sheets"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@bp.route('/public/financial-sales/sync', methods=['POST'])
def sync_financial_sales_from_sheets():
    # Obtiene datos de Google Sheets y reconstruye registros
    from app.services.sheets_service import SheetsService
    force = request.args.get('force', 'false').lower() == 'true'
    result = SheetsService.sync_from_sheets("Ventas_DB", force=force)
    if result["status"] == "success":
        return jsonify({"message": "Base de datos reconstruida con éxito", "added": result["count"]}), 200
    return jsonify({"error": result["message"]}), 500

@bp.route('/public/financial-sales/<int:sale_id>', methods=['PUT', 'OPTIONS'])
def update_financial_sale(sale_id):
    # Endpoint para la resolución manual de errores de ventas
    if request.method == 'OPTIONS':
        return '', 204
    
    data = request.json or {}
    sale = FinancialSale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "Venta no encontrada"}), 404
        
    try:
        if 'product' in data:
            sale.tipo_pago = data['product']
        if 'payment_type' in data:
            sale.metodo_pago = data['payment_type']
        if 'setter_name' in data:
            sale.setter = data['setter_name']
        if 'amount' in data:
            sale.monto = float(data['amount'])
        if 'instagram' in data:
            sale.instagram = data['instagram']
        if 'nombre_cliente' in data:
            sale.nombre_cliente = data['nombre_cliente']
        if 'email_vendedor' in data:
            sale.email_vendedor = data['email_vendedor']
        if 'estado' in data:
            sale.estado = data['estado']
        if 'date' in data and data['date']:
            try:
                from dateutil import parser
                # Parsear la fecha enviada desde el frontend
                sale.date = parser.parse(str(data['date']))
            except Exception as e:
                pass
        db.session.commit()

        # Propagar actualización en caliente a Google Sheets
        if sale.marca_temporal:
            from app.services.sheets_service import SheetsService
            update_payload = {
                "email_vendedor": sale.email_vendedor,
                "nombre_cliente": sale.nombre_cliente,
                "telefono": sale.telefono,
                "mail_cliente": sale.mail_cliente,
                "tipo_pago": sale.tipo_pago,
                "monto": sale.monto,
                "segundo_pago": sale.segundo_pago,
                "metodo_pago": sale.metodo_pago,
                "examen": sale.examen,
                "instagram": sale.instagram,
                "setter": sale.setter,
                "estado": sale.estado
            }
            SheetsService.update_in_sheets("Ventas_DB", sale.marca_temporal, update_payload)

        return jsonify({"message": "Venta actualizada correctamente", "sale": sale.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/financial-sales/<int:sale_id>', methods=['DELETE'])
def delete_financial_sale(sale_id):
    # Excluye localmente la venta para que no se muestre pero continúe en Sheets
    sale = FinancialSale.query.get(sale_id)
    if not sale:
        return jsonify({"error": "Venta no encontrada"}), 404
        
    try:
        if sale.marca_temporal:
            exists = ExcludedSale.query.filter_by(marca_temporal=sale.marca_temporal).first()
            if not exists:
                excluded = ExcludedSale(marca_temporal=sale.marca_temporal)
                db.session.add(excluded)
                
        db.session.delete(sale)
        db.session.commit()
        return jsonify({"message": "Venta excluida correctamente de la base de datos local"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@bp.route('/public/financial-sales', methods=['GET'])
def get_financial_sales():
    # Devuelve todos los registros de ventas con filtros y paginación
    page = request.args.get('page', default=None, type=int)
    limit = request.args.get('limit', default=10, type=int)
    search = request.args.get('search', default='', type=str).strip()
    start_date_str = request.args.get('start_date', default='', type=str).strip()
    end_date_str = request.args.get('end_date', default='', type=str).strip()
    programa = request.args.get('programa', default='', type=str).strip()
    tipo_pago_simple = request.args.get('tipo_pago_simple', default='', type=str).strip()
    metodo_pago = request.args.get('metodo_pago', default='', type=str).strip()
    sin_atribucion = request.args.get('sin_atribucion', default='false', type=str).lower() == 'true'
    
    query = FinancialSale.query
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(or_(
            FinancialSale.nombre_cliente.ilike(search_pattern),
            FinancialSale.instagram.ilike(search_pattern),
            FinancialSale.email_vendedor.ilike(search_pattern),
            FinancialSale.setter.ilike(search_pattern)
        ))
        
    if start_date_str:
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d')
            query = query.filter(FinancialSale.date >= start_date)
        except ValueError:
            pass
            
    if end_date_str:
        try:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d')
            end_date = end_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            query = query.filter(FinancialSale.date <= end_date)
        except ValueError:
            pass

    if programa:
        query = query.filter(or_(
            FinancialSale.tipo_pago.like(f"{programa} - %"),
            FinancialSale.tipo_pago == programa
        ))
        
    if tipo_pago_simple:
        query = query.filter(or_(
            FinancialSale.tipo_pago.like(f"% - {tipo_pago_simple}"),
            FinancialSale.tipo_pago == tipo_pago_simple
        ))
        
    if metodo_pago:
        query = query.filter(FinancialSale.metodo_pago == metodo_pago)
            
    query = query.order_by(FinancialSale.date.desc())
    subquery_sales = query.all()
    
    subquery = query.with_entities(FinancialSale.id)
    # Expresión de monto ajustado: si metodo_pago es 'Stripe', restar 4.5% de comisión
    adjusted_monto_expr = case(
        (func.lower(func.trim(FinancialSale.metodo_pago)) == 'stripe', FinancialSale.monto * 0.955),
        else_=FinancialSale.monto
    )
    # Sumar solo los montos de ventas completadas (con descuento de Stripe si aplica)
    total_monto = db.session.query(func.sum(adjusted_monto_expr))\
        .filter(FinancialSale.id.in_(subquery))\
        .filter(or_(FinancialSale.estado == 'Completada', FinancialSale.estado == None, FinancialSale.estado == ''))\
        .scalar() or 0.0
    
    all_agendas = FinancialAgenda.query.all()
    
    def normalize_ig(ig_str):
        if not ig_str or not isinstance(ig_str, str) or ig_str.lower() in ('n/a', ''):
            return None
        return ig_str.strip().lstrip('@').lower()

    agenda_map = {}
    for a in all_agendas:
        ig_norm = normalize_ig(a.instagram)
        if ig_norm:
            if ig_norm not in agenda_map or (a.date and agenda_map[ig_norm].date and a.date > agenda_map[ig_norm].date):
                agenda_map[ig_norm] = a

    monto_con_agenda = 0.0
    count_con_agenda = 0
    monto_sin_agenda = 0.0
    count_sin_agenda = 0
    
    setter_stats = {}
    processed_sales = []
    
    for s in subquery_sales:
        s_dict = s.to_dict()
        ig_norm = normalize_ig(s.instagram)
        resolved_setter = None
        has_agenda_match = False
        
        if ig_norm and ig_norm in agenda_map:
            agenda = agenda_map[ig_norm]
            has_agenda_match = True
            
            is_valid_lead_source = (
                agenda.nombre and 
                agenda.nombre.strip() and 
                agenda.nombre.lower() not in ('s/f', 'n/a', '') and 
                'entrevista' not in agenda.nombre.lower() and 
                'diagnostica' not in agenda.nombre.lower() and
                'diagnóstica' not in agenda.nombre.lower()
            )
            if is_valid_lead_source:
                resolved_setter = agenda.nombre
                
        if not resolved_setter:
            s_setter = s.setter
            if s_setter and s_setter.strip() and s_setter != 'Sin Setter' and s_setter != 'Confirmada':
                resolved_setter = s_setter
                
        # Una venta está completada si no tiene estado o su estado es "Completada"
        sale_is_completed = not s.estado or s.estado.strip() == "" or s.estado.lower() == "completada"

        # Aplicar el descuento del 4.5% si el método de pago es Stripe
        monto_original = float(s.monto or 0.0)
        monto_ajustado = monto_original * 0.955 if s.metodo_pago and s.metodo_pago.strip().lower() == 'stripe' else monto_original

        if has_agenda_match or resolved_setter:
            if sale_is_completed:
                monto_con_agenda += monto_ajustado
            count_con_agenda += 1
        else:
            if sale_is_completed:
                monto_sin_agenda += monto_ajustado
            count_sin_agenda += 1
            
        final_setter = resolved_setter or "Sin Setter"
        if final_setter not in setter_stats:
            setter_stats[final_setter] = {"count": 0, "total_monto": 0.0}
        setter_stats[final_setter]["count"] += 1
        if sale_is_completed:
            setter_stats[final_setter]["total_monto"] += monto_ajustado
        
        s_dict["monto"] = round(monto_ajustado, 2)
        s_dict["setter"] = final_setter
        s_dict["has_agenda"] = has_agenda_match
        prog, simple_tp = split_tipo_pago(s.tipo_pago)
        s_dict["programa"] = prog
        s_dict["tipo_pago_simple"] = simple_tp
        processed_sales.append(s_dict)
        
    sources_breakdown = []
    for setter_name, stats in setter_stats.items():
        sources_breakdown.append({
            "source": setter_name,
            "count": stats["count"],
            "total_monto": round(stats["total_monto"], 2)
        })
    sources_breakdown.sort(key=lambda x: x["total_monto"], reverse=True)
    
    agenda_query = FinancialAgenda.query
    if start_date_str:
        try:
            start_date_val = datetime.strptime(start_date_str, '%Y-%m-%d')
            agenda_query = agenda_query.filter(FinancialAgenda.date >= start_date_val)
        except ValueError:
            pass
    if end_date_str:
        try:
            end_date_val = datetime.strptime(end_date_str, '%Y-%m-%d')
            end_date_val = end_date_val.replace(hour=23, minute=59, second=59, microsecond=999999)
            agenda_query = agenda_query.filter(FinancialAgenda.date <= end_date_val)
        except ValueError:
            pass
    total_agendas = agenda_query.with_entities(func.count(FinancialAgenda.id)).scalar() or 0

    agenda_breakdown = {
        "con_agenda": {
            "total_monto": round(monto_con_agenda, 2),
            "count": count_con_agenda,
            "total_agendas": total_agendas
        },
        "sin_agenda": {
            "total_monto": round(monto_sin_agenda, 2),
            "count": count_sin_agenda
        }
    }

    payment_type_query = db.session.query(
        FinancialSale.tipo_pago,
        func.count(FinancialSale.id),
        func.sum(adjusted_monto_expr)
    ).filter(
        FinancialSale.id.in_(subquery)
    ).filter(
        or_(FinancialSale.estado == 'Completada', FinancialSale.estado == None, FinancialSale.estado == '')
    ).group_by(FinancialSale.tipo_pago).all()

    payment_types_simple_map = {}
    for tp, count, total_tp_monto in payment_type_query:
        _, simple_tp = split_tipo_pago(tp)
        if simple_tp not in payment_types_simple_map:
            payment_types_simple_map[simple_tp] = {"count": 0, "total_monto": 0.0}
        payment_types_simple_map[simple_tp]["count"] += count
        payment_types_simple_map[simple_tp]["total_monto"] += float(total_tp_monto or 0.0)

    payment_types_breakdown = []
    for tp_simple, stats in payment_types_simple_map.items():
        payment_types_breakdown.append({
            "tipo_pago": tp_simple,
            "count": stats["count"],
            "total_monto": round(stats["total_monto"], 2)
        })

    payment_method_query = db.session.query(
        FinancialSale.metodo_pago,
        func.count(FinancialSale.id),
        func.sum(adjusted_monto_expr)
    ).filter(
        FinancialSale.id.in_(subquery)
    ).filter(
        or_(FinancialSale.estado == 'Completada', FinancialSale.estado == None, FinancialSale.estado == '')
    ).group_by(FinancialSale.metodo_pago).all()

    payment_methods_breakdown = []
    for pm_method, count, total_mp_monto in payment_method_query:
        payment_methods_breakdown.append({
            "metodo_pago": pm_method or "No Especificado",
            "count": count,
            "total_monto": round(total_mp_monto or 0.0, 2)
        })

    all_tps = [
        r[0] for r in db.session.query(FinancialSale.tipo_pago).distinct().all() if r[0]
    ]
    unique_programs_set = set()
    unique_payment_types_simple_set = set()
    for tp in all_tps:
        prog, simple_tp = split_tipo_pago(tp)
        if prog and prog != "Desconocido":
            unique_programs_set.add(prog)
        if simple_tp:
            unique_payment_types_simple_set.add(simple_tp)
    
    unique_programs = sorted(list(unique_programs_set))
    unique_payment_types = sorted(list(unique_payment_types_simple_set))
    
    all_methods = [
        r[0] for r in db.session.query(FinancialSale.metodo_pago).distinct().all() if r[0]
    ]
    unique_payment_methods = sorted(list(set(all_methods)))

    if sin_atribucion:
        processed_sales = [s for s in processed_sales if not s["has_agenda"]]

    if page is not None:
        total_items = len(processed_sales)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_sales = processed_sales[start_idx:end_idx]
        has_more = end_idx < total_items
        pages = (total_items + limit - 1) // limit

        return jsonify({
            "data": paginated_sales,
            "total": total_items,
            "page": page,
            "pages": pages,
            "has_more": has_more,
            "total_monto": float(total_monto),
            "sources_breakdown": sources_breakdown,
            "agenda_breakdown": agenda_breakdown,
            "payment_types_breakdown": payment_types_breakdown,
            "payment_methods_breakdown": payment_methods_breakdown,
            "unique_programs": unique_programs,
            "unique_payment_types": unique_payment_types,
            "unique_payment_methods": unique_payment_methods
        }), 200
    else:
        return jsonify(processed_sales), 200
