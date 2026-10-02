"""El link de Fathom de una agenda: la grabacion y la transcripcion de la llamada.

Pedido del usuario (02/10/2026): «En el resultado de la agenda, que los closers puedan poner el link
de Fathom con la grabacion y la transcripcion, y que el closer pueda ver un icono para ir al link».
Se guarda aparte del arbol de reporte (`ficha_acciones_service.resultado`) a proposito: la grabacion
llega cuando Fathom termina de procesarla, muchas veces despues de reportada la llamada, y tiene que
poder pegarse, corregirse o quitarse sin volver a reportar nada.

Lo que se acepta es cualquier URL http(s), no solo de fathom.video: si mañana el equipo graba con
otra herramienta, el campo sigue sirviendo. Lo que NO se acepta es lo que no es un link —texto
suelto, un `javascript:`—, porque la cabecera lo pone en un `href`. Si no es de Fathom se guarda
igual y la respuesta lo dice (`es_fathom`), para que la ficha avise sin bloquear.
"""
from urllib.parse import urlsplit

from app import db
from app.services.ficha_acciones_service import ErrorDeAccion

# El largo de la columna (`Appointment.fathom_url`). Un link de Fathom ronda los 60 caracteres.
LARGO_MAXIMO = 500


def es_de_fathom(url):
    """True si el link es de fathom.video (o de un subdominio suyo)."""
    try:
        host = (urlsplit(url).hostname or '').lower() if url else ''
    except ValueError:
        return False
    return host == 'fathom.video' or host.endswith('.fathom.video')


def normalizar(valor):
    """El link listo para guardar, None para quitarlo, o `ErrorDeAccion` si no es un link.

    Sin esquema se le pone https: copiado de la barra del navegador a veces llega como
    «fathom.video/share/...». Se exige un host con punto y nada de espacios: «grabacion de ayer» no
    es un link aunque se le anteponga https.
    """
    if valor is None:
        return None
    if not isinstance(valor, str):
        raise ErrorDeAccion('El link de Fathom tiene que ser un texto.', campo='fathom_url')
    texto = valor.strip()
    if not texto:
        return None
    if '://' not in texto:
        texto = f'https://{texto}'
    try:
        partes = urlsplit(texto)
        esquema, host = partes.scheme.lower(), partes.hostname or ''
    except ValueError:   # un corchete sin cerrar, por ejemplo: `urlsplit` lo toma por IPv6
        esquema, host = '', ''
    if esquema not in ('http', 'https') or '.' not in host or any(c.isspace() for c in texto):
        raise ErrorDeAccion('Eso no parece un link: pegá la dirección completa, por ejemplo '
                            'https://fathom.video/share/…', campo='fathom_url')
    if len(texto) > LARGO_MAXIMO:
        raise ErrorDeAccion(f'El link es demasiado largo (más de {LARGO_MAXIMO} caracteres).',
                            campo='fathom_url')
    return texto


def guardar(appt, datos, usuario):
    """Pone, cambia o quita (`fathom_url` vacio) el link de la grabacion de ESTA agenda.

    Si el link es el mismo que ya tenia no se escribe nada, ni en la base ni en la bitacora. Si
    cambia queda una entrada en la bitacora del lead con el anterior: un link pisado por error se
    puede recuperar de ahi.
    """
    if 'fathom_url' not in datos:
        raise ErrorDeAccion('Falta el link de Fathom.', campo='fathom_url')
    nuevo = normalizar(datos.get('fathom_url'))
    anterior = appt.fathom_url or None
    respuesta = {'id': appt.id, 'fathom_url': nuevo, 'es_fathom': es_de_fathom(nuevo)}
    if nuevo == anterior:
        return {**respuesta, 'cambio': False}

    appt.fathom_url = nuevo
    db.session.commit()

    if nuevo and anterior:
        detalle = f'cambió el link de Fathom de la llamada ({anterior} → {nuevo})'
    elif nuevo:
        detalle = f'cargó el link de Fathom de la llamada ({nuevo})'
    else:
        detalle = f'quitó el link de Fathom de la llamada (era {anterior})'
    from app.services.booking_service import BookingService
    BookingService.log_lead_event(appt.id, usuario.id, 'fathom_editado',
                                  f'{usuario.username} {detalle}.')
    return {**respuesta, 'cambio': True}
