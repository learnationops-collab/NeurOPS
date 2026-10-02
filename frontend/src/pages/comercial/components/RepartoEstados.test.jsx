import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RepartoEstados, { GRUPOS, agrupar, repartir } from './RepartoEstados';

/**
 * El panel Estados: la dona con los tres grupos y la tabla de estados.
 *
 * Lo que importa es que los tres grupos sumen exactamente el total y el 100% (el porcentaje del
 * medio sale de ahí), que cada estado y cada grupo lleve a las agendas que lo componen, y que la
 * dona tenga un texto que la lea quien no la ve.
 */

// Los números del diseño de Kerwin, con la forma que manda `estados_de`.
const ESTADOS = [
    { key: 'sin_reporte', label: 'Sin reporte', tone: 'warning', n: 80, filtro: 'Sin reporte', grupo: 'sin_resultado' },
    { key: 'no_show', label: 'No show', tone: 'error', n: 65, filtro: 'No show', grupo: 'sin_resultado' },
    { key: 'venta', label: 'Venta', tone: 'success', n: 13, filtro: 'Venta', grupo: 'cerradas' },
    { key: 'sena', label: 'Seña', tone: 'brand-secondary', n: 12, filtro: 'Seña', grupo: 'cerradas' },
    { key: 'seguimiento', label: 'Seguimiento', tone: 'info', n: 58, filtro: 'Seguimiento', grupo: 'en_curso' },
    { key: 'presento_no_cerro', label: 'Presentó, no cerró', tone: 'naranja', n: 1, filtro: 'Presentó, no cerró', grupo: 'en_curso' },
    { key: 'segunda_llamada', label: '2da llamada', tone: 'info', n: 9, filtro: '2da llamada', grupo: 'en_curso' },
];

const fila = (nombre) => screen.getByRole('button', { name: new RegExp(`^${nombre}:`) });

