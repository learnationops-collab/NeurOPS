"""API del dashboard comercial.

Un solo tablero para tres audiencias, con el alcance resuelto SIEMPRE en el servidor:

  · dirección comercial y admin: todo el equipo, con selector de persona y de rol;
  · closer en "Mis datos": sus agendas y sus ventas, sin selector de equipo;
  · setter en "Mis datos" y en su Revisar: su reporte diario, sus leads, las agendas que generó y
    las ventas de su fuente.

El frontend esconde controles, pero eso no protege nada: acá se ignora cualquier `rol` o
`miembro_id` que mande alguien que no tiene permiso para elegirlos (ver `alcance_de`). Un closer
que pida `miembro_id` de otro closer recibe sus propios datos, no un 403 — pedir una vista que
no le corresponde no es un error del usuario, es un parámetro que no se le respeta.
"""
from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.models import Appointment, User
from app.api.public.finance import puede_ver_finanzas
from app.models.user import ROLE_ADMIN, ROLE_CLOSER, ROLE_DIRECTOR_COMERCIAL, ROLE_OPERATOR, ROLE_SETTER
from app.services import comercial_analitica as analitica
from app.services import comercial_no_cerradas
from app.services import comercial_reporte as reporte
from app.services import setter_mis_datos as datos_setter
from app.services.booking_service import BookingService
from app.services.comercial_service import (
    POST_CALL, POST_CALL_A_CLOSER_RESULT, PRE_CALL, PRE_CALL_A_RESULT, ROL_CLOSERS, ROL_SETTERS,
    ROLES, ComercialService,
)
from app.services.leads_del_setter import puede_abrir

bp = Blueprint('comercial_api', __name__)

# Quién ve el equipo completo y puede elegir de quién son los datos.
ROLES_DIRECCION = (ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL)
# Quién opera los registros desde Revisar: la edición masiva, los duplicados y las acciones sobre las
# ventas (10/10/2026, cuando las tablas viejas de Operaciones pasaron a Revisar). Ve el equipo completo
# como la dirección, pero no reporta ni compara: el operador solo entra a Revisar.
ROLES_QUE_OPERAN = (ROLE_ADMIN, ROLE_OPERATOR)
# Quién entra al tablero, de una forma u otra.
ROLES_CON_ACCESO = ROLES_DIRECCION + (ROLE_OPERATOR, ROLE_CLOSER, ROLE_SETTER)

PERIODOS = [
    {'key': 'hoy', 'label': 'Hoy'}, {'key': 'ayer', 'label': 'Ayer'},
    {'key': '7d', 'label': '7 días'}, {'key': '30d', 'label': '30 días'},
    {'key': 'mes', 'label': 'Este mes'}, {'key': 'mes_pasado', 'label': 'Mes pasado'},
    {'key': '90', 'label': '90 días'}, {'key': 'custom', 'label': 'Personalizado'},
]
# `custom` compara contra dos fechas libres (`compare_start`/`compare_end`), independientes del
# período: un mes contra una semana es una lectura válida y no se recorta (ver `_comparison_range`).
# Sin las dos fechas no hay comparación, nunca el período anterior disfrazado de personalizado.
COMPARACIONES = [
    {'key': 'prev', 'label': 'Período anterior'}, {'key': 'month', 'label': 'Mismo período mes pasado'},
    {'key': 'year', 'label': 'Mismo período año pasado'}, {'key': 'custom', 'label': 'Personalizado'},
    {'key': 'none', 'label': 'Sin comparar'},
]
TABLAS = ('agendas', 'ventas', 'leads', 'generadas', 'clientes')


def alcance_de(usuario, rol_pedido, miembro_pedido):
    """(rol, miembro_id, puede_elegir) según quién pregunta.

    Para un closer o un setter el alcance es él mismo y el rol es el suyo, pida lo que pida: es
    el único punto donde se decide, así que ninguna vista de abajo puede olvidarse de filtrar.
    """
    if usuario.role == ROLE_CLOSER:
        return ROL_CLOSERS, usuario.id, False
    if usuario.role == ROLE_SETTER:
        return ROL_SETTERS, usuario.id, False

    rol = rol_pedido if rol_pedido in ROLES else ROL_CLOSERS
    miembro_id = None
    if miembro_pedido and miembro_pedido != 'all':
        try:
            miembro_id = int(miembro_pedido)
        except (TypeError, ValueError):
            miembro_id = None
    return rol, miembro_id, True


