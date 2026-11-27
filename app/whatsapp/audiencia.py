"""La audiencia del broadcast de un taller (ADR-W259): los contactos de WhatsApp con la etiqueta del plan.

  · Cargar (un CSV, los que agendaron y no cerraron en unos talleres, o los de otra etiqueta) crea el contacto
    `wa:<número>` si no existía, sin setter (el setter se asigna cuando responde, como siempre) y le pone la
    etiqueta. Un contacto sin mensajes no aparece en el Inbox.
  · Al mandar se descartan, si el plan lo pide, los que ya agendaron, los clientes y los alumnos vigentes; las
    bajas (respondieron «baja») siempre. El teléfono se reconoce por sus últimos 8 dígitos, como `PersonIdentity`.
"""
import unicodedata

from app import db
from app.automatizaciones.modelos import IgContacto, IgMensaje
from app.models.tag import TARGET_IG_CONTACT, Tag
from app.models.whatsapp import WaEnvio
from app.services import tags_service
from app.whatsapp.cliente import PREFIJO, normalizar, telefono_de, variantes

ETIQUETA_BAJA = 'Baja WhatsApp'
DESCARTES = ('agendados', 'clientes', 'alumnos')
POR_DEFECTO = {'agendados': True, 'clientes': True, 'alumnos': True}
BAJAS = {'baja', 'stop', 'darme de baja', 'dar de baja', 'no me escriban mas', 'no quiero recibir mas mensajes',
         'no quiero recibir mas', 'eliminame', 'borrame'}


def _llano(texto):
    sin = unicodedata.normalize('NFKD', texto or '').encode('ascii', 'ignore').decode()
    return ' '.join(''.join(c for c in sin.lower() if c.isalnum() or c == ' ').split())


def es_baja(texto):
    return _llano(texto) in BAJAS


def nombre_de(contacto):
    """Con qué nombre se le escribe (ADR-W271): el de su perfil de WhatsApp si ya escribió; si no, el que vino en la
    carga (los CSV de los talleres no traen nombre). None si no hay ninguno."""
    return (contacto.variables or {}).get('nombre_whatsapp') or contacto.nombre or None


def contacto_wa(telefono, nombre, ahora):
    """El contacto de ese número (en cualquiera de sus formas) o uno nuevo, sin setter."""
    contacto = IgContacto.query.filter(IgContacto.igsid.in_([PREFIJO + v for v in variantes(telefono)])).first()
    if contacto is None:
        contacto = IgContacto(igsid=f'{PREFIJO}{telefono}', nombre=nombre, username=f'+{telefono}',
                              variables={'telefono': telefono, 'canal_mensajeria': 'whatsapp'}, creado_en=ahora)
        db.session.add(contacto)
        db.session.flush()
    elif nombre and not contacto.nombre:
        contacto.nombre = nombre
    return contacto


def sumar(etiqueta, filas, usuario_id, ahora):
    """Pone la etiqueta a cada número de `filas` [{telefono, nombre}]. Devuelve cuántos se sumaron y qué se saltó."""
    vistos, r = set(), {'sumados': 0, 'ya_estaban': 0, 'invalidos': 0, 'repetidos': 0}
    ya = {c.id for c in miembros(etiqueta)}
    for fila in filas:
        telefono = normalizar(fila.get('telefono'))
        if not telefono:
            r['invalidos'] += 1
            continue
        if telefono in vistos:
            r['repetidos'] += 1
            continue
        vistos.update(variantes(telefono))
        contacto = contacto_wa(telefono, (fila.get('nombre') or '').strip()[:150] or None, ahora)
        if contacto.id in ya:
            r['ya_estaban'] += 1
            continue
        tags_service.poner(TARGET_IG_CONTACT, contacto.id, None, etiqueta, usuario_id)
        ya.add(contacto.id)
        r['sumados'] += 1
    db.session.commit()
    return r


def no_cerraron(taller_ids, tz='America/Argentina/Buenos_Aires'):
    """[{telefono, nombre}] de los que agendaron en esos talleres y no compraron (ni dejaron seña)."""
    from app.services import workshop_agendas_service as agendas
    talleres = agendas.talleres_por_ids(taller_ids)
    if not talleres:
        return []
    filas = agendas.agendas_de_talleres(talleres, tz)['filas']
    return [{'telefono': f.get('telefono'), 'nombre': f.get('cliente')} for f in filas
            if f.get('telefono') and not f.get('con_venta') and not f.get('con_sena')]


def de_etiqueta(nombre):
    return [{'telefono': telefono_de(c.igsid), 'nombre': c.nombre} for c in miembros(nombre)]


