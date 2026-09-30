"""La foto de la Academia de cada cliente: como se guarda, como se renueva y como la lee la tabla.

Por que una foto y no una consulta en vivo lo explica `app/models/academy_snapshot.py`: no hay
endpoint masivo y el limite de 60 peticiones por minuto se comparte con produccion y con la ficha.

## De donde salen las fotos

  1. **De oportunidad.** La pestana Fulfillment de la ficha (`GET /api/ficha/<appt>/fulfillment`)
     ya paga las peticiones para mostrar al alumno; lo que trae se guarda con
     `guardar_desde_fulfillment`, sin tocar lo que esa ruta devuelve.
  2. **Por lotes.** `sincronizar_lote` recorre los clientes con venta del mas desactualizado al mas
     fresco, con un presupuesto de peticiones por corrida y un tope de tiempo. Lo disparan un cron
     (`GET /api/academia/cron/sincronizar`, con `CRON_SECRET`) y el boton "Actualizar datos de la
     Academia" de Revisar, que es solo de la direccion.

Nada de esto corre solo: ni al crear la app ni en los tests.

## Cuanto cuesta un cliente

  · Con el id del alumno ya sabido: 1 peticion (`/users/{id}/summary`). El id sale de
    `Client.learnation_user_id` o, si no, de la foto anterior mientras el correo con el que se lo
    encontro siga siendo de este cliente.
  · Sin el id: una peticion por correo probado hasta encontrarlo (tope `MAX_EMAILS` de la ficha)
    mas el `/summary`. La busqueda es la MISMA de la ficha (`_resolver_alumno`), importada.
  · Sin ningun correo real: 0 peticiones; se anota `sin_correo`.

Un cliente sin cuenta en la Academia (`sin_acceso`) es el mas caro de confirmar —prueba todos sus
correos— y el que menos cambia: se vuelve a mirar cada `DIAS_RECHEQUEO_SIN_ACCESO` dias, salvo
que mientras tanto le hayan dado el acceso desde NeurOPS (su `learnation_user_id` cambia).

## Cuando se guarda el id en el cliente

`Client.learnation_user_id` hace que la ficha y el lote se salteen la busqueda por correo para
siempre, asi que se escribe solo cuando el cruce es confiable (`_vinculo_confiable`): se lo encontro
con el correo del propio cliente, o el telefono de la Academia coincide con el nuestro. Un alumno
encontrado con el correo de una venta sin nada que lo corrobore queda solo en la foto: la ficha lo
sigue buscando por correo, y si alguien corrige el dato mal cargado, el cruce se corrige solo en vez
de quedar pegado a la cuenta equivocada (no hay pantalla para desvincularlo).

## "Activo" sin una fecha de ultima actividad

La Academia no informa cuando estudio el alumno por ultima vez: solo contadores acumulados y la
racha. La actividad se deduce al sacar cada foto:

  · racha > 0 -> estudio hoy o ayer: actividad vista AHORA;
  · subio alguno de `CONTADORES_DE_ACTIVIDAD` respecto de la foto anterior -> hubo actividad en
    algun momento entre las dos. Se anota la fecha de la foto ANTERIOR, que es la cota segura: con
    la de ahora, alguien que entrego algo hace tres semanas y al que no se miro desde entonces
    apareceria como activo.

La precision es la de la sincronizacion: con el cron andando, cada cliente se mira cada pocas horas.

## Estados de la tabla (`ESTADO_ACADEMIA`)

  · Activo: se vio actividad en los ultimos `DIAS_ACTIVO` (7) dias.
  · Inactivo: tiene cuenta y datos, pero no se vio actividad en esos 7 dias.
  · Sin acceso: ninguno de sus correos tiene cuenta en la Academia.
  · Sin correo real: no hay con que buscarlo (solo el correo inventado de NeurOPS).
  · Sin datos todavia: nunca se lo pudo mirar (todavia no le toco, o la Academia dio error).
"""
import logging
import os
import time
from datetime import datetime, timedelta

from sqlalchemy.exc import IntegrityError

