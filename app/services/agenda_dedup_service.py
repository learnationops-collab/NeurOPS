"""Agendas repetidas del mismo lead: detectarlas, descartar la que sobra, deshacerlo.

Por qué existe. Un mismo lead entra varias veces al libro de agendas y el webhook no
siempre lo reconoce. Medido contra producción el 26/09/2026: de agosto a septiembre,
21 de 217 agendas de workshop (~10%) eran alguien ya agendado. Tres motivos:

  · Reprogramó a otro día. La deduplicación del webhook pedía "mismo lead, mismo día de
    la reunión", así que mover la cita del jueves al viernes entraba como fila nueva.
  · El teléfono llegaba escrito distinto ('+51 996 526 031' vs '+51996526031') y el mail
    llegaba 'N/A', así que no quedaba con qué reconocerlo.
  · Dos requests de n8n en paralelo, con segundos de diferencia, no se ven entre sí.

Los dos primeros ya se taparon en el webhook (ver app/api/public/financial_agendas.py).
El tercero sigue abierto, y ninguno de los tres arregla lo que YA entró: para eso está
este servicio.

Qué hace y qué NO hace. La fila repetida se MARCA (`duplicada_de_id`), nunca se borra:
borrar es irreversible y pierde el registro de lo que Calendly mandó de verdad. Marcarla
la saca del libro, del embudo del taller y de la bandeja del closer, y se puede revertir
entera. Lo que este servicio NO puede hacer es cancelar la reunión en Calendly: el lead
sigue teniendo su invitación, eso se resuelve del lado de Calendly.

Las señales de identidad y sus resguardos se toman de `client_dedup_service`, que ya los
aprendió contra datos reales — en particular `_names_compatible`, que evita encadenar a
dos personas distintas a través de un registro con el mail de otra.
"""
import logging
from datetime import datetime, timedelta

from app import db
from app.models import Appointment, Client, FinancialAgenda
from app.services.attribution_service import UnionFind
from app.services.client_dedup_service import (
    _names_compatible, _normalize_email, _normalize_instagram, _normalize_phone)

logger = logging.getLogger(__name__)

# Si una misma señal (mail/instagram/teléfono) aparece en agendas de más de esta cantidad
# de nombres distintos e incompatibles entre sí, deja de ser "el mismo lead dos veces" y
# pasa a ser un dato compartido o de relleno. Se cuenta por NOMBRES y no por agendas a
# propósito: que una persona tenga cinco agendas con el mismo mail es lo normal acá.
MAX_NOMBRES_POR_SENAL = 2

# Estados en los que la llamada todavía no ocurrió. Una agenda ya resuelta representa una
# llamada que pasó de verdad, y eso cambia la lectura del grupo: no es una reprogramación,
# es alguien que volvió a agendar.
ESTADOS_SIN_RESOLVER = {
    '', 'pendiente', 'confirmado', 'confirmada', 'por_confirmar', 'por confirmar',
    'agendado', 'agendada', 'contactado', 'contactada', 'sin respuesta',
    'reagendada', 'reagendado', 'reprogramada', 'reprogramado',
}

# Dos reuniones separadas por menos que esto son la MISMA reunión cargada dos veces, no
# dos llamadas: nadie agenda dos calls con el mismo lead con una hora de diferencia.
HORAS_MISMA_REUNION = 2

# Cuánto después de la hora de la reunión se sigue considerando que "todavía no pasó".
# Cubre al lead que reagenda apenas el closer no aparece o apenas cuelga sin avanzar.
HORAS_GRACIA_REUNION = 1

# Qué tan cerca tienen que estar dos reuniones para ser "la misma hora" y no una
# reprogramación. Con tolerancia amplia se confundirían las dos cosas; en los datos reales
# los duplicados exactos caen al mismo minuto, así que alcanza con un margen chico para
# absorber el redondeo de Calendly.
MINUTOS_MISMA_HORA = 5


def _senales(agenda):
    """Las tres señales normalizadas con las que se reconoce a la misma persona."""
    senales = []
    mail = _normalize_email(agenda.mail)
    ig = _normalize_instagram(agenda.instagram)
    tel = _normalize_phone(agenda.whatsapp)
    if mail:
        senales.append(('mail', mail))
    if ig:
        senales.append(('ig', ig))
    if tel:
        senales.append(('tel', tel))
    return senales


