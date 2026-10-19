import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import UsoMensual from './UsoMensual';

const uso = ({ hoy = 0.05, pHoy = 19.2, mes = 0.4, pMes = 5 } = {}) => ({
    gastado_usd: mes, tope_usd: 8, porcentaje: pMes, renueva: '2026-11-01',
    hoy_usd: hoy, tope_diario_usd: 0.26, porcentaje_hoy: pHoy,
});

describe('UsoMensual', () => {
    it('la barra es la de hoy contra la referencia diaria, y el mes va en texto', () => {
        render(<UsoMensual uso={uso()} />);

        const barra = screen.getByRole('meter', { name: 'Uso de hoy de Learnito' });
        expect(barra.getAttribute('aria-valuenow')).toBe('19.2');
        expect(screen.getByText('US$0,05 de ~US$0,26 por día')).toBeTruthy();
        expect(screen.getByText('Mes: US$0,40 de US$8,00')).toBeTruthy();
    });

    it('pasar lo del día la pone ámbar pero la barra no se sale', () => {
        const { container } = render(<UsoMensual uso={uso({ hoy: 0.52, pHoy: 200 })} />);

        expect(container.querySelector('.cp-uso--alto')).not.toBeNull();
        expect(container.querySelector('.cp-uso__barra span').style.width).toBe('100%');
    });

    it('desde el 80% del mes dice cuándo se renueva; en el tope, que se agotó', () => {
        const { rerender } = render(<UsoMensual uso={uso({ mes: 6.6, pMes: 82.5 })} />);
        expect(screen.getByText('Mes: US$6,60 de US$8,00 · se renueva el 1/11')).toBeTruthy();

        rerender(<UsoMensual uso={uso({ mes: 8, pMes: 100 })} />);
        expect(screen.getByText('Llegaste al tope del mes (US$8,00). Se renueva el 1/11.')).toBeTruthy();
    });

    it('sin datos todavía no ocupa lugar', () => {
        const { container } = render(<UsoMensual uso={null} />);
        expect(container.firstChild).toBeNull();
    });
});