from app import db
from app.models import AcademySnapshot, Client
from app.services.ficha_fulfillment_service import (
    _error,
    _resolver_alumno,
    _telefonos_coinciden,
    emails_candidatos,
    es_placeholder,
)
from app.services.learnation_service import LearnationAPIError, LearnationService

logger = logging.getLogger(__name__)

# Dias hacia atras que cuentan como "activo". Una semana es el ritmo con el que el programa espera
# que el alumno entregue algo; menos marcaria como inactivo a quien estudia los fines de semana.
DIAS_ACTIVO = 7
# Cada cuanto se vuelve a confirmar que alguien sigue sin cuenta (ver el docstring).
DIAS_RECHEQUEO_SIN_ACCESO = 7

# Peticiones por corrida. 20 es un tercio del limite de un minuto: aunque el lote las gaste todas
# de golpe, a la ficha y a produccion les quedan 40. El tope de tiempo existe porque la app corre
# con un solo worker de gunicorn (`--timeout 120`): mientras el lote espera a la Academia, nadie
# mas es atendido.
PRESUPUESTO_POR_LOTE = 20
PRESUPUESTO_MAXIMO = 40
TOPE_SEGUNDOS = 25

# Errores que no mejoran con el cliente siguiente: token invalido, limite agotado, red caida
# (codigo None). Con estos el lote se corta; con un 404 o un 500 de UN alumno, sigue.
CORTAN_EL_LOTE = (401, 429, None)

# columna de `AcademySnapshot` -> clave de `performance` en `/users/{id}/summary`. Verificado
# contra la API real el 30/09/2026 (una sola GET, sin datos personales).
METRICAS = {
    'horas_estudio': 'total_study_hours',
    'progreso': 'progress_percentage',
    'lecciones_completadas': 'completed_lessons',
    'lecciones_totales': 'total_lessons',
    'vistas_lecciones': 'lesson_views',
    'ejecuciones': 'submitted_executions',
    'racha_dias': 'streak_days',
    'pomodoros': 'pomodoro_sessions',
    'aprobacion': 'approval_rate',
    'sesiones_grupales': 'group_sessions_attended',
    'sesiones_individuales': 'individual_sessions_attended',
    'tickets_abiertos': 'open_support_tickets',
}
_DECIMALES = {'horas_estudio', 'progreso', 'aprobacion'}

# Los contadores que solo suben cuando el alumno HACE algo. Fuera quedan la tasa de aprobacion
# (puede bajar), los tickets (suben y bajan) y el total de lecciones (cambia si cambia el programa).
CONTADORES_DE_ACTIVIDAD = ('horas_estudio', 'pomodoros', 'lecciones_completadas', 'vistas_lecciones',
                           'ejecuciones', 'sesiones_grupales', 'sesiones_individuales', 'progreso')

# `tone` es uno de los 5 estados del design system: el frontend no elige colores, los toma de aca.
ESTADO_ACADEMIA = [
    {'key': 'activo', 'label': 'Activo', 'tone': 'success'},
    {'key': 'inactivo', 'label': 'Inactivo', 'tone': 'warning'},
    {'key': 'sin_acceso', 'label': 'Sin acceso', 'tone': 'error'},
    # Cortos a proposito: es el chip de una columna angosta de Revisar, y el mas comun. Lo que
    # significa cada uno esta en la ayuda de la columna (`AYUDA_ACADEMIA.actividad`).
    {'key': 'sin_correo', 'label': 'Sin correo', 'tone': 'idle'},
    {'key': 'sin_datos', 'label': 'Sin datos', 'tone': 'idle'},
]
_CHIPS = {e['key']: e for e in ESTADO_ACADEMIA}

_LOTE_SQL = 500  # ids por IN: lejos del limite de variables de SQLite y de lo que pesa en Postgres


# --- Lectura: lo que ve la tabla ----------------------------------------------------------------

def _en_tandas(ids):
    unicos = sorted({i for i in ids if i})
    for i in range(0, len(unicos), _LOTE_SQL):
        yield unicos[i:i + _LOTE_SQL]


def fotos_de(client_ids):
    """{client_id -> AcademySnapshot} en una consulta (por tanda de 500), sin el JSON crudo."""
    fotos = {}
    for tanda in _en_tandas(client_ids):
        for foto in AcademySnapshot.query.filter(AcademySnapshot.client_id.in_(tanda)).all():
            fotos[foto.client_id] = foto
    return fotos


