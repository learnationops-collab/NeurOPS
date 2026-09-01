from app import db, login
from .user import User, GoogleCalendarToken, CloserAlias, ROLE_ADMIN, ROLE_CLOSER, ROLE_SETTER, ROLE_OPERATOR
from .client import Client, Lead, ClientComment, CommentNotification
from .funnel import Event, EventGroup, Program, event_closers
from .booking import Appointment, Availability, WeeklyAvailability, SurveyQuestion, SurveyAnswer
from .payment import Enrollment, PaymentMethod, Payment
from .marketing import Campaign, AdSet, Ad, MarketingBudget, AdPeriodSpend, ManychatAdLead, ManychatLead, LeadAnswer, UTMLog, LandingTracking, ConversationalMessage
from .report import SetterDailyStats, CloserDailyStats, DailyReportQuestion, DailyReportAnswer, Expense, RecurringExpense
from .closer_report import CloserDailyReport
from .crm import Pipeline, PipelineStage, UserViewSetting, Notification, Comment, LeadEventLog, FeatureToggle
from .integration import Integration
from .public_registration import PublicRegistration
from .financial import FinancialSale, FinancialAgenda, ExcludedSale, TeamMember, MonthlyPayroll, MonthlyPaymentMethodBalance, MonthlySaving
from .triage_report import TriageDailyReport
from .triage_tracker import TriageTrackerReport
from .workshop import WorkshopTemplate, WorkshopButton, WorkshopTemplateSent, WorkshopInteraction, WorkshopEvent, WorkshopGoals, WorkshopAction
from .workshop_lead import WorkshopLead
from .landing_session import LandingSession
from .alert import AlertRule, Alert
from .installment import InstallmentPlan
from .client_merge_log import ClientMergeLog
from .bug_report import BugReport, URGENCY_LEVELS

# Export all for easy access via from app.models import ...
__all__ = [
    'User', 'GoogleCalendarToken', 'CloserAlias', 'ROLE_ADMIN', 'ROLE_CLOSER', 'ROLE_SETTER', 'ROLE_OPERATOR', 'ROLE_TRIAGE',
    'Client', 'Lead', 'ClientComment', 'CommentNotification',
    'Event', 'EventGroup', 'Program', 'event_closers',
    'Appointment', 'Availability', 'WeeklyAvailability', 'SurveyQuestion', 'SurveyAnswer',
    'Enrollment', 'PaymentMethod', 'Payment',
    'Campaign', 'AdSet', 'Ad', 'MarketingBudget', 'AdPeriodSpend', 'ManychatAdLead', 'ManychatLead', 'LeadAnswer', 'UTMLog', 'LandingTracking', 'ConversationalMessage',
    'SetterDailyStats', 'CloserDailyStats', 'CloserDailyReport', 'DailyReportQuestion', 'DailyReportAnswer', 'Expense', 'RecurringExpense',
    'Pipeline', 'PipelineStage', 'UserViewSetting', 'Notification', 'Comment', 'LeadEventLog', 'FeatureToggle',
    'Integration', 'PublicRegistration', 'FinancialSale', 'FinancialAgenda', 'ExcludedSale', 'TriageDailyReport', 'TriageTrackerReport',
    'TeamMember', 'MonthlyPayroll', 'MonthlyPaymentMethodBalance', 'MonthlySaving',
    'WorkshopTemplate', 'WorkshopButton', 'WorkshopTemplateSent', 'WorkshopInteraction', 'WorkshopEvent',
    'WorkshopGoals', 'WorkshopAction',
    'WorkshopLead', 'LandingSession',
    'AlertRule', 'Alert',
    'InstallmentPlan', 'ClientMergeLog',
    'BugReport', 'URGENCY_LEVELS'
]

