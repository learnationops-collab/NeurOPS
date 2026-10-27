"""Antes de registrar una venta: ¿el correo o el Instagram que cargó el closer ya son de otra ficha con
otro nombre? Pasaba que el closer reusaba los datos del formulario anterior (el cliente que cargó ese
mismo día) y la venta quedaba con el correo de otra persona (pendientes de Santi, 27/10/2026).

Solo avisa: la ficha decide. Un dato que además se usó en una venta de los últimos 2 días es casi
seguro el del formulario anterior, y va marcado `reciente`.
"""
import re
import unicodedata
from datetime import datetime, timedelta

from flask import jsonify, request
from sqlalchemy import func

from app import db
from app.api.ficha import bp
from app.models import Client
from app.models.financial import FinancialSale

RECIENTE = timedelta(days=2)
_SIN_PESO = {'de', 'del', 'la', 'las', 'los', 'y'}


def _palabras(nombre):
    s = unicodedata.normalize('NFKD', (nombre or '').lower())
    s = ''.join(ch for ch in s if not unicodedata.combining(ch))
    return [p for p in re.sub(r'[^a-z ]', ' ', s).split() if p not in _SIN_PESO]


def mismo_nombre(a, b):
    """Dos nombres de la misma persona: comparten alguna palabra (o uno falta, y no se puede saber)."""
    pa, pb = set(_palabras(a)), set(_palabras(b))
    return not pa or not pb or bool(pa & pb)


def _ig(valor):
    return (valor or '').strip().lstrip('@').replace(' ', '').lower()


@bp.route('/venta/chequeo', methods=['GET'])
def chequeo_venta():
    """`?client_id=&nombre=&email=&instagram=` → `{conflictos: [{campo, valor, nombre, client_id, reciente}]}`."""
    client_id = request.args.get('client_id', type=int)
    nombre = request.args.get('nombre') or ''
    email = (request.args.get('email') or '').strip().lower()
    ig = _ig(request.args.get('instagram'))
    propio = db.session.get(Client, client_id) if client_id else None
    persona = propio.person_uuid if propio else None

    def ajenos(q):
        q = q.filter(Client.id != (client_id or 0))
        if persona:
            q = q.filter((Client.person_uuid.is_(None)) | (Client.person_uuid != persona))
        return [c for c in q.limit(20).all() if not mismo_nombre(nombre, c.full_name)]

    conflictos = []
    desde = datetime.utcnow() - RECIENTE
    for campo, valor, filtro, en_venta in (
        ('email', email, func.lower(Client.email) == email, func.lower(FinancialSale.mail_cliente) == email),
        ('instagram', ig, func.lower(func.replace(func.replace(Client.instagram, '@', ''), ' ', '')) == ig,
         func.lower(func.replace(func.replace(FinancialSale.instagram, '@', ''), ' ', '')) == ig),
    ):
        if not valor:
            continue
        otros = ajenos(Client.query.filter(filtro))
        if not otros:
            continue
        ids = [c.id for c in otros]
        recientes = {v.client_id for v in FinancialSale.query.filter(
            en_venta, FinancialSale.client_id.in_(ids), FinancialSale.created_at >= desde)}
        c = next((x for x in otros if x.id in recientes), otros[0])
        conflictos.append({'campo': campo, 'valor': valor, 'nombre': c.full_name, 'client_id': c.id,
                           'reciente': c.id in recientes})
    return jsonify({'conflictos': conflictos}), 200
