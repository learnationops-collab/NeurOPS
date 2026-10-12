import { describe, expect, it } from 'vitest';
import { agrupar, nombresTxt, primerNombre, resumenGrupo } from './tarjetas';

const ana = { id: 'a', nombre: 'Ana López' }, beto = { id: 'b', nombre: 'Beto' }, caro = { id: 'c', nombre: 'Caro Díaz' };
const pz = (tipo, m0, m1, p) => ({ tipo, m0, m1, p });

describe('agrupar', () => {
    it('junta lo del mismo tipo que se pisa o se toca, de cualquier closer', () => {
        const gs = agrupar([
            pz('libre', 540, 585, ana), pz('libre', 600, 645, ana),   // turnos encadenados con 15 de margen
            pz('libre', 570, 615, beto),
            pz('llamada', 720, 765, ana), pz('margen', 765, 780, ana), // la llamada y su margen, juntos
            pz('libre', 900, 945, caro),                               // más tarde: otra tarjeta
        ]);
        expect(gs.map(g => [g.tipo, g.m0, g.m1, g.piezas.length])).toEqual([
            ['libre', 540, 645, 3], ['llamada', 720, 780, 2], ['libre', 900, 945, 1],
        ]);
        expect(gs[0].personas.map(p => p.id)).toEqual(['a', 'b']);
        expect(resumenGrupo(gs[0])).toBe('3 turnos');
        expect(resumenGrupo(gs[1])).toBe('');
    });
    it('lo de distinto tipo que se pisa va lado a lado', () => {
        const gs = agrupar([pz('libre', 540, 660, ana), pz('ocupado', 600, 630, beto), pz('cancelada', 600, 645, ana)]);
        expect(gs.map(g => [g.tipo, g.col, g.ncols])).toEqual([['libre', 0, 3], ['cancelada', 1, 3], ['ocupado', 2, 3]]);
    });
    it('el tiempo libre sin turno completo va con los libres', () => {
        const gs = agrupar([pz('hueco', 540, 570, ana)]);
        expect(gs[0].tipo).toBe('libre');
        expect(resumenGrupo(gs[0])).toBe('sin turno completo');
    });
});

describe('nombres', () => {
    it('el primer nombre de cada closer, y +N si son más de dos', () => {
        expect(primerNombre('  Ana López ')).toBe('Ana');
        expect(nombresTxt([ana, beto])).toBe('Ana, Beto');
        expect(nombresTxt([ana, beto, caro])).toBe('Ana +2');
    });
});