def miembros(etiqueta):
    if not etiqueta:
        return []
    ids = db.session.query(Tag.target_id).filter(Tag.target_type == TARGET_IG_CONTACT, Tag.name == etiqueta)
    return (IgContacto.query.filter(IgContacto.id.in_([int(i) for (i,) in ids if str(i).isdigit()]),
                                    IgContacto.igsid.like(f'{PREFIJO}%')).order_by(IgContacto.id).all())


def con_etiqueta(ids, etiquetas):
    """Los ids de `ids` que tienen alguna de `etiquetas`."""
    if not ids or not etiquetas:
        return set()
    filas = (db.session.query(Tag.target_id).filter(Tag.target_type == TARGET_IG_CONTACT, Tag.name.in_(etiquetas),
                                                   Tag.target_id.in_([str(i) for i in ids])))
    return {int(t) for (t,) in filas}


def _telefonos_de(uuids):
    """Últimos 8 dígitos de los teléfonos de esas personas (el principal y los otros)."""
    from app.models.person import Person, PersonIdentity
    principales = db.session.query(Person.phone).filter(Person.uuid.in_(uuids), Person.phone.isnot(None))
    otros = db.session.query(PersonIdentity.value).filter(PersonIdentity.person_uuid.in_(uuids),
                                                          PersonIdentity.kind == 'phone')
    digitos = [normalizar(t) for (t,) in principales] + [normalizar(v) for (v,) in otros]
    return {d[-8:] for d in digitos if d and len(d) >= 8}


def grupos_descartables():
    """{agendados, clientes, alumnos}: conjuntos de últimos 8 dígitos."""
    from app.models import Appointment, Client, FinancialAgenda
    from app.whatsapp.envios import alumnos_activos
    agendaron = db.session.query(FinancialAgenda.person_uuid).filter(FinancialAgenda.person_uuid.isnot(None))
    citas = db.session.query(Appointment.person_uuid).filter(Appointment.person_uuid.isnot(None))
    clientes = db.session.query(Client.person_uuid).filter(Client.person_uuid.isnot(None))
    return {'agendados': _telefonos_de(agendaron) | _telefonos_de(citas), 'clientes': _telefonos_de(clientes),
            'alumnos': alumnos_activos()}


def filtrar(contactos, descartes, grupos=None):
    """(los que quedan, {motivo: cuántos}). Cada descartado cuenta en el primer motivo que le toca."""
    descartes = {**POR_DEFECTO, **(descartes or {})}
    grupos = grupos if grupos is not None else grupos_descartables()
    bajas = con_etiqueta([c.id for c in contactos], [ETIQUETA_BAJA])
    quedan, cuenta = [], {'bajas': 0, **{k: 0 for k in DESCARTES}}
    for contacto in contactos:
        ocho = (telefono_de(contacto.igsid) or '')[-8:]
        if contacto.id in bajas:
            cuenta['bajas'] += 1
            continue
        motivo = next((k for k in DESCARTES if descartes.get(k) and ocho in grupos[k]), None)
        if motivo:
            cuenta[motivo] += 1
            continue
        quedan.append(contacto)
    return quedan, cuenta


def resumen(plan, grupos=None):
    """Lo que muestra «A cuántos se les puede mandar»: cargados, lo descartado por motivo y lo que queda.
    `posibles` es cuántos caerían en cada grupo si se lo descartara (para el interruptor apagado)."""
    contactos = miembros(plan.etiqueta)
    grupos = grupos if grupos is not None else grupos_descartables()
    quedan, cuenta = filtrar(contactos, plan.descartes, grupos)
    _, todos = filtrar(contactos, {k: True for k in DESCARTES}, grupos)
    return {'cargados': len(contactos), 'descartados': cuenta, 'posibles': todos, 'se_puede': len(quedan)}


def respondieron(telefonos_lotes):
    """Los teléfonos que respondieron alguno de esos lotes."""
    lotes = [l for l in telefonos_lotes if l]
    if not lotes:
        return set()
    filas = db.session.query(WaEnvio.telefono).filter(WaEnvio.lote.in_(lotes), WaEnvio.estado == WaEnvio.RESPONDIO)
    return {v for (t,) in filas for v in variantes(t)}


def tocaron(contacto_ids, boton, desde):
    """Los contactos que escribieron o tocaron exactamente `boton` desde `desde`."""
    if not contacto_ids or not boton:
        return set()
    filas = (db.session.query(IgMensaje.contacto_id)
             .filter(IgMensaje.contacto_id.in_(contacto_ids), IgMensaje.direccion == IgMensaje.ENTRANTE,
                     db.func.lower(IgMensaje.texto) == boton.strip().lower(),
                     *([IgMensaje.enviado_en >= desde] if desde else [])).distinct())
    return {c for (c,) in filas}
