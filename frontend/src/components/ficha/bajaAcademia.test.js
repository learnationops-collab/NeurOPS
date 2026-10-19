import { describe, expect, it } from 'vitest';
import { conAccesoDeLaBaja } from './FichaLeadModal';

// La baja se le avisa a la Academia, que cierra (o reabre) el proceso del alumno; desde el
// 19/10/2026 ya no le corta el acceso. El backend devuelve lo que pasó en `acceso_academia` y el
// aviso de la ficha lo dice; si no se pudo avisar, en amarillo.
describe('el aviso de una baja dice qué pasó con la Academia', () => {
  const BASE = 'Baja registrada.';

  it('sin baja en el pedido, el aviso es el de siempre', () => {
    expect(conAccesoDeLaBaja(BASE, {})).toBe(BASE);
    expect(conAccesoDeLaBaja(BASE, null)).toBe(BASE);
  });

  it('avisada: lo agrega al aviso verde y dice que el acceso sigue', () => {
    expect(conAccesoDeLaBaja(BASE, { acceso_academia: { estado: 'avisado', motivo: null } }))
      .toBe('Baja registrada. La Academia quedó avisada; el acceso sigue hasta su vencimiento.');
  });

  it('sin cuenta: no es alumno de la Academia, y se dice', () => {
    expect(conAccesoDeLaBaja(BASE, { acceso_academia: { estado: 'sin_cuenta', motivo: null } }))
      .toBe('Baja registrada. No tenía cuenta en la Academia.');
  });

  it('si la Academia falló, va en amarillo con el motivo', () => {
    const aviso = conAccesoDeLaBaja(BASE, {
      acceso_academia: { estado: 'no_avisado', motivo: 'No se pudo hablar con la Academia.' },
    });
    expect(aviso.tono).toBe('warning');
    expect(aviso.texto).toBe('Baja registrada. No se le pudo avisar a la Academia (No se pudo hablar con la Academia).');
  });
});
