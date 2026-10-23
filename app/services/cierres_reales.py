"""El close rate real: lo cerrado en el período, venga de la llamada que venga (23/10/2026).

El close rate por llamada mira las llamadas DEL período y pregunta cuántas terminaron en venta. Una
seña (o un seguimiento) de la llamada del mes pasado que se paga este mes no está entre esas
llamadas, así que no entra, aunque sea una venta de este mes y aparezca en el cash y en el ticket.
Mismo cierre, dos cuentas distintas: 9 ventas en el ticket y 4 en el close rate (Jean Carlo).

Acá se cuenta por COBRO, que es cuando el cierre ocurrió, y cada uno se rastrea hasta la llamada de
la que salió (la última con show up antes del pago, de cualquier closer, hasta `VENTANA_LLAMADA_DIAS`
antes):

  · `periodo`     la llamada es del período: ya está entre las que asistieron.
  · `anterior`    la llamada es de antes del período (la seña, el seguimiento o la segunda llamada
                  que se cerró ahora). Esa llamada no está entre las que asistieron: se suma al
                  denominador, porque es una oportunidad que este período trabajó y cerró.
  · `sin_llamada` no hay llamada (upsell de un cliente viejo, venta directa, un cobro sin ficha).
                  No es una oportunidad del período: queda fuera de la tasa y se muestra aparte.

    close rate real = (periodo + anterior) ÷ (asistieron + anterior)

Nunca pasa de 100%: cada cierre con llamada anterior suma uno arriba y uno abajo.

Cuenta como cierre, además de los pagos completos y split pay (`es_venta`), la seña que se terminó
de pagar con una «Cuota» a menos de un mes y llegó al precio (`senas_conversion`): los closers cargan
así el resto de la seña. Solo cuenta en este número; el ticket y el close rate por llamada no la ven.

Como en el resto del tablero, cuenta pagos y no clientes (`ticket_service`: la cantidad de ventas del
close rate sigue contando filas): dos pagos de venta del mismo lead en el período son dos cierres.
"""
from datetime import date, datetime, time, timedelta

from dateutil.relativedelta import relativedelta
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app import db
from app.models import Appointment, Client, FinancialSale
from app.services.closer_agendas_service import derivar_estado
from app.services.closer_name_service import resolver_nombre_closer
from app.services.comercial_cruces import _limpiar_email, _limpiar_ig, clientes_de_ventas
from app.services.comercial_vocabulario import pct
from app.services.senas_conversion import COMPLETO, claves_de_fila, conversion_de, pagos_posteriores
from app.services.ventas_previas import TOLERANCIA_DIAS

# Cuánto antes del pago puede estar la llamada de la que salió: una seña o un seguimiento tarda
# semanas, pero pasado un trimestre el pago ya es de otra venta (un upsell a un cliente viejo).
VENTANA_LLAMADA_DIAS = 90
# Estados del libro de agendas de una llamada que ocurrió.
CON_SHOW_UP = ('show_up', 'segunda_llamada')
PERIODO, ANTERIOR, SIN_LLAMADA = 'periodo', 'anterior', 'sin_llamada'
_LOTE = 400


def _lotes(valores):
    valores = sorted(valores)
    for i in range(0, len(valores), _LOTE):
        yield valores[i:i + _LOTE]


def _dia(texto):
    return date.fromisoformat(texto[:10]) if texto else None


def _clientes_por(columna, valores):
    """{valor normalizado -> {id de cliente}} de los clientes con ese mail o instagram."""
    mapa = {}
    for lote in _lotes(valores):
        for cid, valor in db.session.query(Client.id, columna).filter(columna.in_(lote)):
            mapa.setdefault(valor, set()).add(cid)
    return mapa


