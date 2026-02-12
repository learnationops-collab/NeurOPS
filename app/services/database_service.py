import json
from datetime import datetime, date, time
from sqlalchemy import inspect
from app import db
import app.models as models

class DatabaseService:
    # Ordered list of tables to ensure foreign keys are respected during import
    TABLE_ORDER = [
        'users',
        'event_groups',
        'events',
        'programs',
        'payment_methods',
        'clients',
        'pipelines',
        'pipeline_stages',
        'integrations',
        'daily_report_questions',
        'survey_questions',
        'appointments',
        'enrollments',
        'payments',
        'availability',
        'weekly_availability',
        'survey_answers',
        'expenses',
        'recurring_expenses',
        'setter_daily_stats',
        'closer_daily_stats',
        'daily_report_answers',
        'google_calendar_tokens',
        'user_view_settings',
        'campaigns',
        'ad_sets',
        'ads',
        'leads',
        'marketing_budgets',
        'client_comments'
    ]

    MODEL_MAP = {
        'users': models.User,
        'event_groups': models.EventGroup,
        'events': models.Event,
        'programs': models.Program,
        'payment_methods': models.PaymentMethod,
        'clients': models.Client,
        'pipelines': models.Pipeline,
        'pipeline_stages': models.PipelineStage,
        'integrations': models.Integration,
        'daily_report_questions': models.DailyReportQuestion,
        'survey_questions': models.SurveyQuestion,
        'appointments': models.Appointment,
        'enrollments': models.Enrollment,
        'payments': models.Payment,
        'availability': models.Availability,
        'weekly_availability': models.WeeklyAvailability,
        'survey_answers': models.SurveyAnswer,
        'expenses': models.Expense,
        'recurring_expenses': models.RecurringExpense,
        'setter_daily_stats': models.SetterDailyStats,
        'closer_daily_stats': models.CloserDailyStats,
        'daily_report_answers': models.DailyReportAnswer,
        'google_calendar_tokens': models.GoogleCalendarToken,
        'user_view_settings': models.UserViewSetting,
        'campaigns': models.Campaign,
        'ad_sets': models.AdSet,
        'ads': models.Ad,
        'leads': models.Lead,
        'marketing_budgets': models.MarketingBudget,
        'client_comments': models.ClientComment
    }

    @staticmethod
    def export_db():
        """Exports the entire database to a dictionary."""
        export_data = {}
        
        for table_name in DatabaseService.TABLE_ORDER:
            model = DatabaseService.MODEL_MAP.get(table_name)
            if not model:
                continue
                
            items = model.query.all()
            export_data[table_name] = []
            
            for item in items:
                # Convert the model instance to a dictionary
                data = {}
                for column in inspect(model).columns:
                    value = getattr(item, column.key)
                    
                    # Handle special types
                    if isinstance(value, (datetime, date, time)):
                        value = value.isoformat()
                    
                    data[column.key] = value
                
                export_data[table_name].append(data)
                
        return export_data

    @staticmethod
    def import_db(import_data):
        """
        Imports data into the database. 
        WARNING: This clears the existing business data first.
        """
        try:
            # 1. Clear data in REVERSE order
            for table_name in reversed(DatabaseService.TABLE_ORDER):
                model = DatabaseService.MODEL_MAP.get(table_name)
                if model:
                    db.session.query(model).delete()
            
            db.session.commit()
            
            # 2. Insert data in FORWARD order
            for table_name in DatabaseService.TABLE_ORDER:
                model = DatabaseService.MODEL_MAP.get(table_name)
                data_list = import_data.get(table_name, [])
                
                if not model or not data_list:
                    continue
                    
                for item_data in data_list:
                    # Convert strings back to special types
                    for column in inspect(model).columns:
                        val = item_data.get(column.key)
                        if val is None:
                            continue
                            
                        # Detect type from column if it's a string in JSON
                        if isinstance(val, str):
                            col_type = str(column.type)
                            if 'DATETIME' in col_type or 'TIMESTAMP' in col_type:
                                item_data[column.key] = datetime.fromisoformat(val)
                            elif 'DATE' in col_type:
                                item_data[column.key] = date.fromisoformat(val)
                            elif 'TIME' in col_type:
                                item_data[column.key] = time.fromisoformat(val)
                    
                    new_item = model(**item_data)
                    db.session.add(new_item)
                
                # Flush after each table to ensure PKs/FKs are respected
                db.session.flush()
                
            db.session.commit()
            return True, "Base de datos importada correctamente."
        except Exception as e:
            db.session.rollback()
            return False, f"Error en la importación: {str(e)}"

    @staticmethod
    def clear_table(table_key):
        """Deletes all records from a specific table key."""
        try:
            model = DatabaseService.MODEL_MAP.get(table_key)
            if not model:
                return False, f"Tabla '{table_key}' no reconocida o no permitida para limpieza."
            
            db.session.query(model).delete()
            db.session.commit()
            return True, f"Tabla '{table_key}' limpiada correctamente."
        except Exception as e:
            db.session.rollback()
            return False, f"Error al limpiar la tabla: {str(e)}"
