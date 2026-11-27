"""El flujo de recordatorios del broadcast de un taller (ADR-W259).

  · Cada taller tiene un plan (`WaPlanTaller`) con su etiqueta de audiencia y sus pasos (`WaPasoTaller`). Uno sin
    plan arranca con la copia del estándar (`event_id` vacío); «Guardar como estándar» lo reemplaza.
  · «Programar» pasa los borradores a programado. El reloj del motor (`lanzar_vencidos`) lanza cada paso cuando
    llega su momento: arma la lista de ese momento (audiencia menos descartes, bajas, exclusiones y el filtro del
    paso) y deja una fila pendiente de `WaEnvio` por número en un lote propio; `envios.enviar_tanda` las manda.
  · Un recordatorio que no sale a tiempo ya no sirve: cada fila vence (antes del taller, a las 6 h o al inicio; después,
    a las 24 h). Lo que no entró en el tope del día vence sin salir.
  · Las ramas son las respuestas por botón de la plantilla (`respuestas.py`): siguen igual, sin tocarlas acá.
"""
import uuid
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app import db
from app.models import WorkshopEvent
from app.models.whatsapp import WaEnvio
from app.models.whatsapp_taller import WaPasoTaller, WaPlanTaller
from app.whatsapp import audiencia
from app.whatsapp.cliente import telefono_de

ZONA = ZoneInfo('America/Argentina/Buenos_Aires')
UTC = ZoneInfo('UTC')
MODOS = ('ahora', 'relativo', 'hora')
A_QUIEN = ('todos', 'no_respondieron', 'tocaron', 'etiqueta')
VARIABLES = ('nombre', 'hora', 'fecha', 'meet', 'grupo')
MAX_PASOS = 15
DIAS = ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo')


class PasoInvalido(ValueError):
    pass


def _iso(momento):
    return momento.isoformat() + 'Z' if momento else None


def _local(utc_naive):
    return utc_naive.replace(tzinfo=UTC).astimezone(ZONA)


def _a_utc(local):
    return local.astimezone(UTC).replace(tzinfo=None)


def etiqueta_de(evento):
    return f'WS {evento.date.strftime("%d/%m")}'


# --- Plan ----------------------------------------------------------------------------------------

def estandar(crear=False):
    plan = WaPlanTaller.query.filter(WaPlanTaller.event_id.is_(None)).first()
    if plan is None and crear:
        plan = WaPlanTaller(event_id=None, descartes=dict(audiencia.POR_DEFECTO))
        db.session.add(plan)
        db.session.flush()
    return plan


def _copiar_pasos(origen, destino):
    for p in origen.pasos:
        destino.pasos.append(WaPasoTaller(
            orden=p.orden, nombre=p.nombre, modo=p.modo, minutos=p.minutos, dias=p.dias, hora=p.hora,
            plantilla=p.plantilla, idioma=p.idioma, parametros=p.parametros, a_quien=p.a_quien, valor=p.valor,
            excluir=p.excluir))


def plan_de(evento, crear=True):
    plan = WaPlanTaller.query.filter_by(event_id=evento.id).first()
    if plan is None and crear:
        base = estandar()
        plan = WaPlanTaller(event_id=evento.id, etiqueta=etiqueta_de(evento),
                            descartes=dict(base.descartes) if base and base.descartes else dict(audiencia.POR_DEFECTO))
        if base:
            _copiar_pasos(base, plan)
        db.session.add(plan)
        db.session.commit()
    return plan


def guardar_como_estandar(plan):
    base = estandar(crear=True)
    base.pasos = []
    db.session.flush()
    _copiar_pasos(plan, base)
    base.descartes = dict(plan.descartes or {})
    db.session.commit()
    return len(base.pasos)


# --- Cuándo ----------------------------------------------------------------------------------------