def encontrar_grupos(agendas):
    """Agrupa las agendas que son de la misma persona. Devuelve solo los grupos de 2 o más.

    No se une por una señal sin mirar el nombre: el mismo teléfono aparece compartido entre
    familiares y el mismo mail tipeado por otra persona (13 casos reales encontrados en
    producción el 31/08/2026, ver `client_dedup_service._names_compatible`). Sin ese
    resguardo, dos leads distintos se encadenan por transitividad.
    """
    vigentes = [a for a in agendas if a.duplicada_de_id is None]
    por_id = {a.id: a for a in vigentes}

    por_senal = {}
    for a in vigentes:
        for senal in _senales(a):
            por_senal.setdefault(senal, []).append(a.id)

    uf = UnionFind()
    for a in vigentes:
        uf.find(a.id)

    for senal, ids in por_senal.items():
        if len(ids) < 2:
            continue
        nombres = {(por_id[i].lead or '').strip().lower() for i in ids}
        if len(nombres) > MAX_NOMBRES_POR_SENAL:
            logger.info("[DEDUP AGENDAS] senal %s descartada: la comparten %d nombres distintos",
                        senal, len(nombres))
            continue
        base = ids[0]
        for otro in ids[1:]:
            if _names_compatible(por_id[base].lead, por_id[otro].lead):
                uf.union(base, otro)

    grupos = {}
    for a in vigentes:
        grupos.setdefault(uf.find(a.id), []).append(a)

    return [sorted(g, key=lambda x: (x.created_at is not None, x.created_at))
            for g in grupos.values() if len(g) > 1]


def _sin_resolver(agenda):
    return (agenda.estado or '').strip().lower() in ESTADOS_SIN_RESOLVER


def _asistio(agenda):
    return (agenda.estado or '').strip().lower() in ('show up', 'show_up', 'asistió', 'asistio')


def motivo_probable(grupo):
    """Por qué está repetido este grupo, con la taxonomía medida en producción.

    Es una lectura, no un veredicto: sirve para que quien decide sepa qué está mirando.

    Se mira CUÁNDO se creó cada fila contra cuándo era la reunión anterior, y no el estado
    actual de esa reunión. El estado de hoy no dice nada sobre el pasado: casi toda cita
    vieja terminó resuelta, así que usarlo mandaba a 'volvió a agendar' duplicados obvios
    como el de Laura Jimenez — dos filas para la misma reunión, creadas con dos minutos de
    diferencia, una de ellas hoy marcada 'No Show'.

    La única excepción es un Show Up: si la llamada anterior ocurrió de verdad, lo que vino
    después es una segunda cita, sin importar los tiempos.
    """
    ordenadas = sorted(grupo, key=lambda a: (a.created_at is not None, a.created_at))

    # 1. Dos filas para la misma reunión. Es la señal más fuerte que hay.
    citas = sorted(a.date for a in ordenadas if a.date)
    for previa, siguiente in zip(citas, citas[1:]):
        if siguiente - previa < timedelta(hours=HORAS_MISMA_REUNION):
            return 'duplicado_del_webhook'

    # 2. Reservó de nuevo cuando la llamada anterior todavía no había pasado.
    for previa, siguiente in zip(ordenadas, ordenadas[1:]):
        if _asistio(previa) or not previa.date or not siguiente.created_at:
            continue
        if siguiente.created_at < previa.date + timedelta(hours=HORAS_GRACIA_REUNION):
            return 'reprogramacion'

    return 'volvio_a_agendar'


def identidades_con_venta():
    """Todas las identidades (mail e instagram normalizados) que tienen alguna venta.

    Una sola consulta para lo que si no es una por candidato. La usa el backfill, que
    evalúa cientos de pares: contra el proxy público esas consultas sueltas lo volvían
    inviable (tardaba minutos por marca).
    """
    from app.models import FinancialSale

    conocidas = set()
    for mail, ig in db.session.query(FinancialSale.mail_cliente, FinancialSale.instagram).all():
        for valor in (_normalize_email(mail), _normalize_instagram(ig)):
            if valor:
                conocidas.add(valor)
    return conocidas


