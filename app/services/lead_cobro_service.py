"""Sub-etapa de cobro de un cliente que ya compró.

`CloserFollowUpService.get_client_lead_stage` responde 'cerrada' para TODO cliente con una
venta registrada, sin distinguir entre los cuatro momentos muy distintos que caben adentro de
esa palabra: el que debe y nunca se le armó el cronograma de cuotas, el que tiene una cuota
vencida, el que tiene una cuota por vencer y el que ya no debe nada y toca acompañarlo. El
closer los trabaja distinto en cada caso, así que el modal necesita saber en cuál está para
abrir el paso correcto en vez de mostrar siempre la misma pantalla de cobro.

Esta función es a propósito PURA (recibe la deuda y la próxima cuota ya calculadas, no toca la
base): el cruce cliente↔venta y el cálculo de deuda ya viven en `CloserFollowUpService` con sus
propias reglas y su propia historia de bugs, y duplicarlos acá los haría divergir. Acá solo se
decide, con esos números en la mano, qué le toca hacer al closer ahora."""
from datetime import date, datetime

# Por debajo de este saldo se considera que el cliente está al día: los montos vienen de sumas
# de floats (pagos parciales, cuotas repartidas con round a 2 decimales) y un resto de centavos
# no es una deuda real que valga la pena cobrarle a nadie. Mismo umbral que ya usan
# `_build_cartera_item` y `get_client_lead_stage` para decidir si hay deuda.
UMBRAL_DEUDA = 0.01

# A los dos meses de haber entrado al programa el seguimiento deja de ser "cómo vas" y pasa a
# ser la conversación de renovación/upsell. Es el plazo que usa el equipo comercial.
DIAS_PERMANENCIA = 60

# Vocabulario de acciones que el modal sabe abrir. El backend nombra la acción, el frontend
# decide con qué paso la resuelve — así agregar un paso nuevo no obliga a tocar las dos capas.
ACCION_ARMAR_PLAN = 'armar_plan'
ACCION_REGISTRAR_COBRO = 'registrar_cobro'
ACCION_PROGRAMAR_COBRO = 'programar_cobro'
ACCION_MARCAR_NO_PAGA = 'marcar_no_paga'
ACCION_REGISTRAR_RENOVACION = 'registrar_renovacion'
ACCION_VER_HISTORIAL = 'ver_historial'


def _a_fecha(valor):
    """Acepta date, datetime o 'YYYY-MM-DD' (que es como viajan las fechas de cuota en los
    payloads ya serializados de `proxima_cuota`). None si no se puede leer."""
    if valor is None or valor == '':
        return None
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    try:
        return datetime.strptime(str(valor)[:10], '%Y-%m-%d').date()
    except ValueError:
        return None


def _dias_desde(valor, hoy):
    fecha = _a_fecha(valor)
    return (hoy - fecha).days if fecha else None


def clave_de_etapa(deuda, proxima_cuota=None, enrollment_date=None, hoy=None):
    """La clave de la sub-etapa, sin el texto. Separada de `resolver_etapa` para poder ordenar
    y agrupar listas de clientes por urgencia sin construir el descriptor completo de cada uno."""
    hoy = hoy or date.today()
    deuda = float(deuda or 0.0)

    if deuda > UMBRAL_DEUDA:
        # `sin_plan` es el pseudo-objeto que arma `_build_cartera_item` para el cliente que debe
        # pero nunca pasó por el armador de cronograma (muy común en ventas históricas): no hay
        # cuota que cobrar todavía, lo primero es ponerle el plan.
        if not proxima_cuota or proxima_cuota.get('sin_plan'):
            return 'sin_plan'
        vencimiento = _a_fecha(proxima_cuota.get('fecha_vencimiento'))
        if vencimiento is None:
            return 'sin_plan'
        if vencimiento < hoy:
            return 'cuota_vencida'
        if vencimiento == hoy:
            return 'cuota_hoy'
        return 'cuota_proxima'

    dias = _dias_desde(enrollment_date, hoy)
    if dias is None:
        # Compró pero no hay Enrollment con fecha (ventas cargadas solo como FinancialSale): no
        # se puede saber si le toca permanencia o renovación, así que se deja el caso neutro.
        return 'al_dia'
    return 'renovacion' if dias >= DIAS_PERMANENCIA else 'permanencia'


def _moneda(monto):
    return f"${float(monto or 0):,.0f}".replace(',', '.')


def _plural_dias(n):
    return '1 día' if n == 1 else f'{n} días'


