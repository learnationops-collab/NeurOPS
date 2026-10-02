// Aritmética del plan de cuotas, sin React ni HTTP. Vive aparte del componente porque es la
// parte que no puede equivocarse: si la suma de cuotas no cierra contra el total, el cobro
// queda mal para siempre.
//
// Criterio heredado (no se cambia): la ÚLTIMA cuota absorbe la diferencia. Es el mismo que ya
// aplican `DeclararVentaWizard.cuotaAmounts` (36-46) y el backend en
// `InstallmentService.create_plan`.

export const CANTIDADES_SUGERIDAS = [1, 2, 3, 4, 6, 8, 12];

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Montos de las `n` cuotas para cubrir `total`, respetando los montos que el closer tocó a mano.
 * `montosMap` está indexado en 1 (igual que hoy en el wizard). La última posición siempre se
 * recalcula: nunca se tipea.
 */
export function repartirCuotas(n, total, montosMap) {
  const cantidad = Math.max(0, Math.trunc(Number(n) || 0));
  if (cantidad === 0) return [];
  const objetivo = round2(total);
  const parejo = round2(objetivo / cantidad);
  const montos = [];
  for (let i = 0; i < cantidad - 1; i += 1) {
    const aMano = montosMap?.[i + 1];
    const parsed = aMano !== undefined && aMano !== '' && aMano !== null ? parseFloat(aMano) : NaN;
    montos.push(Number.isNaN(parsed) ? parejo : round2(parsed));
  }
  const acumulado = montos.reduce((a, b) => a + b, 0);
  montos.push(round2(objetivo - acumulado));
  return montos;
}

/** Reparto parejo puro: para el botón «Repartir en partes iguales». */
export const repartirParejo = (n, total) => repartirCuotas(n, total, null);

/**
 * Recalcula la última fila para que la suma cierre contra `total`, dejando las anteriores como
 * están. Es lo que el editor del plan aplica cada vez que se toca una fila.
 *
 * Sin esto la última no se tipeaba pero tampoco se recalculaba: se quedaba con el reparto parejo
 * de antes. Caso real (01/10/2026): total 1500 en 4 cuotas, el closer cargó 250, 250 y 500, y la
 * última siguió en 375 (1500 / 4) en vez de 500; el plan se guardó sumando 1375.
 */
export function cerrarConLaUltima(filas, total) {
  if (!filas?.length) return [];
  const anteriores = filas.slice(0, -1);
  const acumulado = round2(anteriores.reduce((acc, f) => acc + (Number(f.monto) || 0), 0));
  return [...anteriores, { ...filas[filas.length - 1], monto: round2(round2(total) - acumulado) }];
}

/**
 * Estado de cuadre entre el total del plan y las filas cargadas.
 * `tono` sale del design system: success cuando cierra, warning cuando no.
 *
 * Una última cuota en negativo no cuadra aunque la suma dé el total: es que las anteriores se
 * pasaron, y una cuota negativa no se puede cobrar.
 */
export function cuadre(total, filas) {
  const lista = filas || [];
  const suma = round2(lista.reduce((acc, f) => acc + (Number(f.monto) || 0), 0));
  const diferencia = round2(round2(total) - suma);
  const ultima = round2(lista[lista.length - 1]?.monto);
  if (ultima < 0) {
    return {
      suma, diferencia, cuadra: false, negativa: true,
      mensaje: `Te pasaste ${moneda(-ultima)}: bajá alguna cuota`, tono: 'warning',
    };
  }
  if (diferencia === 0) return { suma, diferencia, cuadra: true, mensaje: 'Cuadra con el total', tono: 'success' };
  if (diferencia > 0) {
    return { suma, diferencia, cuadra: false, mensaje: `Faltan ${moneda(diferencia)} por asignar`, tono: 'warning' };
  }
  return { suma, diferencia, cuadra: false, mensaje: `Te pasaste ${moneda(-diferencia)}`, tono: 'warning' };
}

export const moneda = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Suma meses clampeando al último día del mes, igual que `InstallmentService._add_months`. */
export function sumarMeses(iso, meses) {
  const [y, m, d] = String(iso).split('-').map(Number);
  if (!y || !m || !d) return iso;
  const destino = new Date(y, m - 1 + meses, 1);
  const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  const dia = Math.min(d, ultimo);
  return `${destino.getFullYear()}-${String(destino.getMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Cronograma nuevo: `n` filas mensuales a partir de `primeraFecha`, con el total repartido.
 * Conserva el estado y la fecha de las filas que ya existían (no se pisa una cuota ya pagada).
 */
export function redimensionar(filas, n, total, primeraFecha) {
  const cantidad = Math.max(1, Math.trunc(Number(n) || 1));
  const base = (filas || []).slice(0, cantidad).map((f) => ({ ...f }));
  while (base.length < cantidad) {
    const anterior = base[base.length - 1];
    base.push({
      fecha: anterior ? sumarMeses(anterior.fecha, 1) : primeraFecha,
      monto: 0,
      estado: 'pendiente',
    });
  }
  const montos = repartirParejo(cantidad, total);
  return base.map((f, i) => ({ ...f, monto: montos[i] }));
}

export const ESTADOS_CUOTA = [
  { valor: 'pendiente', label: 'Pendiente', tono: 'idle' },
  { valor: 'pagado', label: 'Pagada', tono: 'success' },
  { valor: 'vencido', label: 'Vencida', tono: 'error' },
];
