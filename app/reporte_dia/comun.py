"""Piezas compartidas del reporte único: rol, fechas, cierre del día y formas del JSON."""
import copy
from datetime import datetime, time, timedelta

import pytz

from app import db
from app.models import DailyClose
from app.services.user_time_service import hoy_del_usuario, zona_del_usuario

ROLES = ('closer', 'setter', 'triage')
HORA_CIERRE = 10  # 10:00 local del día siguiente
TIPOS_VICTORIA = ('persona', 'sin_gente')
MIN_MOTIVO = 5


def rol_de(user):
    """El rol del reporte: el activo si es de los tres; si no, el primero de los suyos que lo sea."""
    if getattr(user, 'role', None) in ROLES:
        return user.role
    return next((r for r in getattr(user, 'roles', []) if r in ROLES), None)


def ahora_local(user):
    return datetime.now(zona_del_usuario(user))


def ultimo_dia_cerrable(user, ahora=None):
    """El último día que ya debería estar cerrado: ayer después de las 10:00, anteayer antes."""
    ahora = ahora or ahora_local(user)
    atras = 1 if ahora.hour >= HORA_CIERRE else 2
    return ahora.date() - timedelta(days=atras)


def cierra_en(user, dia):
    """ISO con zona del momento en que se cierra `dia`: las 10:00 del día siguiente."""
    tz = zona_del_usuario(user)
    return tz.localize(datetime.combine(dia + timedelta(days=1), time(HORA_CIERRE))).isoformat()


def hora_local(user, dt_utc):
    """'HH:MM' en la zona del usuario de un instante UTC naive (o '' si no hay)."""
    if not dt_utc:
        return ''
    if isinstance(dt_utc, str):
        try:
            dt_utc = datetime.fromisoformat(dt_utc.replace('Z', ''))
        except ValueError:
            return ''
    if dt_utc.tzinfo is None:
        dt_utc = pytz.UTC.localize(dt_utc)
    return dt_utc.astimezone(zona_del_usuario(user)).strftime('%H:%M')


def pct(parte, total):
    """Porcentaje 0-100 redondeado, o None sin base."""
    if parte is None or not total:
        return None
    return round(parte * 100 / total)


def num(v):
    """Entero no negativo de un valor del formulario; None si viene vacío."""
    if v is None or v == '':
        return None
    try:
        return max(0, int(float(v)))
    except (TypeError, ValueError):
        return None


def plural(n, uno, varios):
    return f"{n} {uno if n == 1 else varios}"


def datos(close):
    """El JSON `data` del cierre, siempre con sus tres claves."""
    d = copy.deepcopy((close.data if close else None) or {})
    d.setdefault('mano', {})
    d.setdefault('mano_meta', {})
    d.setdefault('correcciones', {})
    return d


def cierre_de(user, dia):
    return DailyClose.query.filter_by(user_id=user.id, date=dia).first()


def cierre_o_nuevo(user, dia, rol, modulo, nacer_cerrado=True):
    """El cierre del día; si no hay, uno nuevo (sin commit).

    Si el día ya pasó su hora de cierre y tenía un reporte del flujo viejo, lo trae como legado:
    cerrado, con lo que se había cargado a mano, sin volver a Discord. Sin reporte viejo, nace cerrado
    salvo que lo cree el job (`nacer_cerrado=False`), que lo cierra y lo manda él."""
    close = cierre_de(user, dia)
    if close:
        return close
    close = DailyClose(user_id=user.id, date=dia, role=rol, status='en_curso', is_non_working_day=False)
    d = {'mano': {}, 'mano_meta': {}, 'correcciones': {}}
    if dia <= ultimo_dia_cerrable(user):
        fila = modulo.fila(user, dia)
        if fila is not None:
            d['legado'] = True
            d['mano'] = modulo.mano_de_fila(fila)
            close.is_non_working_day = bool(getattr(fila, 'is_non_working_day', False))
        if fila is not None or nacer_cerrado:
            close.closed_at = datetime.utcnow()
    close.data = d
    db.session.add(close)
    return close


def victoria_de(close):
    """La victoria con todas sus claves (lo que no se cargó, vacío)."""
    v = dict((close.victory if close else None) or {})
    return {
        'tipo': v.get('tipo') if v.get('tipo') in TIPOS_VICTORIA else 'persona',
        'persona': v.get('persona') if isinstance(v.get('persona'), dict) else None,
        'que': v.get('que') or '', 'por': v.get('por') or '',
        'prueba_url': v.get('prueba_url') or '', 'motivo': v.get('motivo') or '',
        'mas': v.get('mas') if isinstance(v.get('mas'), list) else [],
    }


def texto_victoria(close):
    """Una línea para el historial y Discord: «María Rodríguez: cerró…» o el motivo."""
    v = victoria_de(close)
    if v['tipo'] == 'sin_gente':
        return v['motivo']
    nombre = (v['persona'] or {}).get('nombre') or ''
    return f"{nombre}: {v['que']}" if nombre and v['que'] else (v['que'] or nombre)


def victoria_completa(v):
    if v['tipo'] == 'sin_gente':
        return len(v['motivo'].strip()) >= MIN_MOTIVO
    return bool((v['persona'] or {}).get('nombre')) and bool(v['que'].strip())


def parse_fecha(valor, user):
    """(dia, None) o (None, mensaje). Sin valor es hoy; no se admite un día futuro."""
    hoy = hoy_del_usuario(user)
    if not valor:
        return hoy, None
    try:
        dia = datetime.strptime(str(valor), '%Y-%m-%d').date()
    except ValueError:
        return None, "Fecha inválida: se espera 'AAAA-MM-DD'."
    if dia > hoy:
        return None, 'Ese día todavía no llegó.'
    return dia, None