def estado_de(foto, ahora=None):
    """La clave de `ESTADO_ACADEMIA` de esta foto (ver el docstring del modulo)."""
    ahora = ahora or datetime.utcnow()
    if foto is None:
        return 'sin_datos'
    if foto.resultado == AcademySnapshot.SIN_ACCESO:
        return 'sin_acceso'
    if foto.resultado == AcademySnapshot.SIN_CORREO:
        return 'sin_correo'
    if foto.synced_at is None:
        return 'sin_datos'
    if foto.actividad_vista_at and foto.actividad_vista_at >= ahora - timedelta(days=DIAS_ACTIVO):
        return 'activo'
    return 'inactivo'


def _iso(momento):
    # Las fechas se guardan en UTC sin zona; con la Z el navegador las lee como UTC y el "hace 3 h"
    # no sale corrido por el huso del que mira.
    return f'{momento.isoformat()}Z' if momento else None


def _suma(*valores):
    presentes = [v for v in valores if v is not None]
    return sum(presentes) if presentes else None


def bloque_de(foto, ahora=None):
    """Lo que viaja en `fila['academia']`: el chip del estado, las metricas y la frescura.

    Las metricas van en None cuando la foto no las tiene o cuando ya no son de este cliente: un
    "Sin acceso" que conserva los numeros de una cuenta que se encontro antes con otro correo
    mostraria horas de estudio de una cuenta que ya no es la suya.
    """
    estado = estado_de(foto, ahora)
    con_datos = (foto is not None and foto.synced_at is not None
                 and foto.resultado in (AcademySnapshot.VINCULADO, AcademySnapshot.ERROR))

    def dato(columna):
        return getattr(foto, columna) if con_datos else None

    return {
        'estado': dict(_CHIPS[estado]),
        'horas': dato('horas_estudio'),
        'progreso': dato('progreso'),
        'lecciones': dato('lecciones_completadas'),
        'lecciones_total': dato('lecciones_totales'),
        'ejecuciones': dato('ejecuciones'),
        'racha': dato('racha_dias'),
        'aprobacion': dato('aprobacion'),
        'pomodoros': dato('pomodoros'),
        'sesiones': _suma(dato('sesiones_grupales'), dato('sesiones_individuales')),
        'tickets': dato('tickets_abiertos'),
        'producto': dato('producto_activo'),
        'ultima_actividad': _iso(foto.actividad_vista_at) if con_datos else None,
        'sincronizado': _iso(foto.synced_at) if con_datos else None,
        'intentado': _iso(foto.intentado_at) if foto else None,
        'error': foto.error if foto is not None and foto.resultado == AcademySnapshot.ERROR else None,
    }


def bloques_por_cliente(client_ids, ahora=None):
    """{client_id -> bloque} para las filas de una tabla. UNA lectura, sin importar cuantas filas."""
    ahora = ahora or datetime.utcnow()
    fotos = fotos_de(client_ids)
    return {cid: bloque_de(fotos.get(cid), ahora) for cid in {i for i in client_ids if i}}


# --- Escritura: como se guarda una foto ----------------------------------------------------------

def _numero(columna, crudo):
    if isinstance(crudo, bool) or crudo is None or crudo == '':
        return None
    try:
        valor = float(crudo)
    except (TypeError, ValueError):
        return None
    return round(valor, 2) if columna in _DECIMALES else int(round(valor))


def _vinculo_confiable(cliente, email, telefono_academia):
    """¿Se puede escribir este alumno en `Client.learnation_user_id`? Ver el docstring del modulo."""
    propio = (getattr(cliente, 'email', None) or '').strip().lower()
    if email and propio and not es_placeholder(propio) and email.strip().lower() == propio:
        return True
    return _telefonos_coinciden(getattr(cliente, 'phone', None), telefono_academia) is True


def _foto_de(client_id, fotos=None):
    """La foto del cliente, o una nueva ya agregada a la sesion."""
    foto = (fotos or {}).get(client_id) or AcademySnapshot.query.filter_by(client_id=client_id).first()
    if foto is None:
        foto = AcademySnapshot(client_id=client_id)
        db.session.add(foto)
    return foto


