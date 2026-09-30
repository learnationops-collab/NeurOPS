import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatrizCierres, { pctDe, textoDeCelda, FILAS, COLUMNAS } from './MatrizCierres';
import PerformanceCierres from '../../pages/closer/dashboard/components/PerformanceCierres';
import { DESTINOS_CIERRES } from '../../pages/comercial/components/destinos';

/**
 * La tarjeta de cierres: sin / con señas × por llamada / por presentación.
 *
 * Lo que importa es que cada celda muestre SU tasa con SU numerador y denominador (es fácil cruzar
 * filas y columnas y que nadie lo note), que "sin denominador" se lea "—" y no 0%, y que cada
 * número lleve a la lista que lo compone: las ventas para "sin señas" y ventas + señas para "con
 * señas".
 */

// El bloque tal como lo manda el backend (`matriz_de_cierres`).
const CIERRES = {
    ventas: 3, senas: 1, asistieron: 6, presentaciones: 5,
    sin_senas: {
        por_llamada: { num: 3, den: 6, pct: 50.0 },
        por_presentacion: { num: 3, den: 5, pct: 60.0 },
    },
    con_senas: {
        por_llamada: { num: 4, den: 6, pct: 66.7 },
        por_presentacion: { num: 4, den: 5, pct: 80.0 },
    },
};

const fila = (nombre) => screen.getByRole('row', { name: new RegExp(`^${nombre}`) });

describe('MatrizCierres', () => {
    it('cada celda muestra su tasa y su fracción, en la fila y columna que le tocan', () => {
        render(<MatrizCierres cierres={CIERRES} />);

        const sin = within(fila('Sin señas')).getAllByRole('cell');
        const con = within(fila('Con señas')).getAllByRole('cell');

        expect(sin[0]).toHaveTextContent('50%');
        expect(sin[0]).toHaveTextContent('3 de 6 llamadas');
        expect(sin[1]).toHaveTextContent('60%');
        expect(sin[1]).toHaveTextContent('3 de 5 presentaciones');
        expect(con[0]).toHaveTextContent('66.7%');
        expect(con[0]).toHaveTextContent('4 de 6 llamadas');
        expect(con[1]).toHaveTextContent('80%');
        expect(con[1]).toHaveTextContent('4 de 5 presentaciones');
    });

    it('las columnas son por llamada y por presentación', () => {
        render(<MatrizCierres cierres={CIERRES} />);

        const cabeceras = screen.getAllByRole('columnheader').map(c => c.textContent);
        expect(cabeceras.some(t => t.startsWith('Por llamada'))).toBe(true);
        expect(cabeceras.some(t => t.startsWith('Por presentación'))).toBe(true);
    });

    it('sin denominador la tasa es un guion y no 0%', () => {
        const vacia = {
            ...CIERRES, presentaciones: 0,
            sin_senas: { ...CIERRES.sin_senas, por_presentacion: { num: 0, den: 0, pct: null } },
            con_senas: { ...CIERRES.con_senas, por_presentacion: { num: 0, den: 0, pct: null } },
        };
        render(<MatrizCierres cierres={vacia} />);

        expect(within(fila('Sin señas')).getAllByRole('cell')[1]).toHaveTextContent('—');
        expect(pctDe(null)).toBe('—');
        expect(pctDe(0)).toBe('0%');
    });

    it('cada tooltip de celda dice numerador, denominador y los números del período', () => {
        const Ayuda = vi.fn(() => null);
        render(<MatrizCierres cierres={CIERRES} Ayuda={Ayuda} />);

        const textos = Ayuda.mock.calls.map(([props]) => `${props.titulo} | ${props.texto}`);
        expect(textos).toContain(
            'Sin señas · Por llamada | ventas (pago completo o split pay) ÷ llamadas con show up: '
            + '3 de 6. Es el close rate.');
        expect(textos.find(t => t.startsWith('Con señas · Por presentación')))
            .toContain('ventas + señas sin completar ÷ presentaciones: 4 de 5');
        // Filas y columnas también explican qué son.
        expect(textos.some(t => t.startsWith('Sin señas |') && t.includes('split pay'))).toBe(true);
        expect(textos.some(t => t.startsWith('Por presentación |'))).toBe(true);
    });

    it('el texto de la celda con señas avisa que no es el close rate', () => {
        const texto = textoDeCelda(FILAS[1], COLUMNAS[0], CIERRES.con_senas.por_llamada);
        expect(texto).toContain('no es el close rate');
    });

    it('cada número lleva a su lista: ventas sin señas, ventas y señas con señas', () => {
        const irA = vi.fn();
        render(<MatrizCierres cierres={CIERRES} irA={irA} destinos={DESTINOS_CIERRES} />);

        fireEvent.click(within(fila('Sin señas')).getByRole('button', { name: /Sin señas · Por llamada/ }));
        fireEvent.click(within(fila('Con señas')).getByRole('button', { name: /Con señas · Por presentación/ }));

        expect(irA).toHaveBeenNthCalledWith(1, 'agendas', expect.objectContaining({ post_call: 'Venta' }));
        expect(irA).toHaveBeenNthCalledWith(2, 'agendas',
            expect.objectContaining({ post_call: ['Venta', 'Seña'] }));
    });

    it('la nota de abajo cuenta las señas y la brecha que suman', () => {
        render(<MatrizCierres cierres={CIERRES} />);
        expect(screen.getByText(/1 seña sin completar suman 16.7 pts por llamada/)).toBeInTheDocument();
    });

    it('sin señas no hay nota, y sin bloque no dibuja nada', () => {
        const { container, rerender } = render(<MatrizCierres cierres={{ ...CIERRES, senas: 0 }} />);
        expect(container.querySelector('.mc-pie')).toBeNull();

        rerender(<MatrizCierres cierres={null} />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('PerformanceCierres (dashboard del closer)', () => {
    it('dibuja la misma matriz con el bloque del backend', () => {
        render(<PerformanceCierres cierres={CIERRES} />);

        expect(screen.getByText(/Cierres con y sin señas/)).toBeInTheDocument();
        expect(within(fila('Sin señas')).getAllByRole('cell')[0]).toHaveTextContent('50%');
        expect(within(fila('Con señas')).getAllByRole('cell')[1]).toHaveTextContent('80%');
    });

    it('sin llamadas con show up lo dice en vez de mostrar tasas vacías', () => {
        render(<PerformanceCierres cierres={{ ...CIERRES, asistieron: 0 }} />);

        expect(screen.getByText(/Ninguna llamada del período/)).toBeInTheDocument();
        expect(screen.queryByRole('table')).toBeNull();
    });
});
