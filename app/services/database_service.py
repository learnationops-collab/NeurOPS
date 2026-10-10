from app import db
import app.models as models

class DatabaseService:
    # Tablas que se pueden vaciar desde «Limpieza selectiva de tablas» (Operaciones › Datos). Hasta el
    # 10/10/2026 también eran el respaldo en JSON (export_db/import_db): se fue porque cubría 30 de las 91
    # tablas y al importar borraba primero; el respaldo completo es /api/backup (pestaña Respaldo).
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
