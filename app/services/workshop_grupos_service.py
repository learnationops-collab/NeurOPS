"""Tipo del taller (frío / caliente) y sus grupos de WhatsApp por conjunto de anuncios (ADR-W146).

Cada conjunto de anuncios de Workshop tiene su grupo de WhatsApp en cada taller. La landing le pide a
Work los próximos talleres con los UTM de la visita y recibe el grupo del conjunto que la trajo; quien
llega sin anuncio (orgánico, link de la bio) va al grupo general, que es el `whatsapp_url` del taller.
Con eso, cuando se crucen los miembros de cada grupo con las agendas (fase 2), cada agenda queda atada
a su conjunto.
"""
import re

from app import db
from app.models import MetaAnuncio, WorkshopGrupo
from app.services import utm_etiquetas
from app.services.workshop_agenda_service import DatoInvalido, limpiar_url

TIPOS = ('frio', 'caliente')
LARGO_NOMBRE = 80
LARGO_ID = 40
LARGO_UTM = 120
MAX_GRUPOS = 30
# Adónde apunta el «enlace de prueba» si Meta todavía no trajo ningún anuncio con su landing.
LANDING_RESPALDO = 'https://institute.thelearnation.com/live-class/'

_CODIGO = re.compile(r'^\s*([A-Za-z]+\d+)\b')


def _texto(valor, largo):
    texto = str(valor).strip() if valor is not None else ''
    return texto[:largo] or None


def tipo_valido(valor):
    """'' o None -> None (sin tipo). Cualquier otra cosa que no sea frío o caliente no se guarda."""
    if valor in (None, ''):
        return None
    if valor not in TIPOS:
        raise DatoInvalido('El tipo de taller es frío o caliente')
    return valor


def _landing(destino):
    """La landing de un anuncio sin sus parámetros; None si el anuncio no lleva a un link."""
    if not destino or not destino.lower().startswith(('https://', 'http://')):
        return None
    return destino.split('#')[0].split('?')[0]


def conjuntos_disponibles():
    """Los conjuntos de anuncios de Workshop que Meta ya trajo: `[{id, nombre, campana, activo, landing}]`,
    primero los que tienen algún anuncio activo. Un conjunto nuevo aparece recién cuando gasta y corre
    una sincronización; mientras, el panel deja pegar su id."""
    vistos = {}
    filas = MetaAnuncio.query.with_entities(
        MetaAnuncio.conjunto_id, MetaAnuncio.conjunto, MetaAnuncio.campana, MetaAnuncio.estado, MetaAnuncio.destino,
    ).filter(MetaAnuncio.embudo == 'workshop', MetaAnuncio.conjunto_id.isnot(None))
    for sid, nombre, campana, estado, destino in filas:
        c = vistos.setdefault(sid, {'id': sid, 'nombre': nombre, 'campana': campana, 'activo': False, 'landing': None})
        c['activo'] = c['activo'] or estado == 'ACTIVE'
        c['landing'] = c['landing'] or _landing(destino)
    return sorted(vistos.values(), key=lambda c: (not c['activo'], (c['nombre'] or '').lower()))


def detalle(evento):
    """Lo que muestra el modal «Grupos» de un taller."""
    conjuntos = conjuntos_disponibles()
    landing = next((c['landing'] for c in conjuntos if c['activo'] and c['landing']), None)
    return {
        'tipo': evento.tipo,
        'general': evento.whatsapp_url,
        'grupos': [g.to_dict() for g in evento.grupos],
        'conjuntos': conjuntos,
        'landing': landing or LANDING_RESPALDO,
    }


def _fila_limpia(fila, nombres_de_meta):
    if not isinstance(fila, dict):
        raise DatoInvalido('Un grupo de la lista no es válido')
    nombre = _texto(fila.get('nombre'), LARGO_NOMBRE)
    if not nombre:
        raise DatoInvalido('A un grupo le falta el nombre')
    url = limpiar_url(fila.get('whatsapp_url'), f'del grupo «{nombre}»')
    if not url:
        raise DatoInvalido(f'Al grupo «{nombre}» le falta el enlace')
    conjunto_id = _texto(fila.get('conjunto_id'), LARGO_ID)
    if conjunto_id and not conjunto_id.isdigit():
        raise DatoInvalido(f'El id del conjunto de «{nombre}» son solo números (está en el Administrador de anuncios)')
    codigo = _texto(fila.get('codigo'), LARGO_ID)
    if not codigo:
        m = _CODIGO.match(nombre)
        codigo = m.group(1) if m else None
    return {
        'id': fila.get('id') if isinstance(fila.get('id'), int) else None,
        'nombre': nombre,
        'whatsapp_url': url,
        'conjunto_id': conjunto_id,
        'conjunto_nombre': (nombres_de_meta.get(conjunto_id) or _texto(fila.get('conjunto_nombre'), 255)) if conjunto_id else None,
        'codigo': codigo.lower() if codigo else None,
    }