def _rangos():
    """(inicio, fin, inicio_comparado, fin_comparado) de los parámetros del header."""
    args = request.args
    start, end = ComercialService.rango(
        args.get('period', 'mes'), args.get('start_date'), args.get('end_date'))
    prev_start, prev_end = ComercialService.rango_comparado(
        start, end, args.get('compare', 'prev'), args.get('compare_start'), args.get('compare_end'))
    return start, end, prev_start, prev_end


def _fechas(start, end, prev_start, prev_end):
    return {'start': start.isoformat(), 'end': end.isoformat(),
            'compare_start': prev_start.isoformat() if prev_start else None,
            'compare_end': prev_end.isoformat() if prev_end else None}


def _alcance():
    return alcance_de(current_user, request.args.get('rol'), request.args.get('miembro_id'))


@bp.before_request
@login_required
def _solo_roles_con_acceso():
    if current_user.role not in ROLES_CON_ACCESO:
        return jsonify({'message': 'Forbidden'}), 403


@bp.route('/contexto', methods=['GET'])
def contexto():
    """Todo lo que el header y los chips necesitan saber una sola vez: qué puede elegir esta
    persona, quiénes son sus compañeros y el vocabulario de estados con sus colores."""
    rol, miembro_id, puede_elegir = _alcance()
    return jsonify({
        'rol': rol,
        'miembro_id': miembro_id,
        'puede_elegir_equipo': puede_elegir,
        'puede_reportar': current_user.role in ROLES_DIRECCION,
        'puede_operar': current_user.role in ROLES_QUE_OPERAN,
        'puede_comparar': _puede_comparar(),
        # Las secciones Finanzas y Payroll del dock: el mismo criterio con el que responden sus
        # endpoints (`finance_admin_required`), admin o dirección con el permiso «ver finanzas».
        'puede_ver_finanzas': puede_ver_finanzas(current_user),
        'yo': {'id': current_user.id, 'nombre': current_user.username, 'rol': current_user.role},
        'miembros': ComercialService.miembros(rol) if puede_elegir else [],
        # La lista del selector de persona depende del switch Closers / Setters, que se mueve sin
        # volver a pedir el contexto: por eso van las dos. Antes solo viajaba `miembros` (siempre
        # los closers, porque el contexto se pide sin `rol`) y con Setters el selector ofrecía
        # closers: elegir uno acotaba las agendas por un setter_id que no generó ninguna y daba 0.
        'miembros_por_rol': {r: ComercialService.miembros(r) for r in ROLES} if puede_elegir else {},
        'periodos': PERIODOS,
        'comparaciones': COMPARACIONES,
        'estados': {'pre_call': PRE_CALL, 'post_call': POST_CALL},
    }), 200


@bp.route('/resumen', methods=['GET'])
def resumen():
    """Analizar → Dashboard."""
    rol, miembro_id, _ = _alcance()
    start, end, prev_start, prev_end = _rangos()
    datos = analitica.resumen(rol, start, end, prev_start, prev_end, miembro_id)
    return jsonify({**datos, 'dates': _fechas(start, end, prev_start, prev_end)}), 200


@bp.route('/comparativas', methods=['GET'])
def comparativas():
    """Analizar → Comparativas: ranking por métrica y mapa del equipo. **La dirección, los closers
    y los setters.**

    Es la única pantalla del tablero que muestra los números de OTRAS personas con nombre y
    apellido; todo lo demás está acotado a quien pregunta. Desde el 02/oct/2026 los closers la
    ven —decisión del usuario, que revierte la del 24/sep— y desde el 10/oct/2026 también los
    setters («hay que permitir que los setters vean la pestaña de comparativas que ve el
    administrador comercial»). Cada uno ve SIEMPRE la de su propio rol: el rol lo fija
    `alcance_de`, así que un closer no puede pedir la de los setters ni un setter la de los
    closers (la plata de cada closer no es de su incumbencia).

    Con Setters trae además `embudos`: el de cada setter y el del equipo, del reporte diario a las
    ventas (ver `comercial_analitica.comparativas`).

    El 403 es lo que la cumple para cualquier otro rol: la pestaña escondida en el frontend no
    alcanza, porque el endpoint se puede pedir igual.
    """
    if not _puede_comparar():
        return jsonify({'message': 'Forbidden'}), 403
    rol, miembro_id, _ = _alcance()
    start, end, prev_start, prev_end = _rangos()
    datos = analitica.comparativas(rol, start, end, prev_start, prev_end)
    return jsonify({**datos, 'yo': miembro_id, 'dates': _fechas(start, end, prev_start, prev_end)}), 200


