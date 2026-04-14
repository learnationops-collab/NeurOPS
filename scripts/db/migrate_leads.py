import os
import sys

# Añadir el path del proyecto para importar 'app'
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models import ManychatAdLead, ManychatLead, LeadAnswer

app = create_app()

def migrate_leads():
    with app.app_context():
        # Obtener todos los leads viejos ordenados por fecha ascendente
        old_leads = ManychatAdLead.query.order_by(ManychatAdLead.created_at.asc()).all()
        total_leads = len(old_leads)
        
        print(f"Iniciando migracion de {total_leads} registros...")

        for i, old in enumerate(old_leads):
            # 1. Buscar o crear el Lead en ManychatLead
            lead = ManychatLead.query.filter_by(manychat_id=old.manychat_id).first()
            
            if not lead:
                lead = ManychatLead(
                    manychat_id=old.manychat_id,
                    name=old.lead_name,
                    created_at=old.created_at,
                    updated_at=old.updated_at
                )
                db.session.add(lead)
                db.session.flush() # Obtener ID
            elif old.lead_name and not lead.name:
                # Si el lead viejo tenia nombre y el nuevo no, actualizarlo
                lead.name = old.lead_name

            # 2. Recrear el evento en LeadAnswer
            answer = LeadAnswer(
                lead_id=lead.id,
                ad_id=old.ad_id,
                keyword=old.keyword,
                qualification=old.qualification,
                created_at=old.created_at,
                updated_at=old.updated_at
            )
            db.session.add(answer)

            if i > 0 and i % 50 == 0:
                # Guardar en lotes de a 50
                db.session.commit()
                print(f"Migrados {i}/{total_leads}")

        # Guardar todo lo restante
        db.session.commit()
        print(f"Migracion completada. Se procesaron {total_leads} registros.")


if __name__ == '__main__':
    migrate_leads()
