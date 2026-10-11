"""En qué momento de su vida está un lead, y por lo tanto qué pestañas tiene su ficha.

La ficha unificada abre siempre "donde hay trabajo por hacer": un lead con la llamada mañana se
abre en Confirmación, uno con la llamada de la semana pasada sin reportar se abre en Resultado, y
uno que compró y debe plata se abre en Acciones. Esa tabla es un contrato con el frontend y vive
acá, en UNA función pura con tests, en vez de repartida en condicionales de la UI: cuando estaba
en el JS cada pantalla la resolvía un poco distinto y el mismo lead se abría en dos lugares según
por dónde se lo hubiera clickeado.

No se inventa un vocabulario nuevo de estados de agenda: los nombres salen de `derivar_estado`
(`app/services/closer_agendas_service.py`), que es el que ya usan el libro de agendas del closer y
el dashboard comercial. Si acá dijeran otra cosa, la ficha contradeciría a la tabla desde la que se
la abre. Lo que esta función agrega encima son los tres estados que `derivar_estado` no puede ver,
porque no dependen de la agenda sino del cobro: sin agenda, con deuda y al día.
"""
from app.services.lead_cobro_service import UMBRAL_DEUDA

# Identificadores de pestaña, en el orden en que se muestran. El frontend obedece este orden.
# 'ful' (Fulfillment: cómo le va al alumno en la Academia) va pegada a 'acciones' porque las dos
# son post-venta: una cobra y la otra entrega.
PESTANAS = ('conf', 'resultado', 'acciones', 'ful', 'hist', 'form', 'com')

# Estados de `derivar_estado` que significan "la llamada todavía no ocurrió".
_PRE_CALL = ('por_confirmar', 'confirmada')
# Estados de `derivar_estado` en los que el lead quedó fuera del embudo: por decisión del closer, o
# porque nadie reportó la llamada en 30 días y el sistema la archivó.
_DESCARTE = ('lead_perdido', 'no_lead', 'archivada_sin_reporte')

# Etiqueta y tono de cada estado. `tono` es uno de los 5 del design system: el frontend no elige
# colores, los toma de acá (mismo criterio que el vocabulario del dashboard comercial).
_ETIQUETAS = {
    'sin_agenda': ('Sin agenda', 'idle'),
    'por_confirmar': ('Por confirmar', 'idle'),
    'confirmando': ('Confirmando', 'info'),
    'confirmada': ('Confirmada', 'success'),
    'sin_reportar': ('Sin reportar', 'error'),
    'reportada_sin_resultado': ('Reportada · sin resultado', 'warning'),
    'show_up': ('Asistió', 'success'),
    'no_show': ('No asistió', 'error'),
    'segunda_llamada': ('2da llamada', 'info'),
    'reagendada': ('Reagendada', 'info'),
    'cancelada': ('Canceló', 'warning'),
    'descartado': ('Descartado', 'error'),
    # Fuera del embudo como un descartado, pero nadie la descartó: la archivó el barrido de los 30
    # días. Abre donde abre un descartado (Historial); solo cambia cómo se llama.
    'archivada_sin_reporte': ('Archivada sin reporte', 'idle'),
    'venta_con_deuda': ('Venta · con deuda', 'warning'),
    'venta_al_dia': ('Cliente al día', 'success'),
    # Dejó una seña y todavía no pagó completo ni hizo un split: es una reserva, no una venta
    # (misma regla que el close rate, `REAL_SALE_TIPOS`).
    'sena': ('Seña · falta completar', 'warning'),
    # Compró y se fue (`baja_service`): no debe nada, pero tampoco está "al día".
    'dado_de_baja': ('Dado de baja', 'idle'),
}

# La tabla del contrato: estado -> pestaña que se abre. Lo que no está acá abre en Historial,
# porque es un lead cuya llamada ya se reportó y no dejó nada pendiente que hacer.
_POR_DEFECTO = {
    'sin_agenda': 'conf',
    'por_confirmar': 'conf',
    'confirmando': 'conf',
    'confirmada': 'conf',
    'sin_reportar': 'resultado',
    'reportada_sin_resultado': 'resultado',
    'venta_con_deuda': 'acciones',
    # Lo que falta es cobrar el resto, y eso se registra en Acciones.
    'sena': 'acciones',
    # En Acciones está la marca de la baja y el «Revertir baja»: es lo que se viene a mirar.
    'dado_de_baja': 'acciones',
}


