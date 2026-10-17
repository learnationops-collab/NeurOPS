import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
    Reveal, Skeleton, SkeletonBlock, SkeletonChart, SkeletonCircle, SkeletonKpi, SkeletonPanel, SkeletonRow, SkeletonText,
    skeletonDelay,
} from './index';

const huesos = (el) => [...el.querySelectorAll('.ui-skel-bone')];

describe('Skeleton', () => {
    it('se anuncia como «cargando» con su rótulo y texto para el lector', () => {
        render(<Skeleton label="Cargando los KPIs…"><SkeletonBlock /></Skeleton>);
        const estado = screen.getByRole('status', { name: 'Cargando los KPIs…' });
        expect(estado.getAttribute('aria-busy')).toBe('true');
        expect(estado.textContent).toBe('Cargando los KPIs…');
        expect(estado.className).toBe('ui-skel');
    });

    it('los huesos son decorativos y llevan su medida y su lugar en la ola', () => {
        const { container } = render(<SkeletonBlock width="40%" height={34} radius={8} step={3} />);
        const h = container.firstChild;
        expect(h.getAttribute('aria-hidden')).toBe('true');
        expect(h.style.width).toBe('40%');
        expect(h.style.height).toBe('34px');
        expect(h.style.borderRadius).toBe('8px');
        expect(h.style.getPropertyValue('--ui-skel-delay')).toBe(`${skeletonDelay(3)}ms`);
    });

    it('el retraso tiene tope: el elemento 500 no espera medio minuto', () => {
        expect(skeletonDelay(0)).toBe(0);
        expect(skeletonDelay(500)).toBe(skeletonDelay(24));
        expect(skeletonDelay(-3)).toBe(0);
    });

    it('SkeletonCircle es redondo y del tamaño pedido', () => {
        const { container } = render(<SkeletonCircle size={28} />);
        expect(container.firstChild.style.width).toBe('28px');
        expect(container.firstChild.style.borderRadius).toBe('50%');
    });
});

describe('Composiciones', () => {
    it('SkeletonText: cada renglón mide el alto de la línea y el último es más corto', () => {
        const { container } = render(<SkeletonText lines={3} height={10} lineHeight={20} lastWidth="50%" step={2} />);
        const lineas = [...container.querySelectorAll('.ui-skel-line')];
        expect(lineas.map((l) => l.style.height)).toEqual(['20px', '20px', '20px']);
        const h = huesos(container);
        expect(h.map((x) => x.style.width)).toEqual(['100%', '100%', '50%']);
        expect(h[2].style.getPropertyValue('--ui-skel-delay')).toBe(`${skeletonDelay(4)}ms`);
    });

    it('SkeletonKpi usa la clase de la tarjeta real: rótulo, cifra y detalle', () => {
        const { container } = render(<SkeletonKpi className="kpi wr-kpi" valueHeight={32} />);
        expect(container.firstChild.className).toBe('kpi wr-kpi');
        expect(container.firstChild.children).toHaveLength(3);
        expect(huesos(container)[1].style.height).toBe('32px');
        const { container: sinDetalle } = render(<SkeletonKpi detail={false} />);
        expect(sinDetalle.firstChild.className).toBe('ui-kpi');
        expect(sinDetalle.firstChild.children).toHaveLength(2);
    });

    it('SkeletonRow: un hueso por columna, con la grilla de la fila real o columnas iguales', () => {
        const { container } = render(<SkeletonRow cells={['30%', '60%']} columns="120px 1fr" height={40} />);
        const fila = container.firstChild;
        expect(fila.style.gridTemplateColumns).toBe('120px 1fr');
        expect(fila.style.minHeight).toBe('40px');
        expect(huesos(fila)).toHaveLength(2);
        const { container: conAvatar } = render(<SkeletonRow cells={['a', 'b', 'c']} avatar />);
        expect(conAvatar.firstChild.style.gridTemplateColumns).toBe('auto repeat(3, minmax(0, 1fr))');
        expect(conAvatar.querySelectorAll('.ui-skel-bone--round')).toHaveLength(1);
    });

    it('SkeletonPanel: título y filas, o lo que se le pase adentro', () => {
        const { container } = render(<SkeletonPanel rows={4} rowHeight={30} className="panel" />);
        expect(container.firstChild.className).toBe('panel');
        expect(container.querySelectorAll('.ui-skel-stack > .ui-skel-bone')).toHaveLength(4);
        const { container: propio } = render(<SkeletonPanel title={false}><i data-x="1" /></SkeletonPanel>);
        expect(propio.querySelector('[data-x]')).toBeTruthy();
        expect(huesos(propio)).toHaveLength(0);
    });

    it('SkeletonChart: barras del alto del gráfico, o un solo bloque', () => {
        const { container } = render(<SkeletonChart bars={8} height={180} />);
        expect(container.querySelector('.ui-skel-bars').style.height).toBe('180px');
        expect(container.querySelectorAll('.ui-skel-bars > .ui-skel-bone')).toHaveLength(8);
        const { container: area } = render(<SkeletonChart variant="area" title={false} height={150} />);
        expect(huesos(area).map((h) => h.style.height)).toEqual(['150px']);
    });
});

describe('Reveal', () => {
    it('muestra el esqueleto hasta que llega el dato y después el dato con su entrada', () => {
        const esqueleto = <Skeleton label="Cargando…"><SkeletonBlock /></Skeleton>;
        const { rerender } = render(<Reveal ready={false} skeleton={esqueleto}><p>Listo</p></Reveal>);
        expect(screen.getByRole('status')).toBeTruthy();
        expect(screen.queryByText('Listo')).toBeNull();

        rerender(<Reveal ready skeleton={esqueleto} as="section" delay={120} className="wr-kpis"><p>Listo</p></Reveal>);
        expect(screen.queryByRole('status')).toBeNull();
        const caja = screen.getByText('Listo').parentElement;
        expect(caja.tagName).toBe('SECTION');
        expect(caja.className).toBe('ui-reveal wr-kpis');
        expect(caja.style.getPropertyValue('--ui-reveal-delay')).toBe('120ms');
    });

    it('sin esqueleto no dibuja nada mientras espera', () => {
        const { container } = render(<Reveal ready={false}><p>x</p></Reveal>);
        expect(container.innerHTML).toBe('');
    });
});
