import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatrizCierres, {
    LeyendaCierres, brechaDe, pctDe, textoDeCelda, FILAS, COLUMNAS,
} from './MatrizCierres';
import PerformanceCierres from '../../pages/closer/dashboard/components/PerformanceCierres';
import { DESTINOS_CIERRES } from '../../pages/comercial/components/destinos';

/**
 * La tarjeta de cierres: una tarjeta por columna (por llamada / por presentación) con las ventas
 * solas y con señas, la tira de presentación arriba y la leyenda en la cabecera.
 *
 * Lo que importa es que cada lectura muestre SU tasa con SU numerador y denominador (es fácil
 * cruzar filas y columnas y que nadie lo note), que "sin denominador" se lea "—" y no 0%, que
 * cada número lleve a la lista que lo compone —las ventas para "Ventas", ventas + señas para
 * "Con señas", las que presentaron para la tira— y que la pastilla de puntos sea con − sin.
 */

// El bloque tal como lo manda el backend (`matriz_de_cierres`).
const CIERRES = {
    ventas: 3, ventas_completo: 2, ventas_split: 1, senas: 1, asistieron: 6, presentaciones: 5,
    presentacion: { num: 5, den: 6, pct: 83.3 },
    sin_senas: {
        por_llamada: { num: 3, den: 6, pct: 50.0 },
        por_presentacion: { num: 3, den: 5, pct: 60.0 },
    },
    con_senas: {
        por_llamada: { num: 4, den: 6, pct: 66.7 },
        por_presentacion: { num: 4, den: 5, pct: 80.0 },
    },
};

const tarjeta = (nombre) => screen.getByRole('group', { name: nombre });
const lectura = (nombre) => screen.getByRole('group', { name: nombre });

