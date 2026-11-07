"""La foto de saldos de la vista Profit de Finanzas (07/11/2026).

Pedido de Mario: los saldos se cargan ANTES de hacer los pagos del mes, y desde ese momento el
payroll que Profit resta queda fijo aunque se marque gente como pagada (la plata sigue saliendo de
esas cuentas). Por eso la foto guarda cuándo se tomó (`taken_at`): lo que salió antes ya no está en
los saldos; lo que salió después todavía sí, y se resta.
"""
from datetime import datetime

from app import db


class FinanceLiquidity(db.Model):
    __tablename__ = 'finance_liquidity'
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.String(7), unique=True, nullable=False)  # YYYY-MM
    # {cuenta: [monto, ...]}: una cuenta puede tener varias partes (Stripe: disponible y en camino).
    accounts = db.Column(db.JSON, nullable=False, default=dict)
    ads_spent = db.Column(db.Float, nullable=True)
    # Ingresos que ya están en los saldos pero son del mes siguiente: [monto, ...].
    next_income = db.Column(db.JSON, nullable=False, default=list)
    taken_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    def to_dict(self):
        return {
            "month": self.month,
            "accounts": self.accounts or {},
            "ads_spent": self.ads_spent,
            "next_income": self.next_income or [],
            "taken_at": self.taken_at.isoformat() + 'Z' if self.taken_at else None,
        }
