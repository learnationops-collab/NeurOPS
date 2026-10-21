"""El reporte corto de una Momentum en la ficha (bloque `momentum` de POST /api/ficha/<id>/resultado).

Una Momentum (agenda con origen «Momentum», ver app/services/momentum_academia.py) no se reporta con el
árbol de una llamada de venta: el closer contesta tres cosas.

  1. ¿Asistió? asistio | no_asistio | cancelo | reagenda (con `inicio`, ISO con zona).
  2. Si asistió, ¿continúa? pago | pensando | no_sigue. En la de seña: «Pagó, sigue», «Lo está
     pensando», «No sigue»; en la del cierre: «Hizo upsell», «Lo está pensando», «No por ahora».
  3. El motivo: obligatorio si no asistió, canceló, lo está pensando o no sigue.

Se guarda como cualquier reporte (el guardado del mazo: `result`/`closer_result` y la nota; la bitácora
`reporte_arbol`) y se le avisa a la Academia (escritura._ejecutar → momentum_academia.avisar). No se
descarta al alumno ni se abre seguimiento: es un cliente de la Academia y la Academia decide qué sigue.
"""
from app import db

ASISTENCIAS = {'asistio': 'Asistió', 'no_asistio': 'No asistió', 'cancelo': 'Canceló', 'reagenda': 'Reagenda'}
CONTINUA = {
    'sena': {'pago': 'Pagó, sigue', 'pensando': 'Lo está pensando', 'no_sigue': 'No sigue'},
    'cierre': {'pago': 'Hizo upsell', 'pensando': 'Lo está pensando', 'no_sigue': 'No por ahora'},
}
# El estado de la llamada que entiende el mazo, por asistencia.
RESULTADO_DEL_MAZO = {'asistio': 'Show up', 'no_asistio': 'No Show', 'cancelo': 'Cancelado'}
MOTIVO_MAX = 1000


def tipo_de(appt):
    """'sena' | 'cierre' (lo manda la Academia en `agenda_payload.academia.tipo`); sin dato, 'sena'."""
    tipo = (((appt.agenda_payload or {}).get('academia') or {}).get('tipo') or '').strip().lower()
    return 'cierre' if tipo == 'cierre' else 'sena'


def motivo_requerido(asistencia, resultado):
    return asistencia in ('no_asistio', 'cancelo') or resultado in ('pensando', 'no_sigue')


def validar(bloque):
    """{asistencia, resultado, motivo, inicio (datetime UTC naive o None)} o `ErrorDeAccion`."""
    from app.services.ficha_acciones_service import ErrorDeAccion
    from app.services.ficha_agendas_service import _instante_utc

    if not isinstance(bloque, dict):
        raise ErrorDeAccion('El reporte de la Momentum vino mal armado.')
    asistencia = bloque.get('asistencia')
    if asistencia not in ASISTENCIAS:
        raise ErrorDeAccion('Elegí si asistió.', 'asistencia')
    resultado = bloque.get('resultado') if asistencia == 'asistio' else None
    if asistencia == 'asistio' and resultado not in CONTINUA['sena']:
        raise ErrorDeAccion('Elegí si continúa.', 'resultado')
    motivo = str(bloque.get('motivo') or '').strip()[:MOTIVO_MAX]
    if motivo_requerido(asistencia, resultado) and not motivo:
        raise ErrorDeAccion('Falta el motivo.', 'motivo')
    inicio = _instante_utc(bloque.get('inicio')) if asistencia == 'reagenda' else None
    return {'asistencia': asistencia, 'resultado': resultado, 'motivo': motivo or None, 'inicio': inicio}


def nota(appt, r):
    """La nota de la llamada: «Momentum (seña): Asistió · Pagó, sigue. Motivo: …»."""
    tipo = tipo_de(appt)
    partes = [ASISTENCIAS[r['asistencia']]]
    if r['resultado']:
        partes.append(CONTINUA[tipo][r['resultado']])
    if r['inicio']:
        partes.append('nueva fecha ' + r['inicio'].strftime('%d/%m/%Y %H:%M') + ' UTC')
    texto = f"Momentum ({'cierre' if tipo == 'cierre' else 'seña'}): " + ' · '.join(partes)
    return texto + (f". Motivo: {r['motivo']}" if r['motivo'] else '')


def resultado_momentum(appt, datos, usuario):
    """Guarda el reporte corto. Todo se valida antes de escribir (el mazo y la bitácora comitean solos)."""
    from app.services.deck_escritura_service import aplicar_cambios
    from app.services.ficha_acciones_service import ErrorDeAccion, _guardar_respuestas_del_arbol, _mover_la_llamada
    from app.services.momentum_academia import ORIGEN_MOMENTUM

    if appt.origin != ORIGEN_MOMENTUM:
        raise ErrorDeAccion('Esta agenda no es una Momentum.')
    r = validar(datos.get('momentum'))
    deck = {'closer_notes': nota(appt, r)}
    if r['asistencia'] == 'reagenda':
        # Como la reagenda con fecha del árbol de siempre: vuelve a confirmaciones.
        _mover_la_llamada(appt, r['inicio'], usuario)
        deck.update(confirm_status='por_confirmar', result='Pendiente')
    else:
        deck['result'] = RESULTADO_DEL_MAZO[r['asistencia']]
    aplicar_cambios(appt, deck, usuario)
    reporte = {'asistencia': r['asistencia'], 'resultado': r['resultado'], 'motivo': r['motivo'],
               'inicio': r['inicio'].isoformat() + 'Z' if r['inicio'] else None, 'tipo': tipo_de(appt)}
    # La ficha sabe que esta Momentum ya se reportó con el árbol corto (y qué se dijo).
    appt.agenda_payload = {**(appt.agenda_payload or {}), 'momentum_reporte': reporte}
    respuestas = datos.get('respuestas') if isinstance(datos.get('respuestas'), dict) else {}
    _guardar_respuestas_del_arbol(appt, {**respuestas, 'momentum': reporte}, usuario)
    db.session.commit()
    return {'id': appt.id, 'closer_result': appt.closer_result, 'momentum': reporte,
            'fecha': appt.start_time.isoformat() if appt.start_time else None}
