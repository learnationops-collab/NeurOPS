import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import UsoMensual from './UsoMensual';

describe('UsoMensual', () => {
    it('el mes en texto, sin plata', () => {
        const { container } = render(<UsoMensual uso={{ porcentaje: 5, renueva: '2026-11-01' }} />);
        expect(screen.getByText('Mes: 5% usado')).toBeTruthy();
        expect(container.textContent).not.toContain('US$');
    });

    it('un uso mínimo no aparece como 0%', () => {
        render(<UsoMensual uso={{ porcentaje: 0.4, renueva: '2026-11-01' }} />);
        expect(screen.getByText('Mes: menos del 1% usado')).toBeTruthy();
    });

    it('desde el 80% del mes dice cuándo se renueva; en el tope, que se agotó', () => {
        const { rerender, container } = render(<UsoMensual uso={{ porcentaje: 82.5, renueva: '2026-11-01' }} />);
        expect(screen.getByText('Mes: 83% usado · se renueva el 1/11')).toBeTruthy();
        expect(container.querySelector('.cp-uso--alto')).not.toBeNull();

        rerender(<UsoMensual uso={{ porcentaje: 100, renueva: '2026-11-01' }} />);
        expect(screen.getByText('Llegaste al tope del mes. Se renueva el 1/11.')).toBeTruthy();
    });

    it('sin datos todavía no ocupa lugar', () => {
        const { container } = render(<UsoMensual uso={null} />);
        expect(container.firstChild).toBeNull();
    });
});
