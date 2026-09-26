import { describe, it, expect } from 'vitest';
import {
  repartirCuotas, repartirParejo, cuadre, moneda, sumarMeses, redimensionar,
  CANTIDADES_SUGERIDAS, ESTADOS_CUOTA, round2,
} from './planCuotas';

describe('repartirCuotas', () => {
  it('reparte parejo cuando divide exacto', () => {
    expect(repartirCuotas(4, 2000)).toEqual([500, 500, 500, 500]);
  });

  it('la última cuota absorbe la diferencia del redondeo', () => {
    const montos = repartirCuotas(3, 1000);
    expect(montos).toEqual([333.33, 333.33, 333.34]);
    expect(round2(montos.reduce((a, b) => a + b, 0))).toBe(1000);
  });

  it('respeta los montos tocados a mano y la última sigue cerrando la suma', () => {
    const montos = repartirCuotas(4, 2000, { 1: '800', 2: '400' });
    expect(montos.slice(0, 3)).toEqual([800, 400, 500]);
    expect(round2(montos.reduce((a, b) => a + b, 0))).toBe(2000);
    expect(montos[3]).toBe(300);
  });

  it('la última puede quedar negativa si el closer se pasó, para que se note', () => {
    const montos = repartirCuotas(2, 1000, { 1: '1500' });
    expect(montos).toEqual([1500, -500]);
  });

  it('una sola cuota se lleva todo el total', () => {
    expect(repartirCuotas(1, 1750.5)).toEqual([1750.5]);
  });

  it('cero cuotas no devuelve nada', () => {
    expect(repartirCuotas(0, 1000)).toEqual([]);
  });

  it('repartirParejo ignora los montos a mano', () => {
    expect(repartirParejo(2, 1000)).toEqual([500, 500]);
  });
});

describe('cuadre', () => {
  const filas = (montos) => montos.map((m) => ({ monto: m }));

  it('avisa que cuadra cuando la suma da el total', () => {
    expect(cuadre(2000, filas([500, 500, 500, 500]))).toMatchObject({
      suma: 2000, diferencia: 0, cuadra: true, mensaje: 'Cuadra con el total', tono: 'success',
    });
  });

  it('avisa cuánto falta por asignar', () => {
    expect(cuadre(2000, filas([500, 500]))).toMatchObject({
      suma: 1000, cuadra: false, mensaje: 'Faltan $1,000 por asignar', tono: 'warning',
    });
  });

  it('avisa cuánto se pasó', () => {
    expect(cuadre(2000, filas([1500, 900]))).toMatchObject({
      suma: 2400, cuadra: false, mensaje: 'Te pasaste $400', tono: 'warning',
    });
  });

  it('trata los montos vacíos o de texto como cero', () => {
    expect(cuadre(1000, filas(['', null, '250'])).suma).toBe(250);
  });

  it('sin filas todo el total queda por asignar', () => {
    expect(cuadre(500, []).mensaje).toBe('Faltan $500 por asignar');
  });
});

describe('sumarMeses', () => {
  it('suma meses conservando el día', () => {
    expect(sumarMeses('2026-10-25', 1)).toBe('2026-11-25');
    expect(sumarMeses('2026-10-25', 3)).toBe('2027-01-25');
  });

  it('clampea al último día del mes cuando el día no existe', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(sumarMeses('2026-08-31', 1)).toBe('2026-09-30');
  });

  it('devuelve la entrada si no es una fecha', () => {
    expect(sumarMeses('', 1)).toBe('');
  });
});

describe('redimensionar', () => {
  const base = [
    { fecha: '2026-10-25', monto: 500, estado: 'pagado' },
    { fecha: '2026-11-25', monto: 500, estado: 'pendiente' },
  ];

  it('agranda el plan encadenando fechas mensuales', () => {
    const filas = redimensionar(base, 4, 2000, '2026-10-25');
    expect(filas).toHaveLength(4);
    expect(filas.map((f) => f.fecha)).toEqual(['2026-10-25', '2026-11-25', '2026-12-25', '2027-01-25']);
    expect(filas.map((f) => f.monto)).toEqual([500, 500, 500, 500]);
  });

  it('conserva el estado de las cuotas que ya existían', () => {
    expect(redimensionar(base, 4, 2000, '2026-10-25')[0].estado).toBe('pagado');
  });

  it('achica el plan recortando desde el final y recalcula los montos', () => {
    const filas = redimensionar(base, 1, 900, '2026-10-25');
    expect(filas).toHaveLength(1);
    expect(filas[0].monto).toBe(900);
  });

  it('desde cero usa la primera fecha dada', () => {
    expect(redimensionar([], 2, 1000, '2026-12-01')[0].fecha).toBe('2026-12-01');
  });
});

describe('constantes', () => {
  it('las píldoras de cantidad son las del mockup', () => {
    expect(CANTIDADES_SUGERIDAS).toEqual([1, 2, 3, 4, 6, 8, 12]);
  });

  it('los estados de cuota son los tres del modelo', () => {
    expect(ESTADOS_CUOTA.map((e) => e.valor)).toEqual(['pendiente', 'pagado', 'vencido']);
  });

  it('el formato de moneda no pierde centavos', () => {
    expect(moneda(1234.5)).toBe('$1,234.5');
    expect(moneda(0)).toBe('$0');
  });
});
