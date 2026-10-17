"""La grabación de cada taller en Google Drive (17/10/2026).

Es el Meet grabado completo, el registro de lo que se dio; el Loom (`replay_loom_id`) es lo que
muestra la landing y sigue aparte. Se carga uno por uno desde el taller o de a muchos pegando el
CSV que arma Claude in Chrome recorriendo Drive (`cargar_csv`).
"""
import csv
import io
import re
from datetime import datetime
from urllib.parse import parse_qs, urlsplit

from app import db
from app.models import WorkshopEvent

HOSTS_DRIVE = {'drive.google.com', 'docs.google.com'}
_RE_ID_DRIVE = re.compile(r'[A-Za-z0-9_-]{10,}')
MAX_URL = 500

COLUMNAS_ID = ('event_id', 'id', 'id_taller')
COLUMNAS_FECHA = ('fecha', 'date')
COLUMNAS_URL = ('link_drive', 'grabacion_url', 'url', 'link')


class UrlInvalida(ValueError):
    pass


def normalizar_url(valor):
    """Un link de Drive → el del archivo (`/file/d/<id>/view`); vacío → None.

    Una carpeta u otro link de Drive se guarda tal cual. Cualquier otro sitio es error: la columna
    es la grabación del Meet, que Google guarda en Drive."""
    url = (valor or '').strip()
    if not url:
        return None
    partes = urlsplit(url if '://' in url else f'https://{url}')
    if partes.scheme not in ('http', 'https') or partes.hostname not in HOSTS_DRIVE:
        raise UrlInvalida('El link tiene que ser de Google Drive')
    tramos = [t for t in partes.path.split('/') if t]
    archivo = None
    if len(tramos) >= 3 and tramos[0] == 'file' and tramos[1] == 'd':
        archivo = tramos[2]
    elif partes.path in ('/open', '/uc'):
        archivo = (parse_qs(partes.query).get('id') or [None])[0]
    if archivo and _RE_ID_DRIVE.fullmatch(archivo):
        return f'https://drive.google.com/file/d/{archivo}/view'
    url = partes._replace(scheme='https').geturl()
    if len(url) > MAX_URL:
        raise UrlInvalida('El link es demasiado largo')
    return url


def _fecha(valor):
    valor = (valor or '').strip()
    for formato in ('%Y-%m-%d', '%d/%m/%Y'):
        try:
            return datetime.strptime(valor, formato).date()
        except ValueError:
            pass
    return None


def _columna(cabecera, opciones):
    return next((c for c in opciones if c in cabecera), None)


def leer_csv(texto):
    """Las filas del CSV como dicts con la cabecera en minúsculas. Separador , ; o tab."""
    texto = (texto or '').strip().lstrip('﻿')
    # Claude in Chrome a veces lo devuelve dentro de un bloque ```csv.
    texto = re.sub(r'^```[a-z]*\s*|\s*```$', '', texto)
    if not texto:
        raise ValueError('El CSV está vacío')
    primera = texto.splitlines()[0]
    separador = max(',;\t', key=primera.count)
    lector = csv.DictReader(io.StringIO(texto), delimiter=separador)
    lector.fieldnames = [(c or '').strip().lower() for c in (lector.fieldnames or [])]
    if not _columna(lector.fieldnames, COLUMNAS_URL):
        raise ValueError('Falta la columna link_drive')
    if not (_columna(lector.fieldnames, COLUMNAS_ID) or _columna(lector.fieldnames, COLUMNAS_FECHA)):
        raise ValueError('Falta la columna event_id o fecha')
    return lector.fieldnames, list(lector)


def _buscar_taller(fila, col_id, col_fecha):
    crudo_id = (fila.get(col_id) or '').strip() if col_id else ''
    dia = _fecha(fila.get(col_fecha)) if col_fecha else None
    if crudo_id:
        if not crudo_id.isdigit():
            return None, 'El event_id no es un número'
        evento = db.session.get(WorkshopEvent, int(crudo_id))
        if not evento:
            return None, f'No hay un taller con id {crudo_id}'
        if dia and evento.date != dia:
            return None, f'El taller {crudo_id} es del {evento.date.isoformat()}, no del {dia.isoformat()}'
        return evento, None
    if not dia:
        return None, 'Sin event_id ni fecha válida'
    evento = WorkshopEvent.query.filter_by(date=dia).first()
    return (evento, None) if evento else (None, f'No hay un taller el {dia.isoformat()}')


def cargar_csv(texto, *, simular=True, sobrescribir=False):
    """Carga la grabación de cada fila en su taller (por event_id, o por fecha si no viene).

    Con `simular` no guarda: es la vista previa. Un taller que ya tiene otra grabación no se pisa
    salvo `sobrescribir`. Devuelve cada fila con su estado y el resumen por estado."""
    cabecera, filas = leer_csv(texto)
    col_id = _columna(cabecera, COLUMNAS_ID)
    col_fecha = _columna(cabecera, COLUMNAS_FECHA)
    col_url = _columna(cabecera, COLUMNAS_URL)

    resultado, vistos = [], set()
    for n, fila in enumerate(filas, start=2):  # la 1 es la cabecera
        salida = {'fila': n, 'evento_id': None, 'fecha': None, 'nombre': None,
                  'url': None, 'anterior': None, 'estado': 'error', 'motivo': None}
        resultado.append(salida)
        evento, motivo = _buscar_taller(fila, col_id, col_fecha)
        if not evento:
            salida['motivo'] = motivo
            continue
        salida.update(evento_id=evento.id, fecha=evento.date.isoformat(), nombre=evento.name,
                      anterior=evento.grabacion_url)
        if evento.id in vistos:
            salida['motivo'] = 'El taller ya vino en otra fila'
            continue
        vistos.add(evento.id)
        try:
            url = normalizar_url(fila.get(col_url))
        except UrlInvalida as e:
            salida['motivo'] = str(e)
            continue
        salida['url'] = url
        if not url:
            salida['estado'] = 'sin_link'
        elif evento.grabacion_url == url:
            salida['estado'] = 'igual'
        elif evento.grabacion_url and not sobrescribir:
            salida['estado'] = 'ya_tenia'
        else:
            salida['estado'] = 'reemplaza' if evento.grabacion_url else 'nueva'
            if not simular:
                evento.grabacion_url = url

    resumen = {}
    for fila in resultado:
        resumen[fila['estado']] = resumen.get(fila['estado'], 0) + 1
    if not simular and (resumen.get('nueva') or resumen.get('reemplaza')):
        db.session.commit()
    return {'filas': resultado, 'resumen': resumen, 'guardado': not simular}

