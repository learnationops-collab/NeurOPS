from app import db, login
from .user import User, GoogleCalendarToken, CloserAlias, ROLE_ADMIN, ROLE_CLOSER, ROLE_SETTER, ROLE_OPERATOR, get_impersonation_state
from .client import Client, ClientComment, CommentNotification
from .funnel import Event, EventGroup, Program, event_closers
from .booking import Appointment, Availability, WeeklyAvailability, SurveyQuestion, SurveyAnswer
from .payment import PaymentMethod
from .marketing import Campaign, AdSet, Ad, MarketingBudget, AdPeriodSpend, LeadAnswer, UTMLog, LandingTracking, ConversationalMessage, MetaAnuncio, MetaGastoDiario
from .report import SetterDailyStats, CloserDailyStats, DailyReportQuestion, DailyReportAnswer, Expense, RecurringExpense
from .closer_report import CloserDailyReport
from .comercial_report import ReporteDirector, ReporteDirectorPersona
from .crm import Pipeline, PipelineStage, UserSetting, Notification, Comment, LeadEventLog, FeatureToggle
from .integration import Integration
from .public_registration import PublicRegistration
from .financial import FinancialSale, FinancialAgenda, ExcludedSale, TeamMember, MonthlyPayroll, MonthlyPaymentMethodBalance, MonthlySaving
from .conciliacion import ConciliacionCarga, ConciliacionMovimiento, ConciliacionRevision
from .triage_report import TriageDailyReport
from .triage_tracker import TriageTrackerReport
from .workshop import WorkshopEvent, WorkshopGoals, WorkshopAction
from .workshop_lead import WorkshopLead
from .landing_session import LandingSession
from .alert import AlertRule, Alert  # Alertas se retiró el 10/10/2026; las tablas se conservan (ver alert.py)
from .installment import InstallmentPlan
from .sale import Sale, SALE_KINDS, SALE_STATUSES
from .subscription import Subscription, SubscriptionEvent, SUBSCRIPTION_STATUSES, SUBSCRIPTION_EVENT_KINDS
from .ficha_opcion import FichaOpcion
from .client_merge_log import ClientMergeLog
from .system_log import SystemLog
from .person import Person, PersonIdentity, PersonEvent, Conversation, IDENTITY_KINDS, IDENTITY_USOS, PERSON_EVENT_KINDS
from .academy_snapshot import AcademySnapshot
from .bug_report import BugReport, BugReportMessage, URGENCY_LEVELS, STATUS_VALUES, REPORT_TYPES
from .job_application import JobApplication, JobApplicationVote, ClarityWeight, CLARITY_CRITERIA, VOTE_VALUES
from .assistant_application import AssistantApplication, AssistantClarityWeight
from .hiring_form import HiringForm, HiringConfig
from .playbook import (
    PlaybookRoadmap, PlaybookModule, PlaybookLesson, PlaybookQuestion, PlaybookOption,
    PlaybookLessonProgress, PlaybookCompletion, QUESTION_TYPES
)
from .instagram import InstagramWebhookEvento
from .ai_usage import AiUsage
from .intento_limitado import IntentoLimitado
from .tag import Tag, TagGroup, TARGET_IG_CONTACT

# Export all for easy access via from app.models import ...
__all__ = [
    'User', 'GoogleCalendarToken', 'CloserAlias', 'ROLE_ADMIN', 'ROLE_CLOSER', 'ROLE_SETTER', 'ROLE_OPERATOR', 'ROLE_TRIAGE',
    'get_impersonation_state',
    'Client', 'ClientComment', 'CommentNotification',
    'Event', 'EventGroup', 'Program', 'event_closers',
    'Appointment', 'Availability', 'WeeklyAvailability', 'SurveyQuestion', 'SurveyAnswer',
    'PaymentMethod',
    'Campaign', 'AdSet', 'Ad', 'MarketingBudget', 'AdPeriodSpend', 'LeadAnswer', 'UTMLog', 'LandingTracking', 'ConversationalMessage',
    'MetaAnuncio', 'MetaGastoDiario',
    'SetterDailyStats', 'CloserDailyStats', 'CloserDailyReport', 'ReporteDirector', 'ReporteDirectorPersona', 'DailyReportQuestion', 'DailyReportAnswer', 'Expense', 'RecurringExpense',
    'Pipeline', 'PipelineStage', 'UserSetting', 'Notification', 'Comment', 'LeadEventLog', 'FeatureToggle',
    'Integration', 'PublicRegistration', 'FinancialSale', 'FinancialAgenda', 'ExcludedSale', 'TriageDailyReport', 'TriageTrackerReport',
    'TeamMember', 'MonthlyPayroll', 'MonthlyPaymentMethodBalance', 'MonthlySaving',
    'ConciliacionCarga', 'ConciliacionMovimiento', 'ConciliacionRevision',
    'WorkshopEvent',
    'WorkshopGoals', 'WorkshopAction',
    'WorkshopLead', 'LandingSession',
    'AlertRule', 'Alert',
    'InstallmentPlan', 'Sale', 'SALE_KINDS', 'SALE_STATUSES',
    'Subscription', 'SubscriptionEvent', 'SUBSCRIPTION_STATUSES', 'SUBSCRIPTION_EVENT_KINDS','ClientMergeLog', 'SystemLog', 'Person', 'PersonIdentity', 'PersonEvent', 'Conversation', 'IDENTITY_KINDS', 'IDENTITY_USOS', 'PERSON_EVENT_KINDS', 'FichaOpcion', 'AcademySnapshot',
    'BugReport', 'BugReportMessage', 'URGENCY_LEVELS', 'STATUS_VALUES', 'REPORT_TYPES',
    'JobApplication', 'JobApplicationVote', 'ClarityWeight', 'CLARITY_CRITERIA', 'VOTE_VALUES',
    'AssistantApplication', 'AssistantClarityWeight', 'HiringForm', 'HiringConfig',
    'PlaybookRoadmap', 'PlaybookModule', 'PlaybookLesson', 'PlaybookQuestion', 'PlaybookOption',
    'PlaybookLessonProgress', 'PlaybookCompletion', 'QUESTION_TYPES',
    'InstagramWebhookEvento', 'AiUsage', 'IntentoLimitado',
]