def _sin_repetidos(filas):
    nombres, conjuntos, ids = set(), set(), set()
    for f in filas:
        if f['id'] is not None and f['id'] in ids:
            raise DatoInvalido(f'El grupo «{f["nombre"]}» vino dos veces')
        ids.add(f['id'])
        if f['nombre'].lower() in nombres:
            raise DatoInvalido(f'Hay dos grupos con el nombre «{f["nombre"]}»')
        nombres.add(f['nombre'].lower())
        if f['conjunto_id'] and f['conjunto_id'] in conjuntos:
            raise DatoInvalido(f'El conjunto de «{f["nombre"]}» ya tiene otro grupo en este taller')
        conjuntos.add(f['conjunto_id'])


def guardar(evento, data, usuario=None):
    """Deja el tipo, el grupo general y la lista de grupos del taller como vienen en `data` (solo las
    claves presentes). La lista es completa: un grupo que ya existía y no viene, se borra. No commitea."""
    if 'tipo' in data:
        evento.tipo = tipo_valido(data.get('tipo'))
    if 'general' in data:
        evento.whatsapp_url = limpiar_url(data.get('general'), 'del grupo general')
    if 'grupos' not in data:
        return
    filas = data.get('grupos')
    if not isinstance(filas, list):
        raise DatoInvalido('La lista de grupos no es válida')
    if len(filas) > MAX_GRUPOS:
        raise DatoInvalido(f'Un taller puede tener hasta {MAX_GRUPOS} grupos')
    nombres_de_meta = {c['id']: c['nombre'] for c in conjuntos_disponibles()}
    limpias = [_fila_limpia(f, nombres_de_meta) for f in filas]
    _sin_repetidos(limpias)

    actuales = {g.id: g for g in evento.grupos}
    quedan = {f['id'] for f in limpias if f['id'] in actuales}
    for gid, grupo in actuales.items():
        if gid not in quedan:
            evento.grupos.remove(grupo)
        else:
            # Dos filas que intercambian nombre o conjunto chocarían con los únicos al escribirse de a una:
            # primero se sueltan los valores viejos y después se ponen los nuevos.
            grupo.nombre, grupo.conjunto_id = f'~{gid}', None
    db.session.flush()
    for f in limpias:
        grupo = actuales.get(f['id']) if f['id'] in quedan else None
        if grupo is None:
            grupo = WorkshopGrupo(created_by_id=getattr(usuario, 'id', None))
            evento.grupos.append(grupo)
        grupo.nombre, grupo.whatsapp_url = f['nombre'], f['whatsapp_url']
        grupo.conjunto_id, grupo.conjunto_nombre, grupo.codigo = f['conjunto_id'], f['conjunto_nombre'], f['codigo']
    db.session.flush()


def _conjunto_del_anuncio(utm_content, utm_campaign):
    """El conjunto del anuncio que trajo la visita: `utm_content` es `{{ad.id}}` o una etiqueta escrita a
    mano («tc1_pp_a4»), que se traduce por el código del nombre del anuncio (ADR-W125)."""
    codigos = {} if utm_content.isdigit() else utm_etiquetas.codigos_de_workshop()
    _, ad_id = utm_etiquetas.resolver(utm_campaign, utm_content, codigos)
    if not ad_id or not str(ad_id).isdigit():
        return None
    fila = MetaAnuncio.query.with_entities(MetaAnuncio.conjunto_id).filter(MetaAnuncio.meta_ad_id == str(ad_id)).first()
    return fila[0] if fila else None


def selector(utm_term=None, utm_content=None, utm_campaign=None):
    """Una función `evento -> su grupo para esta visita` (None = va al grupo general). En orden:
    `utm_term` igual al id del conjunto de un grupo; `utm_term` igual al código de un único grupo; el
    conjunto del anuncio de `utm_content`. Los grupos de un taller no valen para otro."""
    term = _texto(utm_term, LARGO_UTM)
    contenido = _texto(utm_content, LARGO_UTM)
    campana = _texto(utm_campaign, LARGO_UTM)
    memo = {}

    def conjunto_de_la_visita():
        if 'sid' not in memo:
            memo['sid'] = _conjunto_del_anuncio(contenido, campana) if contenido else None
        return memo['sid']

    def elegir(evento):
        grupos = evento.grupos
        if not grupos:
            return None
        if term:
            por_conjunto = next((g for g in grupos if g.conjunto_id == term), None)
            if por_conjunto:
                return por_conjunto
            por_codigo = [g for g in grupos if g.codigo and g.codigo == term.lower()]
            if len(por_codigo) == 1:
                return por_codigo[0]
        sid = conjunto_de_la_visita()
        return next((g for g in grupos if g.conjunto_id == sid), None) if sid else None

    return elegir