class _Llamadas:
    """Las llamadas con show up de unas personas, para buscar de cuál salió cada pago."""

    def __init__(self, start, end, filas):
        personas = {f['person_uuid'] for f in filas if f.get('person_uuid')}
        clientes = {f['client_id'] for f in filas if f.get('client_id')}
        # Mail e instagram copiados valen solo en los pagos sin persona (plan_personas).
        sin_persona = [f for f in filas if not f.get('person_uuid')]
        mails = {m for m in (_limpiar_email(f['email']) for f in sin_persona) if m and 'no-email-' not in m}
        igs = {i for i in (_limpiar_ig(f['ig']) for f in sin_persona) if i}
        self.por_mail = _clientes_por(func.lower(Client.email), mails)
        self.por_ig = _clientes_por(func.lower(func.replace(Client.instagram, '@', '')), igs)
        for ids in (*self.por_mail.values(), *self.por_ig.values()):
            clientes |= ids

        desde = datetime.combine(start - timedelta(days=VENTANA_LLAMADA_DIAS), time.min)
        hasta = datetime.combine(end + timedelta(days=TOLERANCIA_DIAS), time.max)
        ahora = datetime.utcnow()
        citas = {}
        for columna, valores in ((Appointment.person_uuid, personas), (Appointment.client_id, clientes)):
            for lote in _lotes(valores):
                for a in (Appointment.query.options(joinedload(Appointment.client), joinedload(Appointment.closer))
                          .filter(Appointment.start_time >= desde, Appointment.start_time <= hasta,
                                  columna.in_(lote)).all()):
                    if derivar_estado(a, ahora) in CON_SHOW_UP:
                        citas[a.id] = a
        self.por_persona, self.por_cliente = {}, {}
        for a in citas.values():
            if a.person_uuid:
                self.por_persona.setdefault(a.person_uuid, []).append(a)
            if a.client_id:
                self.por_cliente.setdefault(a.client_id, []).append(a)

    def candidatas(self, fila):
        clientes = {fila['client_id']} if fila.get('client_id') else set()
        citas = {}
        if fila.get('person_uuid'):
            citas.update({a.id: a for a in self.por_persona.get(fila['person_uuid'], ())})
        else:
            clientes |= self.por_mail.get(_limpiar_email(fila['email']), set())
            clientes |= self.por_ig.get(_limpiar_ig(fila['ig']), set())
        for cid in clientes:
            citas.update({a.id: a for a in self.por_cliente.get(cid, ())})
        return list(citas.values())

    def origen(self, fila, dia, start):
        """(PERIODO | ANTERIOR | SIN_LLAMADA, la llamada o None) del pago de `fila` hecho el `dia`."""
        tope = dia + timedelta(days=TOLERANCIA_DIAS)
        piso = dia - timedelta(days=VENTANA_LLAMADA_DIAS)
        previas = [a for a in self.candidatas(fila) if piso <= a.start_time.date() <= tope]
        if not previas:
            return SIN_LLAMADA, None
        ultima = max(previas, key=lambda a: a.start_time)
        return (PERIODO if ultima.start_time.date() >= start else ANTERIOR), ultima


def _cierres_por_cuota(start, end, closer_nombre, ventas_nuevas):
    """[(fila de la seña, cuota que la completó)]: señas pagadas por completo con una «Cuota» cobrada
    en el período. Las señas son de hasta un mes antes (la ventana de la cuota). Se saltea la que ya
    cuenta por otro pago de venta del mismo lead en el período, para no sumarla dos veces."""
    from app.services.comercial_service import ComercialService

    cobros = ComercialService.ventas_del_periodo(start - relativedelta(months=1), end)
    senas = [v for v in cobros if ComercialService.clasificar_venta(v)[1] == 'seña']
    if not senas:
        return []
    clientes = clientes_de_ventas(senas)
    contactos = FinancialSale.contactos(senas)
    filas = []
    for v in senas:
        nombre = resolver_nombre_closer(v.email_vendedor)
        if ComercialService.vendio(nombre, closer_nombre):
            filas.append(ComercialService._fila_venta(v, nombre, clientes.get(v.id), contactos.get(v.id)))
    pagos = pagos_posteriores(sorted({c for f in filas for c in claves_de_fila(f)}))
    ya_cuentan = {c for f in ventas_nuevas for c in claves_de_fila(f)}

    salida, usadas = [], set()
    for f in filas:
        venta, tipo = conversion_de(f, pagos)
        if (venta is None or tipo != COMPLETO or venta.id in usadas
                or ComercialService.clasificar_venta(venta)[1] != 'cuota'
                or not (start <= venta.date.date() <= end)
                or ya_cuentan.intersection(claves_de_fila(f))):
            continue
        usadas.add(venta.id)
        salida.append((f, venta))
    return salida


