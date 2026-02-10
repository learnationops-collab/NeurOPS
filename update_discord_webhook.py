from app import create_app, db
from app.models import Integration

app = create_app()

with app.app_context():
    # URL provided by user
    discord_url = "https://discord.com/api/webhooks/1450234481675079710/lQW7j7UIAwwJ14VcagZzMQ9lXpDFfPz1lzHcBR3BGN782zQP97xn6Y8yti5VfPkdJhMx"
    
    # Find existing or create new
    integration = Integration.query.filter(Integration.name.ilike('Agenda%')).first()
    
    if not integration:
        print("Integration 'Agenda' not found. Creating new...")
        integration = Integration(
            name="Agenda Webhook",
            key="agenda_webhook",
            active_env="prod"
        )
        db.session.add(integration)
    
    # Update URLs
    integration.url_prod = discord_url
    integration.url_dev = discord_url
    integration.active_env = "prod"
    
    db.session.commit()
    print(f"Updated Integration '{integration.name}' with Discord URL.")
