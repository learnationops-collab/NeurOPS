from app import create_app, db
from app.models import User, ROLE_OPERATOR

app = create_app()

with app.app_context():
    if not User.query.filter_by(username='operator_test').first():
        user = User(username='operator_test', email='op@test.com', role=ROLE_OPERATOR)
        user.set_password('12345678')
        db.session.add(user)
        db.session.commit()
        print("Usuario operador creado: operator_test / 12345678")
    else:
        print("Usuario operador ya existe")