@bp.route('/variabilidad', methods=['GET'])
def variabilidad():
    """Analizar → Variabilidad: la serie por día de cada métrica.

    Endpoint aparte y no un bloque de `/resumen` porque se pide solo cuando se abre la pestaña:
    son seis series diarias y no hacen falta para ver el dashboard.
    """
    rol, miembro_id, _ = _alcance()
    start, end, _prev_start, _prev_end = _rangos()
    datos = analitica.variabilidad(rol, start, end, miembro_id)
    return jsonify({**datos, 'dates': _fechas(start, end, None, None)}), 200


@bp.route('/setter/mis-datos', methods=['GET'])
def setter_mis_datos():
    """«Mis datos» del setter: su reporte diario sumado en el período y lo que registra el sistema,
    lado a lado (ver `app/services/setter_mis_datos.py`). Mismos parámetros de período y de
    comparación que el resto del tablero.

    El alcance lo decide `alcance_de`, como en todo el tablero: un setter ve solo lo suyo pida lo
    que pida, también simulado por la dirección (la sesión simulada ES la del setter). La dirección
    lo pide para un setter con `miembro_id`, o sin él para el equipo de setting. Un `miembro_id` que
    no es un setter es un 404: acotar los reportes por el id de un closer daría ceros que parecen
    datos. Un closer no tiene «Mis datos» de setter: 403.
    """
    if current_user.role not in ROLES_DIRECCION + (ROLE_SETTER,):
        return jsonify({'message': 'Forbidden'}), 403
    _rol, miembro_id, puede_elegir = alcance_de(current_user, ROL_SETTERS, request.args.get('miembro_id'))
    if puede_elegir and miembro_id is not None:
        miembro = db.session.get(User, miembro_id)
        if not miembro or miembro.role != ROLE_SETTER:
            return jsonify({'message': 'No existe ese setter'}), 404
    start, end, prev_start, prev_end = _rangos()
    datos = datos_setter.mis_datos(miembro_id, start, end, prev_start, prev_end)
    return jsonify({**datos, 'dates': _fechas(start, end, prev_start, prev_end)}), 200


@bp.route('/cierres/no-cerradas', methods=['GET'])
def cierres_no_cerradas():
    """Analizar › Cierre › «No cerradas»: las llamadas con show up del período que no terminaron ni
    en venta ni en seña, cada una con su objeción registrada (pedido del usuario, 09/10/2026).

    Endpoint aparte y no un bloque de `/resumen`: se pide recién al abrir el modal, y leer la
    objeción de cada agenda no tiene por qué pagarse en cada carga del dashboard.

    El alcance es el de la tarjeta: la dirección ve el equipo o la persona elegida; un closer, solo
    sus agendas, pida lo que pida (`alcance_de`). Un setter no tiene panel Cierre: 403.
    """
    if current_user.role == ROLE_SETTER:
        return jsonify({'message': 'Forbidden'}), 403
    rol, miembro_id, _ = _alcance()
    start, end, _prev_start, _prev_end = _rangos()
    filas = comercial_no_cerradas.no_cerradas(
        start, end, closer_id=miembro_id if rol == ROL_CLOSERS else None)
    return jsonify({'filas': filas, 'total': len(filas),
                    'dates': _fechas(start, end, None, None)}), 200