def _registrar_datos(cliente, foto, alumno_id, performance, producto, email, telefono_academia, ahora):
    """Una foto que salio bien: metricas nuevas, actividad deducida y, si corresponde, el id."""
    performance = performance if isinstance(performance, dict) else {}
    nuevo = {columna: _numero(columna, performance.get(clave)) for columna, clave in METRICAS.items()}

    se_movio = foto.synced_at is not None and any(
        nuevo[c] is not None and getattr(foto, c) is not None and nuevo[c] > getattr(foto, c)
        for c in CONTADORES_DE_ACTIVIDAD)
    vista = ahora if (nuevo['racha_dias'] or 0) > 0 else (foto.synced_at if se_movio else None)
    if vista and (foto.actividad_vista_at is None or vista > foto.actividad_vista_at):
        foto.actividad_vista_at = vista

    for columna, valor in nuevo.items():
        setattr(foto, columna, valor)
    nombre_producto = producto.get('name') if isinstance(producto, dict) else producto
    foto.producto_activo = str(nombre_producto)[:150] if nombre_producto else None
    foto.datos = {'performance': performance, 'producto_activo': producto}
    foto.learnation_user_id = alumno_id
    if email:
        foto.email_usado = email[:120]
    foto.resultado = AcademySnapshot.VINCULADO
    foto.error_codigo = None
    foto.error = None
    foto.synced_at = ahora
    foto.intentado_at = ahora

    if alumno_id and not cliente.learnation_user_id and _vinculo_confiable(cliente, email, telefono_academia):
        cliente.learnation_user_id = alumno_id


def _registrar_sin_acceso(foto, ahora):
    foto.resultado = AcademySnapshot.SIN_ACCESO
    foto.learnation_user_id = None
    foto.email_usado = None
    foto.error_codigo = None
    foto.error = None
    foto.intentado_at = ahora


def _registrar_sin_correo(foto, ahora):
    foto.resultado = AcademySnapshot.SIN_CORREO
    foto.error_codigo = None
    foto.error = None
    foto.intentado_at = ahora


def _registrar_error(foto, error, ahora):
    """Las metricas de antes se quedan: una foto vieja con su fecha dice mas que ninguna."""
    foto.resultado = AcademySnapshot.ERROR
    foto.error_codigo = (error or {}).get('codigo')
    foto.error = ((error or {}).get('motivo') or 'La Academia no respondió.')[:255]
    foto.intentado_at = ahora


def guardar_desde_fulfillment(client, datos, ahora=None):
    """Guarda como foto lo que ya devolvio `ficha_fulfillment_service.fulfillment()`.

    No hace ninguna peticion y nunca levanta: si algo sale mal se registra y la ficha sigue igual.
    Lee solo las claves que ese payload garantiza (`vinculado`, `alumno`, `desempeno`,
    `emails_probados`, `email_usado`, `error`).
    """
    if client is None or not getattr(client, 'id', None) or not isinstance(datos, dict):
        return None
    ahora = ahora or datetime.utcnow()
    try:
        foto = _foto_de(client.id)
        if datos.get('vinculado'):
            alumno = datos.get('alumno') or {}
            _registrar_datos(client, foto, alumno.get('id') or client.learnation_user_id,
                             datos.get('desempeno'), alumno.get('producto_activo'),
                             datos.get('email_usado'), alumno.get('telefono'), ahora)
        elif datos.get('error'):
            _registrar_error(foto, datos['error'], ahora)
        elif datos.get('emails_probados') or client.learnation_user_id:
            _registrar_sin_acceso(foto, ahora)
        else:
            _registrar_sin_correo(foto, ahora)
        db.session.commit()
        return foto
    except Exception:  # la foto es un extra: nunca le rompe la pestana al closer
        db.session.rollback()
        logger.exception('[ACADEMIA] No se pudo guardar la foto del cliente %s', client.id)
        return None


# --- El lote -------------------------------------------------------------------------------------

def _id_de_la_foto(foto, candidatos):
    """El id de la foto anterior, mientras el correo con el que se lo encontro siga siendo suyo."""
    if foto and foto.learnation_user_id and foto.email_usado and foto.email_usado in candidatos:
        return foto.learnation_user_id
    return None


