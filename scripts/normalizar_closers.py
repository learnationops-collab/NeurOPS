import os
import sys
from sqlalchemy import func, or_

# Añadir el directorio raíz al path para importar la app
current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import User, CloserAlias, FinancialAgenda, Appointment, Enrollment

def normalizar_closers():
    app = create_app()
    with app.app_context():
        print("--- Iniciando normalización de closers y alias ---")

        # 1. Obtener usuarios principales de closers
        jean_carlo = User.query.filter(User.username.ilike('Jean Carlo')).first()
        sebastian = User.query.filter(User.username.ilike('Sebastian')).first()
        marlon_closer = User.query.filter(User.username.ilike('Marlon Closer')).first()
        if not marlon_closer:
            marlon_closer = User.query.filter(User.username.ilike('Marlon')).first()

        # Si no existe alguno de los usuarios, reportar advertencia
        if not jean_carlo:
            print("[ADVERTENCIA] Usuario Jean Carlo no encontrado por username.")
        if not sebastian:
            print("[ADVERTENCIA] Usuario Sebastian no encontrado por username.")
        if not marlon_closer:
            print("[ADVERTENCIA] Usuario Marlon Closer no encontrado por username.")

        # 2. Definir mapa de alias a registrar
        alias_map = {}
        if jean_carlo:
            alias_map[jean_carlo.id] = [
                'Jean Carlo', 'Jean Carlo Pérez', 'jean Carlo Pérez', 'Jean Carlo Perez',
                'jeancarlo', 'jeancarlo@thelearnation.com'
            ]

        if sebastian:
            alias_map[sebastian.id] = [
                'Sebastian', 'Sebastian Hernández', 'Sebastian Hernandez',
                'sebastian', 'Sebasdestian@gmail.com'
            ]

        if marlon_closer:
            alias_map[marlon_closer.id] = [
                'Marlon Closer', 'Marlon', 'Marlon García', 'Marlon Garcia',
                'Marol Garcia', 'marlon', 'marlon@thelearnation.com',
                'marlongarcia27948@gmail.com', 'marlon@neurocogniciones.com'
            ]

        # 3. Registrar o actualizar CloserAlias en la base de datos
        aliases_created = 0
        for user_id, aliases in alias_map.items():
            for alias_name in aliases:
                name_clean = alias_name.strip()
                existing = CloserAlias.query.filter(
                    func.lower(CloserAlias.alias_name) == name_clean.lower()
                ).first()
                if not existing:
                    new_alias = CloserAlias(user_id=user_id, alias_name=name_clean)
                    db.session.add(new_alias)
                    aliases_created += 1
                elif existing.user_id != user_id:
                    existing.user_id = user_id
        
        db.session.commit()
        print(f"Alias registrados/actualizados: {aliases_created} nuevos alias agregados.")

        # 4. Reemplazar valores heterogéneos en FinancialAgenda por el nombre canónico del User
        agenda_updates = 0

        # Mapeo directo de patrones de texto en agenda -> nombre canónico
        if jean_carlo:
            aliases_lc = [a.strip().lower() for a in alias_map[jean_carlo.id]]
            updated = FinancialAgenda.query.filter(
                func.lower(FinancialAgenda.closer).in_(aliases_lc)
            ).filter(
                FinancialAgenda.closer != jean_carlo.username
            ).update(
                {FinancialAgenda.closer: jean_carlo.username},
                synchronize_session=False
            )
            agenda_updates += updated

        if sebastian:
            aliases_lc = [a.strip().lower() for a in alias_map[sebastian.id]]
            updated = FinancialAgenda.query.filter(
                func.lower(FinancialAgenda.closer).in_(aliases_lc)
            ).filter(
                FinancialAgenda.closer != sebastian.username
            ).update(
                {FinancialAgenda.closer: sebastian.username},
                synchronize_session=False
            )
            agenda_updates += updated

        if marlon_closer:
            aliases_lc = [a.strip().lower() for a in alias_map[marlon_closer.id]]
            updated = FinancialAgenda.query.filter(
                func.lower(FinancialAgenda.closer).in_(aliases_lc)
            ).filter(
                FinancialAgenda.closer != marlon_closer.username
            ).update(
                {FinancialAgenda.closer: marlon_closer.username},
                synchronize_session=False
            )
            agenda_updates += updated

        db.session.commit()
        print(f"Agendas financieras actualizadas a nombre canónico: {agenda_updates} registros procesados.")

        # 5. Reasignar citas e inscripciones de usuarios legacy (ej. ID 1096 o 1120) a Marlon Closer (ID 1126)
        if marlon_closer:
            legacy_marlon_users = User.query.filter(
                User.id != marlon_closer.id,
                or_(
                    User.username.ilike('Marlon'),
                    User.email.ilike('marlongarcia27948@gmail.com')
                )
            ).all()

            legacy_ids = [u.id for u in legacy_marlon_users]
            if legacy_ids:
                appts_reassigned = Appointment.query.filter(Appointment.closer_id.in_(legacy_ids)).update(
                    {Appointment.closer_id: marlon_closer.id},
                    synchronize_session=False
                )
                enr_reassigned = Enrollment.query.filter(Enrollment.closer_id.in_(legacy_ids)).update(
                    {Enrollment.closer_id: marlon_closer.id},
                    synchronize_session=False
                )
                db.session.commit()
                print(f"Reasignación legacy para Marlon Closer: {appts_reassigned} citas y {enr_reassigned} inscripciones consolidadas.")

        print("--- Normalización finalizada con éxito ---")

if __name__ == "__main__":
    normalizar_closers()
