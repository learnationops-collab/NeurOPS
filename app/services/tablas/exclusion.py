"""Lo que el motor nunca muestra, y lo que muestra solo a algunos roles. Un solo lugar para revisarlo."""
from app.models.user import ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL

# Tablas que nunca son fuente ni padre ni hijo: credenciales, técnicas, chats privados y postulantes.
DENY_TABLES = {
    'google_calendar_tokens', 'integrations', 'feature_toggles', 'user_settings', 'instagram_webhook_eventos',
    'ai_usage', 'conversational_messages', 'ig_mensajes', 'bug_report_messages', 'notifications',
    'job_applications', 'job_application_votes', 'job_application_clarity_weights',
    'hiring_config', 'hiring_forms', 'assistant_applications', 'assistant_application_clarity_weights',
    'alembic_version', 'intentos_limitados',
}

# `users` no es fuente (tiene staff y credenciales): solo se ven estas columnas como padre.
USER_PARENT_COLUMNS = ('username', 'email', 'role')

# Nómina, gastos y comisiones: solo el admin.
ADMIN_TABLES = {
    'monthly_payroll', 'expenses', 'recurring_expenses', 'comision_tasas', 'monthly_savings',
    'monthly_payment_method_balances',
}

# Columnas que nunca se listan: cualquiera cuyo nombre contenga una de estas palabras.
DENY_COLUMN_WORDS = ('password', 'token', 'secret', 'api_key', 'private_key', 'credential')

# Montos: columnas numéricas cuyo nombre contiene una de estas palabras. Las ven admin y director comercial.
AMOUNT_WORDS = (
    'amount', 'monto', 'precio', 'price', 'total', 'deuda', 'saldo', 'comision', 'commission', 'salario', 'salary',
    'sueldo', 'cash', 'revenue', 'ingreso', 'gasto', 'importe', 'pagado', 'cobrado',
)
AMOUNT_ROLES = {ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL}


def allowed_table(name):
    return name not in DENY_TABLES


def allowed_column(name):
    lower = name.lower()
    return not any(w in lower for w in DENY_COLUMN_WORDS)


def is_amount(name, kind):
    lower = name.lower()
    return kind == 'number' and not lower.endswith('_id') and any(w in lower for w in AMOUNT_WORDS)


def sees_table(user, name):
    return name not in ADMIN_TABLES or getattr(user, 'role', None) == ROLE_ADMIN


def sees_amounts(user):
    return getattr(user, 'role', None) in AMOUNT_ROLES
