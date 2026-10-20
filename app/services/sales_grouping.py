"""Agrupado de los pagos históricos (`FinancialSale`) en ventas (`Sale`) (20/10/2026).

Hasta hoy cada pago era una «venta». Para darle a cada pago su venta se recorren los pagos de cada
cliente y programa en orden de fecha, con las mismas reglas que ya usa el sistema:
  · renovación y upsell abren siempre una venta nueva (decisión de Santiago, 20/10);
  · completo o parcial abren una venta nueva, salvo que la venta abierta sea solo seña (es el saldo
    de esa seña) o que sea el resto de una venta nueva a pocos días (`ticket_service._misma_venta`,
    el criterio de Kerwin para el ticket);
  · la seña abre una venta nueva, salvo que la abierta sea solo seña (una segunda seña);
  · la cuota se suma a la venta abierta. Si es la primera cuota después de una seña sola, cuenta
    solo a menos de un mes (`senas_conversion`, `ticket_service.es_primera_cuota`): más tarde se
    suma igual, pero la venta queda para revisar.
Lo que no encaja se agrupa igual y la venta lleva `review_note` con el motivo: ningún pago se
queda sin venta por una duda.

Función pura sobre tuplas, sin base: el script `scripts/backfill_sales.py` lee y escribe.
"""
from collections import Counter
from dataclasses import dataclass, field

from app.services.closer_service import PROGRAM_LABELS, _program_from_examen
from app.services.sheets_service import SheetsService
from app.services.ticket_service import _dia, _misma_venta, _unir_clientes, claves_de_cliente, es_primera_cuota

KIND_DE_TIPO = {'renovacion': 'renewal', 'upsell': 'upsell'}
CODIGO_DE_LABEL = {label: codigo for codigo, label in PROGRAM_LABELS.items()}

NOTA_CUOTA_SIN_VENTA = 'cuota sin una venta anterior registrada'
NOTA_CUOTA_TARDE = 'cuota a más de un mes de la seña'
NOTA_CUOTA_DE_COMPLETO = 'cuota después de un pago completo'
NOTA_SIN_TIPO = 'tipo de pago no reconocido'
NOTA_SIN_PROGRAMA = 'sin programa'
NOTA_SIN_CLIENTE = 'no se sabe de qué cliente es'


@dataclass
class Pago:
    id: int
    claves: tuple
    programa: str | None
    tipo: str | None
    dia: object
    client_id: int | None = None
    vendedor: str | None = None
    setter: str | None = None


@dataclass
class Venta:
    programa: str | None
    kind: str
    pagos: list = field(default_factory=list)
    notas: list = field(default_factory=list)

    @property
    def tipos(self):
        return [p.tipo for p in self.pagos]

    @property
    def solo_sena(self):
        return bool(self.pagos) and all(t == 'seña' for t in self.tipos)

    @property
    def ultimo_de_venta(self):
        """El día del último completo o parcial: hasta ahí llega «a pocos días» del resto."""
        return next((p.dia for p in reversed(self.pagos) if p.tipo in ('completo', 'parcial')), None)

    @property
    def client_id(self):
        ids = Counter(p.client_id for p in self.pagos if p.client_id)
        return ids.most_common(1)[0][0] if ids else None

    @property
    def review_note(self):
        return '; '.join(dict.fromkeys(self.notas))[:255] or None

    def anotar(self, nota):
        self.notas.append(nota)


def pago_de_fila(fila):
    """El `Pago` de una fila de `FinancialSale` (o de cualquier objeto con sus columnas)."""
    raw = fila.raw_data if isinstance(getattr(fila, 'raw_data', None), dict) else {}
    codigo, tipo = SheetsService.parse_tipo_pago(fila.tipo_pago or raw.get('tipo_pago'))
    codigo = codigo or CODIGO_DE_LABEL.get(_program_from_examen(fila.examen))
    claves = claves_de_cliente(fila.client_id, fila.mail_cliente, fila.instagram, fila.nombre_cliente,
                               getattr(fila, 'person_uuid', None))
    return Pago(id=fila.id, claves=claves,
                programa=codigo, tipo=tipo, dia=_dia(fila.date), client_id=fila.client_id,
                vendedor=fila.email_vendedor, setter=fila.setter)


