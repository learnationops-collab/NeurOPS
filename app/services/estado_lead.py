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
PESTANAS = ('conf', 'resultado', 'acciones', 'hist', 'form', 'com')

# Estados de `derivar_estado` que significan "la llamada todavía no ocurrió".
_PRE_CALL = ('por_confirmar', 'confirmada')
# Estados de `derivar_estado` en los que el lead quedó fuera del embudo por decisión del closer.
_DESCARTE = ('lead_perdido', 'no_lead')

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
    'otro': ('Otro estado', 'idle'),
    'descartado': ('Descartado', 'error'),
    'venta_con_deuda': ('Venta · con deuda', 'warning'),
    'venta_al_dia': ('Cliente al día', 'success'),
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
}


def _clave(estado_agenda, etapa_confirmacion, descartado, tiene_venta, deuda):
    if not estado_agenda:
        return 'sin_agenda'
    if descartado:
        return 'descartado'
    if estado_agenda in _PRE_CALL:
        # La llamada no ocurrió: el trabajo es confirmarla, aunque el lead ya sea cliente (una 2ª
        # llamada o una renovación entran por acá). Por eso el pre call gana al estado de cobro.
        if estado_agenda == 'confirmada':
            return 'confirmada'
        # "A medio confirmar": el closer ya avanzó el wizard aunque el lead siga sin confirmar.
        return 'confirmando' if etapa_confirmacion not in (None, '', 'por_contactar') else 'por_confirmar'
    if tiene_venta or deuda > UMBRAL_DEUDA:
        return 'venta_con_deuda' if deuda > UMBRAL_DEUDA else 'venta_al_dia'
    return estado_agenda


def resolver_estado(estado_agenda=None, etapa_confirmacion=None, tiene_venta=False, deuda=0.0,
                    descartado=None):
    """`{clave, etiqueta, tono, pestanas, pestana_por_defecto}` del lead.

    `estado_agenda` es lo que devuelve `derivar_estado` para la agenda vigente, o None cuando el
    lead todavía no tiene ninguna. `deuda` y `tiene_venta` son el estado de cobro ya calculado
    (`CloserFollowUpService._client_debt` y el cruce de ventas): esta función no consulta la base.
    `descartado` en None se deduce del estado de la agenda; se puede forzar para el lead que se dio
    de baja después de comprar, que no deja rastro en `closer_result`.
    """
    deuda = float(deuda or 0.0)
    if descartado is None:
        descartado = estado_agenda in _DESCARTE
    clave = _clave(estado_agenda, etapa_confirmacion, descartado, tiene_venta, deuda)

    etiqueta, tono = _ETIQUETAS.get(clave, (str(clave), 'idle'))
    visibles = {
        # Confirmación solo mientras haya algo que confirmar: en una llamada ya ocurrida el
        # stepper de precall no tiene nada que ofrecer y el 100% confirmado es mentira.
        'conf': clave in ('sin_agenda', 'por_confirmar', 'confirmando', 'confirmada',
                          'sin_reportar', 'reportada_sin_resultado'),
        'resultado': bool(estado_agenda),
        # Cobro: solo para quien ya compró. Sin venta no hay deuda ni plan que armar.
        'acciones': bool(tiene_venta) or deuda > UMBRAL_DEUDA,
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
