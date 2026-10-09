"""Leer los CSV de Stripe y Hotmart para la pestaña Diferencias de Finanzas (09/10/2026).

Kerwin trae dos formatos, los de su planilla de conciliación:

  · Stripe: `Created date (UTC),Amount,Fee,Total,Card Name,Customer Email,Notas`. `Amount` es el
    bruto (lo que pagó el cliente), `Fee` la comisión de Stripe y `Total` el neto. La hora viene en
    UTC y a veces sin el cero de la hora («2026-09-25 3:36:46»). «Notas» la escribe él a mano.
  · Hotmart: `Fecha de venta,Nombre,Precio de la Oferta,precio bruto,comision,porcentaje de
    comision,Email`, con fecha «30/09/2026 19:53:14» (día/mes/año). Contra las ventas del sistema
    (copia de local.db del 09/10): lo reportado es SIEMPRE el «precio bruto» (Beatriz Saraí Olivera,
    RR - Completo de $2.000: bruto 2000, oferta 1837.12, comisión 162.88), «Precio de la Oferta» es
    lo que llegó (el neto) y «comision» = bruto − neto. El «porcentaje de comision» es sobre el NETO
    (162.88 / 1837.12 = 8,87 %), no sobre el bruto: no se usa. Las filas sin «precio bruto» y con
    comisión de −100 % (montos chicos: 16.14, 6.73) se leen como ingreso con el bruto igual al neto y
    marcadas `bruto_desconocido`.

Además se aceptan los encabezados de los exports crudos de cada pasarela (en castellano, portugués e
inglés, ver `ALIAS`), sin importar mayúsculas, tildes ni espacios, y el separador `,`, `;` o tab. La
pasarela se reconoce por los encabezados (`detectar_pasarela`), y si no alcanza, por el nombre del
archivo; si tampoco, el que sube la elige (`CsvInvalido` con `codigo='pasarela'`).

Las fechas quedan como hora de UTC−3 sin zona (`ZONA`): el export de septiembre de Stripe va del
01/09 03:05 UTC al 01/10 00:25 UTC, que es exactamente septiembre en UTC−3 (el horario de la cuenta
de Stripe), y Hotmart es brasileña y exporta en esa misma hora. Así el mes de la pasarela es el mes
de Finanzas. Una fecha de Stripe se pasa de UTC a esa zona solo si su columna o su valor dicen UTC.
"""
import csv
import io
import re
import unicodedata
from datetime import datetime

import pytz

ZONA = 'America/Sao_Paulo'
PASARELAS = {'stripe': 'Stripe', 'hotmart': 'Hotmart'}

# Un archivo de conciliación es de un mes o de unos pocos: con esto alcanza y sobra.
MAX_BYTES = 5 * 1024 * 1024
MAX_FILAS = 20000


class CsvInvalido(ValueError):
    """El archivo no se puede leer como un export de pasarela. `codigo='pasarela'` es que no se sabe de
    cuál es y hay que elegirla; `columnas` son los encabezados que trajo, para decir qué faltó."""

    def __init__(self, mensaje, codigo='invalido', columnas=None):
        super().__init__(mensaje)
        self.codigo = codigo
        self.columnas = columnas or []


def normal(texto):
    """'Created date (UTC)' -> 'created date (utc)'; 'Comisión ' -> 'comision'."""
    texto = unicodedata.normalize('NFKD', str(texto or '')).encode('ascii', 'ignore').decode()
    return re.sub(r'\s+', ' ', texto.replace('﻿', '').strip().strip('"').strip()).lower()


# Cada dato con sus nombres posibles, del más específico al más general: si un archivo trae dos que
# sirven, gana el primero de la lista (en Hotmart, «mi comisión» es el neto con más certeza que
# «precio de la oferta», que en la planilla de Kerwin es el neto).
NOTAS = ['notas', 'nota', 'notes', 'note', 'comentarios', 'comentario', 'observaciones']
ESTADO = ['status', 'estado', 'status de la transaccion', 'estado de la transaccion', 'status da transacao',
          'transaction status', 'payment status']
