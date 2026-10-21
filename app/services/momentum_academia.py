"""El resultado de una Momentum, de vuelta a la Academia (POST /api/v1/sessions/momentum-result).

Las Momentum son las llamadas del closer con sus alumnos de la Academia: la de seña (define si el
alumno sigue en el programa) y la del cierre (upsell). La Academia las agenda por la API de agenda
(app/api/external/agenda.py, modo ventas) y quedan como `Appointment` con origen «Momentum» y
`agenda_payload.academia`. El closer las reporta en la ficha como cualquier llamada; acá se traduce
ese reporte a lo que la Academia entiende y se le avisa:

- `asistencia`: asistio | no_asistio | cancelo | reagenda (con `inicio`, ISO UTC);
- `resultado`: pago (declaró la venta) | pensando (no cerró: sigue en seguimiento) | no_sigue
  («No va a pagar» o descartado);
- `motivo`: por qué no asistió, canceló, lo está pensando o no sigue (texto libre), si se dijo.

Desde el 20/10/2026 la ficha reporta una Momentum con su árbol corto (bloque `momentum`, ver
app/services/ficha_momentum_service.py): asistencia, si continúa y el motivo ya vienen resueltos.

El mazo viejo (POST /api/closer/deck/<id>) también avisa (`traducir('mazo', ...)`).
En la Academia, «no sigue» da de baja el proceso del alumno.

El pago en sí no viaja acá: llega como siempre por /api/v1/payments y convierte la seña.
El HTTP corre en un hilo aparte (el reporte ya está guardado); si falla, queda en el log.
"""
import threading

from flask import current_app

ORIGEN_MOMENTUM = 'Momentum'
DESCARTES = ('Lead Perdido', 'No Lead')


def es_momentum(appt):
    academia = ((appt.agenda_payload or {}).get('academia') or {}) if appt else {}
    return bool(appt and appt.origin == ORIGEN_MOMENTUM and academia.get('reserva_id'))


def traducir(accion, datos):
    """{asistencia?, resultado?, inicio?} del pedido de la ficha, o None si no dice nada de la llamada."""
    if accion == 'venta':
        return {'asistencia': 'asistio', 'resultado': 'pago'}
    if accion == 'mazo':
        return _con_motivo(_traducir_mazo(datos), datos.get('motivo') or datos.get('seguimiento_sub'))
    if isinstance(datos.get('momentum'), dict):
        return _traducir_momentum(datos['momentum'])
    proceso = datos.get('process') if isinstance(datos.get('process'), dict) else {}
    motivo = datos.get('motivo') or datos.get('motivo_descarte') or proceso.get('note') or datos.get('objecion')
    return _con_motivo(_traducir_arbol(datos), motivo)


def _con_motivo(cambio, motivo):
    """Le suma el motivo al cambio (si hay cambio y motivo)."""
    motivo = str(motivo or '').strip()[:1000]
    return {**cambio, 'motivo': motivo} if cambio and motivo else cambio


def _traducir_momentum(m):
    """El árbol corto de la Momentum (ya validado al guardarse)."""
    cambio = {'asistencia': m.get('asistencia')}
    if m.get('asistencia') == 'asistio':
        cambio['resultado'] = m.get('resultado')
    if m.get('asistencia') == 'reagenda':
        cambio['inicio'] = m.get('inicio')
    return _con_motivo(cambio, m.get('motivo'))


def _traducir_arbol(datos):
    """El árbol de siempre de la ficha (las Momentum que se reportaron antes del árbol corto)."""
    from app.services.ficha_acciones_service import _no_cerro

    clave = datos.get('resultado')
    deck = datos.get('deck') if isinstance(datos.get('deck'), dict) else {}
    proceso = datos.get('process') if isinstance(datos.get('process'), dict) else {}
    if proceso.get('status') in DESCARTES or clave in ('lead_perdido', 'no_lead'):
        return {'asistencia': 'asistio' if clave == 'asistio' else None, 'resultado': 'no_sigue'}
    if datos.get('contacto_result') == 'no_paga':
        return {'resultado': 'no_sigue'}
    if clave == 'asistio':
        return {'asistencia': 'asistio', 'resultado': 'pensando' if _no_cerro(datos, deck) else None}
    if clave in ('no_asistio', 'no_show'):
        return {'asistencia': 'no_asistio'}
    if clave == 'cancelo':
        return {'asistencia': 'cancelo'}
    if clave == 'reagenda':
        inicio = (datos.get('reagenda') or {}).get('start_time') if isinstance(datos.get('reagenda'), dict) else None
        return {'asistencia': 'reagenda', 'inicio': inicio}
    return None


def _traducir_mazo(datos):
    """El guardado del mazo viejo: `result` es el resultado de la llamada (`closer_result`) y
    `contact_result` el del seguimiento de cobro."""
    if datos.get('contact_result') == 'no_paga':
        return {'resultado': 'no_sigue'}
    resultado = (datos.get('result') or '').strip()
    if resultado == 'Lead Perdido':
        return {'asistencia': 'asistio', 'resultado': 'no_sigue'}
    if resultado == 'No Lead':
        return {'resultado': 'no_sigue'}
    if resultado in ('Show up', 'Asistió'):
        return {'asistencia': 'asistio', 'resultado': 'pensando' if datos.get('fecha_seguimiento') else None}
    if resultado == 'No Show':
        return {'asistencia': 'no_asistio'}
    return None


def avisar(appt, accion, datos, usuario):
    """Le avisa a la Academia el reporte de una Momentum. Nunca levanta: el reporte ya está guardado."""
    try:
        if not es_momentum(appt):
            return
        cambio = traducir(accion, datos or {})
        if not cambio:
            return
        academia = appt.agenda_payload['academia']
        payload = {
            'reserva_id': academia.get('reserva_id'),
            'appointment_id': appt.id,
            'work_uuid': appt.person_uuid,
            'closer_email': (usuario.email or '').lower() if usuario else None,
            'nota': (datos or {}).get('objecion') or ((datos or {}).get('deck') or {}).get('closer_notes')
                    or (datos or {}).get('closer_notes') or None,
            **{k: v for k, v in cambio.items() if v is not None},
        }
    except Exception as e:  # noqa: BLE001
        current_app.logger.error(f'[MOMENTUM] No se pudo armar el aviso de la agenda #{getattr(appt, "id", None)}: {e}')
        return
    app = current_app._get_current_object()

    def _correr():
        with app.app_context():
            from app.services.learnation_service import LearnationAPIError, LearnationService
            try:
                LearnationService.report_momentum_result(payload)
            except LearnationAPIError as e:
                app.logger.warning(f"[MOMENTUM] Agenda #{payload['appointment_id']}: {e} ({e.status_code})")
            except Exception as e:  # noqa: BLE001
                app.logger.error(f"[MOMENTUM] Agenda #{payload['appointment_id']}: {e}")

    threading.Thread(target=_correr, daemon=True, name='academy-momentum').start()