@bp.route('/tabla', methods=['GET'])
def tabla():
    """Revisar: las filas de una tabla y los totales de lo filtrado.

    Los totales se calculan sobre las MISMAS filas que se devuelven, no sobre otra consulta: es
    lo que garantiza que el pie de la tabla cierre con lo que se ve arriba.
    """
    rol, miembro_id, _ = _alcance()
    start, end, _prev_start, _prev_end = _rangos()
    nombre = ComercialService.nombre_de(miembro_id)
    cual = request.args.get('tabla', 'agendas')
    if cual not in TABLAS:
        cual = 'agendas'
    # La cartera se atribuye al closer que vendió, así que con rol setters se devuelve SIN acotar
    # por persona (sirve a la dirección mirando el área de setting). Para un setter eso eran los
    # clientes y las deudas de todo el equipo (encontrado el 01/10/2026): sigue prohibida.
    #
    # Las ventas sí, desde el 10/10/2026 (Revisar del setter: «que vea las ventas que se van
    # registrando con su fuente»), y acotadas a las suyas acá abajo, no en la pantalla.
    if current_user.role == ROLE_SETTER and cual == 'clientes':
        return jsonify({'message': 'Forbidden'}), 403
    # Sin `basis` explícito, cada tabla usa la fecha con la que se cuenta su número: las agendas
    # generadas por creación (ver `ComercialService.generadas`), las demás por la reunión.
    basis = request.args.get('basis')
    if basis not in ('creacion', 'meet'):
        basis = 'creacion' if cual == 'generadas' else 'meet'

    if cual == 'clientes':
        # La cartera NO se acota al periodo: es un saldo a hoy, no un flujo (ver
        # `ComercialService.clientes`). Y se atribuye por quien vendio, asi que con rol setters
        # no se acota por persona: pedirla por un setter daria una lista vacia, no la suya.
        filas = ComercialService.clientes(closer_id=miembro_id if rol == ROL_CLOSERS else None)
        totales = ComercialService.totales_clientes(filas)
    elif cual == 'ventas':
        # Con closers, las que firmó ese closer. Con setters y una persona (el setter mismo, que
        # `alcance_de` fija siempre, o la dirección eligiendo a uno), las que tienen su FUENTE: los
        # cobros de «Setting · <setter>» de la tarjeta de fuentes (ver
        # `ComercialService.de_la_fuente_del_setter`). `nombre or ''` porque un id sin usuario acota
        # a nadie, no a todos. Con setters y sin persona (la dirección, todo el equipo), sin acotar.
        # `con_fuente`: cada fila lleva la fuente de su cobro, para filtrar y agrupar por ella en
        # Revisar. Se calcula una vez por pedido; filtrar y agrupar después es del lado del cliente.
        de_un_setter = rol == ROL_SETTERS and miembro_id is not None
        # `operar=1` (10/10/2026): quien opera los registros recibe además las no completadas, el
        # estado de cada venta y si tiene agenda (`ComercialService._para_operar`). Ningún otro rol,
        # mande lo que mande; y los totales siguen contando solo las completadas (`totales_ventas`).
        para_operar = current_user.role in ROLES_QUE_OPERAN and request.args.get('operar') in ('1', 'true')
        filas = ComercialService.ventas(start, end, closer_nombre=nombre if rol == ROL_CLOSERS else None,
                                        con_fuente=True,
                                        setter_nombre=(nombre or '') if de_un_setter else None,
                                        para_operar=para_operar)
        totales = ComercialService.totales_ventas(filas)
    elif cual == 'leads':
        de_setter = rol == ROL_SETTERS
        filas = ComercialService.leads(start, end, setter_nombre=nombre if de_setter else None,
                                       setter_id=miembro_id if de_setter else None)
        totales = ComercialService.totales_leads(filas)
    elif cual == 'generadas':
        filas = ComercialService.generadas(start, end, setter_id=miembro_id, basis=basis)
        if miembro_id:
            # La palabra clave de las que ya atribuye Marketing, como las ve «Mis agendas».
            from app.services.palabra_clave_service import completar_palabra_clave
            completar_palabra_clave(filas)
        totales = ComercialService.totales_agendas(filas)
    else:
        closer_id = miembro_id if rol == ROL_CLOSERS else None
        setter_id = miembro_id if rol == ROL_SETTERS else None
        filas = ComercialService.agendas(start, end, closer_id=closer_id, setter_id=setter_id, basis=basis)
        totales = ComercialService.totales_agendas(filas)

    return jsonify({'tabla': cual, 'rol': rol, 'filas': filas, 'totales': totales,
                    'dates': _fechas(start, end, None, None)}), 200


@bp.route('/clientes/<int:client_id>', methods=['GET'])
def cliente(client_id):
    """La ficha de cobro de un cliente: en qué momento del cobro está, su plan de cuotas y sus
    pagos. Solo lectura.

    Vive acá y no en el blueprint del closer porque quien la necesita es el setter (¿en qué
    terminó el lead que agendé?) y la dirección comercial (¿en qué anda esta cartera?), y los
    endpoints del closer piden rol closer — además de ser los que escriben. Acá no se modifica
    nada, así que un rol que solo mira no necesita permisos de cobro para mirar.

    El alcance es el mismo que el de la tabla Clientes: a un closer solo se le deja abrir un
    cliente al que él le vendió (ver `ComercialService.cliente`). Un setter, desde el 10/10/2026,
    solo uno de sus leads (`leads_del_setter`): hasta ese día abría cualquier cliente del sistema,
    con sus pagos y su deuda.
    """
    if not puede_abrir(current_user, client_id=client_id):
        return jsonify({'message': 'Cliente no encontrado'}), 404
    rol, miembro_id, _ = _alcance()
    ficha = ComercialService.cliente(client_id, closer_id=miembro_id if rol == ROL_CLOSERS else None)
    if not ficha:
        return jsonify({'message': 'Cliente no encontrado'}), 404
    return jsonify(ficha), 200