ALIAS = {
    'stripe': {
        'fecha': ['created date (utc)', 'created (utc)', 'created date', 'created', 'fecha (utc)', 'fecha',
                  'fecha de creacion', 'date'],
        'bruto': ['converted amount', 'amount', 'monto', 'importe', 'bruto', 'monto bruto', 'gross'],
        'comision': ['fee', 'fees', 'comision', 'tarifa', 'stripe fee'],
        'neto': ['net', 'total', 'neto', 'monto neto'],
        'nombre': ['card name', 'customer name', 'billing name', 'nombre', 'name', 'cliente',
                   'customer description'],
        'email': ['customer email', 'email', 'correo', 'e-mail', 'receipt email'],
        'nota': NOTAS,
        'estado': ESTADO,
    },
    'hotmart': {
        'fecha': ['fecha de venta', 'fecha de la venta', 'fecha de compra', 'fecha de pedido',
                  'fecha de aprobacion', 'fecha de transaccion', 'data da venda', 'data de venda',
                  'data do pedido', 'data de aprovacao', 'data da transacao', 'purchase date', 'order date',
                  'approval date', 'transaction date', 'fecha', 'data', 'date'],
        'bruto': ['precio bruto', 'valor bruto', 'monto bruto', 'bruto', 'valor de compra con impuestos',
                  'valor da compra com impostos', 'valor de compra com impostos', 'purchase value with taxes',
                  'precio total', 'valor total', 'total price', 'gross', 'monto', 'importe', 'valor', 'amount'],
        'neto': ['mi comision', 'minha comissao', 'your commission', 'comision del productor',
                 'comissao do produtor', 'valor recibido', 'valor que recibi', 'valor liquido', 'neto',
                 'monto neto', 'net', 'precio de la oferta', 'preco da oferta', 'offer price'],
        'comision': ['comision', 'comision hotmart', 'tarifa hotmart', 'taxa hotmart', 'hotmart fee',
                     'tarifa', 'taxa', 'fee'],
        'nombre': ['nombre', 'nombre del comprador', 'comprador', 'nome do comprador', 'nome', 'buyer name',
                   'buyer', 'cliente', 'name'],
        'email': ['email', 'email del comprador', 'email do comprador', 'e-mail do comprador', 'buyer email',
                  'correo', 'correo del comprador', 'e-mail'],
        'nota': NOTAS,
        'estado': ESTADO,
    },
}

# Encabezados que solo trae una de las dos: con ellos se sabe de cuál es el archivo.
FIRMAS = {
    'stripe': {'created date (utc)', 'created (utc)', 'card name', 'customer email', 'card last4',
               'card brand', 'customer id', 'paymentintent id', 'payment intent id', 'converted amount',
               'seller message', 'statement descriptor', 'card fingerprint'},
    'hotmart': {'precio de la oferta', 'precio bruto', 'fecha de venta', 'porcentaje de comision',
                'data da venda', 'preco da oferta', 'nombre del comprador', 'nome do comprador',
                'email del comprador', 'email do comprador', 'codigo de transaccion', 'codigo da transacao',
                'transacao', 'mi comision', 'minha comissao', 'comision del productor', 'comissao do produtor',
                'valor de compra con impuestos', 'valor da compra com impostos'},
}

# Un cobro que no entró no es ingreso: con una columna de estado, solo cuentan estos.
EXITOSOS = {'paid', 'succeeded', 'success', 'successful', 'captured', 'complete', 'completed', 'completo',
            'completa', 'completado', 'completada', 'aprobado', 'aprobada', 'approved', 'aprovado',
            'aprovada', 'pagado', 'pagada', 'pago', 'confirmed', 'confirmado', 'confirmada', 'disponible',
            'available'}


# --- Montos y fechas ------------------------------------------------------------------------------

def monto(texto):
    """'1,400.50', '1.400,50', '1400,5', '$ 1,400', 'US$100', '28.12%', '-16.14' -> float; '' -> None.

    Con los dos separadores, el último es el decimal. Con uno solo, es decimal salvo que lo sigan
    exactamente tres dígitos (o se repita): '1,400' y '1.400' son mil cuatrocientos, que es como se
    escribe un monto redondo en cualquiera de los dos estilos; un centavo nunca lleva tres cifras.
    """
    if texto is None:
        return None
    crudo = str(texto).strip()
    if not crudo:
        return None
    negativo = crudo.startswith('-') or crudo.endswith('-') or (crudo.startswith('(') and crudo.endswith(')'))
    limpio = re.sub(r'[^0-9.,]', '', crudo)
    if not re.search(r'\d', limpio):
        return None
    if '.' in limpio and ',' in limpio:
        decimal = '.' if limpio.rfind('.') > limpio.rfind(',') else ','
        miles = ',' if decimal == '.' else '.'
        limpio = limpio.replace(miles, '').replace(decimal, '.')
    elif ',' in limpio or '.' in limpio:
        sep = ',' if ',' in limpio else '.'
        partes = limpio.split(sep)
        if len(partes) > 2 or len(partes[-1]) == 3:
            limpio = limpio.replace(sep, '')
        else:
            limpio = limpio.replace(sep, '.')
    try:
        valor = float(limpio)
    except ValueError:
        return None
    return -valor if negativo else valor