def sugerir_conservada(grupo, ventas_conocidas=None):
    """Cuál de las filas del grupo conviene conservar.

    Manda lo que ya ocurrió: una agenda con venta cargada, después una con resultado real
    del closer, y recién si ninguna tiene historia, la de la reunión más reciente — que en
    una reprogramación es la que vale.

    `ventas_conocidas` es el conjunto que devuelve `identidades_con_venta()`: cuando se
    pasa, saber si hay venta no cuesta una consulta por candidato.
    """
    from app.models import FinancialSale

    def tiene_venta(a):
        ig = _normalize_instagram(a.instagram)
        mail = _normalize_email(a.mail)
        if not ig and not mail:
            return False
        if ventas_conocidas is not None:
            return bool((mail and mail in ventas_conocidas) or (ig and ig in ventas_conocidas))
        consulta = FinancialSale.query
        if mail:
            return consulta.filter(db.func.lower(FinancialSale.mail_cliente) == mail).count() > 0
        return consulta.filter(
            db.func.lower(db.func.replace(FinancialSale.instagram, '@', '')) == ig).count() > 0

    # Los dos últimos criterios son el desempate y tienen que ser deterministas: con tres
    # filas idénticas (mismo día, misma hora, mismo estado) `max` devolvía la primera de la
    # lista, así que comparar A con B y después A con C daba ganadoras distintas. Cuando
    # todo lo demás empata gana la MÁS VIEJA, que es la original; las otras son la copia.
    return max(grupo, key=lambda a: (
        tiene_venta(a),
        not _sin_resolver(a),
        a.date is not None,
        a.date or datetime.min,
        -(a.created_at.timestamp() if a.created_at else 0),
        -a.id if a.id else 0,
    ))


def _nombre_utilizable(nombre):
    """True si el nombre identifica a alguien, o sea si sirve para corroborar una fusión."""
    from app.services.client_dedup_service import _GENERIC_NAMES, _normalize_name
    limpio = _normalize_name(nombre)
    return bool(limpio) and limpio not in _GENERIC_NAMES and len(limpio) > 2


def _comparte_senal(a, b):
    """True si dos agendas comparten mail, instagram o teléfono normalizados."""
    for norm, campo in ((_normalize_email, 'mail'), (_normalize_instagram, 'instagram'),
                        (_normalize_phone, 'whatsapp')):
        va, vb = norm(getattr(a, campo)), norm(getattr(b, campo))
        if va and va == vb:
            return True
    return False


def _hermanas_del_mismo_dia(agenda, universo=None):
    """Las otras agendas vigentes del mismo lead cuya reunión cae el mismo día LOCAL.

    El día es el local de la fuente y no el día UTC: una cita de las 21:00 cae en el día
    UTC siguiente, y comparando en UTC dos filas de la misma tarde parecerían de días
    distintos (mismo criterio que usa el deduplicador del webhook).
    """
    from app.services.agenda_time_service import limites_dia_origen

    inicio, fin = limites_dia_origen(agenda.date)

    # La base solo acota por día; quién es la misma persona lo decide SIEMPRE Python, con
    # los mismos normalizadores. Antes la condición de identidad iba en el SQL y ahí había
    # que reescribir a mano lo que hacen esos normalizadores: el `replace` de la columna no
    # recorta espacios ni cubre todos los separadores, así que un instagram guardado con un
    # espacio al final o un teléfono con un guion raro no matcheaba. Comparado contra los
    # datos reales, el SQL perdía 2 de 102 pares que Python sí reconoce.
    #
    # `universo` evita incluso esa consulta: el backfill trae todo una vez y compara en
    # memoria. Preguntando por cada agenda eran miles de viajes y contra el proxy público
    # de Railway la conexión se caía a mitad del recorrido.
    if universo is None:
        universo = FinancialAgenda.query.filter(
            FinancialAgenda.duplicada_de_id.is_(None),
            FinancialAgenda.date >= inicio,
            FinancialAgenda.date <= fin,
        ).all()

    candidatas = [c for c in universo
                  if c.id != agenda.id and c.duplicada_de_id is None
                  and c.date and inicio <= c.date <= fin
                  and _comparte_senal(agenda, c)]
    # El nombre decide al final: el mismo teléfono aparece compartido entre familiares y el
    # mismo mail tipeado por otra persona. Sin este resguardo se fusionan dos leads reales.
    #
    # Y acá se exige un nombre DE VERDAD en las dos, no el `_names_compatible` a secas:
    # esa función devuelve True cuando alguno de los dos está vacío o es genérico, así que
    # sobre una fila sin nombre el resguardo se apaga solo y quedarían unidas por el puro
    # teléfono. Para una fusión AUTOMÁTICA eso es demasiado: en producción hay 1069 agendas
    # sin `lead` (todas anteriores a julio, ninguna en el período que esto toca hoy). Sin
    # nombre no se decide solo — el par igual aparece en el panel para que lo mire alguien.
    hermanas = [c for c in candidatas
                if _nombre_utilizable(agenda.lead) and _nombre_utilizable(c.lead)
                and _names_compatible(agenda.lead, c.lead)]
    # Orden explícito: `decidir_reconciliacion` corta el recorrido en cuanto la que sobra
    # es la propia agenda, así que el orden decide qué par se evalúa. Sin esto la consulta
    # devolvía las filas en el orden que quisiera Postgres y el resultado no era
    # reproducible — dos corridas sobre los mismos datos podían resolver pares distintos.
    hermanas.sort(key=lambda c: (c.created_at is not None, c.created_at, c.id))
    return hermanas