def momento(paso, evento, ahora=None):
    """El instante (UTC naive) en que sale el paso, o None si todavía no se puede saber."""
    if paso.modo == 'ahora':
        return paso.lanzado_en or ahora
    if paso.modo == 'relativo':
        return evento.inicio_at + timedelta(minutes=paso.minutos or 0) if evento.inicio_at else None
    if paso.modo == 'hora' and paso.hora:
        h, m = (int(x) for x in paso.hora.split(':'))
        dia = evento.date + timedelta(days=paso.dias or 0)
        return _a_utc(datetime(dia.year, dia.month, dia.day, h, m, tzinfo=ZONA))
    return None


def vence(cuando, evento):
    """Hasta cuándo puede salir una fila del paso que sale en `cuando`."""
    if evento.inicio_at and cuando < evento.inicio_at:
        return min(cuando + timedelta(hours=6), evento.inicio_at)
    return cuando + timedelta(hours=24)


# --- Variables ----------------------------------------------------------------------------------------

def valores(evento):
    """Lo que vale cada variable del taller (salvo el nombre, que es de cada persona)."""
    inicio = _local(evento.inicio_at) if evento.inicio_at else None
    return {
        'hora': f'{inicio.strftime("%H:%M")} (hora de Argentina)' if inicio else '',
        'fecha': f'{DIAS[evento.date.weekday()]} {evento.date.strftime("%d/%m")}',
        'meet': getattr(evento, 'meet_url', None) or '',
        'grupo': getattr(evento, 'whatsapp_url', None) or '',
    }


def parametros_de(paso, evento):
    """Lo que va en {{1}}, {{2}}…: «{nombre}» queda para completarse al mandar."""
    v = valores(evento)
    salida = []
    for p in paso.parametros or []:
        if p == 'nombre':
            salida.append('{nombre}')
        elif isinstance(p, dict):
            salida.append(str(p.get('fijo') or '-'))
        else:
            salida.append(v.get(p) or '-')
    return salida


# --- A quién ----------------------------------------------------------------------------------------

def destinatarios(plan, paso, grupos=None):
    contactos, _ = audiencia.filtrar(audiencia.miembros(plan.etiqueta), plan.descartes, grupos)
    if paso.excluir:
        fuera = audiencia.con_etiqueta([c.id for c in contactos], paso.excluir)
        contactos = [c for c in contactos if c.id not in fuera]
    if paso.a_quien == 'etiqueta':
        dentro = audiencia.con_etiqueta([c.id for c in contactos], [paso.valor]) if paso.valor else set()
        contactos = [c for c in contactos if c.id in dentro]
    elif paso.a_quien == 'no_respondieron':
        ya = audiencia.respondieron([p.lote for p in plan.pasos if p.lote])
        contactos = [c for c in contactos if telefono_de(c.igsid) not in ya]
    elif paso.a_quien == 'tocaron':
        desde = min((p.lanzado_en for p in plan.pasos if p.lanzado_en), default=None)
        dentro = audiencia.tocaron([c.id for c in contactos], paso.valor, desde)
        contactos = [c for c in contactos if c.id in dentro]
    return contactos


def lanzar(paso, evento, ahora, grupos=None):
    """Deja en pendiente una fila por destinatario. Devuelve cuántas."""
    cuando = momento(paso, evento, ahora) or ahora
    hasta = vence(cuando, evento)
    if ahora > hasta:
        paso.estado, paso.lanzado_en = WaPasoTaller.VENCIDO, ahora
        db.session.commit()
        return 0
    contactos = destinatarios(paso.plan, paso, grupos)
    parametros = parametros_de(paso, evento)
    paso.lote = str(uuid.uuid4())
    for c in contactos:
        db.session.add(WaEnvio(lote=paso.lote, plantilla=paso.plantilla, idioma=paso.idioma or 'es',
                               con_nombre='{nombre}' in parametros, telefono=telefono_de(c.igsid), nombre=c.nombre,
                               contacto_id=c.id, creado_en=ahora, paso_id=paso.id, parametros=parametros, vence_en=hasta))
    paso.estado, paso.lanzado_en = WaPasoTaller.LANZADO, ahora
    db.session.commit()
    return len(contactos)


