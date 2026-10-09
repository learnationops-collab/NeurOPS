"""Cambiar el setter o el closer de una venta desde Payroll (08/10/2026).

Kerwin revisa la nómina en /finanzas y, cuando una venta está mal atribuida, la corrige ahí mismo en
vez de pasar por la vista del director comercial. Se tocan solo esos dos datos, con el mismo
criterio con el que los lee la nómina (`nomina_service.comisiones_del_rango`):

- closer: `FinancialSale.email_vendedor`, con el correo del usuario elegido (lo mismo que escribe la
  ficha al cargar una venta). Es lo que lee `resolver_nombre_closer`, y con él la nómina, el dashboard
  comercial y el espacio del closer.
- setter: `FinancialSale.setter` y la fuente (`nombre`) de la agenda que originó la venta, porque la
  agenda manda sobre el campo de la venta (`nomina_service.setter_de_la_venta`): es lo que ya hacían
  la edición de Operaciones y la masiva. Una agenda cuya fuente no cuenta (una entrevista, «s/f») no
  se toca: ahí ya manda el campo de la venta.

La agenda se busca con la atribución de TODAS las ventas (la de las métricas comerciales) y, si llega
el período de Payroll, también con la de ese período, que es la que usa la nómina: con un lead que
volvió a agendar pueden ser dos agendas distintas, y sin corregir las dos el tile que se está mirando
no cambiaba. El setter es el del lead, no el de un pago: cambiarlo mueve también las otras ventas de
ese lead y sus agendas en las métricas comerciales. Por eso la pantalla lo pide como una acción
deliberada.
"""
from app.models import FinancialAgenda, FinancialSale, User, db


class AtribucionInvalida(ValueError):
    """Un pedido que no se puede aplicar: el texto va tal cual en la respuesta (400)."""


def personas_atribuibles():
    """{'setters': [...], 'closers': [...]} para los selectores de Payroll, cada una {id, nombre,
    activo} y en orden alfabético: las activas del rol y, además, las inactivas que cobran comisión
    en la nómina (Nerina dejó de estar activa y sus ventas de septiembre siguen en Payroll)."""
    from app.services.commission_service import SETTERS_CON_COMISION, clave_de_closer

    def de_rol(rol, cobra):
        usuarios = [u for u in User.query.filter(User.role == rol).all()
                    if u.username and (u.is_active or cobra(u.username))]
        return [{'id': u.id, 'nombre': u.username, 'activo': bool(u.is_active)}
                for u in sorted(usuarios, key=lambda u: u.username.lower())]

    return {
        'setters': de_rol('setter', lambda nombre: nombre.strip().lower() in SETTERS_CON_COMISION),
        'closers': de_rol('closer', lambda nombre: clave_de_closer(nombre) is not None),
    }


def _persona(usuario_id, rol):
    try:
        usuario = db.session.get(User, int(usuario_id))
    except (TypeError, ValueError):
        usuario = None
    if not usuario or not usuario.tiene_rol(rol):
        raise AtribucionInvalida(f'La persona elegida no es {rol}.')
    return usuario


def _agendas_del_setter(venta, desde, hasta):
    """Las agendas de las que sale el setter de la venta, sin repetir: la de todas las ventas y la
    del período de Payroll (ver el docstring del módulo). Solo las que cuentan como fuente."""
    from app.services.attribution_service import AttributionService
    from app.services.nomina_service import fuente_valida, ventas_del_rango

    agendas = FinancialAgenda.query.all()
    candidatas = [AttributionService.get_sales_attribution(
        sales=FinancialSale.query.all(), agendas=agendas).get(venta.id)]
    if desde or hasta:
        del_periodo = ventas_del_rango(desde, hasta)
        if any(v.id == venta.id for v in del_periodo):
            candidatas.append(AttributionService.get_sales_attribution(
                sales=del_periodo, agendas=agendas).get(venta.id))
    unicas = {a.id: a for a in candidatas if a is not None}
    return [a for a in unicas.values() if fuente_valida(a.nombre)]


def cambiar_atribucion(venta, closer_id=None, setter_id=None, desde=None, hasta=None):
    """Pone el closer y/o el setter elegidos (ids de usuario) y confirma. Valida las dos personas
    antes de tocar nada: un setter que no existe no deja a medias el cambio de closer.

    Devuelve {id, closer, setter, agendas}: el closer como lo lee la nómina, el setter que quedó en
    la venta y los ids de las agendas cuya fuente cambió."""
    from app.services.closer_name_service import resolver_nombre_closer

    if closer_id is None and setter_id is None:
        raise AtribucionInvalida('Elegí un setter o un closer.')
    closer = _persona(closer_id, 'closer') if closer_id is not None else None
    setter = _persona(setter_id, 'setter') if setter_id is not None else None

    agendas = []
    if closer:
        venta.email_vendedor = closer.email or closer.username
    if setter:
        agendas = _agendas_del_setter(venta, desde, hasta)
        for agenda in agendas:
            agenda.nombre = setter.username
        venta.setter = setter.username
    db.session.commit()
    return {'id': venta.id, 'closer': resolver_nombre_closer(venta.email_vendedor),
            'setter': venta.setter, 'agendas': [a.id for a in agendas]}
