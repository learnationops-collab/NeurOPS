"""Formulario de calificacion de n8n sobre agendas financieras."""
from flask import request, jsonify
from app.models import db, FinancialAgenda, Client
from datetime import datetime
from sqlalchemy import or_, func
from app.services.agenda_contacto_service import ig_limpio, mail_limpio
from . import bp


@bp.route('/public/financial-agendas-form', methods=['POST'])
def receive_financial_agendas_form():
    """Recibe datos del formulario de calificación de n8n y actualiza o crea el cliente correspondiente."""
    data = request.get_json() or {}
    
    nombre = data.get('nombre')
    telefono = data.get('telefono')
    fuente_form = data.get('fuente_form', 'Setting Form')
    instagram = data.get('instagram')
    # El mail es la llave mas confiable para cruzar el formulario con la agenda
    # (Calendly lo pide siempre); instagram y telefono los escribe el lead a mano.
    mail = data.get('mail') or data.get('email')
    
    # Datos de calificación
    examen = data.get('examen')
    profesion = data.get('profesion')
    formacion = data.get('formacion')
    empleo = data.get('empleo')
    interes = data.get('interes')
    puntaje = data.get('puntaje')
    inversion = data.get('inversion')
    apoyo = data.get('apoyo')
    
    # Validaciones iniciales
    if not nombre and not instagram and not telefono:
        return jsonify({"error": "Se requiere al menos un nombre, instagram o teléfono para procesar el lead"}), 400
        
    ig_norm = None
    if instagram and isinstance(instagram, str) and instagram.lower() not in ('n/a', ''):
        ig_norm = instagram.strip().lstrip('@').lower()
        
    clean_phone = None
    if telefono and isinstance(telefono, str) and telefono.lower() not in ('n/a', ''):
        clean_phone = telefono.strip()

    clean_mail = None
    if mail and isinstance(mail, str) and '@' in mail and mail.lower() not in ('n/a', ''):
        clean_mail = mail.strip().lower()

    # La persona primero (docs/plan_personas.md): la encuentra por cualquiera de sus mails, instagrams o
    # teléfonos. Lo de abajo queda de respaldo para quien todavía no tiene persona.
    from app.services import person_service
    client = person_service.cliente_de(
        person_service.buscar(nombre, email=clean_mail, instagram=ig_norm, phone=clean_phone), crear=False)

    # 0. Buscar por mail, que es el identificador mas estable de los tres
    if not client and clean_mail:
        client = Client.query.filter(func.lower(Client.email) == clean_mail).first()

    # 1. Intentar buscar cliente por instagram normalizado
    if not client and ig_norm:
        client = Client.query.filter(func.lower(Client.instagram) == ig_norm).first()
        
    # 2. Intentar buscar por teléfono si no se encontró por instagram
    if not client and clean_phone and len(clean_phone) > 4:
        client = Client.query.filter(Client.phone.like(f"%{clean_phone}%")).first()

    # 3. Buscar por nombre en FinancialAgenda.lead → obtener el Client vinculado.
    # OJO: no incluir FinancialAgenda.nombre acá — pese al nombre de la columna, ese campo
    # guarda la FUENTE/atribución de la agenda (username de un setter tipo 'Elias'/'Ivan', o
    # un embudo como 'workshop'), no el nombre del lead. Como hay setters reales llamados
    # igual que leads comunes, un ILIKE contra `nombre` terminaba matcheando la agenda más
    # futura de CUALQUIER lead atribuido a ese setter — le pegó el formulario de un lead
    # "Ivan" al Client de otro lead sin ninguna relación entre ambos (10/sep/2026).
    if not client and nombre:
        nombre_norm = nombre.strip().lower()
        from app.models import Person
        from app.services import agenda_contacto_service
        from app.services.booking_service import BookingService
        agenda_match = FinancialAgenda.query.filter(or_(
            FinancialAgenda.person_uuid.in_(db.session.query(Person.uuid).filter(func.lower(Person.full_name).like(f"%{nombre_norm}%"))),
            agenda_contacto_service.sin_persona(func.lower(FinancialAgenda.lead).like(f"%{nombre_norm}%")))
        ).order_by(FinancialAgenda.date.desc()).first()
        if agenda_match:
            # El cliente de la persona de la agenda; si no, por su instagram, mail o teléfono
            client = BookingService.cliente_de_agenda(agenda_match)
            contacto = agenda_match.contacto()
            ag_ig = ig_limpio(contacto['instagram'])
            ag_mail = mail_limpio(contacto['mail'])
            ag_phone = contacto['whatsapp'].strip() if contacto['whatsapp'] and contacto['whatsapp'].lower() not in ('n/a', '') else None
            if not client and ag_ig:
                client = Client.query.filter(func.lower(Client.instagram) == ag_ig).first()
            if not client and ag_mail:
                client = Client.query.filter(func.lower(Client.email) == ag_mail).first()
            if not client and ag_phone:
                client = Client.query.filter(Client.phone.like(f"%{ag_phone}%")).first()
            # Si la agenda no tiene cliente vinculado, buscar por nombre directo
            if not client:
                client = Client.query.filter(func.lower(Client.full_name).like(f"%{nombre_norm}%")).first()

    # 4. Último recurso: buscar por nombre exacto en Client
    if not client and nombre:
        client = Client.query.filter(func.lower(Client.full_name) == nombre.strip().lower()).first()

        
    # Construir el nuevo bloque de respuestas de calificación
    new_form_data = {
        "nombre": nombre,
        "telefono": telefono,
        "fuente_form": fuente_form,
        "instagram": instagram,
        "mail": clean_mail,
        "examen": examen,
        "profesion": profesion,
        "formacion": formacion,
        "empleo": empleo,
        "interes": interes,
        "puntaje": puntaje,
        "inversion": inversion,
        "apoyo": apoyo,
        "submitted_at": datetime.utcnow().isoformat()
    }
    
    try:
        if client:
            # Actualizar datos básicos si están vacíos o son genéricos
            if nombre and (not client.full_name or client.full_name.lower() in ('desconocido', '', 'n/a')):
                client.full_name = nombre
            if clean_phone and (not client.phone or client.phone.lower() in ('sin telefono', 'sin teléfono', '', 'n/a')):
                client.phone = clean_phone
            if ig_norm and (not client.instagram or client.instagram.lower() in ('sin instagram', '', 'n/a')):
                client.instagram = ig_norm
            # Los clientes creados por el sync llevan un mail placeholder @neurops.com
            from app.services.booking_service import BookingService
            if clean_mail and (not client.email or '@neurops.com' in client.email.lower()) and \
                    not BookingService._email_de_otro(clean_mail, client.id):
                client.email = clean_mail
            # Actualizar form_data de manera incremental
            from sqlalchemy.orm.attributes import flag_modified
            current_form_data = dict(client.form_data or {})
            current_form_data.update(new_form_data)
            client.form_data = current_form_data
            flag_modified(client, 'form_data')
            
            message = "Cliente existente actualizado con las respuestas del formulario"
        else:
            # Crear un nuevo cliente
            client = Client(
                full_name=nombre or "Desconocido",
                phone=clean_phone,
                instagram=ig_norm,
                email=clean_mail,
                form_data=new_form_data
            )
            db.session.add(client)
            message = "Nuevo cliente creado con las respuestas del formulario"
            
        db.session.commit()

        # El formulario manda sobre la fuente de la agenda: si `fuente_form` es un
        # setter del equipo, se le reasignan las agendas de esta persona que hayan
        # entrado con la fuente generica del evento de Calendly. Ver
        # app/services/fuente_formulario_service.py.
        fuente_aplicada, agendas_actualizadas = None, 0
        try:
            from app.services.fuente_formulario_service import aplicar_a_agendas_del_cliente
            fuente_aplicada, agendas_actualizadas = aplicar_a_agendas_del_cliente(
                fuente_form,
                nombre=nombre,
                telefono=clean_phone,
                instagram=ig_norm,
                mail=clean_mail
            )
            if agendas_actualizadas:
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            from flask import current_app
            current_app.logger.error(f"[FUENTE FORM] No se pudo aplicar la fuente del formulario: {e}")

        return jsonify({
            "message": message,
            "status": "success",
            "fuente_aplicada": fuente_aplicada,
            "agendas_actualizadas": agendas_actualizadas,
            "client_id": client.id,
            "client": {
                "id": client.id,
                "full_name": client.full_name,
                "phone": client.phone,
                "instagram": client.instagram,
                "form_data": client.form_data
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f"Error al procesar el formulario de calificación: {str(e)}"}), 500
