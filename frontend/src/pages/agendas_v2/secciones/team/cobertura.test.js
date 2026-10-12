import { describe, expect, it } from 'vitest';
import { normalHorario, normalPersona } from '../../core/normalizar';
import { avUnir, calcularCobertura, columnas, durTxt, hmTxt, huecosLibres, textoEstrategia, unirTramos } from './cobertura';
import { agendasDeVista } from './semana';

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
    it('cada tramo por eventos lleva los eventos que lo forman', () => {
        const g = () => ({ estado: 'ok', franjas: [[H(10), H(11, 30)]], eventos: [
            { inicio: H(10), fin: H(11), titulo: 'Daily' }, { inicio: H(10, 30), fin: H(11, 30), titulo: null },
            { inicio: H(20), fin: H(21), titulo: 'Fuera' },
        ] });
        const c = calcularCobertura({ todos: [p], cs: [p], ahora, googleDe: g });
        const ev = c.bloques[0].segs.filter(s => s.tipo === 'ev');
        expect(ev).toHaveLength(1);
        expect(ev[0].eventos.map(e => e.titulo)).toEqual(['Daily', null]);
    });
    it('el margen de cada agenda cuenta como ocupado y tapa lo de Google', () => {
        // La agenda de las 12 dura 30 min con 20 de margen; su evento de Google cubre solo la sesión, y hay
        // otra reunión de 12:40 a 13:00 que se pisa con el margen.
        const rs = () => [{ inicio_ms: H(12), fin_ms: H(12, 30), margen_min: 20 }];
        const g = () => ({ estado: 'ok', franjas: [[H(12), H(12, 30)], [H(12, 40), H(13)]] });
        const c = calcularCobertura({ todos: [p], cs: [p], ahora, reservasDe: rs, googleDe: g });
        expect(c.kpi.hAg).toBeCloseTo(50 / 60);
        expect(c.kpi.hMg).toBeCloseTo(20 / 60);
        expect(c.kpi.hEv).toBeCloseTo(10 / 60);
        expect(c.bloques[0].segs.map(s => s.tipo)).toEqual(['ag', 'mg', 'ev']);
    });
    it('cada agenda y cada evento es una tarjeta propia, lado a lado si se pisan', () => {
        const rs = () => [{ inicio_ms: H(9), fin_ms: H(9, 45), lead: { nombre: 'Ana' } }, { inicio_ms: H(9, 45), fin_ms: H(10, 30), lead: { nombre: 'Beto' } }];
        const g = () => ({ estado: 'ok', franjas: [[H(9), H(9, 45)], [H(11), H(12, 30)]], eventos: [
            { inicio: H(9), fin: H(9, 45), titulo: 'Ana' },   // el de la propia agenda: no va
            { inicio: H(11), fin: H(12), titulo: 'Daily' }, { inicio: H(11, 30), fin: H(12, 30), titulo: null },
        ] });
        const its = calcularCobertura({ todos: [p], cs: [p], ahora, reservasDe: rs, googleDe: g }).bloques[0].items;
        expect(its.map(x => x.tipo)).toEqual(['ag', 'ag', 'ev', 'ev']);
        expect(its.map(x => [x.col, x.ncols])).toEqual([[0, 1], [0, 1], [0, 2], [1, 2]]);
    });
    it('las canceladas se muestran pero no ocupan', () => {
        const cx = () => [{ id: 'x', inicio_ms: H(10), fin_ms: H(11), motivo: 'sin_evento', lead: { nombre: 'Lu' } }];
        const c = calcularCobertura({ todos: [p], cs: [p], ahora, canceladasDe: cx });
        expect(c.bloques[0].items.map(x => x.tipo)).toEqual(['cx']);
        expect(c.kpi.nCx).toBe(1);
        expect(c.kpi.hLibre).toBe(4);
    });
    it('el tiempo libre donde no entra un turno', () => {
        // De 9 a 13 con una agenda de 12 a 12:45: libres 9 a 12 y 12:45 a 13. Turnos de 45 + 15 a las 9, 10 y 11.
        const x = calcularCobertura({ todos: [p], cs: [p], ahora, reservasDe: reservas }).bloques[0];
        expect(huecosLibres(x, { ahora })).toEqual([[H(9), H(12)], [H(12, 45), H(13)]]);
        expect(huecosLibres(x, { ahora, turnos: [H(9), H(10), H(11)], largoTurno: 60 * 60000 })).toEqual([[H(12, 45), H(13)]]);
        // Lo que ya pasó no cuenta, y menos de 15 minutos tampoco.
        expect(huecosLibres(x, { ahora: H(12, 50) })).toEqual([]);
    });
    it('se puede ver en la zona de quien mira', () => {
        // Ana trabaja de 9 a 13 en La Paz (UTC-4); vista desde Buenos Aires (UTC-3) arranca a las 10.
        const c = calcularCobertura({ todos: [p], cs: [p], ahora, tz: 'America/Argentina/Buenos_Aires' });
        expect(c.tz).toBe('America/Argentina/Buenos_Aires');
        expect([c.bloques[0].m0, c.bloques[0].m1]).toEqual([600, 840]);
        expect(calcularCobertura({ todos: [p], cs: [p], ahora }).bloques[0].m0).toBe(540);
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

describe('columnas', () => {
    it('reparte en columnas solo lo que se pisa', () => {
        const xs = columnas([{ a: 0, b: 10 }, { a: 5, b: 15 }, { a: 12, b: 20 }, { a: 30, b: 40 }]);
        expect(xs.map(x => [x.col, x.ncols])).toEqual([[0, 2], [1, 2], [0, 2], [0, 1]]);
    });
});

describe('agendasDeVista', () => {
    it('junta Agendas 2.0 y n8n, y aparta las canceladas', () => {
        const reservas = [
            { id: 'a', closer_id: 'p1', inicio_ms: 1, estado: 'agendada' },
            { id: 'b', closer_id: 'p1', inicio_ms: 2, estado: 'cancelada', cancelada: false },  // ya procesada: se hizo
            { id: 'c', closer_id: 'p1', inicio_ms: 3, estado: 'cancelada', cancelada: true },
        ];
        const google = { p1: { estado: 'ok', agendas: [
            { id: 7, inicio: 4, fin: 5, nombre: 'Lu', estado: 'vigente' }, { id: 8, inicio: 6, fin: 7, nombre: 'Mo', estado: 'sin_evento', resultado: 'Pendiente' },
        ] } };
        const v = agendasDeVista(reservas, google);
        expect(v.ocupan('p1').map(r => r.id)).toEqual(['a', 'b', 'n8n-7']);
        expect(v.canceladas('p1').map(r => [r.id, r.motivo])).toEqual([['c', 'cancelada'], ['n8n-8', 'sin_evento']]);
        expect(v.ocupan('p2')).toEqual([]);
    });
});
