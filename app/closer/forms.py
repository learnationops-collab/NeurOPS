from flask_wtf import FlaskForm
from wtforms import StringField, SubmitField, SelectField, DateField, TimeField, FloatField, HiddenField, TextAreaField
from wtforms.validators import DataRequired, Email, Length

class LeadForm(FlaskForm):
    username = StringField('Nombre', validators=[DataRequired(), Length(min=2, max=64)])
    email = StringField('Email', validators=[DataRequired(), Email(), Length(max=120)])
    phone = StringField('Teléfono', validators=[Length(max=20)])
    instagram = StringField('Instagram', validators=[Length(max=50)])
    submit = SubmitField('Guardar Lead')

class AppointmentForm(FlaskForm):
    lead_id = SelectField('Lead', coerce=int, validators=[DataRequired()])
    date = DateField('Fecha', validators=[DataRequired()])
    time = TimeField('Hora', validators=[DataRequired()])
    submit = SubmitField('Agendar Cita')

class SaleForm(FlaskForm):
    lead_id = HiddenField('Lead ID', validators=[DataRequired()])
    # We display name in a readonly field or just via JS updating a div
    lead_search = StringField('Buscar Lead') # Search input
    
    program_id = SelectField('Programa', coerce=int, validators=[DataRequired()])
    amount = FloatField('Monto ($USD)', validators=[DataRequired()])
    
    payment_type = SelectField('Tipo de Pago', choices=[
        ('full', 'Pago Completo'), 
        ('down_payment', 'Primer Pago (Inicial)'),
        ('installment', 'Cuota'),
        ('renewal', 'Renovación')
    ], validators=[DataRequired()])
    
    payment_method_id = SelectField('Método de Pago', coerce=int, validators=[DataRequired()])
    # Removed transaction_id and details per user request
    
    submit = SubmitField('Registrar Venta')

class CloserPaymentForm(FlaskForm):
    amount = FloatField('Monto ($USD)', validators=[DataRequired()])
    date = DateField('Fecha de Pago', format='%Y-%m-%d', validators=[DataRequired()])
    payment_type = SelectField('Tipo de Pago', choices=[
        ('full', 'Pago Completo'),
        ('down_payment', 'Primer Pago'),
        ('installment', 'Cuota'),
        ('renewal', 'Renovación')
    ], validators=[DataRequired()])
    payment_method_id = SelectField('Método de Pago', coerce=int, validators=[DataRequired()])
    reference_id = StringField('Referencia / ID Transacción', validators=[Length(max=100)])
    status = SelectField('Estado', choices=[
        ('completed', 'Completado'),
        ('pending', 'Pendiente'),
        ('failed', 'Fallido')
    ], default='completed')
    submit = SubmitField('Guardar Pago')
