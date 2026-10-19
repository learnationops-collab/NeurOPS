import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import UsoMensual from './UsoMensual';

const uso = (gastado, porcentaje) => ({ gastado_usd: gastado, tope_usd: 8, porcentaje, renueva: '2026-11-01' });

describe('UsoMensual', () => {
    it('muestra lo gastado contra el tope, sin aviso mientras sobra', () => {
        render(<UsoMensual uso={uso(0.12, 1.5)} />);

        const barra = screen.getByRole('meter', { name: 'Uso del mes de Learnito' });
        expect(barra.getAttribute('aria-valuenow')).toBe('1.5');
        expect(screen.getByText('US$0,12 de US$8,00')).toBeTruthy();
        expect(screen.queryByText(/Se renueva/)).toBeNull();
    });

    it('desde el 80% avisa y dice cuándo se renueva; en el tope, que se agotó', () => {
        const { rerender, container } = render(<UsoMensual uso={uso(6.6, 82.5)} />);
        expect(screen.getByText('Te queda poco uso este mes. Se renueva el 1/11.')).toBeTruthy();
        expect(container.querySelector('.cp-uso--alto')).not.toBeNull();

        rerender(<UsoMensual uso={uso(8, 100)} />);
        expect(screen.getByText('Llegaste al tope de este mes. Se renueva el 1/11.')).toBeTruthy();
    });

    it('sin datos todavía no ocupa lugar', () => {
        const { container } = render(<UsoMensual uso={null} />);
        expect(container.firstChild).toBeNull();
    });
});