def resolver_etapa(deuda, proxima_cuota=None, enrollment_date=None, hoy=None):
    """Descriptor completo de en qué momento del cobro está el cliente.

    Devuelve `clave`, los textos que el modal muestra como encabezado, el `tono` del chip (mismo
    vocabulario de tonos que ya usa el dashboard comercial) y la lista de acciones, con la
    principal marcada — el modal abre esa por defecto para que el closer no tenga que elegir."""
    hoy = hoy or date.today()
    deuda = float(deuda or 0.0)
    clave = clave_de_etapa(deuda, proxima_cuota, enrollment_date, hoy)
    cuota = proxima_cuota or {}

    if clave == 'sin_plan':
        return {
            'clave': clave,
            'titulo': f'Debe {_moneda(deuda)} y no tiene plan de cuotas',
            'subtitulo': 'Armale el cronograma para poder cobrarle con fechas.',
            'tono': 'warning',
            'deuda': deuda,
            'accion_principal': ACCION_ARMAR_PLAN,
            'acciones': [ACCION_ARMAR_PLAN, ACCION_REGISTRAR_COBRO, ACCION_VER_HISTORIAL],
        }

    if clave == 'cuota_vencida':
        atraso = (hoy - _a_fecha(cuota.get('fecha_vencimiento'))).days
        return {
            'clave': clave,
            'titulo': f'Cuota vencida hace {_plural_dias(atraso)} · {_moneda(cuota.get("monto"))}',
            'subtitulo': 'Es lo más urgente de este cliente: cobrá o dejá agendado el próximo intento.',
            'tono': 'error',
            'deuda': deuda,
            'dias_atraso': atraso,
            'accion_principal': ACCION_REGISTRAR_COBRO,
            'acciones': [ACCION_REGISTRAR_COBRO, ACCION_PROGRAMAR_COBRO, ACCION_MARCAR_NO_PAGA, ACCION_VER_HISTORIAL],
        }

    if clave == 'cuota_hoy':
        return {
            'clave': clave,
            'titulo': f'Cuota que vence hoy · {_moneda(cuota.get("monto"))}',
            'subtitulo': 'Escribile hoy: todavía no está vencida.',
            'tono': 'warning',
            'deuda': deuda,
            'dias_atraso': 0,
            'accion_principal': ACCION_REGISTRAR_COBRO,
            'acciones': [ACCION_REGISTRAR_COBRO, ACCION_PROGRAMAR_COBRO, ACCION_VER_HISTORIAL],
        }

    if clave == 'cuota_proxima':
        faltan = (_a_fecha(cuota.get('fecha_vencimiento')) - hoy).days
        return {
            'clave': clave,
            'titulo': f'Próxima cuota en {_plural_dias(faltan)} · {_moneda(cuota.get("monto"))}',
            'subtitulo': 'Está al día. Dejá agendado el recordatorio del cobro.',
            'tono': 'primary',
            'deuda': deuda,
            'dias_para_vencer': faltan,
            'accion_principal': ACCION_PROGRAMAR_COBRO,
            'acciones': [ACCION_PROGRAMAR_COBRO, ACCION_REGISTRAR_COBRO, ACCION_VER_HISTORIAL],
        }

    if clave == 'renovacion':
        dias = _dias_desde(enrollment_date, hoy)
        return {
            'clave': clave,
            'titulo': f'Al día · lleva {_plural_dias(dias)} en el programa',
            'subtitulo': 'Momento de hablar de renovación o de un upsell.',
            'tono': 'success',
            'deuda': deuda,
            'dias_en_programa': dias,
            'accion_principal': ACCION_REGISTRAR_RENOVACION,
            'acciones': [ACCION_REGISTRAR_RENOVACION, ACCION_PROGRAMAR_COBRO, ACCION_VER_HISTORIAL],
        }

    if clave == 'permanencia':
        dias = _dias_desde(enrollment_date, hoy)
        return {
            'clave': clave,
            'titulo': f'Al día · entró hace {_plural_dias(dias)}',
            'subtitulo': 'No hay nada que cobrarle: el seguimiento es cómo le está yendo.',
            'tono': 'success',
            'deuda': deuda,
            'dias_en_programa': dias,
            'accion_principal': ACCION_PROGRAMAR_COBRO,
            'acciones': [ACCION_PROGRAMAR_COBRO, ACCION_REGISTRAR_RENOVACION, ACCION_VER_HISTORIAL],
        }

    return {
        'clave': 'al_dia',
        'titulo': 'Al día · no debe nada',
        'subtitulo': 'Sin deuda pendiente y sin fecha de ingreso registrada.',
        'tono': 'success',
        'deuda': deuda,
        'accion_principal': ACCION_PROGRAMAR_COBRO,
        'acciones': [ACCION_PROGRAMAR_COBRO, ACCION_REGISTRAR_RENOVACION, ACCION_VER_HISTORIAL],
    }
