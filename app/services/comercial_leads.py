"""Leads entrantes del setter en el dashboard comercial: sus filas y sus totales.
`ComercialService` hereda de acá; ver `comercial_service.py`.
"""

from sqlalchemy import func

from app import db
from app.models import Appointment, Client, LeadAnswer, ManychatLead, User
from app.services.setter_assignment_service import _variantes_guardadas, normalizar_nombre
from app.services.comercial_cruces import no_es_marcador, _limpiar_ig
from app.services.comercial_vocabulario import SIN_RESPUESTA, chip, pct


class ComercialLeadsMixin:

    # --- Leads entrantes del setter -----------------------------------------------------------

    @staticmethod
    def _setter_id_de(nombre):
        """El id del usuario setter que se llama `nombre`, comparando normalizado.

        Los leads se atribuyen por NOMBRE (`ManychatLead.setter`, lo escribe ManyChat) y las
        agendas por id (`Appointment.setter_id`): esto es el puente, para quien pida los leads de
        un setter con el nombre solo.
        """
        buscado = normalizar_nombre(nombre)
        return next((u.id for u in User.query.filter_by(role='setter').order_by(User.id).all()
                     if normalizar_nombre(u.username) == buscado), None)

    @staticmethod
    def leads(start, end, setter_nombre=None, setter_id=None):
        """Filas de la tabla "Leads entrantes": los prospectos de ManyChat del período.

        El estado no es una columna: se deriva de lo que hizo el lead, con el mismo orden de
        prioridad con el que lo lee la bandeja del setter — agendó (tiene una cita), lo
        descartaron (su cualificación dio que no), viene conversando (contestó al menos una
        pregunta) o no contestó nunca.

        **"Agendó" es agendar con ESE setter** (decisión del 01/10/2026): el lead del período
        cuyo instagram es el de un cliente con una cita que generó ese setter (`setter_id`). Con
        el equipo entero, una cita que generó cualquier setter. Antes alcanzaba con CUALQUIER
        cita, así que a un setter le contaban como suyos los leads que reservaron con otro setter,
        en un taller o por un closer. Esos quedan como "Agendó por otra vía": reservaron, pero no
        le cuentan.

        `setter_id` es la persona de la que se miden las citas; si no viene, sale del nombre.
        """
        from app.services.comercial_service import ComercialService
        desde, hasta = ComercialService._limites(start, end)
        q = ManychatLead.query.filter(ManychatLead.created_at >= desde, ManychatLead.created_at <= hasta)
        if setter_nombre:
            variantes = _variantes_guardadas(setter_nombre)
            if not variantes:
                return []
            q = q.filter(ManychatLead.setter.in_(variantes))

        leads = q.order_by(ManychatLead.created_at.desc()).all()
        if not leads:
            return []

        ids = [l.id for l in leads]
        # Respuestas por lead: cuántas interacciones tiene, si contestó alguna de verdad, y si
        # alguna lo cualificó (o lo descartó).
        #
        # "Respondió" NO es "tiene una interacción registrada": todo lead de ManyChat nace con
        # una, así que con ese criterio la tasa de respuesta daba 100% siempre y no informaba
        # nada. Se usa el mismo que la bandeja del setter (`get_cualificacion_stats`): una
        # cualificación vacía —'null', '' o 'undefined'— es justamente un lead que no contestó.
        respuestas = {}
        for lead_id, qualification in db.session.query(LeadAnswer.lead_id, LeadAnswer.qualification) \
                .filter(LeadAnswer.lead_id.in_(ids)).all():
            datos = respuestas.setdefault(
                lead_id, {'total': 0, 'respondio': False, 'cualificado': False, 'descartado': False})
            datos['total'] += 1
            valor = (qualification or '').strip().lower()
            if valor not in SIN_RESPUESTA:
                datos['respondio'] = True
            if valor in ('yes', 'true'):
                datos['cualificado'] = True
            elif valor in ('no', 'false'):
                datos['descartado'] = True

        # Leads que llegaron a agendar: se cruzan por instagram contra los clientes con cita, y de
        # cada cita se mira quién la generó. `con_cita` es cualquier cita; `agendados`, solo las
        # que cuentan para quien se está mirando (ver el docstring).
        if setter_nombre and setter_id is None:
            setter_id = ComercialService._setter_id_de(setter_nombre)
        if setter_nombre or setter_id:
            propios = {setter_id} if setter_id else set()
        else:
            propios = {uid for (uid,) in db.session.query(User.id).filter(User.role == 'setter')}

        igs = sorted({ig for ig in (_limpiar_ig(l.ig) for l in leads) if ig})
        con_cita, agendados = set(), set()
        if igs:
            ig_cliente = func.lower(func.replace(Client.instagram, '@', ''))
            for ig, generada_por in db.session.query(ig_cliente, Appointment.setter_id).join(
                    Appointment, Appointment.client_id == Client.id).filter(
                    ig_cliente.in_(igs), no_es_marcador()).distinct():
                con_cita.add(ig)
                if generada_por in propios:
                    agendados.add(ig)
        # El lead con persona agendó si ella tiene la cita (plan_personas): sin adivinar por Instagram.
        personas = {l.person_uuid for l in leads if l.person_uuid}
        if personas:
            for puuid, generada_por in db.session.query(Appointment.person_uuid, Appointment.setter_id).filter(
                    Appointment.person_uuid.in_(personas), no_es_marcador()).distinct():
                con_cita.add(('p', puuid))
                if generada_por in propios:
                    agendados.add(('p', puuid))

        salida = []
        vacio = {'total': 0, 'respondio': False, 'cualificado': False, 'descartado': False}
        for l in leads:
            quien = ('p', l.person_uuid) if l.person_uuid else _limpiar_ig(l.ig)
            datos = respuestas.get(l.id, vacio)
            agendo = quien in agendados
            if agendo:
                estado = 'agendo'
            elif quien in con_cita:
                estado = 'agendo_otra_via'
            elif datos['descartado']:
                estado = 'descartado'
            elif datos['respondio']:
                estado = 'en_conversacion'
            else:
                estado = 'sin_respuesta'
            salida.append({
                'id': l.id,
                'tipo': 'lead',
                'person_uuid': l.person_uuid,
                'fecha': l.created_at.isoformat() if l.created_at else None,
                'creada': l.created_at.isoformat() if l.created_at else None,
                'cliente': l.name or 'Sin nombre',
                'ig': l.ig or '',
                'email': '',
                'telefono': '',
                'fuente': 'ManyChat',
                'setter': l.setter or 'Sin asignar',
                'estado': chip('estado', estado),
                'mensajes': datos['total'],
                'respondio': datos['respondio'],
                'cualificado': datos['cualificado'],
                'agendo': agendo,
                'ultimo': l.updated_at.isoformat() if l.updated_at else None,
            })
        return salida

    @staticmethod
    def totales_leads(filas):
        respondieron = [f for f in filas if f['respondio']]
        cualificados = [f for f in filas if f['cualificado']]
        # Solo los que agendaron con quien se mira: "Agendó por otra vía" no suma (ver `leads`).
        agendaron = [f for f in filas if f['agendo']]
        return {
            'leads': len(filas),
            'respondieron': len(respondieron),
            'respuesta': pct(len(respondieron), len(filas)),
            'cualificados': len(cualificados),
            'cualificacion': pct(len(cualificados), len(respondieron)),
            'agendas': len(agendaron),
            'conversion': pct(len(agendaron), len(filas)),
            'mensajes': sum(f['mensajes'] for f in filas),
        }
