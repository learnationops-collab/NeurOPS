"""Learnation Marketing dentro de Work (ADR-W280): la base de documentos y los archivos que el artifact de
claude.ai guardaba con sus capacidades `db` y `assets`.

`MarketingAppDoc` es un documento JSON por ruta (`coleccion/doc_id`), como el almacén del artifact: la página
lo lee y lo escribe igual que antes (ver app/marketing_app/almacen.py). `MarketingAppAsset` guarda los
archivos subidos (imágenes de los guiones), que se sirven en `/_blob/<id>` como en el artifact.
"""
from datetime import datetime

from app import db


class MarketingAppDoc(db.Model):
    __tablename__ = 'marketing_app_docs'
    __table_args__ = (db.UniqueConstraint('collection', 'doc_id', name='uq_marketing_app_docs_path'),)

    id = db.Column(db.Integer, primary_key=True)
    collection = db.Column(db.String(1000), nullable=False, index=True)
    doc_id = db.Column(db.String(200), nullable=False)
    data = db.Column(db.JSON, nullable=False, default=dict)
    version = db.Column(db.Integer, nullable=False, default=1)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)


class MarketingAppAsset(db.Model):
    __tablename__ = 'marketing_app_assets'

    id = db.Column(db.String(32), primary_key=True)
    content_type = db.Column(db.String(120), nullable=False)
    filename = db.Column(db.String(255), nullable=True)
    size = db.Column(db.Integer, nullable=False)
    data = db.Column(db.LargeBinary, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