def reconciliar(agenda, actor_id=None, simular=False, universo=None, ventas_conocidas=None):
    """Hace cumplir la regla: un lead no puede tener dos agendas el mismo día a la misma hora.

    La definió Kerwin el 28/09/2026 mirando el libro:

      · mismo día y MISMA hora  -> no existe tal cosa, es la misma reunión cargada dos
        veces. Se conserva la fila con más historia y la otra se marca.
      · mismo día y otra hora   -> es una REPROGRAMACIÓN, no una segunda llamada: queda una
        sola agenda, la que trae la hora vigente (la de alta más reciente).
      · días distintos          -> puede ser una segunda llamada de verdad (reagendó, o no
        se llegó a hacer la presentación). No se toca.

    Corre después de crear una agenda, en las vías que la crean. Devuelve las filas que
    marcó, vacía si no había nada que reconciliar. Con `simular=True` no escribe: devuelve
    las decisiones (conservada, sobrante, motivo) que tomaría.
    """
    decisiones = decidir_reconciliacion(agenda, universo=universo,
                                        ventas_conocidas=ventas_conocidas)
    if simular:
        return decisiones

    marcadas = []
    for conservada, sobrante, motivo in decisiones:
        try:
            descartar(conservada, sobrante, actor_id, motivo=motivo)
            marcadas.append(sobrante)
            logger.info('[AGENDA UNICA] %s -> se conserva #%s y se marca #%s (%s)',
                        agenda.lead, conservada.id, sobrante.id, motivo)
        except ValueError as e:
            logger.info('[AGENDA UNICA] no se pudo reconciliar #%s con #%s: %s',
                        agenda.id, sobrante.id, e)
    return marcadas


def decidir_reconciliacion(agenda, universo=None, ventas_conocidas=None):
    """Qué haría `reconciliar` con esta agenda, sin tocar nada.

    Devuelve una lista de (conservada, sobrante, motivo). Existe aparte para que el
    dry-run del script de backfill muestre exactamente la misma decisión que se va a
    aplicar: si la simulación tuviera su propia copia de las reglas, mentiría en cuanto
    una de las dos cambiara.
    """
    if not agenda or not agenda.date or agenda.duplicada_de_id is not None:
        return []

    decisiones = []
    for hermana in _hermanas_del_mismo_dia(agenda, universo=universo):
        if hermana.duplicada_de_id is not None:
            continue
        distancia = abs((hermana.date - agenda.date).total_seconds())

        if distancia <= MINUTOS_MISMA_HORA * 60:
            conservada = sugerir_conservada([agenda, hermana], ventas_conocidas)
            motivo = 'automático: misma persona, mismo día y misma hora'
        elif _sin_resolver(hermana) and _sin_resolver(agenda):
            # Reprogramación: manda la hora que se cargó último. Si alguna de las dos ya
            # se resolvió no aplica: una llamada que de verdad ocurrió no es la hora vieja
            # de la otra, ahí son dos agendas distintas y no se toca ninguna.
            conservada = max([agenda, hermana],
                             key=lambda a: (a.created_at is not None, a.created_at))
            motivo = 'automático: reprogramación del mismo día'
        else:
            continue

        sobrante = hermana if conservada is agenda else agenda
        decisiones.append((conservada, sobrante, motivo))
        if sobrante is agenda:
            # La recién llegada fue la que sobró: no tiene sentido seguir comparándola.
            break

    return decisiones


