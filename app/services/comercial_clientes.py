"""Clientes (cartera) del dashboard comercial: la ficha de un cliente, la cartera y sus
totales. `ComercialService` hereda de acá; ver `comercial_service.py`.
"""

from datetime import datetime

from app.models import Appointment, Client, User
from app.services.comercial_vocabulario import chip


class ComercialClientesMixin:

    # --- Clientes (cartera) -------------------------------------------------------------------

    @staticmethod
    def _atribucion_de_ventas(closer_id=None):
        """(de_quien, pedido) para atribuir cada venta a un closer.

        `de_quien` mapea email del vendedor -> nombre del closer, para no volver a consultar por
        cada fila; un email que no sea de ningún closer del sistema queda fuera, porque sin dueño
        la fila no se puede filtrar ni sumar a nadie.

        `pedido` es None cuando NO se acota a nadie, y un conjunto —posiblemente vacío— cuando sí.
        La distinción importa: un closer sin ninguna venta reconocible se acota a un conjunto
        vacío, no a "todas". Escrito como `pedido or de_quien`, un conjunto vacío es falsy y caía
        en la cartera completa del equipo, así que un closer recién entrado veía los clientes de
        todos con nombre y deuda.

        Vive aparte porque la tabla Clientes y el detalle de un cliente tienen que atribuir con
        exactamente la misma regla: si divergen, un closer podría abrir la ficha de un cliente
        que su propia tabla no le muestra.

        Los identificadores son los de `CloserService._resolve_sale_identifiers` (los de
        `identificadores_de_closer` para su username), pero leídos para todos de una vez: de a
        un closer era una consulta por cada uno, y cada una traía la lista entera de vendedores."""
        from app.models.user import ROLE_CLOSER
        from app.services.closer_name_service import identificadores_por_nombre

        por_nombre = identificadores_por_nombre()

        def identificadores(usuario):
            return por_nombre.get(usuario.username, []) if usuario and usuario.username else []

        de_quien = {}
        for usuario in User.query.filter(User.role == ROLE_CLOSER).all():
            for identificador in identificadores(usuario):
                de_quien[identificador.lower()] = usuario.username

        pedido = None
        if closer_id:
            usuario = User.query.get(closer_id)
            pedido = {e.lower() for e in identificadores(usuario)} if usuario else set()
        return de_quien, pedido

    @staticmethod
    def _vendedores_permitidos(de_quien, pedido):
        """Contra qué conjunto de emails se decide si una venta es "de quien pregunta"."""
        return de_quien if pedido is None else pedido

    @staticmethod
    def cliente(client_id, closer_id=None):
        """La ficha de cobro de UN cliente: lo mismo que su fila en la tabla Clientes, más su
        plan de cuotas completo y su historial de pagos.

        Existe para que el setter y la dirección comercial puedan ver en qué momento del cobro
        está un cliente sin pasar por los endpoints del closer, que además de exigir rol closer
        son los que además lo modifican. Acá no se escribe nada.

        La atribución es la misma que la de la tabla (ver `clientes`): a un closer solo se le
        deja abrir un cliente al que él le vendió. Devuelve None si el cliente no existe, no
        compró nada, o no es de quien pregunta."""
        from app.services.comercial_service import ComercialService
        from app.models import InstallmentPlan
        from app.services.closer_followup_service import CloserFollowUpService

        de_quien, pedido = ComercialService._atribucion_de_ventas(closer_id)
        permitidos = ComercialService._vendedores_permitidos(de_quien, pedido)

        ventas_por_cliente = CloserFollowUpService._resolve_sales_and_clients()
        ventas = ventas_por_cliente.get(client_id)
        if not ventas:
            return None
        if not [v for v in ventas if (v.email_vendedor or '').strip().lower() in permitidos]:
            return None

        cliente = Client.query.get(client_id)
        if not cliente:
            return None
        appt = (Appointment.query.filter_by(client_id=client_id)
                .order_by(Appointment.start_time.desc()).first())
        if not appt:
            appt = CloserFollowUpService._ensure_appointment_for_client(cliente)
        if not appt:
            return None

        item = CloserFollowUpService._build_cartera_item(client_id, cliente, appt, ventas_por_cliente)
        cuotas = (InstallmentPlan.query.filter_by(client_id=client_id)
                  .order_by(InstallmentPlan.fecha_vencimiento.asc()).all())
        return {'cliente': item, 'cuotas': [c.to_dict() for c in cuotas]}

    @staticmethod
    def clientes(closer_id=None):
        """Filas de la tabla "Clientes": todo cliente que el equipo ya vendió, con su programa,
        lo pagado, lo que debe y su próxima cuota.

        NO está acotada al período, y no puede estarlo sin cambiar de pregunta — es el mismo caso
        que `por_cobrar_de`: la cartera es un SALDO, no un flujo. "A quién le vendí" y "qué cobré
        del 1 al 30" son dos cosas distintas, y acotar la primera al período dejaría afuera
        justamente a los clientes que arrastran deuda de meses anteriores, que son los que hay que
        ir a cobrar. La tabla lo dice en su ayuda y los totales van rotulados "a hoy".

        La atribución es por QUIÉN VENDIÓ (`FinancialSale.email_vendedor`), no por quién tiene hoy
        la cita más reciente del cliente: es la misma regla que "Mi cartera" del closer, y existe
        porque la otra producía que closers activos vieran clientes de closers dados de baja
        (ver `CloserFollowUpService._cartera_items`, que arregló ese bug). Se reusan sus piezas en
        vez de rearmar el cálculo: la deuda, la próxima cuota y el desglose de pagos de un cliente
        tienen que dar lo mismo en las dos pantallas.

        **Todo en lote.** Esas piezas consultaban cliente por cliente: 5.682 consultas y 8,3 s
        para los 520 clientes de la base local, y la tabla "se queda pegada" (pedido del usuario,
        29/sep/2026). Ahora se leen de una `CarteraEnLote` —las mismas piezas, leyendo de otro
        lado— y la cantidad de consultas ya no depende de cuántos clientes haya.
        """
        from app.services.comercial_service import ComercialService
        from app.services.closer_followup_service import CarteraEnLote, CloserFollowUpService

        de_quien, pedido = ComercialService._atribucion_de_ventas(closer_id)
        permitidos = ComercialService._vendedores_permitidos(de_quien, pedido)

        ventas_por_cliente = CloserFollowUpService._resolve_sales_and_clients()
        propias_de = {}
        for cid, ventas in ventas_por_cliente.items():
            propias = [v for v in ventas
                       if (v.email_vendedor or '').strip().lower() in permitidos]
            if propias:
                propias_de[cid] = propias

        # El cliente comprado que nunca tuvo cita recibe su ancla, como siempre; se crean antes de
        # leer el lote porque cada una hace commit (ver `_anclar_clientes_sin_cita`).
        CloserFollowUpService._anclar_clientes_sin_cita(list(propias_de), ventas_por_cliente)
        # `cita_exacta=False`: la tabla no muestra nada de la cita, la necesita solo para armar el
        # item, así que entre dos citas empatadas en `start_time` da igual cuál.
        lote = CarteraEnLote(list(propias_de), cita_exacta=False)

        filas = []
        for cid, propias in propias_de.items():
            cliente = lote.clientes.get(cid)
            if not cliente:
                continue
            # `appt` es solo para los campos de display; cualquier cita del cliente sirve.
            appt = lote.ultima_cita.get(cid)
            if not appt:
                appt = CloserFollowUpService._ensure_appointment_for_client(cliente)
            item = CloserFollowUpService._build_cartera_item(cid, cliente, appt, ventas_por_cliente, lote=lote)

            propias.sort(key=lambda v: v.date or v.created_at or datetime.min)
            vendedor = de_quien.get((propias[0].email_vendedor or '').strip().lower())
            cuota = item['proxima_cuota']
            filas.append({
                'id': item['client_id'],
                'tipo': 'cliente',
                'client_id': item['client_id'],
                'cliente': item['lead_name'],
                'ig': item['instagram'],
                'email': cliente.email or '',
                'telefono': item['phone'],
                'fecha': item['enrollment_date'],
                'closer': vendedor or 'Sin closer',
                'programa': item['programa_nombre'] or 'Sin programa',
                'pagado': round(sum(pago['monto'] for pago in item['pagos']), 2),
                'deuda': round(item['deuda'], 2),
                'cobros': len(item['pagos']),
                'estado': chip('estado_cartera', ComercialService._estado_cartera(item)),
                'cuota_monto': cuota['monto'] if cuota else None,
                'cuota_fecha': cuota['fecha_vencimiento'] if cuota else None,
                'cuota_vencida': bool(cuota and cuota['vencida']),
                'cuota_numero': cuota['numero_cuota'] if cuota else None,
                # `{fecha, fecha_legible, motivo, por}` o None. La fila viaja igual —lo que pagó es
                # de la cartera y la tabla tiene un filtro "Dados de baja"—, pero el listado por
                # defecto la deja afuera (ver `tablasDef.js`).
                'baja': item['baja'],
            })

        ComercialService._con_academia(filas)
        filas.sort(key=lambda f: (-f['deuda'], f['cliente'].lower()))
        return filas

    @staticmethod
    def _estado_cartera(item):
        if item.get('baja'):
            return 'baja'
        cuota = item['proxima_cuota']
        if not cuota:
            return 'al_dia'
        if cuota['sin_plan']:
            return 'sin_plan'
        return 'vencida' if cuota['vencida'] else 'por_vencer'

    @staticmethod
    def totales_clientes(filas):
        """Los totales van rotulados "a hoy" en la pantalla: son un saldo, no un flujo del
        período (ver `clientes`).

        Un dado de baja no debe nada, pero tampoco está "al día": se cuenta aparte. Lo que pagó sí
        entra en `pagado`, que es plata cobrada."""
        con_deuda = [f for f in filas if f['deuda'] > 0.01]
        vencidas = [f for f in filas if f['cuota_vencida']]
        bajas = [f for f in filas if f.get('baja')]
        return {
            'clientes': len(filas),
            'al_dia': len(filas) - len(con_deuda) - len(bajas),
            'bajas': len(bajas),
            'con_deuda': len(con_deuda),
            'deuda': round(sum(f['deuda'] for f in filas), 2),
            'vencidas': len(vencidas),
            'deuda_vencida': round(sum(f['cuota_monto'] or 0 for f in vencidas), 2),
            'pagado': round(sum(f['pagado'] for f in filas), 2),
        }