def _fila_de_cierre(fila, llamada, origen, via, tipo):
    return {
        'id': fila['id'], 'cliente': fila['cliente'], 'fecha': fila['fecha'], 'monto': fila['monto'],
        'tipo': tipo, 'via': via, 'origen': origen,
        'llamada': ({'fecha': llamada.start_time.isoformat(),
                     'closer': llamada.closer.username if llamada.closer else ''} if llamada else None),
    }


def cierres_reales(start, end, ventas, asistieron, closer_nombre=None):
    """El bloque `reales` del cierre. `ventas` son las filas de `ComercialService.ventas` del
    período (con el mismo alcance que `closer_nombre`) y `asistieron` las llamadas con show up."""
    nuevas = [f for f in ventas if f['es_venta']]
    # (fila, día que se mira para buscar la llamada, cómo se cerró, tipo para mostrar)
    cierres = [(f, _dia(f['fecha']), 'venta', f['tipo_pago_raw']) for f in nuevas]
    for sena, cuota in _cierres_por_cuota(start, end, closer_nombre, nuevas):
        propia = {**sena, 'id': cuota.id, 'fecha': cuota.date.isoformat(), 'monto': round(float(cuota.monto or 0), 2)}
        cierres.append((propia, _dia(sena['fecha']), 'cuota', 'Seña + cuota'))

    llamadas = _Llamadas(start, end, [c[0] for c in cierres]) if cierres else None
    conteo = {PERIODO: 0, ANTERIOR: 0, SIN_LLAMADA: 0}
    filas = []
    for fila, dia, via, tipo in cierres:
        origen, llamada = llamadas.origen(fila, dia, start)
        conteo[origen] += 1
        filas.append(_fila_de_cierre(fila, llamada, origen, via, tipo))
    filas.sort(key=lambda f: (f['origen'] != ANTERIOR, f['origen'] != PERIODO, f['fecha'] or ''))

    del_periodo, anteriores = conteo[PERIODO], conteo[ANTERIOR]
    cerrados = del_periodo + anteriores
    # Un cierre "del período" que no era de una llamada propia (la tomó otro closer) podría dejar
    # más cierres que llamadas: la base nunca baja del numerador.
    base = max(asistieron, del_periodo) + anteriores
    return {
        'cierres': cerrados,
        'del_periodo': del_periodo,
        'anteriores': anteriores,
        'sin_llamada': conteo[SIN_LLAMADA],
        'por_cuota': sum(1 for f in filas if f['via'] == 'cuota'),
        'asistieron': asistieron,
        'base': base,
        'pct': pct(cerrados, base),
        'filas': filas,
    }


def _a_fecha(valor):
    return datetime.strptime(valor, '%Y-%m-%d').date() if isinstance(valor, str) else valor


def cierres_reales_de_closer(closer_id, start_date, end_date, asistieron):
    """El bloque `reales` para el tablero del closer (`CloserService.get_comprehensive_stats`).

    Ese tablero cuenta las llamadas de los reportes diarios y no de las agendas, así que
    `asistieron` llega de él; los cobros salen del mismo lugar que en el dashboard comercial. None
    sin período: sin fechas no hay un "este período" contra el cual decir cuál llamada es anterior.
    """
    if not (start_date and end_date):
        return None
    from app.models import User
    from app.services.comercial_service import ComercialService

    inicio, fin = _a_fecha(start_date), _a_fecha(end_date)
    nombre = None
    if closer_id:
        closer = db.session.get(User, closer_id)
        nombre = closer.username if closer else ''
    ventas = ComercialService.ventas(inicio, fin, closer_nombre=nombre)
    return cierres_reales(inicio, fin, ventas, asistieron, closer_nombre=nombre)
