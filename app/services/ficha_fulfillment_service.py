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

## El producto que se muestra es el que PAGO, no el que la Academia tenga primero

La Academia le asigna a todo alumno nuevo su producto gratuito de bienvenida (`learnation-course`
viene con `is_default_on_registration: true` en `GET /products`), y un alumno puede tener otros
accesos que alguien le dio a mano. La pestana listaba todo junto y el closer leia como "lo que
compro" un producto que no pago. Ademas los tres productos pagos traen el mismo `program_name`
("Bootcamp", el programa INTERNO de la Academia), asi que ese rotulo tampoco servia para
distinguirlos (comprobado contra la API real el 30/09/2026).

La fuente de verdad es la misma que usa la pestana Acciones para su campo Programa:
`CloserFollowUpService._client_program_code` (el prefijo AL/RR/SI de la ultima venta del cliente).
Ese codigo se traduce al `product_slug` de la Academia con el mapeo que un admin configura
(`AcademyAccessService.get_product_mapping`, el mismo que usa el alta), y con ese slug se separa el
producto pagado del resto (`resolver_producto`, pura). Lo que no se puede resolver —sin programa en
NeurOPS, programa sin vincular, o la Academia sin ese producto— viaja en `aviso_producto`.
"""
from datetime import datetime, timezone

from app.services.closer_followup_service import PROGRAM_CODE_NAMES, CloserFollowUpService
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


# --- El producto que pago ----------------------------------------------------------------------

def _aviso(codigo, motivo):
    return {'codigo': codigo, 'motivo': motivo}


def _el_mas_vigente(candidatos):
    """De varias asignaciones del MISMO producto (una vieja archivada y la renovacion, p. ej.), la
    que hoy le da acceso: primero la activa, despues la que vence mas tarde, despues la ultima
    asignada. Las fechas llegan en ISO 8601 con el mismo formato, asi que se comparan como texto."""
    return max(candidatos, key=lambda p: (bool(p.get('is_active')), p.get('expires_at') or '',
                                          p.get('assigned_at') or ''))


def resolver_producto(programa_code, mapeo, productos):
    """Separa, de los productos que el alumno tiene en la Academia, el que pago segun NeurOPS.

    Pura: recibe el codigo de programa (AL/RR/SI, el mismo de Acciones), el mapeo
    {codigo -> product_slug} y la lista cruda de `GET /users/{id}/products`, y devuelve:

      programa         {codigo, nombre, product_slug} o None si NeurOPS no sabe que pago.
      producto_pagado  la asignacion de la Academia de ese producto, o None.
      otros_productos  todo lo demas que tiene en la Academia, en el orden en que llego.
      aviso_producto   {codigo, motivo} cuando no se pudo resolver, o None.

    Los codigos del aviso son `sin_programa` (NeurOPS no tiene el programa cargado: se arregla en
    Acciones), `sin_vinculo` (el programa no tiene producto de la Academia en el mapeo: lo arregla
    un admin) y `sin_producto` (la Academia no le tiene asignado lo que pago). En los tres,
    `otros_productos` trae la lista entera: nada de lo que tiene se puede presentar como lo pagado.
    """
    productos = [p for p in (productos or []) if isinstance(p, dict)]
    codigo = (programa_code or '').strip().upper() or None
    if not codigo:
        return {'programa': None, 'producto_pagado': None, 'otros_productos': productos,
                'aviso_producto': _aviso(
                    'sin_programa',
                    'NeurOPS no tiene cargado qué programa pagó este cliente, así que no se puede '
                    'saber cuál de sus accesos en la Academia es el que pagó. Cargalo en Acciones, '
                    'en «Programa».')}

    nombre = PROGRAM_CODE_NAMES.get(codigo, codigo)
    slug = str((mapeo or {}).get(codigo) or '').strip() or None
    programa = {'codigo': codigo, 'nombre': nombre, 'product_slug': slug}
    if not slug:
        return {'programa': programa, 'producto_pagado': None, 'otros_productos': productos,
                'aviso_producto': _aviso(
                    'sin_vinculo',
                    f'El programa {nombre} no está vinculado a ningún producto de la Academia. Un '
                    'admin lo vincula en Configuración de Ventas → Integraciones.')}

    propios = [p for p in productos if str(p.get('product_slug') or '').strip().lower() == slug.lower()]
    if not propios:
        return {'programa': programa, 'producto_pagado': None, 'otros_productos': productos,
                'aviso_producto': _aviso(
                    'sin_producto',
                    f'La Academia no le tiene asignado {nombre}, que es el programa que pagó: '
                    'hasta que se lo asignen no ve ese contenido.')}

    pagado = _el_mas_vigente(propios)
    return {'programa': programa, 'producto_pagado': pagado,
            'otros_productos': [p for p in productos if p is not pagado], 'aviso_producto': None}


def _programa_y_mapeo(client):
    """(codigo de programa, mapeo) de este cliente, de las MISMAS fuentes que Acciones y el alta.

    El mapeo solo se lee si hay programa: es una consulta, y sin codigo no hay nada que traducir.
    """
    from app.services.academy_access_service import AcademyAccessService

    codigo = CloserFollowUpService._client_program_code(getattr(client, 'id', None))
    return codigo, (AcademyAccessService.get_product_mapping() if codigo else {})


def _ahora_iso():
    """Cuando se le pregunto a la Academia, en UTC con zona: la pestana lo muestra en la hora de
    quien mira."""
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def fulfillment(client, ventas=None):
    """El bloque completo de la pestana Fulfillment. Nunca levanta: los errores viajan dentro.

    `vinculado` es la pregunta que la pestana contesta primero —¿este cliente existe como alumno?—
    y separa los tres casos que el closer tiene que poder distinguir de un vistazo: no existe
    (hay que darle el acceso), existe y se le ve el progreso, o no se pudo averiguar.

    `productos` sigue viajando entero y crudo, como siempre; `producto_pagado` y `otros_productos`
    son la misma lista partida en dos segun el programa que pago (ver `resolver_producto`).
    """
    vacio = {'vinculado': False, 'alumno': None, 'desempeno': None, 'productos': [],
             'email_usado': None, 'emails_probados': [], 'telefono_coincide': None, 'error': None,
             'programa': None, 'producto_pagado': None, 'otros_productos': [],
             'aviso_producto': None, 'consultado_en': _ahora_iso()}

    if not client:
        return {**vacio, 'error': {'codigo': None,
                                  'motivo': 'Este lead todavía no es un cliente: no hay alumno que buscar.'}}

    programa_code, mapeo = _programa_y_mapeo(client)
    # Sin alumno no hay productos que separar, pero el programa pagado se muestra igual: es lo que
    # habria que darle de alta.
    vacio['programa'] = resolver_producto(programa_code, mapeo, [])['programa']

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
        **resolver_producto(programa_code, mapeo, productos),
        'consultado_en': _ahora_iso(),
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
