"""Edicion desde el roadmap del lead: guardar la ficha del cliente y relacionar una venta o agenda a un instagram."""
from flask import request, jsonify
from flask_login import current_user
from app import db
from app.models import Client
from app.models.financial import FinancialSale, FinancialAgenda
from app.services.identity_service import normalize_ig
from . import bp
from sqlalchemy import func

from .lead_roadmap_helpers import is_generic_val

# Lo que queda en la bitácora del sistema cuando alguien edita la ficha de un cliente que ya existía. El
# setter puede buscar y editar cualquier lead (decisión del 26/10/2026): el registro dice quién cambió qué.
CAMPOS_REGISTRADOS = ('full_name', 'email', 'phone', 'instagram', 'objeciones', 'observaciones', 'dolores')


def _registrar_cambios(client, antes):
    from app.services import system_log_service
    cambios = [f'{campo}: {antes[campo] or "—"} → {getattr(client, campo) or "—"}'
               for campo in CAMPOS_REGISTRADOS if (antes[campo] or None) != (getattr(client, campo) or None)]
    if not cambios:
        return
    usuario = current_user if current_user.is_authenticated else None
    quien = f'{usuario.username} ({usuario.role})' if usuario else 'un sistema con el secreto de ingesta'
    system_log_service.registrar(f'Ficha del cliente editada por {quien}', '\n'.join(cambios), usuario=usuario,
                                 entity_type='client', entity_id=client.id)


