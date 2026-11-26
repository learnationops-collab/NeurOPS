"""«Seguir» de triage como bandeja que se vacía cada día (ADR-W241, mockup docs/mockups/seguimientos-triage/).

El seguimiento es el mismo del closer (uno por agenda, en las columnas de `Appointment`); cambia qué se
muestra y cómo se resuelve:

  · **Hoy**: lo que toca hoy o se atrasó, y los no show y cancelaciones que nunca tuvieron seguimiento.
    No entran las llamadas sin reportar (están en Reportar › Atrasadas) ni los Show up que ya se
    calificaron: para triage, un lead que pasó al closer o al low ticket ya no es suyo de seguir.
  · **Esperan fecha**: los que reprogramaron sin fecha («te aviso»). No vencen ni traban el reporte;
    si dijeron un momento, ese día pasan a Hoy.
  · **Hechos hoy**: lo que tuvo un contacto registrado hoy.

Las acciones de la fila (`accion`) cierran el seguimiento ahí mismo, sin pasar por el árbol del
closer: no respondió (siguiente contacto de la cadencia), no le interesa (cierra con motivo sin tocar
el resultado de la llamada), más adelante (otra fecha o «me avisa») y agendó (la llamada vuelve a
Confirmar). Cada una devuelve lo que había antes, para «Deshacer».
"""
from datetime import date, datetime, timedelta

from app import db
from app.models import Appointment
from app.services.closer_followup_service import CADENCIA, CloserFollowUpService as Seguimientos
from app.services.user_time_service import hoy_del_usuario, limites_dia_utc

ESPERA = 'Reprogramó sin fecha'
DIAS_SIN_NOTICIAS = 10
MOTIVOS_NO_INTERESA = {
    'precio': 'Precio', 'momento': 'No es el momento', 'otra_opcion': 'Eligió otra opción',
    'no_era': 'No era para su perfil', 'otro': 'Otro',
}
# Lo que se guarda para «Deshacer» y lo único que «Deshacer» puede devolver.
CAMPOS = ('fecha_seguimiento', 'seguimiento_tipo', 'seguimiento_sub', 'seguimiento_intento',
          'seguimiento_realizado', 'last_contact_outcome', 'last_contact_at')


class ErrorDeSeguir(ValueError):
    pass


def _sin_reportar(a):
    return not a.closer_processed and (a.closer_result or 'Pendiente') in ('', 'Pendiente')


def es_de_la_bandeja(a):
    """Un seguimiento de triage: programado a propósito, o un no show / cancelación sin seguimiento."""
    if _sin_reportar(a):
        return False
    if a.seguimiento_tipo:
        return a.seguimiento_tipo != 'cerrada'
    return (a.closer_result or '').strip().lower() in ('no show', 'cancelado', 'cancelada')


def _espera(a):
    return (a.seguimiento_sub or '').startswith(ESPERA)


def _situacion(a):
    """El chip principal de la fila: qué pasó con la llamada."""
    if _espera(a):
        return 'sin_fecha'
    if a.triage_calificacion == 'seguimiento':
        return 'pensar'
    if a.triage_calificacion == 'descalificado':
        return 'low_ticket'
    resultado = (a.closer_result or '').strip().lower()
    if resultado.startswith('cancel'):
        return 'cancelo'
    if resultado == 'no show':
        return 'no_asistio'
    return 'otro'


def _fila(a, hoy):
    datos = Seguimientos._serialize(a, reference_date=hoy)
    fecha = (a.fecha_seguimiento or '')[:10] or None
    datos.update({
        'situacion': _situacion(a),
        'intento': min(a.seguimiento_intento or 1, len(CADENCIA)),
        'de': len(CADENCIA),
        'fecha': fecha,
        'esperando_desde': a.updated_at.date().isoformat() if _espera(a) and getattr(a, 'updated_at', None) else None,
        'nota': (a.seguimiento_sub or '').replace(ESPERA, '').lstrip(' ·:') or (a.closer_notes or '')[:200],
        'ultimo_contacto': a.last_contact_outcome,
    })
    return datos