def cola_de_sincronizacion(ids, clientes, fotos, ahora):
    """En que orden se miran los clientes: los que nunca se miraron y los que recien recibieron el
    acceso primero (los mas nuevos antes), despues el resto del intento mas viejo al mas reciente.

    Se ordena por el ultimo INTENTO y no por la ultima foto buena: un cliente que da error va al
    final de la cola como cualquiera, en vez de quedarse primero y gastar el presupuesto de cada
    corrida en el mismo error.
    """
    primero, despues = [], []
    limite_sin_acceso = ahora - timedelta(days=DIAS_RECHEQUEO_SIN_ACCESO)
    for cid in ids:
        cliente = clientes.get(cid)
        if cliente is None:
            continue
        foto = fotos.get(cid)
        if foto is None or foto.intentado_at is None:
            primero.append(cid)
            continue
        if cliente.learnation_user_id and cliente.learnation_user_id != foto.learnation_user_id:
            primero.append(cid)
            continue
        if foto.resultado == AcademySnapshot.SIN_ACCESO and foto.intentado_at > limite_sin_acceso:
            continue
        despues.append((foto.intentado_at, cid))
    return sorted(primero, reverse=True) + [cid for _, cid in sorted(despues)]


def _sincronizar_uno(cliente, ventas, foto, candidatos, conocido, ahora):
    """(peticiones gastadas, error o None) de mirar UN cliente. Deja la foto lista para commit.

    Las gastadas en la busqueda por correo se cuentan por lo alto cuando hay error: `_resolver_alumno`
    no dice en que correo corto, y contar de mas solo achica el lote, nunca pasa el presupuesto.
    """
    email, gastadas = None, 0
    if conocido:
        alumno_id = conocido
        if conocido == foto.learnation_user_id:
            email = foto.email_usado
    elif not candidatos:
        _registrar_sin_correo(foto, ahora)
        return 0, None
    else:
        alumno_id, email, probados, error = _resolver_alumno(cliente, ventas)
        gastadas = probados.index(email) + 1 if email in probados else len(probados)
        if error:
            _registrar_error(foto, error, ahora)
            return gastadas, error
        if not alumno_id:
            _registrar_sin_acceso(foto, ahora)
            return gastadas, None

    try:
        resumen = LearnationService.get_student_summary(alumno_id) or {}
    except LearnationAPIError as e:
        error = _error(e)
        if e.status_code == 404 and not cliente.learnation_user_id:
            # El id de la foto ya no existe en la Academia: la proxima vez se busca por correo.
            foto.learnation_user_id = None
            foto.email_usado = None
        _registrar_error(foto, error, ahora)
        return gastadas + 1, error

    alumno = resumen.get('student') or {}
    _registrar_datos(cliente, foto, alumno.get('id') or alumno_id, resumen.get('performance'),
                     alumno.get('active_product'), email, alumno.get('phone'), ahora)
    return gastadas + 1, None


def _acotar(presupuesto):
    try:
        valor = int(presupuesto) if presupuesto is not None else PRESUPUESTO_POR_LOTE
    except (TypeError, ValueError):
        valor = PRESUPUESTO_POR_LOTE
    return max(1, min(valor, PRESUPUESTO_MAXIMO))


def _mensaje(resumen):
    corte = resumen['corte']
    if corte == 'sin_token':
        return 'Falta configurar ACADEMY_API_TOKEN: no se consultó la Academia.'
    if corte == '401':
        return ('La Academia rechazó el token (401). Avisale a un admin: reintentar no lo arregla. '
                f'Se alcanzaron a actualizar {resumen["procesados"]} clientes.')
    if corte == '429':
        return ('La Academia pidió frenar: demasiadas consultas por minuto. Se guardó lo que alcanzó '
                f'({resumen["procesados"]} clientes); el próximo lote sigue desde ahí.')
    if corte == 'red':
        return ('La Academia no respondió. Se guardó lo que alcanzó '
                f'({resumen["procesados"]} clientes).')
    base = (f'Se actualizaron {resumen["procesados"]} clientes con {resumen["peticiones"]} '
            'consultas a la Academia.')
    if resumen['sin_datos']:
        return f'{base} Quedan {resumen["sin_datos"]} sin datos todavía.'
    return f'{base} Todos los clientes con venta ya tienen datos.'