@bp.route('/academia/sincronizar', methods=['POST'])
def sincronizar_academia():
    """"Actualizar datos de la Academia" en Revisar: corre UN lote de fotos, el mismo del cron.

    Solo la direccion. Cada lote gasta peticiones de un limite que la Academia comparte con
    produccion y con la ficha de todos los closers: un boton al alcance de todo el equipo, apretado
    por varios a la vez, dejaria sin Academia a la ficha. Closers y setters ven los datos igual; la
    frescura la sostiene el cron.
    """
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    from app.services import academy_snapshot_service
    return jsonify(academy_snapshot_service.sincronizar_lote()), 200


@bp.route('/agendas/<int:agenda_id>', methods=['DELETE'])
def eliminar_agenda(agenda_id):
    """Borra una agenda desde el libro de la dirección comercial.

    Existe porque el borrado del mazo (`DELETE /closer/deck/<id>`) pide rol closer y además
    exige que la agenda sea del closer que pregunta: a la dirección le responde 403, así que
    desde este tablero no había forma de borrar nada — ni siquiera las agendas de prueba que
    uno mismo crea.

    Se limita a la dirección a propósito. Podría haberse usado `_puede_corregir`, que también
    habilita al closer dueño y al setter que la generó, pero eso le daría al setter un poder de
    borrado que hoy no tiene en ninguna pantalla; corregir un estado y borrar la fila no son la
    misma responsabilidad. El closer sigue borrando por su propia ruta.
    """
    if current_user.role not in ROLES_DIRECCION:
        return jsonify({'message': 'Forbidden'}), 403

    appt = Appointment.query.get_or_404(agenda_id)
    ok, error = BookingService.eliminar_agenda(appt)
    if not ok:
        return jsonify({'error': error}), 400
    return jsonify({'message': 'Agenda eliminada'}), 200


def _puede_corregir(appt):
    """Quién puede corregir el estado de esta agenda: la dirección, el closer que la atiende y
    el setter que la generó. Nadie toca las filas de otro."""
    if current_user.role in ROLES_DIRECCION:
        return True
    if current_user.role == ROLE_CLOSER:
        return appt.closer_id == current_user.id
    if current_user.role == ROLE_SETTER:
        return appt.setter_id == current_user.id
    return False


@bp.route('/agendas/<int:agenda_id>', methods=['PATCH'])
def corregir_agenda(agenda_id):
    """Corrige el pre call o el post call de una agenda desde el modal del lead.

    Escribe en las mismas columnas que el mazo del closer (`result` / `closer_result`), no en un
    campo propio: si no, el dashboard y el mazo mostrarían dos verdades distintas de la misma
    llamada. Cada cambio deja su rastro en `lead_event_logs` con el valor anterior, que es lo que
    permite revertirlo si alguien se equivoca.
    """
    appt = db.session.get(Appointment, agenda_id)
    if not appt:
        return jsonify({'message': 'No existe esa agenda'}), 404
    if not _puede_corregir(appt):
        return jsonify({'message': 'Forbidden'}), 403

    datos = request.get_json(silent=True) or {}
    campo, valor = datos.get('campo'), datos.get('valor')

    if campo == 'pre_call' and valor in PRE_CALL_A_RESULT:
        anterior, columna, nuevo = appt.result, 'result', PRE_CALL_A_RESULT[valor]
        appt.result = nuevo
    elif campo == 'post_call' and valor in POST_CALL_A_CLOSER_RESULT:
        anterior, columna, nuevo = appt.closer_result, 'closer_result', POST_CALL_A_CLOSER_RESULT[valor]
        appt.closer_result = nuevo
        # Darle un resultado a la llamada es reportarla: sin esto, la agenda seguiria apareciendo
        # en el mazo del closer como pendiente de reportar.
        appt.closer_processed = valor != 'pendiente'
    else:
        return jsonify({'message': 'Campo o valor no admitido'}), 400

    db.session.commit()
    BookingService.log_lead_event(
        appt.id, current_user.id, 'status_changed',
        '{} corrigió {} desde el dashboard comercial: {!r} -> {!r}.'.format(
            current_user.username, columna, anterior, nuevo))

    return jsonify({'id': appt.id, 'campo': campo, 'valor': valor, 'anterior': anterior}), 200