@bp.route('/public/lead-roadmap/update-client', methods=['POST'])
def update_client_roadmap():
    data = request.get_json() or {}
    client_id = data.get('client_id')
    email = data.get('email')
    if email:
        email = email.strip().lower()
        if is_generic_val(email) or '@' not in email:
            email = None

    phone = data.get('phone')
    if phone:
        phone = phone.strip()
        if is_generic_val(phone):
            phone = None

    instagram = data.get('instagram')
    full_name = data.get('full_name')
    objeciones = data.get('objeciones')
    observaciones = data.get('observaciones')
    dolores = data.get('dolores')

    client = None
    if client_id:
        client = Client.query.get(client_id)
        
    # Solo se busca por Instagram si hay un usuario real: `== None` se traduce a IS NULL y
    # empataria con el primer cliente sin Instagram (que luego se sobrescribe).
    ig_norm = normalize_ig(instagram)
    if not client and (ig_norm or email):
        from app.services import person_service
        client = person_service.cliente_de(person_service.buscar(
            full_name, email=email, instagram=ig_norm, phone=phone), crear=False)
    if not client and ig_norm:
        client = Client.query.filter(func.lower(Client.instagram) == ig_norm).first()

    if not client and email:
        client = Client.query.filter(func.lower(Client.email) == email.strip().lower()).first()

    # Si no existe, crear uno nuevo
    if not client:
        # Se requiere al menos un nombre para crear
        if not full_name:
            return jsonify({"error": "Para crear un nuevo cliente se requiere el Nombre Completo"}), 400
        client = Client(
            full_name=full_name,
            email=email.strip().lower() if email else None,
            phone=phone.strip() if phone else None,
            instagram=normalize_ig(instagram),
            objeciones=objeciones,
            observaciones=observaciones,
            dolores=dolores
        )
        db.session.add(client)
        db.session.flush()
    else:
        antes = {campo: getattr(client, campo) for campo in CAMPOS_REGISTRADOS}
        # Actualizar campos existentes
        if full_name:
            client.full_name = full_name
        if email:
            client.email = email.strip().lower()
        if phone:
            client.phone = phone.strip()
        if instagram:
            client.instagram = normalize_ig(instagram)
        if objeciones is not None:
            client.objeciones = objeciones
        if observaciones is not None:
            client.observaciones = observaciones
        if dolores is not None:
            client.dolores = dolores
        _registrar_cambios(client, antes)

    if objeciones is not None or observaciones is not None or dolores is not None:
        from app.models import Notification
        notif = Notification(
            subject=f"Calificación de Lead Actualizada: {client.full_name or client.instagram or 'Desconocido'}",
            content=f"Se actualizaron los datos de calificación del lead.\nDolores: {client.dolores or 'N/A'}\nObjeciones: {client.objeciones or 'N/A'}\nObservaciones: {client.observaciones or 'N/A'}",
            target_users=["all"],
            associated_id=client.id,
            associated_type="lead"
        )
        db.session.add(notif)

    try:
        db.session.commit()
        return jsonify({
            "message": "Ficha de cliente guardada con éxito",
            "client": {
                "id": client.id,
                "full_name": client.full_name,
                "email": client.email,
                "phone": client.phone,
                "instagram": client.instagram,
                "objeciones": client.objeciones or "",
                "observaciones": client.observaciones or "",
                "dolores": client.dolores or "",
                "form_data": client.form_data
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        import logging
        logging.getLogger(__name__).error(f"Error al guardar calificación del lead: {e}")
        return jsonify({"error": str(e)}), 500

@bp.route('/public/lead-roadmap/relate-event', methods=['POST'])
def relate_event_roadmap():
    data = request.get_json() or {}
    event_type = data.get('event_type') # 'sale' o 'agenda'
    event_id = data.get('event_id')
    instagram = data.get('instagram')

    if not event_type or not event_id or not instagram:
        return jsonify({"error": "Faltan datos requeridos (event_type, event_id, instagram)"}), 400

    ig_norm = normalize_ig(instagram)
    if not ig_norm:
        return jsonify({"error": "Instagram inválido o vacío"}), 400

    try:
        if event_type == 'sale':
            sale = FinancialSale.query.get(event_id)
            if not sale:
                return jsonify({"error": "Venta no encontrada"}), 404
            # Relacionarla es decir de quién es: queda con la persona de ese instagram (comprador).
            # Sin persona de ese instagram, queda en la copia del pago (solo si el pago no tiene persona).
            from app.services import person_service, pagos_copia
            persona = person_service.buscar(instagram=ig_norm)
            if persona is not None:
                sale.person = persona
                cliente = person_service.cliente_de(persona, crear=False)
                if cliente is not None:
                    sale.client_id = cliente.id
            else:
                pagos_copia.escribir(sale, instagram=ig_norm)

            # Sincronizar en Sheets si aplica, con el contacto que se lee (el de la persona)
            if sale.marca_temporal:
                from app.services.sheets_service import SheetsService
                contacto = sale.contacto()
                update_payload = {
                    "email_vendedor": sale.email_vendedor,
                    "nombre_cliente": contacto['nombre_cliente'],
                    "telefono": contacto['telefono'],
                    "mail_cliente": contacto['mail_cliente'],
                    "tipo_pago": sale.tipo_pago,
                    "monto": sale.monto,
                    "segundo_pago": sale.segundo_pago,
                    "metodo_pago": sale.metodo_pago,
                    "examen": sale.examen,
                    "instagram": contacto['instagram'],
                    "setter": sale.setter,
                    "estado": sale.estado
                }
                SheetsService.update_in_sheets("Ventas_DB", sale.marca_temporal, update_payload)

        elif event_type == 'agenda':
            agenda = FinancialAgenda.query.get(event_id)
            if not agenda:
                return jsonify({"error": "Agenda no encontrada"}), 404
            # Relacionarla es decir de quién es: queda con la persona de ese instagram. Si nadie lo tiene,
            # se le anota a la persona de la agenda (Etapa 2c: la agenda no guarda el contacto).
            from app.services import agenda_contacto_service, person_service
            persona = person_service.buscar(instagram=ig_norm)
            if persona is not None:
                agenda.person = persona
            else:
                agenda_contacto_service.dar_persona(agenda, instagram=ig_norm)
        else:
            return jsonify({"error": "Tipo de evento inválido"}), 400

        db.session.commit()
        return jsonify({"message": f"Evento {event_type} relacionado con éxito a @{ig_norm}"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