def _abre_venta(abierta, pago):
    """¿Este pago empieza una venta nueva, o se suma a la `abierta`?"""
    if pago.tipo in KIND_DE_TIPO or abierta is None:
        return True
    if pago.tipo == 'cuota':
        return False
    if abierta.solo_sena:
        return False  # saldo de la seña, o una segunda seña
    if pago.tipo in ('completo', 'parcial') and abierta.kind == 'new':
        return not _misma_venta(abierta.ultimo_de_venta, pago.dia)
    return True


def decidir(abierta, pago):
    """(¿abre una venta nueva?, notas para revisar) de `pago` frente a la venta `abierta` del mismo
    cliente y programa (None si no tiene). La usan el agrupado retroactivo y cada pago nuevo
    (`sale_service`): una sola regla."""
    if not pago.tipo:
        return abierta is None, [NOTA_SIN_TIPO]
    if _abre_venta(abierta, pago):
        return True, [NOTA_CUOTA_SIN_VENTA] if pago.tipo == 'cuota' else []
    notas = []
    if pago.tipo == 'cuota':
        primero = abierta.pagos[0].dia
        if abierta.solo_sena and pago.dia and primero and not es_primera_cuota(primero, pago.dia):
            notas.append(NOTA_CUOTA_TARDE)
        if abierta.tipos[0] == 'completo' and 'parcial' not in abierta.tipos:
            notas.append(NOTA_CUOTA_DE_COMPLETO)
    return False, notas


def _ventas_de(pagos):
    """Las ventas de los pagos de un cliente en un programa, ya ordenados por fecha."""
    ventas, abierta = [], None
    for pago in pagos:
        abre, notas = decidir(abierta, pago)
        if abre:
            abierta = Venta(pago.programa, KIND_DE_TIPO.get(pago.tipo, 'new'))
            ventas.append(abierta)
        for nota in notas:
            abierta.anotar(nota)
        abierta.pagos.append(pago)
    return ventas


def agrupar(pagos):
    """[Venta] de una lista de `Pago` de cualquier cliente. Un pago sin claves de cliente es una
    venta suelta para revisar; uno sin programa se agrupa con los otros sin programa del cliente."""
    clientes = _unir_clientes([p.claves for p in pagos])
    grupos, sueltas = {}, []
    for cliente, pago in zip(clientes, pagos):
        if cliente is None:
            venta = Venta(pago.programa, KIND_DE_TIPO.get(pago.tipo, 'new'), [pago])
            venta.anotar(NOTA_SIN_CLIENTE)
            sueltas.append(venta)
            continue
        grupos.setdefault((cliente, pago.programa), []).append(pago)

    ventas = list(sueltas)
    for (_, programa), lista in grupos.items():
        lista.sort(key=lambda p: (p.dia is None, p.dia, p.id))
        for venta in _ventas_de(lista):
            if programa is None:
                venta.anotar(NOTA_SIN_PROGRAMA)
            ventas.append(venta)
    return ventas


def resumen(ventas, sin_agrupar=0):
    """Los números del agrupado, para el modo de prueba del script."""
    notas = Counter(n for v in ventas for n in dict.fromkeys(v.notas))
    return {
        'pagos': sum(len(v.pagos) for v in ventas),
        'ventas': len(ventas),
        'por_tipo': dict(Counter(v.kind for v in ventas)),
        'solo_sena': sum(1 for v in ventas if v.solo_sena),
        'para_revisar': sum(1 for v in ventas if v.notas),
        'motivos': dict(notas),
        'pagos_fuera': sin_agrupar,
    }
