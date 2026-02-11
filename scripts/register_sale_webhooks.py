from app import create_app
from app.models import Integration, db

app = create_app()
with app.app_context():
    # 1. Wins Webhook
    wins = Integration.query.filter_by(key='sale_wins').first()
    if not wins:
        wins = Integration(
            key='sale_wins',
            name='Ventas (Wins)',
            url_dev='https://discord.com/api/webhooks/1454108874427863050/HMEVGUB0aecTacqhM7JmF6G_DpUGDZJj6q3mLSKjw0u08JTHIP1sduS1BHpSubTP6IaG',
            url_prod='https://discord.com/api/webhooks/1454108874427863050/HMEVGUB0aecTacqhM7JmF6G_DpUGDZJj6q3mLSKjw0u08JTHIP1sduS1BHpSubTP6IaG',
            active_env='prod'
        )
        db.session.add(wins)
        print("Created Won Sales integration.")
    else:
        wins.url_dev = 'https://discord.com/api/webhooks/1454108874427863050/HMEVGUB0aecTacqhM7JmF6G_DpUGDZJj6q3mLSKjw0u08JTHIP1sduS1BHpSubTP6IaG'
        wins.url_prod = 'https://discord.com/api/webhooks/1454108874427863050/HMEVGUB0aecTacqhM7JmF6G_DpUGDZJj6q3mLSKjw0u08JTHIP1sduS1BHpSubTP6IaG'
        print("Updated Won Sales integration.")

    # 2. Onboardings Webhook
    onboarding = Integration.query.filter_by(key='sale_onboarding').first()
    if not onboarding:
        onboarding = Integration(
            key='sale_onboarding',
            name='Onboardings (Fullfilment)',
            url_dev='https://discord.com/api/webhooks/1454110394866991114/Ow5tUjK9xQw-EM9bANltyR158VijdKaNaELSL81rEHl-xNsgooBUOaJpno4wHv8MxX0o',
            url_prod='https://discord.com/api/webhooks/1454110394866991114/Ow5tUjK9xQw-EM9bANltyR158VijdKaNaELSL81rEHl-xNsgooBUOaJpno4wHv8MxX0o',
            active_env='prod'
        )
        db.session.add(onboarding)
        print("Created Onboarding integration.")
    else:
        onboarding.url_dev = 'https://discord.com/api/webhooks/1454110394866991114/Ow5tUjK9xQw-EM9bANltyR158VijdKaNaELSL81rEHl-xNsgooBUOaJpno4wHv8MxX0o'
        onboarding.url_prod = 'https://discord.com/api/webhooks/1454110394866991114/Ow5tUjK9xQw-EM9bANltyR158VijdKaNaELSL81rEHl-xNsgooBUOaJpno4wHv8MxX0o'
        print("Updated Onboarding integration.")

    db.session.commit()
    print("Done.")
