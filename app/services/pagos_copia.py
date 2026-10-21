"""La copia del contacto en los pagos (`FinancialSale.mail_cliente`, `instagram`, `nombre_cliente`,
`telefono`), leída en un solo lugar (Inventario 2c, paso 1, docs/plan_personas.md).

Un pago con persona se lee de la persona (`FinancialSale.contacto()`); la copia cuenta solo en los
pagos sin persona. Los cruces en lote que no pueden pasar por `contacto()` (consultas, claves de
agrupado) toman la copia de acá: el día que se borren las columnas, se cambia este archivo y
devuelve vacío, sin tocar a los que llaman.
"""
from sqlalchemy import func

from app.models import FinancialSale

VACIA = {'mail': None, 'instagram': None, 'nombre': None, 'telefono': None}


def copia(fila):
    """Lo copiado en el pago, o todo None si el pago tiene persona. `fila` es un `FinancialSale` o
    cualquier objeto con sus columnas (las filas livianas del agrupado)."""
    if getattr(fila, 'person_uuid', None):
        return dict(VACIA)
    return {'mail': getattr(fila, 'mail_cliente', None), 'instagram': getattr(fila, 'instagram', None),
            'nombre': getattr(fila, 'nombre_cliente', None), 'telefono': getattr(fila, 'telefono', None)}


# Las mismas columnas en SQL, para consultas en lote. Solo se usan sobre pagos sin persona
# (`FinancialSale.person_uuid.is_(None)`), o en una columna que se descarta cuando tiene persona.
MAIL = FinancialSale.mail_cliente
INSTAGRAM = FinancialSale.instagram
MAIL_NORMALIZADO = func.lower(FinancialSale.mail_cliente)
IG_NORMALIZADO = func.lower(func.replace(FinancialSale.instagram, '@', ''))
