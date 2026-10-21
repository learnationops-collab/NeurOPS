"""Ventas del dashboard comercial: los cobros del período, sus filas (con fuente y Academia)
y sus totales. `ComercialService` hereda de acá; ver `comercial_service.py`.
"""

from app.models import FinancialSale
from app.services.closer_name_service import resolver_nombre_closer
from app.services.commission_service import cash_neto_de
from app.services.setter_assignment_service import normalizar_nombre
from app.services.ticket_service import pago_de_fila, ticket_de
from app.services.comercial_cruces import clientes_de_ventas
from app.services.comercial_vocabulario import chip, venta_completada, estado_de_venta


class ComercialVentasMixin:

    # --- Ventas -------------------------------------------------------------------------------

    @staticmethod
    def clasificar_venta(venta):
        """(programa, tipo canónico, es_venta_real) de una fila de `FinancialSale`, con el mismo
        parseo que usa el resto del sistema (`SheetsService.parse_tipo_pago`)."""
        from app.services.closer_service import PROGRAM_LABELS, REAL_SALE_TIPOS, _program_from_examen
        from app.services.sheets_service import SheetsService

        codigo, tipo = SheetsService.parse_tipo_pago(venta.tipo_pago)
        programa = PROGRAM_LABELS.get(codigo) or _program_from_examen(venta.examen) or 'Sin programa'
        return programa, (tipo or 'otro'), (tipo in REAL_SALE_TIPOS)

    @staticmethod
    def _cobros_del_periodo(start, end):
        """TODOS los cobros (`FinancialSale`) del período, de todo el equipo, en cualquier estado y
        del más reciente al más viejo."""
        from app.services.comercial_service import ComercialService
        desde, hasta = ComercialService._limites(start, end)
        q = FinancialSale.query.filter(FinancialSale.date >= desde, FinancialSale.date <= hasta)
        return q.order_by(FinancialSale.date.desc(), FinancialSale.id.desc()).all()

    @staticmethod
    def ventas_del_periodo(start, end):
        """Los cobros (`FinancialSale`) del período que cuentan como cash, de todo el equipo y del
        más reciente al más viejo: los de estado vacío, «Completada» o «Confirmada»."""
        from app.services.comercial_service import ComercialService
        return [v for v in ComercialService._cobros_del_periodo(start, end) if venta_completada(v)]

    @staticmethod
    def vendio(nombre_vendedor, closer_nombre):
        """¿Es de `closer_nombre` una venta cuyo vendedor resuelve a `nombre_vendedor`?

        None es "no acotar" (todo el equipo); cualquier otro valor acota, también uno vacío, que no
        es de nadie: no se repite la fuga del conjunto vacío de `_atribucion_de_ventas`. Es el
        único lugar que lo decide para la tabla Ventas, el cash de Analizar y sus ingresos por
        fuente (`comercial_analitica.fuentes_de`), que por eso cierran entre sí."""
        if closer_nombre is None:
            return True
        return normalizar_nombre(nombre_vendedor) == normalizar_nombre(closer_nombre)

    @staticmethod
    def ventas_de(start, end, closer_nombre=None):
        """(las del período, las de `closer_nombre`): las dos listas de `FinancialSale` con las que
        se reparte el cash por fuente. La primera es el contexto de la atribución (ver
        `procedencia_ingresos_service.procedencia_de_ventas`); la segunda, lo que se reparte."""
        from app.services.comercial_service import ComercialService
        del_periodo = ComercialService.ventas_del_periodo(start, end)
        if closer_nombre is None:
            return del_periodo, del_periodo
        return del_periodo, [v for v in del_periodo
                             if ComercialService.vendio(resolver_nombre_closer(v.email_vendedor), closer_nombre)]

    @staticmethod
    def de_la_fuente_del_setter(setter_nombre, procedencias):
        """Los ids de los cobros cuya fuente es el setter `setter_nombre`, de un mapa
        {id -> (balde, detalle, rótulo)} de `procedencia_por_venta`.

        "Las ventas del setter" son las que la tarjeta «Ingresos por fuente» y Finanzas › Procedencia
        ponen en «Setting · <setter>»: el balde `setting` con el detalle de ese setter. Es la misma
        regla con la que la nómina le paga (`nomina_service.setter_de_la_venta`): la fuente de la
        agenda que originó el pago, o si no hay, el setter escrito en la venta. Así su lista de
        Revisar › Ventas son exactamente los cobros de su renglón en la tarjeta de la dirección.

        No hay "sin acotar" acá: un nombre vacío, o un setter sin ninguna venta de su fuente, da un
        conjunto vacío — nunca las del equipo (la fuga del conjunto vacío, ver `vendio`).
        """
        from app.services.fuente_service import normalizar

        objetivo = normalizar(setter_nombre)
        if not objetivo:
            return set()
        return {venta_id for venta_id, (balde, detalle, _rotulo) in procedencias.items()
                if balde == 'setting' and detalle == objetivo}

    @staticmethod
    def _fila_venta(v, nombre, client_id, contacto=None):
        """La fila de Ventas de un cobro: `nombre` es su closer ya resuelto, `client_id` el cliente
        con el que se cruzó (`clientes_de_ventas`), o None, y `contacto` el de `FinancialSale.contactos`
        (los datos de su persona; sin él se lee acá)."""
        from app.services.comercial_service import ComercialService
        programa, tipo, es_venta = ComercialService.clasificar_venta(v)
        contacto = contacto or v.contacto()
        monto = float(v.monto or 0.0)
        return {
            'id': v.id,
            'tipo': 'venta',
            # `None` cuando la venta no se pudo cruzar con ningún cliente: esa fila sigue
            # abriendo el modal viejo, porque no hay ficha que abrir.
            'client_id': client_id,
            'person_uuid': v.person_uuid,
            'fecha': v.date.isoformat() if v.date else None,
            'creada': v.created_at.isoformat() if v.created_at else None,
            'cliente': contacto['nombre_cliente'] or 'Sin nombre',
            'ig': contacto['instagram'] or '',
            'email': contacto['mail_cliente'] or '',
            'telefono': contacto['telefono'] or '',
            'programa': programa,
            'tipo_pago': chip('tipo_pago', tipo),
            'tipo_pago_raw': (v.tipo_pago or '').strip() or 'Sin tipo',
            'es_venta': es_venta,
            'monto': round(monto, 2),
            'monto_neto': round(cash_neto_de(monto, v.metodo_pago), 2),
            'metodo': v.metodo_pago or 'Sin método',
            'closer': nombre,
            'setter': v.setter or '',
            # Se completa abajo: en qué terminó esta seña. `None` en cualquier fila que no sea
            # una seña, para que la clave no falte nunca y el frontend no tenga que preguntar.
            'sena_estado': None,
        }

    @staticmethod
    def ventas(start, end, closer_nombre=None, con_fuente=False, setter_nombre=None, para_operar=False):
        """Filas de la tabla "Ventas". El cash del período sale de estas mismas filas.

        `con_fuente` le agrega a cada fila la fuente que trajo ese cobro (`_con_fuente`): la faceta
        y el agrupar «Fuente» de Revisar. Solo lo pide la tabla: esta función la corren también el
        bloque de Analizar, Variabilidad y el reporte diario, y en Comparativas una vez por persona
        y por período, que no muestran la fuente y no tienen por qué pagar la atribución.

        `setter_nombre` deja solo los cobros cuya fuente es ese setter (ver
        `de_la_fuente_del_setter`): Revisar › Ventas del setter, las que él originó. None es "no
        acotar"; cualquier otro valor acota, también uno vacío. La fuente se calcula sobre TODAS
        las ventas del período, como la tarjeta, así que una fila cae en el mismo balde para él y
        para la dirección; ese contexto no le agrega ninguna fila ajena.

        `para_operar` suma lo que Operaciones necesita para corregir las ventas desde Revisar (ver
        `_para_operar`). Solo lo pide `GET /comercial/tabla` para admin y operador: las filas
        completadas salen idénticas, y sin él la función devuelve exactamente lo de siempre. Con un
        setter elegido no suma las no completadas: lo que ata un cobro a un setter es su fuente, y
        esa se calcula sobre lo cobrado."""
        from app.services.comercial_service import ComercialService
        # El cliente de cada venta, para que la fila pueda abrir la ficha unificada. Se resuelve
        # en bloque ANTES del bucle: adentro sería una consulta por fila.
        if para_operar:
            cobros = ComercialService._cobros_del_periodo(start, end)
            del_periodo = [v for v in cobros if venta_completada(v)]
            no_completadas = [v for v in cobros if not venta_completada(v)] if setter_nombre is None else []
        else:
            del_periodo = ComercialService.ventas_del_periodo(start, end)
            no_completadas = []
        # Una venta se cruza con su cliente por su persona o su propio contacto, así que sumar las no
        # completadas no le cambia el cliente a ninguna completada.
        clientes = clientes_de_ventas(del_periodo + no_completadas)
        contactos = FinancialSale.contactos(del_periodo)

        # Con un setter la fuente decide qué filas entran, así que se calcula antes del bucle (una
        # sola vez: `_con_fuente` reusa este mismo mapa).
        procedencias = None
        del_setter = None
        if setter_nombre is not None:
            from app.services.procedencia_ingresos_service import procedencia_por_venta
            procedencias = procedencia_por_venta(del_periodo, contexto=del_periodo)
            del_setter = ComercialService.de_la_fuente_del_setter(setter_nombre, procedencias)

        filas = []
        propias = []
        for v in del_periodo:
            if del_setter is not None and v.id not in del_setter:
                continue
            nombre = resolver_nombre_closer(v.email_vendedor)
            if not ComercialService.vendio(nombre, closer_nombre):
                continue
            propias.append(v)
            filas.append(ComercialService._fila_venta(v, nombre, clientes.get(v.id), contactos.get(v.id)))

        # En qué terminó cada seña, con la MISMA función que cuenta el panel Señas. Sin esto la
        # tabla Ventas no sabía cortar por eso: el panel decía "3 caídas" y no había forma de ver
        # cuáles eran. Se resuelve acá y no en el frontend porque hace falta buscar la venta
        # posterior del mismo contacto, que el frontend no tiene.
        from app.services.comercial_analitica import clasificar_senas
        filas_por_id = {f['id']: f for f in filas}
        for fila_id, dato in clasificar_senas(filas).items():
            filas_por_id[fila_id]['sena_estado'] = dato['estado']
        ComercialService._con_academia(filas)
        if con_fuente:
            ComercialService._con_fuente(filas_por_id, propias, del_periodo, procedencias=procedencias)
        if para_operar:
            filas = ComercialService._para_operar(filas, del_periodo, no_completadas, closer_nombre,
                                                  clientes, con_fuente)
        return filas

    @staticmethod
    def _para_operar(filas, del_periodo, no_completadas, closer_nombre, clientes, con_fuente):
        """Las filas de Ventas para quien opera los registros (admin y operador, 10/10/2026).

        La tabla vieja de Ventas de Operaciones se retiró y Revisar la reemplaza; lo que ella sabía y
        Revisar no, se suma acá:

          · **Las no completadas** (pendientes, reembolsadas, canceladas…), mezcladas en el orden de
            la tabla. Se arman DESPUÉS de todo lo de las completadas: en qué terminó cada seña y la
            fuente de cada cobro se calcularon sin ellas, así que las filas completadas salen
            idénticas a las de la dirección. Una no completada no es cash: no tiene estado de seña,
            y su fuente se calcula sobre el período entero, como la de cualquier cobro.
          · **`estado`** (`estado_de_venta`) y **`completada`** en todas: con eso Revisar arma la
            faceta y el filtro rápido, y deja a las no completadas fuera de los totales.
          · **`tiene_agenda`** en todas, con el criterio de la tabla vieja (`sin_atribucion` de
            `GET /public/financial-sales`): ¿`AttributionService` le encuentra una `FinancialAgenda`
            entre las del lead? Sobre los cobros del período en cualquier estado, como ella. Una
            atribución para todas las filas, nunca una consulta por fila.
        """
        from app.services.comercial_service import ComercialService
        from app.services.attribution_service import AttributionService
        from app.services.procedencia_ingresos_service import agendas_para_atribuir

        extra, propias_extra = [], []
        contactos = FinancialSale.contactos(no_completadas)
        for v in no_completadas:
            nombre = resolver_nombre_closer(v.email_vendedor)
            if not ComercialService.vendio(nombre, closer_nombre):
                continue
            propias_extra.append(v)
            extra.append(ComercialService._fila_venta(v, nombre, clientes.get(v.id), contactos.get(v.id)))
        ComercialService._con_academia(extra)

        todos = del_periodo + no_completadas
        agendas = agendas_para_atribuir()
        if con_fuente:
            ComercialService._con_fuente({f['id']: f for f in extra}, propias_extra, todos, agendas=agendas)

        atribucion = AttributionService.get_sales_attribution(sales=todos, agendas=agendas)
        por_id = {v.id: v for v in todos}
        juntas = filas + extra
        for fila in juntas:
            venta = por_id[fila['id']]
            fila['estado'] = estado_de_venta(venta)
            fila['completada'] = venta_completada(venta)
            fila['tiene_agenda'] = atribucion.get(fila['id']) is not None
        # El orden de `_cobros_del_periodo`: la fecha y después el id, de lo más nuevo a lo más viejo.
        juntas.sort(key=lambda f: (por_id[f['id']].date, f['id']), reverse=True)
        return juntas

    @staticmethod
    def _con_fuente(filas_por_id, propias, del_periodo, procedencias=None, agendas=None):
        """Le pone a cada fila de Ventas la fuente que trajo ese cobro: `procedencia` (el balde,
        `{key, label, tone}`: Workshop, Setting, VSL, Fulfillment o Sin procedencia) y
        `procedencia_detalle` (`{key, label}`: en vivo o grabación, el setter… o None si el balde
        no se abre, como la VSL).

        Es la MISMA clasificación que la tarjeta «Ingresos por fuente» de Analizar y que Finanzas ›
        Procedencia (`procedencia_ingresos_service.procedencia_por_venta`), con el mismo contexto que
        la tarjeta: la atribución corre sobre TODAS las ventas del período aunque la tabla esté
        acotada a un closer, así que un cobro cae en la misma fuente en «Mis datos», en el equipo y
        en la tarjeta. El contexto solo decide la agenda de cada cobro: las filas siguen siendo las
        de `vendio`, y un closer no ve nada de otro.

        Cada fila es UN cobro (`FinancialSale`), así que no hay que decidir qué hacer con una venta
        cuyos cobros caen en fuentes distintas: cada cobro lleva la suya, como en la tarjeta. Por la
        atribución, casi siempre es la misma para todos los cobros de una persona (manda la agenda
        del primer pago calificado); la excepción son las renovaciones y los upsells, que van a
        Fulfillment aunque la venta original haya sido de un setter.

        Con eso, filtrar Revisar › Ventas por una fuente da exactamente los cobros de esa fila de la
        tarjeta, y su cash (bruto, como la tarjeta) suma su monto.

        `procedencias` es el mapa ya calculado sobre todo el período, si lo hay (las ventas de un
        setter lo necesitan antes para elegir las filas): la atribución no se corre dos veces.
        `agendas` (opcional) son las de la atribución ya leídas, para quien las necesita también para
        otra cosa (`_para_operar`); sin ellas, `procedencia_por_venta` las lee."""
        from app.services.procedencia_ingresos_service import PROCEDENCIAS, procedencia_por_venta

        if procedencias is None:
            procedencias = procedencia_por_venta(propias, contexto=del_periodo, agendas=agendas)
        baldes = {p['key']: {'key': p['key'], 'label': p['label'], 'tone': p['tone']} for p in PROCEDENCIAS}
        for venta_id in (v.id for v in propias):
            balde, sub, rotulo = procedencias[venta_id]
            fila = filas_por_id[venta_id]
            fila['procedencia'] = dict(baldes[balde])
            fila['procedencia_detalle'] = {'key': sub, 'label': rotulo} if sub else None

    @staticmethod
    def _con_academia(filas):
        """Le agrega a cada fila la foto de la Academia de su cliente (`fila['academia']`).

        Es lo que deja filtrar y ordenar Clientes y Ventas por lo que el alumno hace en la Academia
        (ver `academy_snapshot_service`). Se lee de la foto guardada, nunca de la Academia en vivo,
        y en UNA consulta para todas las filas. Una venta que no se cruza con ningun cliente queda
        en None: no hay alumno que buscar.
        """
        from app.services.academy_snapshot_service import bloques_por_cliente

        bloques = bloques_por_cliente([f['client_id'] for f in filas if f.get('client_id')])
        for fila in filas:
            fila['academia'] = bloques.get(fila.get('client_id'))

    @staticmethod
    def totales_ventas(filas):
        # Una venta no completada no es cash: llega solo a quien opera (`_para_operar`), que la ve
        # en la lista para corregirla, pero no suma. Las filas de los demás no traen la marca.
        filas = [f for f in filas if f.get('completada', True)]
        cash = sum(f['monto'] for f in filas)
        ventas = [f for f in filas if f['es_venta']]
        # El ticket es lo que entró POR CADA VENTA NUEVA (pago completo o split pay), igual que
        # en el dashboard del closer (`general_average_ticket`). Antes dividía TODO el cash del
        # período —cuotas y señas incluidas— por las ventas: un mes con una venta de $250 y
        # cuotas viejas cobradas mostraba un ticket de $1.200. Los pagos del mismo cliente en el
        # mismo mes cuentan como una sola venta, con su primera cuota si llega antes del mes
        # (`ticket_service`).
        return {
            'filas': len(filas),
            'ventas': len(ventas),
            'cash': round(cash, 2),
            'cash_neto': round(sum(f['monto_neto'] for f in filas), 2),
            'ticket': ticket_de([pago_de_fila(f) for f in filas])[2],
        }
