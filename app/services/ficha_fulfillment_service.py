"""La pestana Fulfillment de la ficha: como le esta yendo al alumno dentro de la Academia.

Hasta ahora el closer solo podia DARLE el acceso a la Academia desde NeurOPS (`AcademyAccessService`)
y despues quedaba ciego: para saber si el alumno entro, cuanto avanzo o cuando se le vence el
producto habia que abrir la otra plataforma. Esta seccion trae eso a la ficha, leyendo los endpoints
de consulta que la Academia ya expone (`docs/integracion_learnation_api.md` §2.2, §2.5 y §2.6).

## Vive fuera de `GET /api/ficha/lead`, a proposito

Es una llamada HTTP a OTRO sistema, con su timeout de 15s y su limite de 60 peticiones por minuto.
Meterla en la lectura de la ficha haria que abrir cualquier lead —incluido uno que nunca compro—
dependiera de que la Academia este arriba. Tiene su propia ruta y la pestana la pide cuando se
abre; si falla, falla la pestana y no el modal.

## El cruce es por EMAIL, y solo por email

Comprobado contra la API real (28/09/2026): `GET /users/check` acepta `email` y nada mas —con
`phone` responde `422 {"errors":{"email":["The email field is required."]}}`— y no existe ningun
endpoint de busqueda (`GET /users` responde 404). El telefono NO se puede usar para encontrar al
alumno; lo unico que se puede hacer con el es comparar el que tiene la Academia contra el nuestro
y avisar si no coinciden, que para fulfillment es justo lo que hay que mirar.

De ahi el orden de intentos:

  1. `Client.learnation_user_id`, cuando el alta ya se hizo desde NeurOPS: es el id exacto, sin
     adivinar y sin gastar una peticion en buscarlo.
  2. los emails que conocemos de este cliente, en orden: el de `Client` y despues los
     `mail_cliente` de sus ventas. No es lo mismo: `Client.email` puede ser el placeholder
     sintetico que arma `BookingService` (`no-email-<hex>@neurops.com`) cuando el lead entro sin
     correo, mientras que el que el closer tipeo al declarar la venta suele ser el real — y es ese
     el que el alumno usa para entrar a la Academia. Los placeholders se descartan: preguntar por
     uno es gastar una peticion en un `exists: false` garantizado.

## Nada de esto levanta una excepcion hacia arriba

Un token revocado, la Academia caida o un rate limit no son motivo para romperle la ficha al
closer: vuelven en `error` con el texto que corresponde y la pestana lo muestra. Es la reaccion que
pide la tabla de errores de la doc (§2: un 401 se avisa, no se reintenta en loop).
"""
from app.services.learnation_service import LearnationAPIError, LearnationService

# `BookingService` inventa un correo cuando el lead llego sin ninguno. No identifica a nadie en la
# Academia, asi que no se pregunta por el. Las dos formas existen en la base.
_PLACEHOLDERS = ('no-email-', 'no_email_')

# Cuantos emails se prueban como maximo. El limite de la Academia es 60 peticiones por minuto y
# varios closers pueden tener la ficha abierta a la vez: un cliente con doce ventas no puede
# gastar doce peticiones para descubrir que ninguna tiene su correo.
MAX_EMAILS = 4

# Que hacer con cada error de la Academia, en el idioma del closer. Las causas salen de la tabla
# de codigos de `docs/integracion_learnation_api.md` §2.
_MOTIVOS = {
    401: 'El token de la Academia no es válido o fue revocado. Avisale a un admin: no es algo '
         'que se arregle reintentando.',
    403: 'La Academia no deja consultar esta cuenta porque es de staff, no de un alumno. '
         'Probablemente el correo esté mal cargado.',
    404: 'La Academia no encuentra a este alumno.',
    429: 'La Academia recibió demasiadas consultas por minuto. Probá de nuevo en un rato.',
}


def es_placeholder(email):
    """¿Este correo lo invento NeurOPS porque el lead llego sin ninguno?"""
    limpio = (email or '').strip().lower()
    return not limpio or any(p in limpio for p in _PLACEHOLDERS)


