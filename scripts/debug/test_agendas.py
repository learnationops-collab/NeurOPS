from app import create_app
from app.models import db, FinancialAgenda
app = create_app()
app.app_context().push()

from app.api.public.__init__ import sync_financial_agendas_from_sheets
print(sync_financial_agendas_from_sheets())
