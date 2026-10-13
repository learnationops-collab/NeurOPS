import { describe, expect, it } from 'vitest';
import { apilar, primerNombre } from './tarjetas';

const pz = (tipo, m0, m1, id) => ({ tipo, m0, m1, id });

describe('apilar', () => {
    it('cada turno va por separado: lo ocupado atrás, lo libre adelante y corrido', () => {
        const xs = apilar([
            pz('libre', 540, 585, 'a1'), pz('libre', 600, 645, 'a2'),   // dos turnos de Ana: no se juntan
            pz('libre', 570, 615, 'b1'),                                // uno de Beto que se les pisa
            pz('ocupado', 540, 660, 'c'),                               // un evento de Caro debajo de todo
        ]);
        expect(xs.map(x => [x.id, x.capa])).toEqual([['c', 0], ['a1', 1], ['b1', 2], ['a2', 1]]);
    });
    it('lo corrido no crece a lo largo del día', () => {
        // Dos closers con turnos encadenados que se pisan de a dos todo el día.
        const xs = [];
        for (let i = 0; i < 10; i++) xs.push(pz('libre', 540 + i * 60, 585 + i * 60, 'a' + i), pz('libre', 570 + i * 60, 615 + i * 60, 'b' + i));
        expect(Math.max(...apilar(xs).map(x => x.capa))).toBe(1);
    });
});

describe('primerNombre', () => {
    it('el primer nombre del closer', () => {
        expect(primerNombre('  Ana López ')).toBe('Ana');
    });
});
