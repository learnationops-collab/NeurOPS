import { describe, expect, it } from 'vitest';
import { conAccesoDeLaBaja } from './FichaLeadModal';

// La baja también le quita el acceso a la Academia (pedido del 30/09/2026). El backend devuelve lo
// que pasó en `acceso_academia` y el aviso de la ficha lo dice; si no se pudo, en amarillo.
describe('el aviso de una baja dice qué pasó con la Academia', () => {
  const BASE = 'Baja registrada.';

  it('sin baja en el pedido, el aviso es el de siempre', () => {
    expect(conAccesoDeLaBaja(BASE, {})).toBe(BASE);
    expect(conAccesoDeLaBaja(BASE, null)).toBe(BASE);
  });

  it('cortado: lo agrega al aviso verde', () => {
    expect(conAccesoDeLaBaja(BASE, { acceso_academia: { estado: 'quitado', vence: '2026-09-30' } }))
      .toBe('Baja registrada. También se le quitó el acceso a la Academia: vence hoy.');
  });

  it('sin cuenta: no había nada que cortar, y se dice', () => {
    expect(conAccesoDeLaBaja(BASE, { acceso_academia: { estado: 'sin_cuenta', motivo: null } }))
      .toBe('Baja registrada. No tenía cuenta en la Academia.');
  });

  it('si la Academia falló, va en amarillo con el motivo y adónde ir a cortarlo', () => {
    const aviso = conAccesoDeLaBaja(BASE, {
      acceso_academia: { estado: 'no_quitado', motivo: 'La Academia no aceptó el cambio: Too Many Requests.' },
    });
    expect(aviso.tono).toBe('warning');
    expect(aviso.texto).toBe('Baja registrada. No se le pudo quitar el acceso a la Academia '
      + '(La Academia no aceptó el cambio: Too Many Requests): quitáselo desde Fulfillment.');
  });
});
