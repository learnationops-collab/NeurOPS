import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MatrizCierres, {
    LeyendaCierres, pctDe, textoDeCelda, FILAS, COLUMNAS,
} from './MatrizCierres';
import PerformanceCierres from '../../pages/closer/dashboard/components/PerformanceCierres';
import { DESTINOS_CIERRES } from '../../pages/comercial/components/destinos';

/**
 * La tarjeta de cierres: una tarjeta por columna (por llamada / por presentación) con las ventas y
 * las señas, la tira de presentación arriba y la leyenda en la cabecera.
 *
 * Lo que importa es que cada lectura muestre SU tasa con SU numerador y denominador (es fácil
 * cruzar filas y columnas y que nadie lo note), que "sin denominador" se lea "—" y no 0%, que
 * cada número lleve a la lista que lo compone —las ventas para "Ventas", solo las señas para
 * "Señas", las que presentaron para la tira— y que la fila de señas no repita las ventas
 * (pedido del usuario, 09/10/2026: «que solo se vean las señas ahí»).
 */

// El bloque tal como lo manda el backend (`matriz_de_cierres`).
const CIERRES = {
    ventas: 3, ventas_completo: 2, ventas_split: 1, senas: 1, asistieron: 6, presentaciones: 5,
    presentacion: { num: 5, den: 6, pct: 83.3 },
    sin_senas: {
        por_llamada: { num: 3, den: 6, pct: 50.0 },
        por_presentacion: { num: 3, den: 5, pct: 60.0 },
    },
    solo_senas: {
        por_llamada: { num: 1, den: 6, pct: 16.7 },
        por_presentacion: { num: 1, den: 5, pct: 20.0 },
    },
    // 6 asistieron = 3 ventas + 1 seña + 2 no cerradas.
    no_cerradas: { num: 2, den: 6, pct: 33.3 },
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
        expect(lectura('Señas · Por llamada')).toHaveTextContent('16.7%');
        expect(lectura('Señas · Por llamada')).toHaveTextContent('1 de 6');
        expect(lectura('Señas · Por presentación')).toHaveTextContent('20%');
        expect(lectura('Señas · Por presentación')).toHaveTextContent('1 de 5');
    });

    it('hay una tarjeta por columna y cada una dice su denominador', () => {
        render(<MatrizCierres cierres={CIERRES} />);

        expect(tarjeta('Por llamada')).toHaveTextContent('6 llamadas');
        expect(tarjeta('Por presentación')).toHaveTextContent('5 presentaciones');
        expect(within(tarjeta('Por llamada')).getByRole('group', { name: 'Ventas · Por llamada' }))
            .toBeInTheDocument();
    });

    it('la fila de señas no repite las ventas: ni las suma ni lleva la pastilla de puntos', () => {
        const { container } = render(<MatrizCierres cierres={CIERRES} />);

        // 1 seña de 6 llamadas, no las 3 ventas + 1 seña de la vieja fila "con señas".
        expect(lectura('Señas · Por llamada')).not.toHaveTextContent('66.7%');
        expect(lectura('Señas · Por llamada')).not.toHaveTextContent('pp');
        expect(screen.queryByText(/Con señas/)).toBeNull();
        expect(container.querySelector('.mc-pp')).toBeNull();
    });

    it('cada barra es de lo suyo: azul las ventas y rosa, sola, la de las señas', () => {
        const { container } = render(<MatrizCierres cierres={CIERRES} />);
        const llamada = within(tarjeta('Por llamada'));

        const ventas = llamada.getByRole('group', { name: 'Ventas · Por llamada' })
            .querySelectorAll('.mc-tramo');
        const senas = llamada.getByRole('group', { name: 'Señas · Por llamada' })
            .querySelectorAll('.mc-tramo');

        expect(ventas).toHaveLength(1);
        expect(ventas[0]).toHaveClass('mc-tramo--ventas');
        expect(ventas[0].style.getPropertyValue('--ancho')).toBe('50%');
        expect(senas).toHaveLength(1);
        expect(senas[0]).toHaveClass('mc-tramo--senas');
        expect(parseFloat(senas[0].style.getPropertyValue('--ancho'))).toBeCloseTo(16.67, 1);
        // La de abajo arranca después de la de arriba.
        expect(parseInt(senas[0].style.getPropertyValue('--demora'), 10))
            .toBeGreaterThan(parseInt(ventas[0].style.getPropertyValue('--demora'), 10));
        // Las ventas no se pintan en la fila de señas.
        expect(container.querySelectorAll('.mc-lectura--solo_senas .mc-tramo--ventas')).toHaveLength(0);
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
            solo_senas: { ...CIERRES.solo_senas, por_presentacion: { num: 0, den: 0, pct: null } },
        };
        render(<MatrizCierres cierres={vacia} />);

        expect(lectura('Ventas · Por presentación')).toHaveTextContent('—');
        expect(lectura('Señas · Por presentación')).toHaveTextContent('—');
        expect(pctDe(null)).toBe('—');
        expect(pctDe(0)).toBe('0%');
    });

    it('cada tooltip de lectura dice numerador, denominador y los números del período', () => {
        const Ayuda = vi.fn(() => null);
        render(<MatrizCierres cierres={CIERRES} Ayuda={Ayuda} />);

        const textos = Ayuda.mock.calls.map(([props]) => `${props.titulo} | ${props.texto}`);
        expect(textos.find(t => t.startsWith('Ventas · Por llamada |'))).toContain(
            'ventas (pago completo o split pay) ÷ llamadas con show up: 3 de 6. Es el close rate.');
        expect(textos.find(t => t.startsWith('Señas · Por presentación |')))
            .toContain('señas sin completar ÷ presentaciones: 1 de 5');
        // Las columnas y la tira también explican qué son.
        expect(textos.some(t => t.startsWith('Por presentación |'))).toBe(true);
        expect(textos.find(t => t.startsWith('Presentación |'))).toContain('5 de 6');
    });

    it('el texto de la lectura de señas avisa que no entran en el close rate', () => {
        const texto = textoDeCelda(FILAS[1], COLUMNAS[0], CIERRES.solo_senas.por_llamada);
        expect(texto).toContain('no entran en el close rate');
    });

    it('cada número lleva a su lista: ventas, solo señas, y las que presentaron', () => {
        const irA = vi.fn();
        render(<MatrizCierres cierres={CIERRES} irA={irA} destinos={DESTINOS_CIERRES} />);

        fireEvent.click(within(lectura('Ventas · Por llamada')).getByRole('button'));
        fireEvent.click(within(lectura('Señas · Por presentación')).getByRole('button'));
        fireEvent.click(screen.getByRole('button', { name: /Presentación · 5 de 6/ }));

        expect(irA).toHaveBeenNthCalledWith(1, 'agendas', expect.objectContaining({ post_call: 'Venta' }));
        expect(irA).toHaveBeenNthCalledWith(2, 'agendas', expect.objectContaining({ post_call: 'Seña' }));
        expect(irA).toHaveBeenNthCalledWith(3, 'agendas', expect.objectContaining({ presento: 'Sí' }));
    });

    it('sin bloque no dibuja nada', () => {
        const { container } = render(<MatrizCierres cierres={null} />);
        expect(container).toBeEmptyDOMElement();
    });
});

