import { describe, expect, it } from 'vitest';
import { colorEspera, esperaMin, examenDe, examenes, filtrar, quien, textoEspera } from './colas';

const AHORA = new Date('2026-10-17T15:00:00Z');
const hace = (min) => new Date(AHORA - min * 60000).toISOString();
const LISTA = [
    { id: 1, ultimo_de: 'lead', ultimo_en: hace(10), examen: 'enarm 2027', califica: true },
    { id: 2, ultimo_de: 'lead', ultimo_en: hace(90), examen: 'MIR' },
    { id: 3, ultimo_de: 'motor', ultimo_en: hace(5), examen: 'Enarm.', bot_pausado: true, califica: false },
];

describe('Bandeja › colas', () => {
    it('la espera corre solo si lo último lo escribió el lead', () => {
        expect(esperaMin(LISTA[0], AHORA)).toBe(10);
        expect(esperaMin(LISTA[2], AHORA)).toBeNull();
        expect([textoEspera(46), textoEspera(60), textoEspera(135), textoEspera(3000)]).toEqual(['46 min', '1 h', '2 h 15 min', '2 d']);
        expect([colorEspera(5), colorEspera(45), colorEspera(200)]).toEqual(['var(--text-muted)', 'var(--warning)', 'var(--error)']);
    });

    it('las colas de espera ordenan por la que más espera', () => {
        expect(filtrar(LISTA, { cola: 'esperan', ahora: AHORA }).map((c) => c.id)).toEqual([2, 1]);
        expect(filtrar(LISTA, { cola: 'esperan_hora', ahora: AHORA }).map((c) => c.id)).toEqual([2]);
        expect(filtrar(LISTA, { cola: 'no_califican', ahora: AHORA }).map((c) => c.id)).toEqual([3]);
        expect(filtrar(LISTA, { cola: 'todas', examen: 'ENARM', ahora: AHORA }).map((c) => c.id)).toEqual([1, 3]);
    });

    it('agrupa los exámenes por la primera palabra', () => {
        expect(examenDe({ examen: ' enarm 2027' })).toBe('ENARM');
        expect(examenes(LISTA)).toEqual([['ENARM', 2], ['MIR', 1]]);
    });

    it('identidad antes que ID', () => {
        expect(quien({ username: 'dr.lay_', igsid: '123' })).toBe('@dr.lay_');
        expect(quien({ nombre: 'Ana', igsid: '123' })).toBe('Ana');
        expect(quien({ igsid: '1234567' })).toBe('Sin usuario');
    });
});
