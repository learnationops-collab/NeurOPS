"""Condiciones SQL y cruces del dashboard comercial: qué cita es una agenda del setter, y qué
cliente le corresponde a cada venta. Se re-exporta desde `comercial_service.py`.
"""

from sqlalchemy import and_, func

from app import db
from app.models import Appointment, Client, FinancialSale


def no_es_marcador():
    """Condición SQL: la cita NO es el marcador que deja cualificar un lead en el mazo del setter.

    Confirmar un lead de ManyChat como cualificado (`/setter/deck/confirm-qualified` y sus dos
    hermanas en app/api/setter.py) crea un `Appointment` con `result='Cualificado'`, el
    `setter_id` del setter y la hora del clic como reunión, sin ninguna reserva detrás: es lo que
    `setter_agendas.py` ya documenta como placeholder. Contarlo haría de cada lead cualificado una
    "agenda generada" y un "Agendó". `coalesce` porque un `result` vacío es una agenda de verdad.
    """
    return func.lower(func.coalesce(Appointment.result, '')) != 'cualificado'


def es_agenda_del_setter(setter_id):
    """Condición SQL de «las agendas de un setter». Es LA definición: la usan sus números
    (`ComercialService.agendas` con `de_setters`, y por ella `generadas`: el bloque de Analizar, la
    serie de Variabilidad y la tabla de Revisar) y sus listas («Mis agendas», ver
    `palabra_clave_service`). Una lista que se arme con otra regla va a decir un número distinto
    del de "Mis datos".

    Una agenda es del setter cuando su cita (`Appointment`) tiene su `setter_id`, sin contar el
    marcador que deja cualificar un lead (`no_es_marcador`). `setter_id` no es un dato aparte de
    la fuente, es su espejo: el sync del Tablero lo recalcula desde `FinancialAgenda.nombre` cada
    vez que corre (`BookingService.sync_financial_agenda_to_appointment`), la ficha lo escribe
    junto con la fuente (`ficha_agendas_service.poner_fuente`), Agendas 2.0 lo pone con el link
    del setter y reclamar una agenda sin dueño también. Así «las que llegaron con la fuente del
    setter» y «las que cuentan en sus números» son las mismas filas.
    """
    return and_(Appointment.setter_id == setter_id, no_es_marcador())


def _limpiar_email(valor):
    v = (valor or '').strip().lower()
    return v if v and v != 'n/a' and '@' in v else None


def _limpiar_ig(valor):
    v = (valor or '').strip().lstrip('@').lower()
    return v if v and v != 'n/a' else None


def _ultimos8(valor):
    digitos = ''.join(c for c in str(valor or '') if c.isdigit())
    return digitos[-8:] if len(digitos) >= 8 else None


def _tipos_por_persona(personas):
    """{person_uuid: set de tipos canónicos} de sus pagos vigentes: el `_tipos_por_contacto` de las
    agendas que ya tienen persona (plan_personas, 20/10/2026)."""
    from app.services.sheets_service import SheetsService

    tipos = {}
    if not personas:
        return tipos
    for puuid, tipo_pago, estado in db.session.query(
            FinancialSale.person_uuid, FinancialSale.tipo_pago, FinancialSale.estado).filter(
            FinancialSale.person_uuid.in_(personas)):
        if (estado or '').strip().lower() in ('', 'completada', 'confirmada'):
            tipos.setdefault(puuid, set()).add(SheetsService.parse_tipo_pago(tipo_pago)[1] or 'otro')
    return tipos


def clientes_de_ventas(ventas):
    """{id de venta -> client_id}: el suyo y, si no lo tiene guardado, el de su persona (el más
    viejo, como `person_service.cliente_de`). El mail o el instagram copiados cuentan solo en las
    que no tienen persona (docs/plan_personas.md, Etapa 2b); el teléfono, nunca. Sin cliente, la
    fila se queda con el modal viejo: no hay a quién abrirle la ficha.

    **Un índice, no una consulta por fila:** `ventas()` devuelve cientos de filas por período y esto
    corre en cada pedido de la tabla. Ante dos clientes con el mismo contacto gana el más viejo.
    """
    mapa = {v.id: v.client_id for v in ventas if v.client_id}
    pendientes = [v for v in ventas if not v.client_id]
    # Primero el cliente de su persona (plan_personas, 20/10/2026): el más viejo, como `cliente_de`.
    personas = {v.person_uuid for v in pendientes if v.person_uuid}
    if personas:
        cliente_de_persona = {}
        for cid, puuid in (db.session.query(Client.id, Client.person_uuid)
                           .filter(Client.person_uuid.in_(personas)).order_by(Client.id)):
            cliente_de_persona.setdefault(puuid, cid)
        for v in pendientes:
            if cliente_de_persona.get(v.person_uuid):
                mapa[v.id] = cliente_de_persona[v.person_uuid]
    pendientes = [v for v in pendientes if not v.person_uuid]
    if not pendientes:
        return mapa

    por_email, por_ig = {}, {}
    for cid, email, ig in (db.session.query(Client.id, Client.email, Client.instagram)
                           .order_by(Client.id).all()):
        # El correo sintético que inventa `BookingService` cuando el lead llegó sin ninguno no
        # identifica a nadie: dos clientes distintos jamás comparten uno, pero tampoco sirve
        # para reconocer a este.
        limpio = _limpiar_email(email)
        if limpio and 'no-email-' not in limpio:
            por_email.setdefault(limpio, cid)
        ig_limpio = _limpiar_ig(ig)
        if ig_limpio:
            por_ig.setdefault(ig_limpio, cid)

    for v in pendientes:
        encontrado = (por_email.get(_limpiar_email(v.mail_cliente) or '')
                      or por_ig.get(_limpiar_ig(v.instagram) or ''))
        if encontrado:
            mapa[v.id] = encontrado
    return mapa