def _clave(estado_agenda, etapa_confirmacion, descartado, tiene_venta, deuda, baja=False,
           solo_sena=False):
    if not estado_agenda:
        return 'sin_agenda'
    if descartado:
        return 'archivada_sin_reporte' if estado_agenda == 'archivada_sin_reporte' else 'descartado'
    if estado_agenda in _PRE_CALL:
        # La llamada no ocurrió: el trabajo es confirmarla, aunque el lead ya sea cliente (una 2ª
        # llamada o una renovación entran por acá). Por eso el pre call gana al estado de cobro,
        # y también a la baja: un dado de baja con una llamada por delante es alguien que se
        # está recuperando.
        if estado_agenda == 'confirmada':
            return 'confirmada'
        # "A medio confirmar": el closer ya avanzó el wizard aunque el lead siga sin confirmar.
        return 'confirmando' if etapa_confirmacion not in (None, '', 'por_contactar') else 'por_confirmar'
    if baja:
        return 'dado_de_baja'
    if tiene_venta or deuda > UMBRAL_DEUDA:
        if solo_sena:
            return 'sena'
        return 'venta_con_deuda' if deuda > UMBRAL_DEUDA else 'venta_al_dia'
    return estado_agenda


def resolver_estado(estado_agenda=None, etapa_confirmacion=None, tiene_venta=False, deuda=0.0,
                    descartado=None, baja=False, solo_sena=False):
    """`{clave, etiqueta, tono, pestanas, pestana_por_defecto}` del lead.

    `estado_agenda` es lo que devuelve `derivar_estado` para la agenda vigente, o None cuando el
    lead todavía no tiene ninguna. `deuda` y `tiene_venta` son el estado de cobro ya calculado
    (`CloserFollowUpService._client_debt` y el cruce de ventas): esta función no consulta la base.
    `descartado` en None se deduce del estado de la agenda; se puede forzar para el lead que se dio
    de baja después de comprar, que no deja rastro en `closer_result`.

    `baja` dice si el cliente está dado de baja (`baja_service`): la llamada fue una venta, así que
    no es un descarte, y no debe nada pero tampoco está al día — es 'dado_de_baja'.

    `solo_sena` dice que lo único que pagó es una seña: sigue siendo cliente para cobrarle el resto
    (`tiene_venta` abre Acciones y Fulfillment), pero no se lo llama venta — es 'sena'.
    """
    deuda = float(deuda or 0.0)
    if descartado is None:
        descartado = estado_agenda in _DESCARTE
    clave = _clave(estado_agenda, etapa_confirmacion, descartado, tiene_venta, deuda, baja,
                   solo_sena)

    etiqueta, tono = _ETIQUETAS.get(clave, (str(clave), 'idle'))
    visibles = {
        # Confirmación solo mientras haya algo que confirmar: en una llamada ya ocurrida el
        # stepper de precall no tiene nada que ofrecer y el 100% confirmado es mentira.
        'conf': clave in ('sin_agenda', 'por_confirmar', 'confirmando', 'confirmada',
                          'sin_reportar', 'reportada_sin_resultado'),
        'resultado': bool(estado_agenda),
        # Cobro: solo para quien ya compró. Sin venta no hay deuda ni plan que armar. Un dado de
        # baja la conserva siempre: ahí se ve la baja y se revierte.
        'acciones': bool(tiene_venta) or deuda > UMBRAL_DEUDA or bool(baja),
        # Fulfillment: mismo criterio, porque un alumno existe porque alguien compró. Ofrecerla
        # antes sería mandar al closer a buscar en la Academia a alguien que no puede estar.
        'ful': bool(tiene_venta) or deuda > UMBRAL_DEUDA,
        'hist': True,
        'form': True,
        'com': True,
    }
    pestanas = [p for p in PESTANAS if visibles[p]]
    por_defecto = _POR_DEFECTO.get(clave, 'hist')

    return {
        'clave': clave,
        'etiqueta': etiqueta,
        'tono': tono,
        'pestanas': pestanas,
        # Nunca puede apuntar a una pestaña que no se muestra: el frontend abriría un panel vacío.
        'pestana_por_defecto': por_defecto if por_defecto in pestanas else 'hist',
    }


def estado_de_agenda(appt, ahora=None):
    """El estado de la agenda vigente, o None si el lead no tiene ninguna.

    Envoltorio corto sobre `derivar_estado` para que quien arma la ficha no tenga que importar el
    libro de agendas ni acordarse de que la hora va en UTC.
    """
    if appt is None:
        return None
    from datetime import datetime

    from app.services.closer_agendas_service import derivar_estado
    return derivar_estado(appt, ahora or datetime.utcnow())
