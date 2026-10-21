"""El WhatsApp a quien da una sesión de la Academia (la plantilla del aviso de agenda).

Lo usan las reservas de la API de agenda (app/api/external/agenda.py: nueva y, en las Momentum, movida)
y `POST /agenda/avisos`, con el que la Academia avisa una Momentum que agendó sin pasar por Thalamus.
La plantilla es la de las agendas de ventas (closer, lead, teléfono, Instagram, día, hora, grupo, fuente):
si se movió o se canceló, lo dice la fuente («… · MOVIDA», «… · CANCELADA»).
"""

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from flask import current_app, jsonify, request
from sqlalchemy import func

from app.api.external import bp
from app.decorators import require_academy_token
from app.models import User

TIPOS_AVISO = {'nueva': '', 'movida': ' · MOVIDA', 'cancelada': ' · CANCELADA'}


def avisar(u, inicio_ms, tz, sesion, alumno, tipo='nueva', telefono=None):
    """Manda el aviso a `u`. → (enviado, error). Nunca levanta: un aviso no frena una reserva."""
    from app.agendas_v2.operacion import DIAS
    from app.services.whatchimp_service import AvisoDeAgenda

    if not u.two_chat_number:
        return False, 'sin_numero'
    try:
        local = datetime.fromtimestamp(inicio_ms / 1000, tz=timezone.utc).astimezone(ZoneInfo(tz))
        hora = local.strftime('%I:%M').lstrip('0') + (' am' if local.hour < 12 else ' pm')
        AvisoDeAgenda.enviar(u.two_chat_number, closer=u.username, lead=alumno or 'Alumno', telefono=telefono or '-',
                             instagram='-', dia=f'{DIAS[local.weekday()]} {local.day}', hora=hora, grupo='Academia',
                             fuente=f'{sesion or "-"}{TIPOS_AVISO.get(tipo, "")}')
        return True, None
    except Exception as e:  # noqa: BLE001
        current_app.logger.warning(f'[AGENDA ACADEMIA] No se pudo avisar por WhatsApp a #{u.id}: {e}')
        return False, 'whatsapp'


def _inicio_ms(v):
    """`inicio` en ms o en ISO 8601 → ms, o None."""
    if isinstance(v, int) and not isinstance(v, bool) and v > 0:
        return v
    if isinstance(v, str) and v.strip():
        try:
            dt = datetime.fromisoformat(v.strip().replace('Z', '+00:00'))
        except ValueError:
            return None
        return int((dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).timestamp() * 1000)
    return None


@bp.route('/agenda/avisos', methods=['POST'])
@require_academy_token
def agenda_aviso():
    """{email (de quien da la sesión), alumno: {nombre, email, telefono?}, sesion, inicio (ms o ISO), meet?,
    tipo: nueva|movida|cancelada} → {enviado, error?}. Para una Momentum que la Academia agendó sin pasar
    por Thalamus. La hora va en la zona de esa cuenta. `meet` se acepta pero la plantilla no lo muestra."""
    from app.agendas_v2.servicio import zona_de_usuario

    datos = request.get_json(silent=True) or {}
    email = (datos.get('email') or '').strip().lower()
    tipo = datos.get('tipo') or 'nueva'
    inicio = _inicio_ms(datos.get('inicio'))
    alumno = datos.get('alumno') if isinstance(datos.get('alumno'), dict) else {}
    if not email or tipo not in TIPOS_AVISO or inicio is None:
        return jsonify({'error': 'Datos inválidos (email, tipo o inicio)'}), 400
    u = User.query.filter(func.lower(User.email) == email).first()
    if not u or not u.is_active:
        return jsonify({'error': 'No existe esa persona del equipo'}), 404
    enviado, error = avisar(u, inicio, zona_de_usuario(u), str(datos.get('sesion') or '')[:80] or None,
                            str(alumno.get('nombre') or alumno.get('email') or '')[:80] or None, tipo,
                            str(alumno.get('telefono') or '')[:30] or None)
    return jsonify({'enviado': enviado, **({'error': error} if error else {})}), 200
