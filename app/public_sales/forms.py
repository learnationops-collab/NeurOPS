from flask_wtf import FlaskForm
from wtforms import StringField, SubmitField, SelectField, DecimalField, HiddenField
from wtforms.validators import DataRequired, Email, Length, Optional

class EmailLookupForm(FlaskForm):
    email = StringField('Email del Cliente', validators=[DataRequired(), Email()])
    submit = SubmitField('Buscar Cliente')

class NewClientForm(FlaskForm):
    username = StringField('Nombre Completo', validators=[DataRequired(), Length(min=2, max=64)])
    email = StringField('Email', validators=[DataRequired(), Email()])
    phone = StringField('Teléfono', validators=[DataRequired()])
    instagram = StringField('Instagram', validators=[Optional()])
    submit = SubmitField('Registrar Cliente')

class PublicSaleForm(FlaskForm):
    # Hidden fields to maintain context
    lead_id = HiddenField('Lead ID')
    
    program_id = SelectField('Programa', coerce=int, validators=[DataRequired()])
    payment_method_id = SelectField('Método de Pago', coerce=int, validators=[DataRequired()])
    amount = DecimalField('Monto a Pagar', validators=[DataRequired()])
    payment_type = SelectField('Tipo de Pago', choices=[
        ('full', 'Pago Completo'),
        ('down_payment', 'Primer Pago'),
        ('deposit', 'Seña')
    ], validators=[DataRequired()])
    
    submit = SubmitField('Registrar Venta')

class PublicPaymentForm(FlaskForm):
    payment_method_id = SelectField('Método de Pago', coerce=int, validators=[DataRequired()])
    amount = DecimalField('Monto a Pagar', validators=[DataRequired()])
    payment_type = SelectField('Concepto', choices=[
        ('installment', 'Cuota'),
        ('renewal', 'Renovación'),
        ('full', 'Liquidación Total') # In case they finish paying
    ], validators=[DataRequired()])
    
    submit = SubmitField('Registrar Pago')
