from app import db, login
from .user import User, GoogleCalendarToken, CloserAlias, ROLE_ADMIN, ROLE_CLOSER, ROLE_SETTER, ROLE_OPERATOR, get_impersonation_state
from .client import Client
from .funnel import Event, EventGroup, Program, event_closers
from .booking import Appointment, Availability, WeeklyAvailability, SurveyQuestion, SurveyAnswer
from .payment import PaymentMethod
from .marketing import Campaign, AdSet, Ad, MarketingBudget, AdPeriodSpend, LeadAnswer, UTMLog, LandingTracking, ConversationalMessage, MetaAnuncio, MetaGastoDiario, MetaGastoHorario, MetaCampanaPrograma
from .report import SetterDailyStats, CloserDailyStats, DailyReportQuestion, DailyReportAnswer, Expense, RecurringExpense
from .closer_report import CloserDailyReport
from .comercial_report import ReporteDirector, ReporteDirectorPersona
from .crm import Pipeline, PipelineStage, UserSetting, Notification, LeadEventLog, FeatureToggle
from .integration import Integration
from .public_registration import PublicRegistration
from .financial import FinancialSale, FinancialAgenda, ExcludedSale, TeamMember, MonthlyPayroll, MonthlyPaymentMethodBalance, MonthlySaving
from .conciliacion import ConciliacionCarga, ConciliacionMovimiento, ConciliacionRevision
from .liquidez import FinanceLiquidity
from .triage_report import TriageDailyReport
from .daily_close import DailyClose
from .triage_tracker import TriageTrackerReport
from .workshop import WorkshopEvent, WorkshopGoals, WorkshopAction
from .workshop_grupo import WorkshopGrupo
from .workshop_lead import WorkshopLead
from .landing_session import LandingSession
from .alert import AlertRule, Alert  # Alertas se retiró el 10/10/2026; las tablas se conservan (ver alert.py)
from .installment import InstallmentPlan
from .sale import Sale, SALE_KINDS, SALE_STATUSES
from .subscription import Subscription, SubscriptionEvent, SUBSCRIPTION_STATUSES, SUBSCRIPTION_EVENT_KINDS
from .ficha_opcion import FichaOpcion
from .client_merge_log import ClientMergeLog
from .system_log import SystemLog
from .learnito_conversacion import LearnitoConversacion
from .person import Person, PersonIdentity, PersonEvent, Conversation, IDENTITY_KINDS, IDENTITY_USOS, PERSON_EVENT_KINDS
from .academy_snapshot import AcademySnapshot
from .embudo import EmbudoConfig, EmbudoRegistro
from .bug_report import BugReport, BugReportMessage, URGENCY_LEVELS, STATUS_VALUES, REPORT_TYPES, report_type_priority
from .job_application import JobApplication, JobApplicationVote, ClarityWeight, CLARITY_CRITERIA, VOTE_VALUES
from .assistant_application import AssistantApplication, AssistantClarityWeight
from .hiring_form import HiringForm, HiringConfig
from .playbook import (
    PlaybookRoadmap, PlaybookModule, PlaybookLesson, PlaybookQuestion, PlaybookOption,
    PlaybookLessonProgress, PlaybookCompletion, QUESTION_TYPES
)
from .instagram import InstagramWebhookEvento
from .whatsapp import WhatsappWebhookEvento, WaEnvio, WaRespuestaBoton, WaRespuestaPendiente
from .whatsapp_taller import WaPlanTaller, WaPasoTaller
from .ai_usage import AiUsage
from .intento_limitado import IntentoLimitado
from .tag import Tag, TagGroup, TARGET_IG_CONTACT
from .inbox_work import Note, Task, QuickReply, AudioClip, InboxRead
from .conflicto import Conflicto, CONFLICTO_TIPOS, CONFLICTO_ESTADOS
from .meeting_note import MeetingNote

# Export all for easy access via from app.models import ...
__all__ = [
    'User', 'GoogleCalendarToken', 'CloserAlias', 'ROLE_ADMIN', 'ROLE_CLOSER', 'ROLE_SETTER', 'ROLE_OPERATOR', 'ROLE_TRIAGE',
    'get_impersonation_state',
    'Client',
    'Event', 'EventGroup', 'Program', 'event_closers',
    'Appointment', 'Availability', 'WeeklyAvailability', 'SurveyQuestion', 'SurveyAnswer',
    'PaymentMethod',
    'Campaign', 'AdSet', 'Ad', 'MarketingBudget', 'AdPeriodSpend', 'LeadAnswer', 'UTMLog', 'LandingTracking', 'ConversationalMessage',
    'MetaAnuncio', 'MetaGastoDiario', 'MetaGastoHorario', 'MetaCampanaPrograma',
    'SetterDailyStats', 'CloserDailyStats', 'CloserDailyReport', 'ReporteDirector', 'ReporteDirectorPersona', 'DailyReportQuestion', 'DailyReportAnswer', 'Expense', 'RecurringExpense',
    'Pipeline', 'PipelineStage', 'UserSetting', 'Notification', 'LeadEventLog', 'FeatureToggle',
    'Integration', 'PublicRegistration', 'FinancialSale', 'FinancialAgenda', 'ExcludedSale', 'TriageDailyReport', 'TriageTrackerReport', 'DailyClose',
    'TeamMember', 'MonthlyPayroll', 'MonthlyPaymentMethodBalance', 'MonthlySaving',
    'ConciliacionCarga', 'ConciliacionMovimiento', 'ConciliacionRevision',
    'WorkshopEvent',
    'WorkshopGoals', 'WorkshopAction', 'WorkshopGrupo',
    'WorkshopLead', 'LandingSession',
    'AlertRule', 'Alert',
    'InstallmentPlan', 'Sale', 'SALE_KINDS', 'SALE_STATUSES',
    'Subscription', 'SubscriptionEvent', 'SUBSCRIPTION_STATUSES', 'SUBSCRIPTION_EVENT_KINDS','ClientMergeLog', 'SystemLog', 'Person', 'PersonIdentity', 'PersonEvent', 'Conversation', 'IDENTITY_KINDS', 'IDENTITY_USOS', 'PERSON_EVENT_KINDS', 'FichaOpcion', 'AcademySnapshot',
    'BugReport', 'BugReportMessage', 'URGENCY_LEVELS', 'STATUS_VALUES', 'REPORT_TYPES', 'report_type_priority',
    'JobApplication', 'JobApplicationVote', 'ClarityWeight', 'CLARITY_CRITERIA', 'VOTE_VALUES',
    'AssistantApplication', 'AssistantClarityWeight', 'HiringForm', 'HiringConfig',
    'PlaybookRoadmap', 'PlaybookModule', 'PlaybookLesson', 'PlaybookQuestion', 'PlaybookOption',
    'PlaybookLessonProgress', 'PlaybookCompletion', 'QUESTION_TYPES',
    'InstagramWebhookEvento', 'AiUsage', 'IntentoLimitado', 'LearnitoConversacion',
    'EmbudoConfig', 'EmbudoRegistro',
]

