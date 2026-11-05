"""Learnito lee un comprobante con Claude y devuelve sus datos; no decide nada (eso es `validacion`).

Imagen y PDF van como archivo; CSV y texto, como texto. La respuesta sale por una herramienta forzada
(`registrar_comprobante`), así siempre vuelve con la misma forma. Un extracto con varios movimientos trae
la lista (`movimientos`) y, si uno es el del pago declarado, ese en los campos principales.
"""
import base64
import logging

from app.services.claude_service import ClaudeService

logger = logging.getLogger(__name__)

FEATURE = 'comprobante_pago'
MODELO = 'claude-sonnet-5-5'
TEXTO_MAX = 60_000

_NUM = {'type': ['number', 'null']}
_TXT = {'type': ['string', 'null']}

HERRAMIENTA = {
    'name': 'registrar_comprobante',
    'description': 'Registra los datos leídos del comprobante. Lo que no figura va en null: nunca se inventa.',
    'input_schema': {
        'type': 'object',
        'properties': {
            'es_comprobante': {'type': 'boolean', 'description': 'Si el archivo muestra un pago o movimiento de dinero.'},
            'origen': {'type': 'string', 'enum': ['transferencia', 'stripe', 'hotmart', 'paypal', 'extracto', 'otro'],
                       'description': 'Qué es: comprobante de transferencia bancaria, recibo o panel de Stripe, de '
                                      'Hotmart, de PayPal, un extracto con varios movimientos u otro.'},
            'estado': {'type': 'string', 'enum': ['aprobado', 'pendiente', 'rechazado', 'desconocido']},
            'fecha': {**_TXT, 'description': 'Fecha del pago, YYYY-MM-DD.'},
            'monto': {**_NUM, 'description': 'Monto bruto pagado por el cliente.'},
            'moneda': {**_TXT, 'description': 'Código ISO (USD, ARS, MXN, COP...).'},
            'neto': {**_NUM, 'description': 'Lo que se acredita después de la comisión, solo si figura.'},
            'comision': {**_NUM, 'description': 'La comisión o fee de la plataforma, solo si figura.'},
            'numero_operacion': {**_TXT, 'description': 'Número de operación, transacción, recibo o referencia.'},
            'pagador_nombre': _TXT,
            'pagador_email': _TXT,
            'beneficiario': {**_TXT, 'description': 'A quién o a qué cuenta se le pagó.'},
            'movimientos': {'type': 'array', 'description': 'Solo en un extracto: cada movimiento de ingreso.',
                            'items': {'type': 'object', 'properties': {
                                'fecha': _TXT, 'monto': _NUM, 'moneda': _TXT, 'descripcion': _TXT}}},
            'observaciones': {**_TXT, 'description': 'Algo raro: editado, ilegible, otra persona, un pago parcial.'},
        },
        'required': ['es_comprobante', 'origen', 'estado'],
    },
}

SISTEMA = (
    'Sos Learnito, el asistente de Learnation. Leés comprobantes de pago que suben los closers para '
    'respaldar un pago que declararon. Extraés los datos tal como figuran, sin corregirlos ni '
    'completarlos, y marcás en observaciones cualquier señal de que el comprobante está editado, '
    'incompleto o es de otro pago. El pago declarado se te da solo para ubicar el movimiento correcto '
    'en un extracto: no copies sus datos si el archivo no los muestra.'
)


def _bloque_del_archivo(datos, tipo):
    if tipo.startswith('image/'):
        return {'type': 'image', 'source': {'type': 'base64', 'media_type': tipo,
                                            'data': base64.b64encode(datos).decode()}}
    if tipo == 'application/pdf':
        return {'type': 'document', 'source': {'type': 'base64', 'media_type': tipo,
                                               'data': base64.b64encode(datos).decode()}}
    texto = datos.decode('utf-8', errors='replace')[:TEXTO_MAX]
    return {'type': 'text', 'text': f'Contenido del archivo:\n\n{texto}'}


def leer(datos, tipo, declarado, user_id):
    """Los datos del comprobante (dict de `HERRAMIENTA`). `declarado`: {cliente, monto, fecha, medio}.
    Lanza `ClaudeServiceError` si Claude falla."""
    pedido = (f"Pago declarado: {declarado.get('cliente')}, US$ {declarado.get('monto')}, "
              f"{declarado.get('fecha')}, por {declarado.get('medio')}. Leé el comprobante adjunto.")
    respuesta = ClaudeService.create_message(
        FEATURE, user_id, model=MODELO, max_tokens=2000, system=SISTEMA,
        tools=[HERRAMIENTA], tool_choice={'type': 'tool', 'name': HERRAMIENTA['name']},
        messages=[{'role': 'user', 'content': [_bloque_del_archivo(datos, tipo), {'type': 'text', 'text': pedido}]}])
    for bloque in respuesta.content:
        if getattr(bloque, 'type', None) == 'tool_use':
            return dict(bloque.input)
    logger.error(f'[COMPROBANTE] Claude no devolvió la lectura (usuario {user_id})')
    return {'es_comprobante': False, 'origen': 'otro', 'estado': 'desconocido',
            'observaciones': 'No se pudo leer el archivo.'}
