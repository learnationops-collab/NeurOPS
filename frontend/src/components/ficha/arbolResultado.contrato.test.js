import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/api', () => ({
  default: { get: vi.fn(), patch: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import REPORTES from './__fixtures__/reportes.json';
import { GUIONES, recorrerGuion } from './__fixtures__/reportes.guiones';
import { fechaHoraAIso } from './arbolResultado';
import { ACCIONES } from './fichaApi';

// El reporte SIN venta de «Resultado» contra el contrato que también lee el backend
// (tests/api/test_ficha_reporte_arbol.py). Si este test falla por un cambio A PROPÓSITO en lo que
// manda el árbol, se regenera el contrato y se corren los tests del backend con el nuevo:
//   cd frontend && npx vite-node scripts/generar-contrato-reportes.mjs

// La hora nueva de una reagenda depende de la zona de la máquina que corre el test (la fecha y la
// hora se leen como locales, a propósito): se comprueba aparte y se saca de la comparación.
const sinHora = (pedido) => {
  const copia = structuredClone(pedido);
  if (copia.datos.reagenda) delete copia.datos.reagenda.start_time;
  return copia;
};

describe('contrato del reporte sin venta con el backend', () => {
  it('hay un caso fijado por cada guion, y ninguno de más', () => {
    expect(Object.keys(REPORTES).sort()).toEqual(Object.keys(GUIONES).sort());
  });

  it.each(Object.keys(GUIONES))('%s: el árbol arma exactamente el pedido fijado', (nombre) => {
    const armado = recorrerGuion(GUIONES[nombre]);
    const fijado = REPORTES[nombre];

    expect(sinHora(armado)).toEqual(sinHora(fijado));
    expect(ACCIONES).toContain(armado.accion);
    if (armado.datos.reagenda) {
      const r = armado.datos.respuestas;
      expect(armado.datos.reagenda.start_time).toBe(fechaHoraAIso(r.nueva_fecha_agenda, r.nueva_hora_agenda));
      expect(fijado.datos.reagenda.start_time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });
});
