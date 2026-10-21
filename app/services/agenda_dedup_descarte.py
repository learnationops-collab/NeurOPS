"""Descartar una agenda repetida, deshacerlo y encontrar su cita. Es parte de `agenda_dedup_service`."""
import logging
from datetime import timedelta

from app import db
from app.models import Appointment, Client, FinancialAgenda
from app.services.agenda_dedup_reglas import MINUTOS_MISMA_HORA, _sin_resolver
from app.services.client_dedup_service import _normalize_email, _normalize_instagram, _normalize_phone

logger = logging.getLogger(__name__)


# Campos que la fila que se conserva HEREDA de la repetida cuando ella no los tiene.
# Sin esto, conservar la original significaría perder el resultado que el closer cargó
# sobre la copia. `encargado_triage` se queda aunque el tablero ya no muestre el Call
# Confirmer (10/10/2026): lo sigue escribiendo la pantalla del rol triage y lo cuenta su
# reporte diario, asi que la fila que sobrevive no debe perderlo.
_VACIOS ={'', 'n/a', 'na', 'none', 'no tengo', 'notengo', 'ninguno', 'sin asignar', 'desconocido'}
CAMPOS_HEREDABLES = ('mail', 'instagram', 'whatsapp', 'closer', 'encargado_triage', 'zona_geografica')
# El contacto (Etapa 2c) es de la persona: la copia se hereda solo entre agendas sin persona.
CONTACTO = ('mail', 'instagram', 'whatsapp')


def _esta_vacio(valor):
    return (valor or '').strip().lower() in _VACIOS


def cita_de(agenda):
    """El Appointment de esta agenda, o None. No crea nada.

    Usa el mismo criterio que `BookingService.sync_financial_agenda_to_appointment`: el
    cliente por identidad y la cita dentro de las +/-12h de la reunión.
    """
    if not agenda.date:
        return None
    c = agenda.contacto()
    ig = _normalize_instagram(c['instagram'])
    mail = _normalize_email(c['mail'])
    tel = _normalize_phone(c['whatsapp'])
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
    from app.services.booking_service import BookingService
    client = BookingService.cliente_de_agenda(agenda)
    if client is None and not condiciones:
        return None

    client = client or Client.query.filter(db.or_(*condiciones)).first()
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
    from app.services.agenda_contacto_service import precargar
    precargar(agendas)

    condiciones, por_agenda = [], {}
    for a in agendas:
        mail = _normalize_email(a.contacto()['mail'])
        ig = _normalize_instagram(a.contacto()['instagram'])
        por_agenda[a.id] = (mail, ig)
        if mail:
            condiciones.append(db.func.lower(Client.email) == mail)
        if ig:
            condiciones.append(db.func.lower(db.func.replace(Client.instagram, '@', '')) == ig)
    from app.services.booking_service import BookingService
    por_persona = BookingService.clientes_por_persona(agendas)
    if not condiciones and not por_persona:
        return {}

    clientes = Client.query.filter(db.or_(Client.id.in_(list(por_persona.values())), *condiciones)).all()
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
        client_id = (por_persona.get(a.person_uuid) or (por_mail.get(mail) if mail else None)
                     or (por_ig.get(ig) if ig else None))
        for cita in por_cliente.get(client_id, []):
            if abs((cita.start_time - a.date).total_seconds()) <= 12 * 3600:
                salida[a.id] = cita
                break
    return salida