describe('MatrizCierres', () => {
    it('cada lectura muestra su tasa y su fracción, en la tarjeta y la fila que le tocan', () => {
        render(<MatrizCierres cierres={CIERRES} />);

        expect(lectura('Ventas · Por llamada')).toHaveTextContent('50%');
        expect(lectura('Ventas · Por llamada')).toHaveTextContent('3 de 6');
        expect(lectura('Ventas · Por presentación')).toHaveTextContent('60%');
        expect(lectura('Ventas · Por presentación')).toHaveTextContent('3 de 5');
        expect(lectura('Con señas · Por llamada')).toHaveTextContent('66.7%');
        expect(lectura('Con señas · Por llamada')).toHaveTextContent('4 de 6');
        expect(lectura('Con señas · Por presentación')).toHaveTextContent('80%');
        expect(lectura('Con señas · Por presentación')).toHaveTextContent('4 de 5');
    });

    it('hay una tarjeta por columna y cada una dice su denominador', () => {
        render(<MatrizCierres cierres={CIERRES} />);

        expect(tarjeta('Por llamada')).toHaveTextContent('6 llamadas');
        expect(tarjeta('Por presentación')).toHaveTextContent('5 presentaciones');
        expect(within(tarjeta('Por llamada')).getByRole('group', { name: 'Ventas · Por llamada' }))
            .toBeInTheDocument();
    });

    it('la pastilla de "con señas" son los puntos que suman las señas en esa columna', () => {
        render(<MatrizCierres cierres={CIERRES} />);

        expect(lectura('Con señas · Por llamada')).toHaveTextContent('+16.7 pp');
        expect(lectura('Con señas · Por presentación')).toHaveTextContent('+20 pp');
        expect(brechaDe(14.3, 29.8)).toBe(15.5);
        expect(brechaDe(null, 29.8)).toBeNull();
    });

    it('sin señas no hay pastilla', () => {
        const sinSenas = {
            ...CIERRES, senas: 0,
            con_senas: { por_llamada: { num: 3, den: 6, pct: 50.0 }, por_presentacion: { num: 3, den: 5, pct: 60.0 } },
        };
        const { container } = render(<MatrizCierres cierres={sinSenas} />);
        expect(container.querySelector('.mc-pp')).toBeNull();
    });

    it('la barra con señas apila el azul de las ventas y el rosa de las señas', () => {
        const { container } = render(<MatrizCierres cierres={CIERRES} />);
        const llamada = within(tarjeta('Por llamada'));

        const [ventas] = llamada.getByRole('group', { name: 'Ventas · Por llamada' })
            .querySelectorAll('.mc-tramo');
        const [azul, rosa] = llamada.getByRole('group', { name: 'Con señas · Por llamada' })
            .querySelectorAll('.mc-tramo');

        expect(ventas.style.getPropertyValue('--ancho')).toBe('50%');
        expect(azul).toHaveClass('mc-tramo--ventas');
        expect(azul.style.getPropertyValue('--ancho')).toBe('50%');
        expect(rosa).toHaveClass('mc-tramo--senas');
        expect(parseFloat(rosa.style.getPropertyValue('--ancho'))).toBeCloseTo(16.67, 1);
        // El rosa arranca después del azul.
        expect(parseInt(rosa.style.getPropertyValue('--demora'), 10))
            .toBeGreaterThan(parseInt(azul.style.getPropertyValue('--demora'), 10));
        expect(container.querySelectorAll('.mc-tramo--senas')).toHaveLength(2);
    });

    it('arriba va la tira de presentación con su tasa y su fracción', () => {
        const { container } = render(<MatrizCierres cierres={CIERRES} />);
        const tira = container.querySelector('.mc-tira');

        expect(tira).toHaveTextContent('Presentación');
        expect(tira).toHaveTextContent('83.3%');
        expect(tira).toHaveTextContent('5 de 6');
    });

    it('sin denominador la tasa es un guion y no 0%', () => {
        const vacia = {
            ...CIERRES, presentaciones: 0,
            sin_senas: { ...CIERRES.sin_senas, por_presentacion: { num: 0, den: 0, pct: null } },
            con_senas: { ...CIERRES.con_senas, por_presentacion: { num: 0, den: 0, pct: null } },
        };
        render(<MatrizCierres cierres={vacia} />);

        expect(lectura('Ventas · Por presentación')).toHaveTextContent('—');
        expect(lectura('Con señas · Por presentación')).not.toHaveTextContent('pp');
        expect(pctDe(null)).toBe('—');
        expect(pctDe(0)).toBe('0%');
    });

    it('cada tooltip de lectura dice numerador, denominador y los números del período', () => {
        const Ayuda = vi.fn(() => null);
        render(<MatrizCierres cierres={CIERRES} Ayuda={Ayuda} />);

        const textos = Ayuda.mock.calls.map(([props]) => `${props.titulo} | ${props.texto}`);
        expect(textos.find(t => t.startsWith('Ventas · Por llamada |'))).toContain(
            'ventas (pago completo o split pay) ÷ llamadas con show up: 3 de 6. Es el close rate.');
        expect(textos.find(t => t.startsWith('Con señas · Por presentación |')))
            .toContain('ventas + señas sin completar ÷ presentaciones: 4 de 5');
        // Las columnas y la tira también explican qué son.
        expect(textos.some(t => t.startsWith('Por presentación |'))).toBe(true);
        expect(textos.find(t => t.startsWith('Presentación |'))).toContain('5 de 6');
    });

    it('el texto de la lectura con señas avisa que no es el close rate', () => {
        const texto = textoDeCelda(FILAS[1], COLUMNAS[0], CIERRES.con_senas.por_llamada);
        expect(texto).toContain('no es el close rate');
    });

    it('cada número lleva a su lista: ventas, ventas y señas, y las que presentaron', () => {
        const irA = vi.fn();
        render(<MatrizCierres cierres={CIERRES} irA={irA} destinos={DESTINOS_CIERRES} />);

        fireEvent.click(within(lectura('Ventas · Por llamada')).getByRole('button'));
        fireEvent.click(within(lectura('Con señas · Por presentación')).getByRole('button'));
        fireEvent.click(screen.getByRole('button', { name: /Presentación · 5 de 6/ }));

        expect(irA).toHaveBeenNthCalledWith(1, 'agendas', expect.objectContaining({ post_call: 'Venta' }));
        expect(irA).toHaveBeenNthCalledWith(2, 'agendas',
            expect.objectContaining({ post_call: ['Venta', 'Seña'] }));
        expect(irA).toHaveBeenNthCalledWith(3, 'agendas', expect.objectContaining({ presento: 'Sí' }));
    });

    it('sin bloque no dibuja nada', () => {
        const { container } = render(<MatrizCierres cierres={null} />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('LeyendaCierres', () => {
    it('dice las ventas con su desglose y las señas', () => {
        const { container } = render(<LeyendaCierres cierres={{ ...CIERRES, ventas: 12, ventas_completo: 3, ventas_split: 9, senas: 13 }} />);

        expect(container).toHaveTextContent('12 ventas');
        expect(container).toHaveTextContent('3 PC + 9 SP');
        expect(container).toHaveTextContent('13 señas');
        expect(screen.getByTitle('pago completo')).toHaveTextContent('PC');
    });

    it('en singular cuando es una, y sin desglose si el bloque no lo trae', () => {
        const { container } = render(
            <LeyendaCierres cierres={{ ventas: 1, senas: 1, asistieron: 2, presentaciones: 2 }} />);

        expect(container).toHaveTextContent('1 venta');
        expect(container).toHaveTextContent('1 seña');
        expect(container).not.toHaveTextContent('PC');
    });
});

describe('PerformanceCierres (dashboard del closer)', () => {
    it('dibuja la misma matriz con el bloque del backend, y la leyenda en la cabecera', () => {
        render(<PerformanceCierres cierres={CIERRES} />);

        expect(screen.getByRole('heading', { name: /Cierre/ })).toBeInTheDocument();
        expect(screen.getByText('3 ventas')).toBeInTheDocument();
        expect(lectura('Ventas · Por llamada')).toHaveTextContent('50%');
        expect(lectura('Con señas · Por presentación')).toHaveTextContent('80%');
    });

    it('sin llamadas con show up lo dice en vez de mostrar tasas vacías', () => {
        render(<PerformanceCierres cierres={{ ...CIERRES, asistieron: 0 }} />);

        expect(screen.getByText(/Ninguna llamada del período/)).toBeInTheDocument();
        expect(screen.queryByRole('group')).toBeNull();
        expect(screen.queryByText(/ventas/)).toBeNull();
    });
});