def cita_de(agenda):
    """El Appointment de esta agenda, o None. No crea nada.

    Usa el mismo criterio que `BookingService.sync_financial_agenda_to_appointment`: el
    cliente por identidad y la cita dentro de las +/-12h de la reunión.
    """
    if not agenda.date:
        return None
    ig = _normalize_instagram(agenda.instagram)
    mail = _normalize_email(agenda.mail)
    tel = _normalize_phone(agenda.whatsapp)
    condiciones = []
    if mail:
        condiciones.append(db.func.lower(Client.email) == mail)
    if ig:
        condiciones.append(db.func.lower(db.func.replace(Client.instagram, '@', '')) == ig)
    if tel:
        # El teléfono como tercera señal: una agenda que llegó con mail 'N/A' e instagram
        # 'N/A' no tiene con qué encontrar su cita, y sin cita el descarte no puede saber
        # que la que iba a cancelar es la misma de la fila que se conserva.
        columna = Client.phone
        for sep in (' ', '-', '(', ')', '+', '.'):
            columna = db.func.replace(columna, sep, '')
        condiciones.append(columna.like('%' + tel))
    if not condiciones:
        return None

    client = Client.query.filter(db.or_(*condiciones)).first()
    if not client:
        return None
    return Appointment.query.filter(
        Appointment.client_id == client.id,
        Appointment.start_time >= agenda.date - timedelta(hours=12),
        Appointment.start_time <= agenda.date + timedelta(hours=12)
    ).first()


def citas_de(agendas):
    """{agenda_id: Appointment} para una lista entera, en dos consultas.

    `cita_de` hace dos consultas por agenda, y el panel pinta cientos de filas de una
    vez: resolverlas una por una convertía la pantalla en cientos de viajes a la base.
    """
    if not agendas:
        return {}

    condiciones, por_agenda = [], {}
    for a in agendas:
        mail = _normalize_email(a.mail)
        ig = _normalize_instagram(a.instagram)
        por_agenda[a.id] = (mail, ig)
        if mail:
            condiciones.append(db.func.lower(Client.email) == mail)
        if ig:
            condiciones.append(db.func.lower(db.func.replace(Client.instagram, '@', '')) == ig)
    if not condiciones:
        return {}

    clientes = Client.query.filter(db.or_(*condiciones)).all()
    por_mail = {(c.email or '').strip().lower(): c.id for c in clientes if c.email}
    por_ig = {(c.instagram or '').strip().replace('@', '').lower(): c.id for c in clientes if c.instagram}

    fechas = [a.date for a in agendas if a.date]
    if not fechas or not clientes:
        return {}
    citas = Appointment.query.filter(
        Appointment.client_id.in_([c.id for c in clientes]),
        Appointment.start_time >= min(fechas) - timedelta(hours=12),
        Appointment.start_time <= max(fechas) + timedelta(hours=12)
    ).all()
    por_cliente = {}
    for cita in citas:
        por_cliente.setdefault(cita.client_id, []).append(cita)

    salida = {}
    for a in agendas:
        if not a.date:
            continue
        mail, ig = por_agenda[a.id]
        client_id = (por_mail.get(mail) if mail else None) or (por_ig.get(ig) if ig else None)
        for cita in por_cliente.get(client_id, []):
            if abs((cita.start_time - a.date).total_seconds()) <= 12 * 3600:
                salida[a.id] = cita
                break
    return salida