def lanzar_vencidos(ahora=None):
    """Una vuelta del reloj: los pasos programados cuyo momento llegó. Devuelve cuántas filas quedaron pendientes."""
    ahora = ahora or datetime.utcnow()
    programados = (WaPasoTaller.query.join(WaPlanTaller).filter(WaPasoTaller.estado == WaPasoTaller.PROGRAMADO,
                                                                 WaPlanTaller.event_id.isnot(None)).all())
    total, grupos = 0, None
    for paso in programados:
        evento = db.session.get(WorkshopEvent, paso.plan.event_id)
        cuando = momento(paso, evento, ahora) if evento else None
        if cuando is None or cuando > ahora:
            continue
        grupos = grupos if grupos is not None else audiencia.grupos_descartables()
        total += lanzar(paso, evento, ahora, grupos)
    return total


# --- Edición ----------------------------------------------------------------------------------------

def _validar_paso(datos):
    modo = datos.get('modo') if datos.get('modo') in MODOS else 'relativo'
    a_quien = datos.get('a_quien') if datos.get('a_quien') in A_QUIEN else 'todos'
    hora = (datos.get('hora') or '').strip() or None
    if modo == 'hora':
        try:
            h, m = (int(x) for x in (hora or '').split(':'))
            assert 0 <= h < 24 and 0 <= m < 60
            hora = f'{h:02d}:{m:02d}'
        except (ValueError, AssertionError):
            raise PasoInvalido('La hora va como HH:MM')
    parametros = []
    for p in datos.get('parametros') or []:
        if p in VARIABLES:
            parametros.append(p)
        elif isinstance(p, dict) and str(p.get('fijo') or '').strip():
            parametros.append({'fijo': str(p['fijo']).strip()[:200]})
        else:
            raise PasoInvalido('Cada variable de la plantilla necesita un valor')
    valor = (datos.get('valor') or '').strip()[:60] or None
    if a_quien in ('tocaron', 'etiqueta') and not valor:
        raise PasoInvalido('Elegí el botón o la etiqueta del paso')
    return {
        'nombre': (datos.get('nombre') or '').strip()[:60] or None, 'modo': modo,
        'minutos': int(datos.get('minutos') or 0) if modo == 'relativo' else None,
        'dias': int(datos.get('dias') or 0) if modo == 'hora' else None, 'hora': hora if modo == 'hora' else None,
        'plantilla': (datos.get('plantilla') or '').strip() or None, 'idioma': (datos.get('idioma') or 'es').strip(),
        'parametros': parametros, 'a_quien': a_quien, 'valor': valor if a_quien in ('tocaron', 'etiqueta') else None,
        'excluir': [str(e).strip()[:60] for e in datos.get('excluir') or [] if str(e).strip()],
    }


def guardar(plan, datos):
    """Cambia descartes, etiqueta y los pasos que todavía no salieron (los lanzados o vencidos quedan como están)."""
    if isinstance(datos.get('descartes'), dict):
        plan.descartes = {k: bool(datos['descartes'].get(k)) for k in audiencia.DESCARTES}
    if 'etiqueta' in datos and plan.event_id:
        etiqueta = (datos.get('etiqueta') or '').strip()[:60]
        if not etiqueta:
            raise PasoInvalido('La audiencia necesita una etiqueta')
        plan.etiqueta = etiqueta
    if isinstance(datos.get('pasos'), list):
        if len(datos['pasos']) > MAX_PASOS:
            raise PasoInvalido(f'Van hasta {MAX_PASOS} pasos')
        quedan = {p.id: p for p in plan.pasos}
        nuevos = []
        for orden, d in enumerate(datos['pasos']):
            existente = quedan.pop(d.get('id'), None) if d.get('id') else None
            if existente and existente.estado in (WaPasoTaller.LANZADO, WaPasoTaller.VENCIDO):
                existente.orden = orden
                nuevos.append(existente)
                continue
            campos = _validar_paso(d)
            paso = existente or WaPasoTaller()
            for clave, valor in campos.items():
                setattr(paso, clave, valor)
            paso.orden = orden
            nuevos.append(paso)
        # Lo lanzado no se borra aunque falte en el pedido: su historial queda.
        nuevos += [p for p in quedan.values() if p.estado in (WaPasoTaller.LANZADO, WaPasoTaller.VENCIDO)]
        plan.pasos = nuevos
    db.session.commit()