def bandeja(usuario):
    hoy = hoy_del_usuario(usuario)
    desde, hasta = limites_dia_utc(usuario, hoy)
    filas = [a for a in Seguimientos._base_query(usuario.id).all() if es_de_la_bandeja(a)]
    atrasados, para_hoy, esperan = [], [], []
    for a in filas:
        fecha = (a.fecha_seguimiento or '')[:10]
        if fecha and fecha <= hoy.isoformat():
            (atrasados if fecha < hoy.isoformat() else para_hoy).append(_fila(a, hoy))
        elif _espera(a):
            esperan.append(_fila(a, hoy))
        elif not fecha:
            para_hoy.append(_fila(a, hoy))  # no show o cancelación que nunca tuvo seguimiento
    hechos = (Appointment.query.filter(Appointment.closer_id == usuario.id,
                                       Appointment.last_contact_at >= desde, Appointment.last_contact_at <= hasta)
              .order_by(Appointment.last_contact_at.desc()).all())
    atrasados.sort(key=lambda f: f['fecha'] or '')
    esperan.sort(key=lambda f: (f['fecha'] is None, f['fecha'] or ''))
    return {
        'hoy': hoy.isoformat(), 'atrasados': atrasados, 'para_hoy': para_hoy, 'esperan': esperan,
        'hechos': [{**_fila(a, hoy), 'resultado_contacto': a.last_contact_outcome} for a in hechos],
        'dias_sin_noticias': DIAS_SIN_NOTICIAS, 'motivos': MOTIVOS_NO_INTERESA,
    }


def _antes(a):
    valores = {c: getattr(a, c) for c in CAMPOS}
    valores['last_contact_at'] = valores['last_contact_at'].isoformat() if valores['last_contact_at'] else None
    return valores


def _contacto(a, resultado):
    a.last_contact_outcome, a.last_contact_at = resultado, datetime.utcnow()


def _fecha(valor, campo='fecha'):
    try:
        return date.fromisoformat(str(valor or '')[:10])
    except ValueError:
        raise ErrorDeSeguir(f'Elegí la {campo}.') from None


def _log(a, usuario, texto):
    from app.services.booking_service import BookingService
    BookingService.log_lead_event(a.id, usuario.id, 'seguimiento', f'{usuario.username} {texto}')


def accion(a, datos, usuario):
    """Aplica una acción de la fila. Devuelve {'antes': campos previos, 'texto': qué quedó}."""
    if a.closer_id != usuario.id and usuario.role != 'admin':
        raise ErrorDeSeguir('Este seguimiento es de otra persona.')
    tipo = datos.get('accion')
    hoy = hoy_del_usuario(usuario)
    antes = _antes(a)
    if tipo == 'deshacer':
        return _deshacer(a, datos.get('antes') or {}, usuario)
    if tipo == 'no_respondio':
        texto = _no_respondio(a, hoy, bool(datos.get('cerrar')))
    elif tipo == 'no_interesa':
        texto = _no_interesa(a, datos)
    elif tipo == 'mas_adelante':
        texto = _mas_adelante(a, datos, hoy)
    elif tipo == 'agendo':
        texto = _agendo(a, datos, usuario)
    elif tipo == 'reprogramo_sin_fecha':
        texto = reprogramar_sin_fecha(a, datos, usuario, hoy)
    else:
        raise ErrorDeSeguir('Acción no admitida.')
    _log(a, usuario, texto)
    db.session.commit()
    return {'antes': antes, 'texto': texto}


def _no_respondio(a, hoy, cerrar):
    intento = min(a.seguimiento_intento or 1, len(CADENCIA))
    _contacto(a, 'no_resp')
    a.seguimiento_tipo = a.seguimiento_tipo or 'no_tomada'
    if cerrar or intento >= len(CADENCIA):
        if not cerrar:
            raise ErrorDeSeguir('Era el último contacto: elegí si se cierra.')
        a.seguimiento_realizado = True
        return f'cerró el seguimiento: no respondió a {intento} contactos.'
    siguiente = intento + 1
    a.seguimiento_intento = siguiente
    a.fecha_seguimiento = (hoy + timedelta(days=CADENCIA[siguiente - 1] - CADENCIA[intento - 1])).isoformat()
    a.seguimiento_realizado = False
    return f'no obtuvo respuesta: contacto {siguiente} de {len(CADENCIA)} el {a.fecha_seguimiento}.'


def _no_interesa(a, datos):
    motivo = MOTIVOS_NO_INTERESA.get(datos.get('motivo'))
    if not motivo:
        raise ErrorDeSeguir('Elegí por qué no le interesa.')
    nota = (datos.get('nota') or '').strip()
    _contacto(a, 'contesto')
    # Cierra el seguimiento, no la llamada: el resultado y la calificación del triage quedan como estaban.
    a.seguimiento_sub = f'No le interesa: {motivo}' + (f' · {nota}' if nota else '')
    a.seguimiento_sub = a.seguimiento_sub[:250]
    a.seguimiento_realizado = True
    return f'cerró el seguimiento: no le interesa ({motivo.lower()})' + (f': «{nota}».' if nota else '.')


