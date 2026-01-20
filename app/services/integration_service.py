from app import db
from app.models import Integration
from app.services.base import BaseService

class IntegrationService(BaseService):
    @staticmethod
    def ensure_defaults():
        """Ensure all default integrations exist in the database."""
        integration_config = {
            'sales': 'Ventas',
            'calendar': 'Agendamiento',
            'agenda': 'Agenda'
        }

        for key, name in integration_config.items():
            exists = Integration.query.filter_by(key=key).first()
            if not exists:
                new_int = Integration(
                    key=key,
                    name=name,
                    url_dev='',
                    url_prod='',
                    active_env='dev'
                )
                db.session.add(new_int)
        db.session.commit()

    @staticmethod
    def get_all():
        """Get all integrations."""
        return Integration.query.all()

    @staticmethod
    def update_integration(key, data):
        """Update an existing integration."""
        integration = Integration.query.filter_by(key=key).first()
        if not integration:
            return IntegrationService.error("Integration not found", 404)

        integration.url_dev = data.get('url_dev')
        integration.url_prod = data.get('url_prod')
        
        active_env = data.get('active_env')
        if active_env in ['dev', 'prod']:
            integration.active_env = active_env
            
        db.session.commit()
        return IntegrationService.success(integration, f"Integración {integration.name} actualizada.")
