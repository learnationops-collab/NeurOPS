import sys
import os
from datetime import datetime

# Añadir el directorio raíz al path para poder importar la app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from run import app
from app import db
from app.models import Pipeline, PipelineStage, Appointment

def update_stages():
    with app.app_context():
        print("Buscando Pipeline 'Closer Kanban'...")
        pipeline = Pipeline.query.filter_by(name='Closer Kanban').first()
        
        if not pipeline:
            print("No se encontró el pipeline 'Closer Kanban'. Creándolo...")
            pipeline = Pipeline(name='Closer Kanban', is_active=True)
            db.session.add(pipeline)
            db.session.flush()
            
        new_stage_names = ["Nueva", "Respondido", "Confirmado", "Asistido", "Contexto", "Decisor", "Presentado"]
        
        # Obtener etapas actuales
        current_stages = PipelineStage.query.filter_by(pipeline_id=pipeline.id).order_by(PipelineStage.order).all()
        
        print(f"Etapas actuales: {[s.name for s in current_stages]}")
        print(f"Nuevas etapas: {new_stage_names}")
        
        # Actualizar o Crear etapas
        for i, name in enumerate(new_stage_names):
            if i < len(current_stages):
                stage = current_stages[i]
                old_name = stage.name
                stage.name = name
                stage.order = i
                stage.is_active = True
                print(f"Actualizada etapa {i}: {old_name} -> {name}")
                
                # Opcionalmente: Actualizar appointments que apuntaban al nombre viejo
                # Aunque en este sistema las stages se guardan por NOMBRE en Appointment.last_stage
                # Así que es mejor actualizar los appointments también si queremos mantener consistencia
                Appointment.query.filter_by(last_stage=old_name).update({Appointment.last_stage: name})
            else:
                new_stage = PipelineStage(name=name, pipeline_id=pipeline.id, order=i, is_active=True)
                db.session.add(new_stage)
                print(f"Creada nueva etapa {i}: {name}")
                
        # Desactivar etapas sobrantes
        if len(current_stages) > len(new_stage_names):
            for i in range(len(new_stage_names), len(current_stages)):
                current_stages[i].is_active = False
                print(f"Desactivada etapa sobrante: {current_stages[i].name}")
                
        db.session.commit()
        print("Migración de etapas completada con éxito.")

if __name__ == "__main__":
    update_stages()
