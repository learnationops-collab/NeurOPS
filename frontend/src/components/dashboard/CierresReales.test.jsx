import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MatrizCierres from './MatrizCierres';
import CierresReales from './CierresReales';

/**
 * El close rate real: lo cerrado en el período venga de la llamada que venga (23/10/2026).
 *
 * Lo que importa: que la tasa sea la del backend con SU numerador y SU base (9 de 13, no 9 de las 8
 * llamadas), que los cierres de llamadas anteriores se vean aparte —son los que la tasa por llamada
 * de abajo no veía—, que el cobro sin llamada quede fuera de la tasa y dicho, y que la lista de
 * cobros agrupe por origen y nombre la llamada de la que salió cada uno.
 */

const FILAS = [
    { id: 1, cliente: 'Ana Pérez', fecha: '2026-10-08T00:00:00', monto: 1000, tipo: 'AL - Completo',
      via: 'venta', origen: 'anterior', llamada: { fecha: '2026-09-20T15:00:00', closer: 'Jean Carlo' } },
    { id: 2, cliente: 'Beto Ruiz', fecha: '2026-10-09T00:00:00', monto: 500, tipo: 'RR - Parcial',
      via: 'venta', origen: 'periodo', llamada: { fecha: '2026-10-05T15:00:00', closer: 'Jean Carlo' } },
    { id: 3, cliente: 'Cora Díaz', fecha: '2026-10-12T00:00:00', monto: 2000, tipo: 'SI - Completo',
      via: 'venta', origen: 'sin_llamada', llamada: null },
    { id: 4, cliente: 'Dani Soto', fecha: '2026-10-14T00:00:00', monto: 950, tipo: 'Seña + cuota',
      via: 'cuota', origen: 'anterior', llamada: { fecha: '2026-09-24T15:00:00', closer: 'Jean Carlo' } },
];

// 9 cierres de 13 oportunidades: 8 llamadas con show up + 5 anteriores; 4 del período, 5 anteriores.
const REALES = {
    cierres: 9, del_periodo: 4, anteriores: 5, sin_llamada: 1, por_cuota: 1,
    asistieron: 8, base: 13, pct: 69.2, filas: FILAS,
};

const CIERRES = {
    ventas: 3, ventas_completo: 2, ventas_split: 1, senas: 1, asistieron: 8, presentaciones: 6,
    presentacion: { num: 6, den: 8, pct: 75.0 },
    sin_senas: { por_llamada: { num: 3, den: 8, pct: 37.5 }, por_presentacion: { num: 3, den: 6, pct: 50.0 } },
    solo_senas: { por_llamada: { num: 1, den: 8, pct: 12.5 }, por_presentacion: { num: 1, den: 6, pct: 16.7 } },
    no_cerradas: { num: 4, den: 8, pct: 50.0 },
    reales: REALES,
};

const tarjeta = () => screen.getByRole('region', { name: 'Close rate real' });

describe('CierresReales', () => {
    it('muestra la tasa del backend con sus cierres y su base', () => {
        render(<CierresReales reales={REALES} />);

        expect(tarjeta()).toHaveTextContent('69.2%');
        expect(tarjeta()).toHaveTextContent('9 de 13');
    });

    it('dice de qué se compone la base: las llamadas con show up más las anteriores que cerraron', () => {
        render(<CierresReales reales={REALES} />);

        expect(tarjeta()).toHaveTextContent('Base: 8 llamadas con show up + 5 llamadas anteriores que cerraron');
    });

    it('separa los cierres del período de los de llamadas anteriores y cuenta aparte los sin llamada', () => {
        render(<CierresReales reales={REALES} />);

        expect(tarjeta()).toHaveTextContent('4de llamadas del período');
        expect(tarjeta()).toHaveTextContent('5de llamadas anterioresseña, seguimiento o segunda llamada');
        expect(tarjeta()).toHaveTextContent('1cobro sin llamadafuera de la tasa');
        expect(tarjeta()).toHaveTextContent('1seña completada con cuota');
    });

    it('sin cobros sin llamada ni cuotas, esas dos líneas no aparecen', () => {
        render(<CierresReales reales={{ ...REALES, sin_llamada: 0, por_cuota: 0 }} />);

        expect(tarjeta()).not.toHaveTextContent('sin llamada');
        expect(tarjeta()).not.toHaveTextContent('con cuota');
    });

    it('sin cierres anteriores la base es solo las llamadas', () => {
        render(<CierresReales reales={{ ...REALES, anteriores: 0, base: 8, cierres: 4, pct: 50.0 }} />);

        expect(tarjeta()).toHaveTextContent('Base: 8 llamadas con show up');
        expect(tarjeta()).not.toHaveTextContent('anteriores que cerraron');
    });

    it('sin el bloque no dibuja nada', () => {
        const { container } = render(<CierresReales reales={null} />);

        expect(container).toBeEmptyDOMElement();
    });

    it('«Ver cobros» abre la lista agrupada por origen, con la llamada de cada uno', () => {
        render(<CierresReales reales={REALES} />);

        fireEvent.click(screen.getByRole('button', { name: /Ver los 10 cobros/ }));

        const anteriores = screen.getByRole('region', { name: 'De llamadas anteriores' });
        expect(anteriores).toHaveTextContent('De llamadas anteriores · 2');
        expect(within(anteriores).getByText('Ana Pérez')).toBeInTheDocument();
        expect(anteriores).toHaveTextContent('Llamada del 20/09 · Jean Carlo');
        expect(anteriores).toHaveTextContent('seña completada con cuota');
        expect(within(screen.getByRole('region', { name: 'De llamadas del período' })).getByText('Beto Ruiz'))
            .toBeInTheDocument();
        const sin = screen.getByRole('region', { name: 'Sin llamada' });
        expect(sin).toHaveTextContent('Sin llamada previa');
        expect(sin).toHaveTextContent('Quedan fuera de la tasa');
    });

    it('sin cobros no ofrece la lista', () => {
        render(<CierresReales reales={{ ...REALES, cierres: 0, anteriores: 0, del_periodo: 0, sin_llamada: 0,
            por_cuota: 0, filas: [], pct: 0 }} />);

        expect(screen.queryByRole('button', { name: /Ver los/ })).toBeNull();
    });
});

describe('MatrizCierres con el close rate real', () => {
    it('lo muestra arriba de las tarjetas por llamada, que siguen con sus propias tasas', () => {
        render(<MatrizCierres cierres={CIERRES} />);

        expect(tarjeta()).toHaveTextContent('69.2%');
        // Por llamada sigue siendo 3 de 8: el real no pisa la lectura de abajo.
        expect(screen.getByRole('group', { name: 'Ventas · Por llamada' })).toHaveTextContent('37.5%');
        expect(screen.getByRole('group', { name: 'Ventas · Por llamada' })).toHaveTextContent('3 de 8');
    });

    it('un tablero que no trae el bloque se ve como antes', () => {
        render(<MatrizCierres cierres={{ ...CIERRES, reales: undefined }} />);

        expect(screen.queryByRole('region', { name: 'Close rate real' })).toBeNull();
        expect(screen.getByRole('group', { name: 'Por llamada' })).toBeInTheDocument();
    });
});