def emails_candidatos(client, ventas=None):
    """Los correos con los que vale la pena preguntarle a la Academia, sin repetidos.

    Primero el del cliente y despues los de sus ventas, que es el orden de confianza: el de la
    venta lo tipeo un humano para cobrarle, el del cliente puede venir de una agenda automatica.
    """
    crudos = [getattr(client, 'email', None)]
    crudos += [v.mail_cliente for v in (ventas or [])]

    vistos, salida = set(), []
    for crudo in crudos:
        limpio = (crudo or '').strip().lower()
        if not limpio or limpio in vistos or es_placeholder(limpio):
            continue
        vistos.add(limpio)
        salida.append(limpio)
    return salida[:MAX_EMAILS]


def _error(e):
    """El error de la Academia traducido, con su codigo para que el frontend pueda distinguirlos."""
    return {'codigo': e.status_code,
            'motivo': _MOTIVOS.get(e.status_code) or str(e) or 'La Academia no respondió.'}


def _telefonos_coinciden(nuestro, suyo):
    """Los ultimos 8 digitos, que es el criterio con el que el resto del sistema compara telefonos.

    None cuando falta alguno de los dos: "no sabemos" no es "no coinciden", y pintar una alerta
    sobre un dato que no tenemos manda al closer a arreglar algo que no esta roto.
    """
    a = ''.join(c for c in str(nuestro or '') if c.isdigit())
    b = ''.join(c for c in str(suyo or '') if c.isdigit())
    if len(a) < 8 or len(b) < 8:
        return None
    return a[-8:] == b[-8:]


def _resolver_alumno(client, ventas):
    """(learnation_user_id, email_con_el_que_se_encontro, emails_probados, error).

    `learnation_user_id` es None cuando el alumno no existe en la Academia, que NO es un error:
    es el caso normal de un cliente al que todavia nadie le dio el acceso.
    """
    guardado = getattr(client, 'learnation_user_id', None)
    if guardado:
        return guardado, None, [], None

    probados = emails_candidatos(client, ventas)
    for email in probados:
        try:
            respuesta = LearnationService.check_user(email) or {}
        except LearnationAPIError as e:
            # Un 401 o un 429 no mejoran probando el email siguiente: se corta acá.
            return None, None, probados, _error(e)
        if respuesta.get('exists') and (respuesta.get('user') or {}).get('id'):
            return respuesta['user']['id'], email, probados, None
    return None, None, probados, None


def fulfillment(client, ventas=None):
    """El bloque completo de la pestana Fulfillment. Nunca levanta: los errores viajan dentro.

    `vinculado` es la pregunta que la pestana contesta primero —¿este cliente existe como alumno?—
    y separa los tres casos que el closer tiene que poder distinguir de un vistazo: no existe
    (hay que darle el acceso), existe y se le ve el progreso, o no se pudo averiguar.
    """
    vacio = {'vinculado': False, 'alumno': None, 'desempeno': None, 'productos': [],
             'email_usado': None, 'emails_probados': [], 'telefono_coincide': None, 'error': None}

    if not client:
        return {**vacio, 'error': {'codigo': None,
                                  'motivo': 'Este lead todavía no es un cliente: no hay alumno que buscar.'}}

    alumno_id, email, probados, error = _resolver_alumno(client, ventas)
    if error or not alumno_id:
        return {**vacio, 'emails_probados': probados, 'error': error}

    try:
        resumen = LearnationService.get_student_summary(alumno_id) or {}
        productos = (LearnationService.get_student_products(alumno_id) or {}).get('products') or []
    except LearnationAPIError as e:
        return {**vacio, 'emails_probados': probados, 'email_usado': email, 'error': _error(e)}

    alumno = resumen.get('student') or {}
    return {
        'vinculado': True,
        'alumno': {
            'id': alumno.get('id') or alumno_id,
            'nombre': alumno.get('name'),
            'email': alumno.get('email'),
            'telefono': alumno.get('phone'),
            'rol': alumno.get('role'),
            'producto_activo': alumno.get('active_product'),
        },
        'desempeno': resumen.get('performance') or None,
        # Los productos vienen ordenados por la Academia con el activo primero; se respeta.
        'productos': productos,
        'email_usado': email,
        'emails_probados': probados,
        'telefono_coincide': _telefonos_coinciden(getattr(client, 'phone', None), alumno.get('phone')),
        'error': None,
    }