_ISO = re.compile(r'^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?'
                  r'\s*(Z|UTC|[+-]\d{2}:?\d{2})?$', re.I)
_DMA = re.compile(r'^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?'
                  r'\s*([ap])?\.?\s*m?\.?)?\s*(Z|UTC|[+-]\d{2}:?\d{2})?$', re.I)


def _zona(texto):
    """La zona escrita al final de una fecha: pytz.utc, un desplazamiento fijo o None."""
    if not texto:
        return None
    if texto.upper() in ('Z', 'UTC'):
        return pytz.utc
    signo = -1 if texto[0] == '-' else 1
    digitos = texto[1:].replace(':', '')
    return pytz.FixedOffset(signo * (int(digitos[:2]) * 60 + int(digitos[2:4])))


def fecha(texto, en_utc=False):
    """La fecha de una fila como hora de `ZONA` sin zona, o None si no se entiende.

    '2026-09-27 23:10:31', '2026-09-25 3:36:46', '2026-09-27T23:10:31Z', '30/09/2026 19:53:14',
    '30/09/2026'. Día/mes/año salvo que el segundo número pase de 12 (entonces es mes/día). Con
    `en_utc`, o con la zona escrita en el valor, la hora se pasa a `ZONA`; si no, se toma tal cual.
    """
    crudo = str(texto or '').strip()
    if not crudo:
        return None
    m = _ISO.match(crudo)
    if m:
        anio, mes, dia, hora, minuto, segundo, zona = m.groups()
        ampm = None
    else:
        m = _DMA.match(crudo)
        if not m:
            return None
        dia, mes, anio, hora, minuto, segundo, ampm, zona = m.groups()
        if int(mes) > 12 and int(dia) <= 12:
            dia, mes = mes, dia
        if len(anio) == 2:
            anio = '20' + anio
    try:
        h = int(hora or 0)
        if ampm:
            h = h % 12 + (12 if ampm.lower() == 'p' else 0)
        cuando = datetime(int(anio), int(mes), int(dia), h, int(minuto or 0), int(segundo or 0))
    except ValueError:
        return None
    origen = _zona(zona) or (pytz.utc if en_utc else None)
    if origen is None:
        return cuando
    return origen.localize(cuando).astimezone(pytz.timezone(ZONA)).replace(tzinfo=None)


def email_normal(texto):
    """El correo en minúsculas y sin espacios, o None si no parece uno."""
    valor = str(texto or '').strip().lower().replace(' ', '')
    return valor if '@' in valor and valor not in ('n/a', 'na') else None


def clave_de(pasarela, cuando, email, nombre, bruto):
    """La clave natural de un cobro: pasarela, fecha, correo y bruto. Sin correo, el nombre."""
    quien = email or ('nombre:' + normal(nombre)) if (email or nombre) else ''
    return f'{pasarela}|{cuando.isoformat(timespec="seconds")}|{quien}|{bruto:.2f}'


# --- El archivo -----------------------------------------------------------------------------------

def _texto(contenido):
    if isinstance(contenido, str):
        return contenido
    for codificacion in ('utf-8-sig', 'cp1252'):
        try:
            return contenido.decode(codificacion)
        except UnicodeDecodeError:
            continue
    return contenido.decode('latin-1')


def _filas(texto):
    """(encabezados, filas) del CSV, con el separador que use (',', ';' o tab)."""
    lineas = texto.splitlines()
    separador = None
    if lineas and normal(lineas[0]).startswith('sep='):
        separador = lineas[0].strip()[4:5] or None
        lineas = lineas[1:]
    if not lineas:
        raise CsvInvalido('El archivo está vacío.')
    if not separador:
        primera = lineas[0]
        separador = max((',', ';', '\t'), key=primera.count)
    lector = csv.reader(io.StringIO('\n'.join(lineas)), delimiter=separador)
    filas = [f for f in lector]
    if not filas:
        raise CsvInvalido('El archivo está vacío.')
    return filas[0], filas[1:]


def detectar_pasarela(encabezados, archivo=None):
    """'stripe', 'hotmart' o None, por los encabezados que solo trae una de las dos y, si eso no
    alcanza, por el nombre del archivo."""
    normales = {normal(e) for e in encabezados}
    puntos = {p: len(normales & firma) + sum('hotmart' in e for e in normales if p == 'hotmart')
              for p, firma in FIRMAS.items()}
    if puntos['stripe'] != puntos['hotmart']:
        return max(puntos, key=puntos.get)
    nombre = normal(archivo)
    en_nombre = [p for p in PASARELAS if p in nombre]
    return en_nombre[0] if len(en_nombre) == 1 else None