def _heredar_persona(conservada, duplicada, snapshot):
    """La persona de las dos agendas (Etapa 2c). Si solo la repetida la tiene, la conservada se queda
    con ella (se deshace con `restaurar`). Si tienen dos personas distintas, esas personas son la misma
    y hay que fusionarlas: no se hace acá, porque fusionar no se deshace y descartar sí. Queda anotado
    en el descarte (`personas_a_fusionar`) y en el log, para `fusionar_lista`."""
    if duplicada.person_uuid and not conservada.person_uuid:
        conservada.person_uuid = duplicada.person_uuid
        snapshot['persona_heredada'] = duplicada.person_uuid
    elif duplicada.person_uuid and duplicada.person_uuid != conservada.person_uuid:
        snapshot['personas_a_fusionar'] = [conservada.person_uuid, duplicada.person_uuid]
        logger.warning('[DEDUP AGENDAS] #%s y #%s son el mismo lead con dos personas (%s, %s): fusionarlas',
                       conservada.id, duplicada.id, conservada.person_uuid, duplicada.person_uuid)


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

    # La que sobrevive se queda con lo mejor de las dos. Si no, descartar la copia tira el
    # dato que solo ella tenía: el resultado que el closer cargó ahí, el mail que en la
    # original llegó 'N/A', el closer asignado. Se anota el valor previo para que
    # `restaurar` deje todo como estaba.
    heredado = {}
    _heredar_persona(conservada, duplicada, snapshot)
    con_persona = bool(conservada.person_uuid or duplicada.person_uuid)
    for campo in CAMPOS_HEREDABLES:
        if con_persona and campo in CONTACTO:
            continue
        nuevo = getattr(duplicada, campo, None)
        if _esta_vacio(getattr(conservada, campo, None)) and not _esta_vacio(nuevo):
            heredado[campo] = getattr(conservada, campo, None)
            setattr(conservada, campo, nuevo)
    # El estado solo se hereda si el de la copia es un resultado REAL de la llamada y el de
    # la conservada todavía no lo es: un 'Pendiente' nunca debe pisar un 'Show Up'.
    if _sin_resolver(conservada) and not _sin_resolver(duplicada):
        heredado['estado'] = conservada.estado
        conservada.estado = duplicada.estado
    if heredado:
        snapshot['heredado'] = heredado
        logger.info('[AGENDA UNICA] #%s hereda de #%s: %s',
                    conservada.id, duplicada.id, ', '.join(heredado))

    duplicada.duplicada_de_id = conservada.id
    duplicada.descartada_at = datetime.utcnow()
    duplicada.descartada_por_id = usuario_id
    duplicada.descartada_motivo = (motivo or '').strip()[:255] or None
    # `raw_data` es JSON: reasignar el dict entero para que SQLAlchemy vea el cambio.
    duplicada.raw_data = {**(duplicada.raw_data or {}), '_dedup': snapshot}
    return duplicada


def restaurar(agenda):
    """Deshace un descarte: la fila vuelve al libro y su cita al estado que tenía.

    De la cita se deshace solo lo que el descarte cambió, y solo si sigue como lo dejó: el
    `result` vuelve al de antes mientras diga 'Cancelado'. Antes se reescribían `result` y
    `closer_result` a ciegas, así que deshacer después de que el closer reportó la llamada
    le borraba el reporte (el descarte nunca toca `closer_result`: devolverlo solo podía
    pisar algo nuevo), y a una cita a la que alguien le había cambiado el pre call después
    del descarte se le volvía a poner el de antes. Desde el 10/10/2026 esto se usa desde
    Revisar, donde la cita cancelada sigue a la vista (en «Descartadas») y se puede trabajar
    mientras la agenda está descartada.
    """
    if agenda.duplicada_de_id is None:
        raise ValueError(f'La agenda #{agenda.id} no está descartada')

    snapshot = (agenda.raw_data or {}).get('_dedup') or {}
    appointment_id = snapshot.get('appointment_id')
    if appointment_id:
        cita = Appointment.query.get(appointment_id)
        if cita and (cita.result or '') == 'Cancelado':
            cita.result = snapshot.get('result_previo')

    # Devolver lo que la conservada heredó de esta fila: si no, deshacer dejaría las dos
    # con el mismo dato y ya no se sabría cuál era de quién.
    heredado = snapshot.get('heredado') or {}
    if heredado or snapshot.get('persona_heredada'):
        conservada = FinancialAgenda.query.get(snapshot.get('conservada_id'))
        if conservada:
            for campo, previo in heredado.items():
                setattr(conservada, campo, previo)
            if snapshot.get('persona_heredada') and conservada.person_uuid == snapshot['persona_heredada']:
                conservada.person_uuid = None

    agenda.duplicada_de_id = None
    agenda.descartada_at = None
    agenda.descartada_por_id = None
    agenda.descartada_motivo = None
    resto = {k: v for k, v in (agenda.raw_data or {}).items() if k != '_dedup'}
    agenda.raw_data = resto
    return agenda
