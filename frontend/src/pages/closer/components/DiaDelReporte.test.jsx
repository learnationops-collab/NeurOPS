import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DiaDelReporte, { etiquetaDia } from './DiaDelReporte';

const HOY = '2026-09-30';
const AYER = '2026-09-29';

const pintar = (props = {}) => {
    const onElegir = vi.fn();
    render(<DiaDelReporte hoy={HOY} ayer={AYER} valor={HOY} onElegir={onElegir} {...props} />);
    return onElegir;
};

describe('etiquetaDia', () => {
    it('nombra el día sin correrse al anterior por leer la fecha como UTC', () => {
        expect(etiquetaDia(AYER)).toBe('mar 29/09');
        expect(etiquetaDia(AYER, { largo: true })).toBe('martes 29/09');
        expect(etiquetaDia(HOY)).toBe('mié 30/09');
        expect(etiquetaDia('')).toBe('');
    });
});

describe('DiaDelReporte', () => {
    it('arranca en Hoy y deja elegir Ayer', async () => {
        const user = userEvent.setup();
        const onElegir = pintar();

        expect(screen.getByRole('radio', { name: /Hoy/ })).toHaveAttribute('aria-checked', 'true');
        expect(screen.getByRole('radio', { name: /Ayer/ })).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByText('Hoy · miércoles 30/09')).toBeInTheDocument();

        await user.click(screen.getByRole('radio', { name: /Ayer/ }));
        expect(onElegir).toHaveBeenCalledWith(AYER);
    });

    it('volver a tocar el día elegido no recarga nada', async () => {
        const user = userEvent.setup();
        const onElegir = pintar();

        await user.click(screen.getByRole('radio', { name: /Hoy/ }));
        expect(onElegir).not.toHaveBeenCalled();
    });

    it('si ayer quedó sin reportar lo avisa y el aviso lleva a Ayer', async () => {
        const user = userEvent.setup();
        const onElegir = pintar({ ayerSinReportar: true, agendasDeAyer: 3 });

        const aviso = screen.getByRole('status');
        expect(aviso).toHaveTextContent('Ayer quedó sin reportar');
        expect(aviso).toHaveTextContent('tuviste 3 agendas el martes 29/09');

        await user.click(screen.getByRole('button', { name: 'Reportar ayer' }));
        expect(onElegir).toHaveBeenCalledWith(AYER);
    });

    it('sin deuda de ayer no hay aviso', () => {
        pintar({ ayerSinReportar: false });
        expect(screen.queryByText('Ayer quedó sin reportar')).not.toBeInTheDocument();
    });

    it('con Ayer elegido el aviso se va y dice qué día se guarda', () => {
        pintar({ valor: AYER, ayerSinReportar: true, agendasDeAyer: 1 });

        expect(screen.getByRole('radio', { name: /Ayer/ })).toHaveAttribute('aria-checked', 'true');
        expect(screen.queryByText('Ayer quedó sin reportar')).not.toBeInTheDocument();
        expect(screen.getByText('Ayer · martes 29/09')).toBeInTheDocument();
        expect(screen.getByText(/se guarda como el reporte del martes 29\/09/)).toBeInTheDocument();
    });

    it('el de ayer mandado hoy dice que se envió otro día', () => {
        // 15:00 UTC del 30/09: en cualquier zona de América sigue siendo 30/09.
        pintar({ valor: AYER, enviado: true, enviadoEl: '2026-09-30T15:00:00' });
        expect(screen.getByText(/✓ Enviado el 30\/09 · \d\d:\d\d/)).toBeInTheDocument();
    });

    it('el de hoy mandado hoy dice solo la hora', () => {
        pintar({ valor: HOY, enviado: true, enviadoEl: '2026-09-30T15:00:00' });
        expect(screen.getByText(/^✓ Enviado \d\d:\d\d$/)).toBeInTheDocument();
    });

    it('sin enviar no muestra el sello', () => {
        pintar({ enviado: false });
        expect(screen.queryByText(/Enviado/)).not.toBeInTheDocument();
    });
});