def _mas_adelante(a, datos, hoy):
    nota = (datos.get('nota') or '').strip()
    _contacto(a, 'contesto')
    a.seguimiento_tipo = a.seguimiento_tipo or 'no_tomada'
    a.seguimiento_realizado = False
    if datos.get('fecha'):
        fecha = _fecha(datos['fecha'])
        if fecha <= hoy:
            raise ErrorDeSeguir('La fecha tiene que ser después de hoy.')
        a.fecha_seguimiento = fecha.isoformat()
        if nota:
            a.seguimiento_sub = nota[:250]
        return f'habló con el lead: le vuelve a escribir el {a.fecha_seguimiento}.'
    a.fecha_seguimiento = None
    a.seguimiento_sub = f'{ESPERA} · {nota}'[:250] if nota else ESPERA
    return 'habló con el lead: avisa él cuándo (pasa a Esperan fecha).'


def _agendo(a, datos, usuario):
    from app.services import triage_service
    from app.services.ficha_acciones_service import ErrorDeAccion

    try:
        triage_service._reagendar(a, {'fecha': datos.get('fecha'), 'nota': datos.get('nota')}, usuario)
    except ErrorDeAccion as e:
        raise ErrorDeSeguir(str(e)) from None
    _contacto(a, 'agendo')
    a.seguimiento_realizado, a.fecha_seguimiento = True, None
    return 'agendó una llamada nueva desde el seguimiento (vuelve a Confirmar).'


def fecha_aproximada(cuando, hoy, fecha=None):
    """«La semana que viene» = el lunes que viene; «fin de mes» = el último día del mes (o del que sigue
    si faltan menos de 3 días); un día elegido; o None si no dijo."""
    if cuando == 'semana':
        return hoy + timedelta(days=7 - hoy.weekday())
    if cuando == 'fin_mes':
        primero_siguiente = (hoy.replace(day=1) + timedelta(days=32)).replace(day=1)
        fin = primero_siguiente - timedelta(days=1)
        if (fin - hoy).days < 3:
            fin = (primero_siguiente + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        return fin
    if cuando == 'dia':
        elegida = _fecha(fecha, 'fecha en que te escribe')
        if elegida <= hoy:
            raise ErrorDeSeguir('La fecha tiene que ser después de hoy.')
        return elegida
    return None


def reprogramar_sin_fecha(a, datos, usuario, hoy=None):
    """La llamada se reprogramó pero el lead no dio fecha: Reagendado, sale de Atrasadas y queda en Esperan
    fecha (como la reagenda sin fecha del closer, ADR-W143). No cuenta como cancelación ni no show."""
    from app.services import motivo_estado_service
    from app.services.deck_escritura_service import aplicar_cambios

    hoy = hoy or hoy_del_usuario(usuario)
    aproximada = fecha_aproximada(datos.get('cuando'), hoy, datos.get('fecha'))
    nota = (datos.get('nota') or '').strip()
    aplicar_cambios(a, {
        'result': 'Reagendado', 'seguimiento_tipo': 'no_tomada',
        'seguimiento_sub': f'{ESPERA} · {nota}'[:250] if nota else ESPERA,
        'seguimiento_intento': 1, 'seguimiento_realizado': False,
        'fecha_seguimiento': aproximada.isoformat() if aproximada else None,
    }, usuario)
    motivo_estado_service.registrar(a, usuario, 'Reagendado', nota or ESPERA)
    cuando = f' (dijo que escribe cerca del {aproximada.isoformat()})' if aproximada else ''
    return f'reportó que el lead reprogramó sin fecha{cuando}.'


def reportar_sin_fecha(a, datos, usuario):
    """El reporte de triage «Reagenda → No, va a avisar» (la ficha): lo mismo, con su commit y su log."""
    from app.services.ficha_acciones_service import ErrorDeAccion

    try:
        texto = reprogramar_sin_fecha(a, datos, usuario)
    except ErrorDeSeguir as e:
        raise ErrorDeAccion(str(e), 'fecha') from None
    _log(a, usuario, texto)
    db.session.commit()
    return {}


def _deshacer(a, antes, usuario):
    for campo in CAMPOS:
        if campo in antes:
            valor = antes[campo]
            if campo == 'last_contact_at' and valor:
                valor = datetime.fromisoformat(valor)
            setattr(a, campo, valor)
    _log(a, usuario, 'deshizo el último cambio del seguimiento.')
    db.session.commit()
    return {'antes': None, 'texto': 'Deshecho.'}