def programar(plan, evento):
    """Pasa los borradores a programado. Lanza ValueError si a alguno le falta algo."""
    borradores = [p for p in plan.pasos if p.estado == WaPasoTaller.BORRADOR]
    if not borradores:
        raise PasoInvalido('No hay pasos para programar')
    if not plan.etiqueta:
        raise PasoInvalido('La audiencia necesita una etiqueta')
    for p in borradores:
        if not p.plantilla:
            raise PasoInvalido(f'Al paso «{p.nombre or p.orden + 1}» le falta la plantilla')
        if p.modo == 'relativo' and not evento.inicio_at:
            raise PasoInvalido('El taller no tiene hora: cargala en Próximos talleres')
    for p in borradores:
        p.estado = WaPasoTaller.PROGRAMADO
    db.session.commit()
    return len(borradores)


def pausar(plan):
    n = 0
    for p in plan.pasos:
        if p.estado == WaPasoTaller.PROGRAMADO:
            p.estado, n = WaPasoTaller.BORRADOR, n + 1
    db.session.commit()
    return n


# --- Lectura ----------------------------------------------------------------------------------------

def _conteos(lotes):
    if not lotes:
        return {}
    salida = {}
    for lote, estado, n in (db.session.query(WaEnvio.lote, WaEnvio.estado, db.func.count(WaEnvio.id))
                            .filter(WaEnvio.lote.in_(lotes)).group_by(WaEnvio.lote, WaEnvio.estado)):
        salida.setdefault(lote, {})[estado] = n
    return salida


def paso_json(paso, evento, conteos, estimado=None):
    return {
        'id': paso.id, 'orden': paso.orden, 'nombre': paso.nombre, 'modo': paso.modo, 'minutos': paso.minutos,
        'dias': paso.dias, 'hora': paso.hora, 'plantilla': paso.plantilla, 'idioma': paso.idioma,
        'parametros': paso.parametros or [], 'a_quien': paso.a_quien, 'valor': paso.valor, 'excluir': paso.excluir or [],
        'estado': paso.estado, 'lote': paso.lote, 'lanzado_en': _iso(paso.lanzado_en),
        'momento': _iso(momento(paso, evento)) if evento else None,
        'por_estado': conteos.get(paso.lote, {}) if paso.lote else {}, 'estimado': estimado,
    }


def a_json(plan, evento):
    grupos = audiencia.grupos_descartables()
    conteos = _conteos([p.lote for p in plan.pasos if p.lote])
    pasos = [paso_json(p, evento, conteos, None if p.lote else len(destinatarios(plan, p, grupos)))
             for p in plan.pasos]
    return {
        'id': plan.id, 'etiqueta': plan.etiqueta, 'descartes': {**audiencia.POR_DEFECTO, **(plan.descartes or {})},
        'taller': {'id': evento.id, 'nombre': evento.name, 'fecha': evento.date.isoformat(),
                   'inicio_at': _iso(evento.inicio_at), 'variables': valores(evento)},
        'audiencia': audiencia.resumen(plan, grupos), 'pasos': pasos,
    }


def resumenes(evento_ids):
    """Para la fila de cada taller en Próximos: {id: {contactos, pasos, programados, lanzados}}."""
    planes = WaPlanTaller.query.filter(WaPlanTaller.event_id.in_(evento_ids)).all() if evento_ids else []
    salida = {}
    for plan in planes:
        estados = [p.estado for p in plan.pasos]
        salida[plan.event_id] = {
            'contactos': len(audiencia.miembros(plan.etiqueta)), 'pasos': len(estados),
            'programados': estados.count(WaPasoTaller.PROGRAMADO), 'lanzados': estados.count(WaPasoTaller.LANZADO),
        }
    hay_estandar = bool(estandar() and estandar().pasos)
    return {'talleres': salida, 'estandar': hay_estandar}
