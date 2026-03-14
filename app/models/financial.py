from datetime import datetime
from app import db

class FinancialSale(db.Model):
    __tablename__ = 'financial_sales'
    id = db.Column(db.Integer, primary_key=True)
    setter_name = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    raw_data = db.Column(db.JSON, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "setter_name": self.setter_name,
            "amount": self.amount,
            "date": self.date.isoformat() if self.date else None,
            "raw_data": self.raw_data
        }
