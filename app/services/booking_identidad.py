"""Quién es quién en una agenda: resolver closers/setters por nombre y el cliente por sus datos.
Mixin de `BookingService` (app/services/booking_service.py)."""
from app.models import User, db


class BookingIdentidadMixin:
    @staticmethod
    def normalize_closer_name(name_str):
        """Normaliza cualquier alias de closer al nombre de usuario canónico (User.username)."""
        from app.services.booking_service import BookingService
        if not name_str:
            return "Sin asignar"
        name_clean = str(name_str).strip()
        if name_clean.lower() in ('n/a', 'none', 'undefined', 'sin asignar', 'sin_asignar', 'equipo', ''):
            return "Sin asignar"
            
        user = BookingService.resolve_user_by_name(name_clean, default_role='closer')
        if user and user.username:
            return user.username
        return name_clean

    @staticmethod
    def resolve_user_by_name(name_str, default_role=None):
        """Resuelve un usuario por nombre/username de forma flexible."""
        if not name_str:
            return None
        name_clean = str(name_str).strip().lower()
        if name_clean in ('n/a', 'none', 'undefined', 'sin asignar', 'sin_asignar', 'equipo', ''):
            return None
            
        # 0. Buscar por alias explícito (CloserAlias)
        from app.models import CloserAlias
        alias = CloserAlias.query.filter(db.func.lower(CloserAlias.alias_name) == name_clean).first()
        if alias and alias.user:
            return alias.user
            
        # 1. Coincidencia exacta por username
        user = User.query.filter(User.username.ilike(name_clean)).first()
        if user:
            return user
            
        # 2. Coincidencia sin espacios
        name_no_spaces = name_clean.replace(' ', '')
        user = User.query.filter(User.username.ilike(name_no_spaces)).first()
        if user:
            return user
            
        # 3. Coincidencia parcial priorizando rol (removiendo espacios de ambos)
        users = User.query.all()
        for u in users:
            u_name_no_spaces = u.username.lower().replace(' ', '')
            if u_name_no_spaces in name_no_spaces or name_no_spaces in u_name_no_spaces:
                if default_role and u.role == default_role:
                    return u
                    
        # 4. Fallback de coincidencia parcial simple
        for u in users:
            u_name_no_spaces = u.username.lower().replace(' ', '')
            if u_name_no_spaces in name_no_spaces or name_no_spaces in u_name_no_spaces:
                return u
                
        return None

    @staticmethod
    def find_or_create_client(nombre, email, instagram, phone, grupo=None):
        """Busca o crea un cliente usando cruzado inteligente de campos.

        Prioridad email/telefono sobre Instagram, guiada por dos incidentes reales el mismo
        dia (07/09/2026, ver bitacora): 'Joel Celis' se fusiono con un cliente de 2024 no
        relacionado ('Juan Jose Silva Menchaca') y 'Diego Gutierrez' con uno de febrero
        ('Jesus Emmanuel Cruz') -- en ambos casos el UNICO campo en comun era el instagram
        (nombre, email y telefono completamente distintos). Un handle de Instagram se puede
        tipear mal, reciclar o coincidir por casualidad; el email y el telefono no. Por eso
        un match SOLO por instagram ya no se acepta a ciegas: hace falta que el nombre
        corrobore (mismo criterio que SalesConsistencyService._names_corroborate, usado para
        el mismo problema en ventas desde el 02/09) para fusionar el historial de dos leads
        bajo el mismo Client. Sin corroboracion, se trata como un cliente nuevo -- preferible
        duplicar (se arregla despues con un merge manual) a mezclar el historial de dos
        personas reales."""
        from app.services.booking_service import BookingService
        email_clean = str(email).strip().lower() if email and '@' in str(email) else None
        ig_clean = str(instagram).strip().replace('@', '').lower() if instagram and str(instagram).lower() not in ('n/a', 'none', '') else None
        phone_clean = str(phone).strip() if phone and str(phone).lower() not in ('n/a', 'none', '') else None

        grupo_clean = str(grupo).strip() if grupo and str(grupo).strip() else None

        # La persona decide quién es (docs/plan_personas.md): mismas reglas de arriba, pero sobre todos
        # sus mails, instagrams y teléfonos (person_service.buscar). Si no tiene cliente comercial, se crea.
        from app.services import person_service
        person = person_service.resolver(nombre, email_clean, ig_clean, phone_clean, fuente='agenda')
        client = person_service.cliente_de(person)
        if client:
            # Actualizar datos vacíos
            if nombre and not client.full_name:
                client.full_name = nombre
            # 'no-email-' en el email actual = placeholder sintético (ver create_or_update_client
            # más arriba en este mismo archivo, línea ~145) — sin este chequeo, un cliente ya
            # creado sin email real (o matcheado por instagram/teléfono antes de que llegara su
            # agendamiento de Calendly) se queda con el placeholder para siempre: el email real
            # que sí llega después nunca lo pisa porque "ya tiene un email" (aunque sea falso).
            if email_clean and (not client.email or 'no-email-' in client.email) and \
                    not BookingService._email_de_otro(email_clean, client.id):
                client.email = email_clean
            if phone_clean and not client.phone:
                client.phone = phone_clean
            if ig_clean and not client.instagram:
                client.instagram = ig_clean
            if grupo_clean and not client.grupo:
                client.grupo = grupo_clean

        return client