describe('MatrizCierres · No cerradas', () => {
    const tira = () => screen.getByRole('group', { name: 'No cerradas' });

    it('abajo va la tira de las no cerradas: la cantidad, su base y la tasa', () => {
        const { container } = render(<MatrizCierres cierres={CIERRES} />);

        expect(tira()).toHaveTextContent('No cerradas');
        expect(tira().querySelector('.mc-tira-pct')).toHaveTextContent(/^2$/);
        expect(tira()).toHaveTextContent('de 6 · 33.3%');
        // Va después de las dos tarjetas: cierra la lectura de la columna por llamada.
        const hijos = [...container.querySelector('.mc').children];
        expect(hijos.indexOf(tira())).toBe(hijos.length - 1);
        const [tramo] = tira().querySelectorAll('.mc-tramo');
        expect(tramo).toHaveClass('mc-tramo--no');
        expect(tramo.style.getPropertyValue('--ancho')).toBe('33.3%');
    });

    it('la cantidad lleva a Revisar con las que no cerraron', () => {
        const irA = vi.fn();
        render(<MatrizCierres cierres={CIERRES} irA={irA} destinos={DESTINOS_CIERRES} />);

        fireEvent.click(screen.getByRole('button', { name: /No cerradas · 2 de 6/ }));

        expect(irA).toHaveBeenCalledWith('agendas', expect.objectContaining({ cerro: 'No', __de: 'No cerradas' }));
    });

    it('su tooltip dice qué cuenta y con los números del período', () => {
        const Ayuda = vi.fn(() => null);
        render(<MatrizCierres cierres={CIERRES} Ayuda={Ayuda} />);

        const texto = Ayuda.mock.calls.map(([p]) => p).find(p => p.titulo === 'No cerradas')?.texto;
        expect(texto).toContain('ni en venta ni en seña: 2 de 6');
    });

    it('sin show up la tasa es un guion, y un bloque viejo sin el dato no dibuja la tira', () => {
        const { rerender } = render(
            <MatrizCierres cierres={{ ...CIERRES, no_cerradas: { num: 0, den: 0, pct: null } }} />);
        expect(tira()).toHaveTextContent('de 0 · —');

        const { no_cerradas: _fuera, ...viejo } = CIERRES;
        rerender(<MatrizCierres cierres={viejo} />);
        expect(screen.queryByRole('group', { name: 'No cerradas' })).toBeNull();
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
        expect(lectura('Señas · Por presentación')).toHaveTextContent('20%');
    });

    it('sin llamadas con show up lo dice en vez de mostrar tasas vacías', () => {
        render(<PerformanceCierres cierres={{ ...CIERRES, asistieron: 0 }} />);

        expect(screen.getByText(/Ninguna llamada del período/)).toBeInTheDocument();
        expect(screen.queryByRole('group')).toBeNull();
        expect(screen.queryByText(/ventas/)).toBeNull();
    });
});