@bp.route('/agendas/<int:agenda_id>/duplicada', methods=['POST'])
def marcar_duplicada_agenda(agenda_id):
    """Cancela una agenda por ser una copia de otra, desde el modal del lead.

    La accion existia solo en la pestana "Agendas" de Mi cartera del closer, que el dashboard
    comercial reemplazo; se movio aca para no perderla. Las dos guardas que la hacen segura
    (solo la copia todavia SIN resultado, y solo si hay otra cita del mismo cliente a menos de
    seis horas) y el rastro de auditoria viven en el servicio, compartidos con la ruta del mazo.

    Usa `_puede_corregir`, el mismo permiso que corregir un estado: la direccion sobre cualquier
    agenda y el closer solo sobre las suyas. La ruta del mazo no servia para esto — pide rol
    closer o admin, asi que al director comercial le respondia 403.
    """
    from app.services.closer_agendas_service import marcar_duplicada

    appt = db.session.get(Appointment, agenda_id)
    if not appt:
        return jsonify({'message': 'No existe esa agenda'}), 404
    if not _puede_corregir(appt):
        return jsonify({'message': 'Forbidden'}), 403

    ok, mensaje, conservada = marcar_duplicada(appt)
    if not ok:
        return jsonify({'message': mensaje}), 400

    BookingService.log_lead_event(
        appt.id, current_user.id, 'status_changed',
        '{} marco la agenda como duplicada desde el dashboard comercial: se conserva la #{}.'.format(
            current_user.username, conservada))
    return jsonify({'id': appt.id, 'conservada': conservada, 'message': mensaje}), 200


# --- Reportar: el reporte diario de la direccion comercial ------------------------------------
# Solo la direccion. Para un closer o un setter la seccion ni siquiera aparece en el dock, pero
# el permiso se comprueba igual acá: esconder el boton no es proteger la ruta.

def _solo_direccion():
    return current_user.role in ROLES_DIRECCION


def _puede_comparar():
    """Quién ve Analizar → Comparativas (ver `comparativas`): la dirección, los closers (desde el
    02/10/2026) y los setters (desde el 10/10/2026), cada uno la de su rol."""
    return current_user.role in ROLES_DIRECCION + (ROLE_CLOSER, ROLE_SETTER)


@bp.route('/reporte/hoy', methods=['GET'])
def reporte_hoy():
    """Paso 1 del wizard: los números del día y el estado de reporte de cada persona."""
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    fecha = ComercialService.fecha_o_hoy(request.args.get('fecha'))
    return jsonify(reporte.dia_del_equipo(fecha)), 200


@bp.route('/reporte/constancia', methods=['GET'])
def reporte_constancia():
    """Constancia de carga: una fila por persona y una celda por día de los últimos N."""
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    fecha = ComercialService.fecha_o_hoy(request.args.get('fecha'))
    try:
        dias = int(request.args.get('dias') or 14)
    except (TypeError, ValueError):
        dias = 14
    return jsonify(reporte.constancia(fecha, dias)), 200


@bp.route('/reporte', methods=['POST'])
def guardar_reporte():
    """Guarda el reporte del día. Volver a guardar el mismo día lo actualiza."""
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    datos = request.get_json(silent=True) or {}
    fecha = ComercialService.fecha_o_hoy(datos.get('fecha'))
    guardado = reporte.guardar(current_user, datos, fecha)
    return jsonify(guardado.to_dict()), 200


@bp.route('/reportes', methods=['GET'])
def reportes():
    """Historial: todos los días, o el registro de trabajo de una persona."""
    if not _solo_direccion():
        return jsonify({'message': 'Forbidden'}), 403
    miembro_id = request.args.get('miembro_id')
    try:
        miembro_id = int(miembro_id) if miembro_id else None
    except (TypeError, ValueError):
        miembro_id = None
    return jsonify(reporte.historial(miembro_id)), 200


from app.api import comercial_agendas_lote  # noqa: E402,F401  (Editar en lote desde Revisar, 10/10/2026)
