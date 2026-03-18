from datetime import datetime
from app import db

class FinancialSale(db.Model):
    __tablename__ = 'financial_sales'
    id = db.Column(db.Integer, primary_key=True)
    setter_name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    raw_data = db.Column(db.JSON, nullable=True)
    status = db.Column(db.String(50), default='valid', nullable=False)
    error_notes = db.Column(db.Text, nullable=True)
    product = db.Column(db.String(100), nullable=True)
    payment_type = db.Column(db.String(100), nullable=True)

    def to_dict(self):
        raw = self.raw_data or {}
        # Safely fallback to parsing from raw_data for older records before the migration
        db_product = self.product or raw.get('tipo_pago') or raw.get('producto') or 'N/A'
        
        return {
            "id": self.id,
            "setter_name": self.setter_name,
            "amount": self.amount,
            "date": self.date.isoformat() if self.date else None,
            "cliente": raw.get('cliente') or raw.get('nombre') or 'Desconocido',
            "closer": raw.get('vendedor') or raw.get('closer') or 'Sin asignar',
            "producto": db_product,
            "payment_type": self.payment_type or 'N/A',
            "status": self.status,
            "error_notes": self.error_notes,
            "raw_data": raw
        }