def sincronizar_lote(presupuesto=None, tope_segundos=TOPE_SEGUNDOS, ahora=None, reloj=time.monotonic):
    """Mira los clientes con venta mas desactualizados sin pasarse de `presupuesto` peticiones.

    Antes de cada cliente se reserva lo MAXIMO que podria costar (ver `_sincronizar_uno`); si no
    entra, la corrida termina ahi y ese cliente queda primero para la proxima. Cada cliente se
    guarda con su propio commit: si el proceso muere a mitad de camino, lo ya mirado queda.
    Devuelve un resumen con `mensaje` listo para mostrar.
    """
    from app.services.closer_followup_service import CloserFollowUpService

    presupuesto = _acotar(presupuesto)
    ahora = ahora or datetime.utcnow()
    resumen = {'presupuesto': presupuesto, 'peticiones': 0, 'procesados': 0, 'vinculados': 0,
               'sin_acceso': 0, 'sin_correo': 0, 'errores': 0, 'corte': None, 'clientes': 0,
               'sin_datos': 0}
    if not os.environ.get('ACADEMY_API_TOKEN'):
        resumen['corte'] = 'sin_token'
        resumen['mensaje'] = _mensaje(resumen)
        return resumen

    ventas_por_cliente = CloserFollowUpService._resolve_sales_and_clients()
    ids = list(ventas_por_cliente)
    clientes = {}
    for tanda in _en_tandas(ids):
        clientes.update({c.id: c for c in Client.query.filter(Client.id.in_(tanda)).all()})
    fotos = fotos_de(ids)
    cola = cola_de_sincronizacion(ids, clientes, fotos, ahora)

    usadas, inicio = 0, reloj()
    for cid in cola:
        if reloj() - inicio >= tope_segundos:
            resumen['corte'] = 'tiempo'
            break
        cliente, ventas = clientes[cid], ventas_por_cliente.get(cid) or []
        candidatos = emails_candidatos(cliente, ventas)
        conocido = cliente.learnation_user_id or _id_de_la_foto(fotos.get(cid), candidatos)
        costo_maximo = 1 if conocido else (len(candidatos) + 1 if candidatos else 0)
        if costo_maximo > presupuesto - usadas:
            resumen['corte'] = 'presupuesto'
            break

        foto = _foto_de(cid, fotos)
        try:
            gastadas, error = _sincronizar_uno(cliente, ventas, foto, candidatos, conocido, ahora)
        except Exception:  # una respuesta con otra forma, de UN alumno, no deja sin datos al resto
            logger.exception('[ACADEMIA] Respuesta inesperada al mirar al cliente %s', cid)
            gastadas, error = costo_maximo, None
            _registrar_error(foto, {'codigo': None,
                                    'motivo': 'La Academia respondió algo que no se pudo leer.'}, ahora)
        usadas += gastadas
        try:
            db.session.commit()
        except IntegrityError:
            # Otra corrida (el cron y el boton a la vez) o la ficha crearon la foto de este cliente
            # en el medio. La suya vale igual: se sigue con el proximo.
            db.session.rollback()
            continue
        fotos[cid] = foto
        resumen['procesados'] += 1
        clave = {AcademySnapshot.VINCULADO: 'vinculados', AcademySnapshot.SIN_ACCESO: 'sin_acceso',
                 AcademySnapshot.SIN_CORREO: 'sin_correo'}.get(foto.resultado, 'errores')
        resumen[clave] += 1
        if error and error.get('codigo') in CORTAN_EL_LOTE:
            resumen['corte'] = str(error.get('codigo') or 'red')
            break

    resumen['peticiones'] = usadas
    resumen['clientes'] = len(ids)
    resumen['sin_datos'] = sum(1 for cid in ids if cid not in fotos)
    resumen['mensaje'] = _mensaje(resumen)
    logger.info('[ACADEMIA] Lote: %s', {k: v for k, v in resumen.items() if k != 'mensaje'})
    return resumen
