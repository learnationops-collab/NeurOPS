import sys
import os

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app, db
from app.models import SurveyQuestion

app = create_app()

with app.app_context():
    print("Seeding Default Landing Questions...")
    
    # 1. Name
    if not SurveyQuestion.query.filter_by(mapping_field='name').first():
        q = SurveyQuestion(text='Nombre Completo', question_type='text', order=-4, is_active=True, mapping_field='name', step='landing')
        db.session.add(q)
        print("Added Name Question")

    # 2. Email
    if not SurveyQuestion.query.filter_by(mapping_field='email').first():
        q = SurveyQuestion(text='Correo Electrónico', question_type='email', order=-3, is_active=True, mapping_field='email', step='landing')
        db.session.add(q)
        print("Added Email Question")

    # 3. Phone (Optional?) - Let's make it mandatory for now via text, user can change later
    if not SurveyQuestion.query.filter_by(mapping_field='phone').first():
        q = SurveyQuestion(text='Teléfono (WhatsApp)', question_type='text', order=-2, is_active=True, mapping_field='phone', step='landing')
        db.session.add(q)
        print("Added Phone Question")

    # 4. Instagram (Optional)
    if not SurveyQuestion.query.filter_by(mapping_field='instagram').first():
        q = SurveyQuestion(text='Usuario de Instagram', question_type='text', order=-1, is_active=True, mapping_field='instagram', step='landing')
        db.session.add(q)
        print("Added Instagram Question")
        
    db.session.commit()
    print("Seeding Complete.")
