import sys
import os
sys.path.append(os.getcwd())
from app import create_app, db
from app.models import DailyReportQuestion

app = create_app()

with app.app_context():
    try:
        print("Querying questions...")
        questions = DailyReportQuestion.query.all()
        for q in questions:
            print(f"ID: {q.id}, Text: {q.text}, Role: {q.role}")
            
        print("\nQuerying questions with filter role='closer'...")
        closer_questions = DailyReportQuestion.query.filter((DailyReportQuestion.role == 'closer') | (DailyReportQuestion.role == None)).all()
        for q in closer_questions:
            print(f"ID: {q.id}, Text: {q.text}")
            
        print("Success!")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