describe('repartir', () => {
    it('los porcentajes cierran en 100 exacto aunque redondear cada uno no lo haga', () => {
        expect(repartir([1, 1, 1])).toEqual([33.4, 33.3, 33.3]);
        expect(repartir([145, 68, 25]).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
        expect(repartir([0, 0])).toEqual([0, 0]);
    });
});

describe('agrupar', () => {
    it('suma cada grupo con el grupo que manda el backend, y siempre son los tres', () => {
        const grupos = agrupar(ESTADOS);

        expect(grupos.map(g => [g.key, g.n, g.pct])).toEqual([
            ['sin_resultado', 145, 60.9], ['en_curso', 68, 28.6], ['cerradas', 25, 10.5],
        ]);
        expect(agrupar([ESTADOS[2]]).map(g => g.key)).toEqual(GRUPOS.map(g => g.key));
    });

    it('un estado sin grupo se cuenta en curso: el total no pierde agendas', () => {
        const sinGrupo = { key: 'nuevo', label: 'Nuevo', tone: 'idle', n: 4, filtro: 'Nuevo' };
        const grupos = agrupar([...ESTADOS, sinGrupo]);

        expect(grupos.find(g => g.key === 'en_curso').n).toBe(72);
        expect(grupos.reduce((a, g) => a + g.n, 0)).toBe(242);
    });
});

describe('RepartoEstados · gráfico', () => {
    it('al medio el porcentaje sin resultado y al lado los tres grupos con el suyo', () => {
        const { container } = render(<RepartoEstados estados={ESTADOS} vista="grafico" />);

        expect(container.querySelector('.est-centro')).toHaveTextContent('61%');
        expect(container.querySelector('.est-centro')).toHaveTextContent('sin resultado');
        const grupos = [...container.querySelectorAll('.est-grupo')].map(g => g.textContent);
        expect(grupos).toEqual(['Sin resultado60.9%', 'En curso28.6%', 'Cerradas10.5%']);
    });

    it('la dona tiene un arco por estado con su color, y un texto que la describe', () => {
        const { container } = render(<RepartoEstados estados={ESTADOS} vista="grafico" />);

        const arcos = container.querySelectorAll('.est-seg');
        expect(arcos).toHaveLength(7);
        expect(arcos[0].getAttribute('stroke')).toBe('var(--warning)');
        expect(arcos[3].getAttribute('stroke')).toBe('var(--brand-secondary)');
        // Cada arco arranca donde terminó el anterior: 80 de 238 es el 33.6% de la vuelta.
        expect(arcos[0].getAttribute('stroke-dashoffset')).toBe('0.000');
        expect(arcos[1].getAttribute('stroke-dashoffset')).toBe('-33.613');
        expect(arcos[2].getAttribute('stroke-dashoffset')).toBe('-60.924');
        const dona = screen.getByRole('img');
        expect(dona).toHaveAccessibleName(/^238 agendas: Sin reporte 80 \(33\.6%\), No show 65/);
    });

    it('un estado con una sola agenda sigue teniendo su arco aunque la rendija sea más grande', () => {
        const { container } = render(<RepartoEstados estados={ESTADOS} vista="grafico" />);
        const presento = container.querySelectorAll('.est-seg')[5];

        expect(parseFloat(presento.getAttribute('stroke-dasharray'))).toBeGreaterThan(0);
    });

    it('cada grupo lleva a las agendas de todos sus estados, y cada arco a las del suyo', () => {
        const irA = vi.fn();
        const { container } = render(<RepartoEstados estados={ESTADOS} vista="grafico" irA={irA} />);

        fireEvent.click(fila('Sin resultado'));
        fireEvent.click(container.querySelectorAll('.est-seg')[4]);
        fireEvent.keyDown(container.querySelectorAll('.est-seg')[2], { key: 'Enter' });

        expect(irA).toHaveBeenNthCalledWith(1, 'agendas', expect.objectContaining({
            estado: ['Sin reporte', 'No show'], __de: 'Estados: Sin resultado',
        }));
        expect(irA).toHaveBeenNthCalledWith(2, 'agendas', expect.objectContaining({
            estado: 'Seguimiento', __de: 'Estados: Seguimiento',
        }));
        expect(irA).toHaveBeenNthCalledWith(3, 'agendas', expect.objectContaining({ estado: 'Venta' }));
        // Con drill-down la dona es un grupo de botones, no una imagen.
        expect(screen.getByRole('group')).toHaveAccessibleName(/^238 agendas: Sin reporte 80/);
        expect(screen.getByRole('button', { name: /^Seguimiento: 58 agendas, 24\.4%\. Ver en Revisar$/ }))
            .toBeInTheDocument();
    });

    it('pasar por un grupo apaga los arcos de los otros dos', () => {
        const { container } = render(<RepartoEstados estados={ESTADOS} vista="grafico" irA={vi.fn()} />);

        fireEvent.mouseEnter(fila('Cerradas'));

        const apagados = [...container.querySelectorAll('.est-seg[data-apagado]')].map(a => a.dataset.grupo);
        expect(apagados).toHaveLength(5);
        expect(apagados).not.toContain('cerradas');
    });

    it('un grupo en cero se dibuja igual pero no lleva a ningún lado', () => {
        const irA = vi.fn();
        const { container } = render(<RepartoEstados estados={ESTADOS.slice(0, 2)} vista="grafico" irA={irA} />);

        expect(container.querySelectorAll('.est-grupo')).toHaveLength(3);
        expect(container.querySelector('.est-centro')).toHaveTextContent('100%');
        expect(screen.queryByRole('button', { name: /^Cerradas:/ })).toBeNull();
    });

    it('sin drill-down no hay nada cliqueable', () => {
        render(<RepartoEstados estados={ESTADOS} vista="grafico" />);
        expect(screen.queryByRole('button')).toBeNull();
    });
});

describe('RepartoEstados · tabla', () => {
    it('una fila por estado con su cuenta y su porcentaje, la barra escalada al mayor', () => {
        const { container } = render(<RepartoEstados estados={ESTADOS} vista="tabla" />);

        const filas = container.querySelectorAll('.est-fila');
        expect(filas).toHaveLength(7);
        expect(filas[0]).toHaveTextContent('Sin reporte8033.6%');
        expect(filas[5]).toHaveTextContent('Presentó, no cerró10.4%');
        const anchos = [...container.querySelectorAll('.est-fila-riel > i')]
            .map(i => parseFloat(i.style.getPropertyValue('--ancho')));
        expect(anchos[0]).toBe(100);
        expect(anchos[1]).toBeCloseTo(81.25, 2);
        // La suma de la columna de porcentajes cierra en 100.
        const pcts = [...container.querySelectorAll('.est-fila-p')].map(p => parseFloat(p.textContent));
        expect(pcts.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    });

    it('cada fila lleva a las agendas de su estado', () => {
        const irA = vi.fn();
        render(<RepartoEstados estados={ESTADOS} vista="tabla" irA={irA} />);

        fireEvent.click(fila('No show'));

        expect(irA).toHaveBeenCalledWith('agendas', expect.objectContaining({
            estado: 'No show', __de: 'Estados: No show',
        }));
    });
});

it('sin agendas no dibuja nada', () => {
    const { container } = render(<RepartoEstados estados={[]} />);
    expect(container).toBeEmptyDOMElement();
});
