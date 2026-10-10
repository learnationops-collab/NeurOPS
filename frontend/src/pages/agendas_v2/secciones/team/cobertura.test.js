import { describe, expect, it } from 'vitest';
import { normalHorario, normalPersona } from '../../core/normalizar';
import { avUnir, calcularCobertura, durTxt, hmTxt, textoEstrategia, unirTramos } from './cobertura';

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
    const H = (h, m = 0) => Date.UTC(2026, 9, 5, h + 4, m); // hora de La Paz (UTC-4) ese lunes
    const p = normalPersona('a', { nombre: 'Ana', tz: 'America/La_Paz', horario: normalHorario({ 1: [['09:00', '13:00']] }) });
    const reservas = () => [{ inicio_ms: H(12), fin_ms: H(12, 45) }];
    // Dos reuniones que se pisan en calendarios distintos y el evento de la propia agenda de las 12.
    const google = () => ({ estado: 'ok', franjas: [[H(10), H(11)], [H(10, 30), H(11, 30)], [H(12), H(12, 45)]] });

    it('mide el tiempo efectivo: lo que se pisa cuenta una vez', () => {
        const c = calcularCobertura({ todos: [p], cs: [p], ahora, reservasDe: reservas, googleDe: google });
        expect(c.kpi.hDisp).toBe(4);
        expect(c.kpi.hAg).toBe(0.75);
        expect(c.kpi.hEv).toBe(1.5);
        expect(c.kpi.hLibre).toBe(1.75);
        expect(c.kpi.ocupacion).toBeCloseTo(2.25 / 4);
        expect(c.kpi.nAg).toBe(1);
        expect(c.bloques[0].segs.map(s => s.tipo)).toEqual(['ev', 'ag']);
    });
    it('lo de fuera del horario no cuenta y lo que lo cruza cuenta solo adentro', () => {
        const g = () => ({ estado: 'ok', franjas: [[H(8), H(9, 30)], [H(12, 30), H(14)], [H(20), H(21)]] });
        const c = calcularCobertura({ todos: [p], cs: [p], ahora, googleDe: g });
        expect(c.kpi.hEv).toBe(1);
        expect(c.porDia[0]).toEqual({ a: 60, t: 240 });
    });
    it('un calendario que no se pudo leer queda fuera de la ocupación', () => {
        const q = normalPersona('b', { nombre: 'Beto', tz: 'America/La_Paz', horario: normalHorario({ 1: [['09:00', '13:00']] }) });
        const g = (id) => (id === 'a' ? google() : { estado: 'error', franjas: [] });
        const c = calcularCobertura({ todos: [p, q], cs: [p, q], ahora, reservasDe: (id) => (id === 'a' ? reservas() : []), googleDe: g });
        expect(c.kpi.hDisp).toBe(8);
        expect(c.kpi.ocupacion).toBeCloseTo(2.25 / 4);
        expect(c.sinLeer.map(x => x.id)).toEqual(['b']);
    });
    it('sin datos de Google cuenta solo las reservas', () => {
        const c = calcularCobertura({ todos: [p], cs: [p], ahora, reservasDe: reservas });
        expect(c.kpi.ocupacion).toBeCloseTo(0.75 / 4);
        expect(c.sinLeer).toEqual([]);
        expect(c.sinGoogle).toEqual([]);
    });
});

describe('unirTramos y durTxt', () => {
    it('une lo que se pisa o se toca', () => {
        expect(unirTramos([[5, 6], [1, 3], [2, 4], [4, 5], [8, 8]])).toEqual([[1, 6]]);
    });
    it('escribe duraciones', () => {
        expect(durTxt(45)).toBe('45 min');
        expect(durTxt(120)).toBe('2 h');
        expect(durTxt(135)).toBe('2 h 15');
    });
});

describe('textoEstrategia', () => {
    const d = { personas: [{ id: 'a', nombre: 'Ana' }, { id: 'b', nombre: 'Beto' }] };
    it('explica llenar en orden con la ventana', () => {
        expect(textoEstrategia(d, { miembros: ['a', 'b'], estrategia: 'llenar' })).toMatch(/Los leads van a Ana hasta llenar .* 7 días; después a Beto\./);
        expect(textoEstrategia(d, { miembros: [], estrategia: 'llenar' })).toBe('Sumá closers.');
    });
});
