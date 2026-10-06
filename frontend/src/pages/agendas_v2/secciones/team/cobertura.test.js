import { describe, expect, it } from 'vitest';
import { normalHorario, normalPersona } from '../../core/normalizar';
import { avUnir, calcularCobertura, hmTxt, textoEstrategia } from './cobertura';

describe('avUnir', () => {
    it('une franjas que se pisan o se tocan y ordena', () => {
        expect(avUnir([['14:00', '16:00'], ['09:00', '12:00'], ['11:00', '13:00'], ['13:00', '14:00']])).toEqual([['09:00', '16:00']]);
    });
    it('descarta las vacías o invertidas y deja hasta 6', () => {
        expect(avUnir([['10:00', '10:00'], ['12:00', '11:00']])).toEqual([]);
        const muchas = Array.from({ length: 8 }, (_, i) => [hmTxt(i * 120), hmTxt(i * 120 + 60)]);
        expect(avUnir(muchas)).toHaveLength(6);
    });
});

describe('calcularCobertura', () => {
    const ahora = Date.UTC(2026, 9, 5, 12); // lunes
    const p = normalPersona('a', { nombre: 'Ana', tz: 'America/La_Paz', horario: normalHorario({ 1: [['09:00', '12:00']] }) });
    it('cuenta agendadas con reservas reales', () => {
        const t = Date.UTC(2026, 9, 5, 14); // 10:00 en La Paz
        const c = calcularCobertura({ todos: [p], cs: [p], ahora, reservasDe: () => [{ inicio_ms: t, fin_ms: t + 45 * 60000 }] });
        expect(c.kpi.celdas).toBe(3);
        expect(c.kpi.agendadas).toBe(1);
        expect(c.kpi.hDisp).toBe(3);
    });
});

describe('textoEstrategia', () => {
    const d = { personas: [{ id: 'a', nombre: 'Ana' }, { id: 'b', nombre: 'Beto' }] };
    it('explica llenar en orden con la ventana', () => {
        expect(textoEstrategia(d, { miembros: ['a', 'b'], estrategia: 'llenar' })).toMatch(/Los leads van a Ana hasta llenar .* 7 días; después a Beto\./);
        expect(textoEstrategia(d, { miembros: [], estrategia: 'llenar' })).toBe('Sumá closers.');
    });
});