def _columnas(encabezados, pasarela):
    """{dato -> índice de su columna} con los alias de la pasarela."""
    normales = [normal(e) for e in encabezados]
    columnas = {}
    for dato, alias in ALIAS[pasarela].items():
        for nombre in alias:
            if nombre in normales:
                columnas[dato] = normales.index(nombre)
                break
    return columnas


def leer(contenido, archivo=None, pasarela=None):
    """Lee un export: {pasarela, detectada, filas: [{fecha, nombre, email, bruto, comision, neto,
    bruto_desconocido, nota, clave}], omitidas: [{fila, motivo}], columnas}.

    `pasarela` es la que eligió quien sube; sin ella se detecta (`detectar_pasarela`). Se omite (y se
    cuenta) la fila sin fecha o sin ningún monto, la de un cobro que no entró (una columna de estado
    que no dice pagado o aprobado) y la de un monto negativo o cero, que es un reembolso o un ajuste.
    """
    if isinstance(contenido, (bytes, bytearray)) and len(contenido) > MAX_BYTES:
        raise CsvInvalido('El archivo pesa más de 5 MB: no parece un export de un período.')
    encabezados, filas = _filas(_texto(contenido))
    if len(filas) > MAX_FILAS:
        raise CsvInvalido(f'El archivo trae más de {MAX_FILAS} filas: subí un período más corto.')

    detectada = pasarela is None
    if pasarela is not None and pasarela not in PASARELAS:
        raise CsvInvalido(f'«{pasarela}» no es una pasarela: Stripe o Hotmart.')
    pasarela = pasarela or detectar_pasarela(encabezados, archivo)
    if not pasarela:
        raise CsvInvalido('No se reconoce de qué pasarela es el archivo: elegí Stripe o Hotmart.',
                          codigo='pasarela', columnas=encabezados)

    columnas = _columnas(encabezados, pasarela)
    faltan = [d for d in ('fecha',) if d not in columnas]
    if 'bruto' not in columnas and 'neto' not in columnas:
        faltan.append('monto')
    if faltan:
        raise CsvInvalido(
            f'El archivo de {PASARELAS[pasarela]} no tiene la columna de {" ni la de ".join(faltan)}.',
            codigo='columnas', columnas=encabezados)
    en_utc = 'utc' in normal(encabezados[columnas['fecha']])

    def celda(fila, dato):
        i = columnas.get(dato)
        return fila[i].strip() if i is not None and i < len(fila) else ''

    leidas, omitidas = [], []
    for numero, fila in enumerate(filas, start=2):
        if not any(c.strip() for c in fila):
            continue
        estado = normal(celda(fila, 'estado'))
        if estado and estado not in EXITOSOS:
            omitidas.append({'fila': numero, 'motivo': f'estado «{celda(fila, "estado")}»'})
            continue
        cuando = fecha(celda(fila, 'fecha'), en_utc=en_utc)
        if cuando is None:
            omitidas.append({'fila': numero, 'motivo': 'sin fecha'})
            continue
        bruto, neto, comision = monto(celda(fila, 'bruto')), monto(celda(fila, 'neto')), monto(celda(fila, 'comision'))
        desconocido = bruto is None
        if desconocido:
            bruto, comision = neto, None
        if bruto is None:
            omitidas.append({'fila': numero, 'motivo': 'sin monto'})
            continue
        if bruto <= 0:
            omitidas.append({'fila': numero, 'motivo': 'monto negativo o cero (reembolso o ajuste)'})
            continue
        if not desconocido:
            if comision is None and neto is not None:
                comision = round(bruto - neto, 2)
            if neto is None:
                neto = round(bruto - (comision or 0.0), 2)
        email = email_normal(celda(fila, 'email'))
        nombre = celda(fila, 'nombre') or None
        leidas.append({
            'fecha': cuando, 'nombre': nombre, 'email': email, 'bruto': round(bruto, 2),
            'comision': round(comision, 2) if comision is not None else None,
            'neto': round(neto, 2) if neto is not None else None, 'bruto_desconocido': desconocido,
            'nota': celda(fila, 'nota') or None, 'clave': clave_de(pasarela, cuando, email, nombre, bruto),
        })
    return {'pasarela': pasarela, 'detectada': detectada, 'filas': leidas, 'omitidas': omitidas,
            'columnas': {d: encabezados[i] for d, i in columnas.items()}}
