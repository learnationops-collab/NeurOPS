import { describe, expect, it } from 'vitest';
import {
  elegirAsistencia, faltantesMomentum, motivoRequerido, opcionesContinua, pasosMomentum, payloadMomentum,
} from './arbolMomentum';

describe('arbolMomentum', () => {
  it('pregunta asistencia, después continúa (o la fecha) y el motivo', () => {
    expect(pasosMomentum({})).toEqual(['asistencia']);
    expect(pasosMomentum({ asistencia: 'asistio' })).toEqual(['asistencia', 'continua', 'motivo']);
    expect(pasosMomentum({ asistencia: 'reagenda' })).toEqual(['asistencia', 'fecha', 'motivo']);
    expect(pasosMomentum({ asistencia: 'cancelo' })).toEqual(['asistencia', 'motivo']);
  });

  it('la de seña y la del cierre preguntan lo mismo con otras palabras', () => {
    expect(opcionesContinua('sena').map((o) => [o.valor, o.label])).toEqual([
      ['pago', 'Pagó, sigue'], ['pensando', 'Lo está pensando'], ['no_sigue', 'No sigue']]);
    expect(opcionesContinua('cierre').map((o) => [o.valor, o.label])).toEqual([
      ['pago', 'Hizo upsell'], ['pensando', 'Lo está pensando'], ['no_sigue', 'No por ahora']]);
    expect(opcionesContinua(undefined)).toEqual(opcionesContinua('sena'));
  });

  it('el motivo es obligatorio si no asistió, canceló, lo está pensando o no sigue', () => {
    expect(motivoRequerido({ asistencia: 'asistio', resultado: 'pago' })).toBe(false);
    expect(motivoRequerido({ asistencia: 'reagenda' })).toBe(false);
    ['no_asistio', 'cancelo'].forEach((a) => expect(motivoRequerido({ asistencia: a })).toBe(true));
    ['pensando', 'no_sigue'].forEach((x) => expect(motivoRequerido({ asistencia: 'asistio', resultado: x })).toBe(true));
    expect(faltantesMomentum({ asistencia: 'asistio', resultado: 'no_sigue', motivo: '  ' })).toEqual(['Escribí el motivo']);
    expect(faltantesMomentum({ asistencia: 'asistio' })).toEqual(['Elegí si continúa']);
    expect(faltantesMomentum({ asistencia: 'reagenda' })).toEqual(['Elegí la nueva fecha']);
    expect(faltantesMomentum({ asistencia: 'asistio', resultado: 'pago' })).toEqual([]);
  });

  it('cambiar la asistencia borra lo que dependía de la anterior pero no el motivo', () => {
    const r = elegirAsistencia({ asistencia: 'asistio', resultado: 'pago', motivo: 'x' }, 'reagenda');
    expect(r).toEqual({ asistencia: 'reagenda', motivo: 'x' });
  });

  it('arma el pedido del bloque momentum', () => {
    const { accion, datos } = payloadMomentum({ asistencia: 'asistio', resultado: 'pensando', motivo: ' Lo consulta ' });
    expect(accion).toBe('reportar_resultado');
    expect(datos.momentum).toEqual({ asistencia: 'asistio', resultado: 'pensando', inicio: null, motivo: 'Lo consulta' });
    const reag = payloadMomentum({ asistencia: 'reagenda', resultado: 'pago', fecha: '2026-10-08', hora: '15:30' }).datos.momentum;
    expect(reag.resultado).toBe(null);
    expect(reag.inicio).toBe(new Date(2026, 9, 8, 15, 30).toISOString());
  });
});
