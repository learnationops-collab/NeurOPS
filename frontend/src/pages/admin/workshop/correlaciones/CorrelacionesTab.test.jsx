import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../../../services/api';
import CorrelacionesTab from './CorrelacionesTab';

const METRICAS = [
    { key: 'show_up_workshop', label: 'Show up del taller', grupo: 'Embudo', formato: 'pct', tip: '' },
    { key: 'show_up_citas', label: 'Show up de citas', grupo: 'Agendas', formato: 'pct', tip: '' },
    { key: 'cash_collected', label: 'Cash collected', grupo: 'Ventas', formato: 'usd', tip: '' },
];

const celda = (pearson, n = 5, extra = {}) => ({
    n, pearson, spearman: pearson, p: 0.2, confianza: 'baja', intensidad: 'fuerte', constante: false, ...extra,
});

const MATRIZ = {
    show_up_workshop: { show_up_workshop: celda(1), show_up_citas: celda(0.3), cash_collected: celda(0.9) },
    show_up_citas: { show_up_workshop: celda(0.3), show_up_citas: celda(1), cash_collected: celda(-0.5) },
    cash_collected: { show_up_workshop: celda(0.9), show_up_citas: celda(-0.5), cash_collected: celda(1) },
};

const taller = (id, fecha, su, sc, cash) => ({
    id, date: fecha, name: `T${id}`, valores: { show_up_workshop: su, show_up_citas: sc, cash_collected: cash },
});

const RESPUESTA = {
    n_talleres: 5,
    objetivo: 'cash_collected',
    avisos: ['Solo 5 talleres: las correlaciones son muy inestables, un taller distinto las cambia.'],
    notas: ['Una correlación no prueba que una cosa cause la otra: solo que se mueven parecido entre talleres.'],
    metricas: METRICAS,
    talleres: [
        taller(1, '2026-08-03', 20, 60, 500), taller(2, '2026-08-10', 35, 50, 1000), taller(3, '2026-08-17', 62, 70, 2400),
        taller(4, '2026-08-24', 47, 40, 1500), taller(5, '2026-08-31', 30, 55, 900),
    ],
    matriz: MATRIZ,
    ranking: [],
};

describe('Workshop › Correlaciones', () => {
    beforeEach(() => api.get.mockReset());

    it('muestra el aviso de muestra chica, el ranking contra cash y el par inicial', async () => {
        api.get.mockResolvedValue({ data: RESPUESTA });
        render(<CorrelacionesTab />);

        expect(await screen.findByText(/Solo 5 talleres/)).toBeInTheDocument();
        expect(screen.getByText(/no prueba que una cosa cause la otra/)).toBeInTheDocument();

        // Ranking: la más fuerte contra cash va primero.
        const filas = within(screen.getByRole('list', { name: /ordenadas por relación con Cash collected/ })).getAllByRole('button');
        expect(filas[0]).toHaveTextContent('Show up del taller');
        expect(filas[0]).toHaveTextContent('+0.90');
        expect(filas[1]).toHaveTextContent('−0.50');

        // Par inicial: show up del taller contra cash collected, con su dispersión.
        expect(screen.getByRole('heading', { name: 'Show up del taller vs Cash collected' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /en 5 talleres/ })).toBeInTheDocument();
    });

    it('un clic en una celda del mapa cambia el par que se dibuja', async () => {
        api.get.mockResolvedValue({ data: RESPUESTA });
        render(<CorrelacionesTab />);
        await screen.findByRole('table');

        await userEvent.click(screen.getByRole('button', { name: /Show up de citas contra Cash collected: −0.50/ }));
        expect(screen.getByRole('heading', { name: 'Show up de citas vs Cash collected' })).toBeInTheDocument();
    });

    it('los atajos comparan el show up del taller con el de las citas', async () => {
        api.get.mockResolvedValue({ data: RESPUESTA });
        render(<CorrelacionesTab />);
        await screen.findByRole('table');

        await userEvent.click(screen.getByRole('button', { name: 'Show up: taller vs citas' }));
        expect(screen.getByRole('heading', { name: 'Show up del taller vs Show up de citas' })).toBeInTheDocument();
    });

    it('con menos de 3 talleres explica que no hay datos y no dibuja el mapa', async () => {
        api.get.mockResolvedValue({ data: { ...RESPUESTA, n_talleres: 2, talleres: [], avisos: ['Hay 2 talleres'] } });
        render(<CorrelacionesTab />);

        expect(await screen.findByText('Todavía no hay datos para correlacionar')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('si el pedido falla ofrece reintentar', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        api.get.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({ data: RESPUESTA });
        render(<CorrelacionesTab />);

        await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }));
        await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
        expect(api.get).toHaveBeenCalledTimes(2);
    });
});
