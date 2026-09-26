import { describe, expect, it } from 'vitest';
import { agruparPor, SIN_VALOR, totalDeGrupos } from './agruparPor';

/**
 * Lo que estos tests fijan es el contrato que hace que las vistas agrupadas no mientan: que la
 * suma de los subtotales dé el total de la lista, que ninguna fila se pierda por no tener valor en
 * la dimensión, y que el orden no cambie entre dos renders.
 */

const porCloser = { key: 'closer', label: 'Closer', de: (f) => f.closer };
const porFuente = { key: 'fuente', label: 'Fuente', de: (f) => f.fuente };

const VENTAS = [
    { id: 1, cliente: 'Ana', closer: 'Nerina', fuente: 'Setting', monto: 500 },
    { id: 2, cliente: 'Beto', closer: 'Marlon', fuente: 'Workshop', monto: 300.5 },
    { id: 3, cliente: 'Cora', closer: 'Nerina', fuente: 'Setting', monto: 199.5 },
    { id: 4, cliente: 'Dani', closer: 'Marlon', fuente: 'Setting', monto: 1000 },
];

describe('agruparPor', () => {
    it('junta las filas de cada valor de la dimensión', () => {
        const grupos = agruparPor(VENTAS, porCloser);

        expect(grupos.map(g => g.clave)).toEqual(['Nerina', 'Marlon']);
        expect(grupos[0].filas.map(f => f.id)).toEqual([1, 3]);
        expect(grupos[1].filas.map(f => f.id)).toEqual([2, 4]);
    });

    it('cambiar de dimensión no pide ningún cambio de código', () => {
        const grupos = agruparPor(VENTAS, porFuente);

        expect(grupos.map(g => g.clave)).toEqual(['Setting', 'Workshop']);
        expect(grupos[0].cantidad).toBe(3);
    });

    it('acepta la dimensión como función suelta', () => {
        const grupos = agruparPor(VENTAS, (f) => f.closer);
        expect(grupos.map(g => g.clave)).toEqual(['Nerina', 'Marlon']);
    });

    describe('subtotales', () => {
        it('cuenta filas y suma montos', () => {
            const grupos = agruparPor(VENTAS, porCloser);

            expect(grupos[0]).toMatchObject({ cantidad: 2, monto: 699.5 });
            expect(grupos[1]).toMatchObject({ cantidad: 2, monto: 1300.5 });
        });

        it('la suma de los subtotales da el total de la lista', () => {
            const total = totalDeGrupos(agruparPor(VENTAS, porCloser));

            expect(total.cantidad).toBe(VENTAS.length);
            expect(total.monto).toBe(2000);
        });

        it('redondea a dos decimales: sumar flotantes deja colas de 0.0000001', () => {
            const filas = [
                { closer: 'A', monto: 0.1 },
                { closer: 'A', monto: 0.2 },
            ];
            expect(agruparPor(filas, porCloser)[0].monto).toBe(0.3);
        });

        it('una lista sin la columna de monto no inventa un subtotal', () => {
            const agendas = [{ closer: 'Nerina' }, { closer: 'Nerina' }];
            const grupo = agruparPor(agendas, porCloser)[0];

            expect(grupo.cantidad).toBe(2);
            expect(grupo.monto).toBe(0);
            expect(grupo.tieneMonto).toBe(false);
        });

        it('suma la deuda aparte, para el encabezado de la cartera', () => {
            const clientes = [
                { closer: 'Nerina', pagado: 500, deuda: 500 },
                { closer: 'Nerina', pagado: 1000, deuda: 0 },
            ];
            const grupo = agruparPor(clientes, porCloser)[0];

            expect(grupo.deuda).toBe(500);
            expect(grupo.tieneDeuda).toBe(true);
        });

        it('un monto que no es número no rompe el subtotal', () => {
            const filas = [{ closer: 'A', monto: null }, { closer: 'A', monto: 100 }];
            expect(agruparPor(filas, porCloser)[0].monto).toBe(100);
        });
    });

    describe('filas sin valor en la dimensión', () => {
        it('van a su propio grupo en vez de desaparecer', () => {
            const filas = [...VENTAS, { id: 5, closer: null, monto: 50 }];
            const grupos = agruparPor(filas, porCloser);

            const resto = grupos.find(g => g.clave === SIN_VALOR);
            expect(resto.cantidad).toBe(1);
            expect(totalDeGrupos(grupos).cantidad).toBe(5);
        });

        it('cubre null, undefined y la cadena vacía, y los junta en un solo grupo', () => {
            const filas = [{ closer: null }, { closer: undefined }, { closer: '' }];
            const grupos = agruparPor(filas, porCloser);

            expect(grupos).toHaveLength(1);
            expect(grupos[0].cantidad).toBe(3);
            expect(grupos[0].esSinValor).toBe(true);
        });

        it('la etiqueta del resto se puede cambiar', () => {
            const grupos = agruparPor([{ closer: null }], porCloser, { sinValor: 'Sin closer' });
            expect(grupos[0].clave).toBe('Sin closer');
        });

        it('el resto va último, aunque su fila sea la primera de la lista', () => {
            const filas = [{ closer: null }, { closer: 'Nerina' }, { closer: 'Marlon' }];
            const grupos = agruparPor(filas, porCloser);

            expect(grupos.map(g => g.clave)).toEqual(['Nerina', 'Marlon', SIN_VALOR]);
        });
    });

    describe('orden estable', () => {
        it('los grupos salen en el orden en que aparece su primera fila', () => {
            const grupos = agruparPor(VENTAS, porCloser);
            // Nerina primero porque la fila 1 es suya, no por orden alfabético.
            expect(grupos.map(g => g.clave)).toEqual(['Nerina', 'Marlon']);
        });

        it('dos llamadas con las mismas filas dan exactamente el mismo orden', () => {
            const a = agruparPor(VENTAS, porCloser).map(g => g.clave);
            const b = agruparPor(VENTAS, porCloser).map(g => g.clave);
            expect(a).toEqual(b);
        });

        it('dentro de cada grupo las filas conservan el orden de la lista', () => {
            // La lista llega ordenada por el backend (lo vencido primero, lo más reciente
            // primero): reordenar acá perdería ese criterio.
            const grupos = agruparPor([...VENTAS].reverse(), porCloser);
            expect(grupos[0].filas.map(f => f.id)).toEqual([4, 2]);
        });
    });

    describe('casos de borde', () => {
        it('sin filas devuelve una lista vacía, no un grupo vacío', () => {
            expect(agruparPor([], porCloser)).toEqual([]);
            expect(agruparPor(null, porCloser)).toEqual([]);
        });

        it('sin dimensión no agrupa nada en vez de explotar', () => {
            expect(agruparPor(VENTAS, null)).toEqual([]);
            expect(agruparPor(VENTAS, {})).toEqual([]);
        });

        it('los totales de una lista vacía son ceros', () => {
            expect(totalDeGrupos([])).toEqual({ cantidad: 0, monto: 0, deuda: 0 });
            expect(totalDeGrupos(null)).toEqual({ cantidad: 0, monto: 0, deuda: 0 });
        });
    });
});
