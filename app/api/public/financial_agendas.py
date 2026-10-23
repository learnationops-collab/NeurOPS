"""Los helpers de las agendas financieras, reexportados desde acá para quien los importa con este nombre.

El ingreso por webhook de n8n/Calendly (POST /public/financial-agendas, su verificación de hora y el
sync desde Sheets) se sacó el 23/10/2026: desde el 15/10 todas las agendas entran por Agendas 2.0.
"""
# Re-export: otros modulos importan estos helpers desde aca.
from .financial_agendas_helpers import (  # noqa: F401
    parse_date_robustly, ESTADOS_AGENDA_ABIERTA, _split_multi, _build_agenda_queries, _resolve_closer_results)
