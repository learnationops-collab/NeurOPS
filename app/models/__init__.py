from app import db, login
from .user import User, GoogleCalendarToken, ROLE_ADMIN, ROLE_CLOSER, ROLE_SETTER, ROLE_OPERATOR
from .client import Client, Lead, ClientComment
from .funnel import Event, EventGroup, Program, event_closers
from .booking import Appointment, Availability, WeeklyAvailability, SurveyQuestion, SurveyAnswer
from .payment import Enrollment, PaymentMethod, Payment
from .marketing import Campaign, AdSet, Ad, MarketingBudget, AdPeriodSpend, ManychatAdLead, ManychatLead, LeadAnswer, UTMLog
from .report import SetterDailyStats, CloserDailyStats, DailyReportQuestion, DailyReportAnswer, Expense, RecurringExpense
from .closer_report import CloserDailyReport
from .crm import Pipeline, PipelineStage, UserViewSetting, Notification, Comment
from .integration import Integration
from .public_registration import PublicRegistration
from .financial import FinancialSale, FinancialAgenda
from .triage_report import TriageDailyReport
from .triage_tracker import TriageTrackerReport
from .workshop import WorkshopTemplate, WorkshopButton, WorkshopTemplateSent, WorkshopInteraction


# Export all for easy access via from app.models import ...
__all__ = [
    'User', 'GoogleCalendarToken', 'ROLE_ADMIN', 'ROLE_CLOSER', 'ROLE_SETTER', 'ROLE_OPERATOR', 'ROLE_TRIAGE',
    'Client', 'Lead', 'ClientComment',
    'Event', 'EventGroup', 'Program', 'event_closers',
    'Appointment', 'Availability', 'WeeklyAvailability', 'SurveyQuestion', 'SurveyAnswer',
    'Enrollment', 'PaymentMethod', 'Payment',
    'Campaign', 'AdSet', 'Ad', 'MarketingBudget', 'AdPeriodSpend', 'ManychatAdLead', 'ManychatLead', 'LeadAnswer', 'UTMLog',
    'SetterDailyStats', 'CloserDailyStats', 'CloserDailyReport', 'DailyReportQuestion', 'DailyReportAnswer', 'Expense', 'RecurringExpense',
    'Pipeline', 'PipelineStage', 'UserViewSetting', 'Notification', 'Comment',
    'Integration', 'PublicRegistration', 'FinancialSale', 'FinancialAgenda', 'TriageDailyReport', 'TriageTrackerReport',
    'WorkshopTemplate', 'WorkshopButton', 'WorkshopTemplateSent', 'WorkshopInteraction'


]