def descartar(conservada, duplicada, usuario_id, motivo=None, cancelar_cita=True):
    """Marca `duplicada` como repetida de `conservada`. Reversible con `restaurar`.

    Si la repetida tiene su propia cita (distinta de la que se conserva), se la cancela
    para que el closer no siga viendo dos llamadas con la misma persona. El estado previo
    de esa cita se guarda en `raw_data['_dedup']`, que es lo que lee `restaurar`: por eso
    no hace falta una tabla de bitácora aparte.
    """
    from datetime import datetime

    if conservada.id == duplicada.id:
        raise ValueError('No se puede descartar la misma fila que se conserva')
    if duplicada.duplicada_de_id is not None:
        raise ValueError(f'La agenda #{duplicada.id} ya está descartada')

    snapshot = {'conservada_id': conservada.id}

    if cancelar_cita:
        cita = cita_de(duplicada)
        cita_conservada = cita_de(conservada)
        ya_cancelada = bool(cita and (cita.result or '').strip().lower().startswith('cancel'))
        # Guarda dura: si la cita cae a la misma hora que la reunión de la fila que se
        # CONSERVA, es su cita, y cancelarla apagaría la llamada que queríamos dejar viva.
        # No alcanza con comparar contra `cita_de(conservada)`: cuando la conservada tiene
        # la identidad rota (mail 'N/A', instagram 'N/A') esa búsqueda devuelve None y el
        # resguardo de abajo no se entera de que las dos filas son la misma reunión.
        es_la_cita_de_la_conservada = bool(
            cita and conservada.date
            and abs((cita.start_time - conservada.date).total_seconds()) <= MINUTOS_MISMA_HORA * 60)
        if es_la_cita_de_la_conservada:
            cita = None
        # Solo se guarda el estado previo de la cita que este descarte cancela DE VERDAD.
        # Dos agendas repetidas pueden apuntar a la misma cita: si la segunda volviera a
        # anotar el snapshot, guardaría 'Cancelado' —lo que dejó la primera— y al deshacer
        # en ese orden la cita se quedaría cancelada para siempre.
        if cita and not ya_cancelada and (not cita_conservada or cita.id != cita_conservada.id):
            snapshot['appointment_id'] = cita.id
            snapshot['result_previo'] = cita.result
            snapshot['closer_result_previo'] = cita.closer_result
            cita.result = 'Cancelado'
            logger.info('[DEDUP AGENDAS] cita #%s cancelada por descartar la agenda #%s',
                        cita.id, duplicada.id)

    duplicada.duplicada_de_id = conservada.id
    duplicada.descartada_at = datetime.utcnow()
    duplicada.descartada_por_id = usuario_id
    duplicada.descartada_motivo = (motivo or '').strip()[:255] or None
    # `raw_data` es JSON: reasignar el dict entero para que SQLAlchemy vea el cambio.
    duplicada.raw_data = {**(duplicada.raw_data or {}), '_dedup': snapshot}
    return duplicada


def restaurar(agenda):
    """Deshace un descarte: la fila vuelve al libro y su cita al estado que tenía."""
    if agenda.duplicada_de_id is None:
        raise ValueError(f'La agenda #{agenda.id} no está descartada')

    snapshot = (agenda.raw_data or {}).get('_dedup') or {}
    appointment_id = snapshot.get('appointment_id')
    if appointment_id:
        cita = Appointment.query.get(appointment_id)
        if cita:
            cita.result = snapshot.get('result_previo')
            cita.closer_result = snapshot.get('closer_result_previo')

    agenda.duplicada_de_id = None
    agenda.descartada_at = None
    agenda.descartada_por_id = None
    agenda.descartada_motivo = None
    resto = {k: v for k, v in (agenda.raw_data or {}).items() if k != '_dedup'}
    agenda.raw_data = resto
    return agenda


def grupos_de(query, limite=60):
    """(grupos, hay_mas) dentro de un query de agendas ya filtrado.

    Recibe el query y no una lista para que el endpoint pueda reusar exactamente el mismo
    recorte que el usuario está viendo en el libro de agendas.
    """
    grupos = encontrar_grupos(query.filter(FinancialAgenda.duplicada_de_id.is_(None)).all())
    # Primero lo que más pide una decisión: lo que parece reprogramación o error del
    # webhook, y dentro de eso lo más reciente.
    orden = {'duplicado_del_webhook': 0, 'reprogramacion': 1, 'volvio_a_agendar': 2}
    grupos.sort(key=lambda g: (
        orden.get(motivo_probable(g), 3),
        -(max((a.created_at.timestamp() for a in g if a.created_at), default=0)),
    ))
    return grupos[:limite], len(grupos) > limite
