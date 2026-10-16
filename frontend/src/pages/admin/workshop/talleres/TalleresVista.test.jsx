import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import api from '../../../../services/api';
import { olvidarDatosTaller } from './datosTaller';
import TalleresVista from './TalleresVista';

const taller = (id, date, name, extra = {}) => ({
    id, date, name, inversion: 300, cash_collected: 900, roas: 3, leads: 200, whatsapp_leads: 150, show_up: 60,
    show_up_rate: 30, pitch_leads: 40, pitch_final_leads: 30, aplicaciones_form: 12, agendas_exitosas: 10,
    show_up_sales_call: 6, sales: 2, pct_close_rate: 33.3, cpl: 1.5, costo_por_agenda: 30, ticket_promedio: 450,
    clics: 900, ctr: 2, cpc: 0.33, cpm: 8, inversion_de_meta: true, ...extra,
});

const TALLERES = [
    taller(15, '2026-10-12', 'WEBINAR 12 DE OCTUBRE', { replay_loom_id: 'abc123' }),
    taller(14, '2026-10-03', 'WEBINAR 3 DE OCTUBRE', { sales: 0, roas: 0.5, cash_collected: 150 }),
    taller(13, '2026-09-20', 'WEBINAR 20 DE SEPTIEMBRE'),
];

const ANUNCIOS = {
    desde: '2026-10-04', hasta: '2026-10-12', anuncios_workshop: 3,
    totales: { gasto: 280, impresiones: 9000, clics: 300, ctr: 3.33, cpc: 1.71, cpm: 22.8, visitas: 410, clics_whatsapp: 61, costo_whatsapp: 3.37 },
    campanas: [{ campana_id: 'c1', nombre: 'WORKSHOP FUNNEL | TESTING', gasto: 280, conjuntos: [] }],
};

const responder = (url) => {
    if (url.includes('/anuncios')) return Promise.resolve({ data: ANUNCIOS });
    if (url.startsWith('workshop/prefill')) {
        return Promise.resolve({ data: { desglose: { vivo: { agendas: 7 }, landing: { agendas: 3 } }, ventana: { desde: '2026-10-12', hasta: '2026-10-16', dias: 5, abierta: true } } });
    }
    return Promise.resolve({ data: {} });
};

const armar = () => render(
    <div className="dc-shell">
        <TalleresVista events={TALLERES} realizados={TALLERES} onEdit={vi.fn()} onRefresh={vi.fn()}
            formatDate={(d) => d} />
    </div>,
);

describe('Workshop › Talleres', () => {
    beforeEach(() => {
        window.localStorage.clear();
        olvidarDatosTaller();
        api.get.mockReset().mockImplementation(responder);
        api.put.mockReset().mockResolvedValue({ data: {} });
    });

    it('arranca en tarjetas y cada tarjeta cambia entre su embudo y sus anuncios', async () => {
        armar();
        const tarjeta = screen.getByRole('article', { name: /WEBINAR 12 DE OCTUBRE/ });
        expect(within(tarjeta).getByRole('list', { name: 'Embudo del taller' })).toBeInTheDocument();
        // Los anuncios se piden recién al mirarlos.
        expect(api.get).not.toHaveBeenCalled();

        await userEvent.click(within(tarjeta).getByRole('tab', { name: 'Anuncios' }));
        expect(await within(tarjeta).findByText('WORKSHOP FUNNEL | TESTING')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('workshop/events/15/anuncios', expect.anything());
    });

    it('el interruptor de la grabación la publica 48 h desde la tarjeta', async () => {
        armar();
        const tarjeta = screen.getByRole('article', { name: /WEBINAR 12 DE OCTUBRE/ });
        await userEvent.click(within(tarjeta).getByRole('tab', { name: 'Grabación' }));
        expect(within(tarjeta).getByRole('link', { name: /Abrir grabación/ })).toHaveAttribute('href', 'https://www.loom.com/share/abc123');

        await userEvent.click(within(tarjeta).getByRole('switch', { name: /Landing de la grabación/ }));
        const [url, cuerpo] = api.put.mock.calls[0];
        expect(url).toBe('workshop/events/15');
        expect(cuerpo.replay_loom_id).toBe('abc123');
        const horas = (new Date(cuerpo.replay_vence_hasta) - new Date(cuerpo.replay_activo_desde)) / 3600000;
        expect(horas).toBe(48);

        // Sin Loom cargado no se puede prender.
        const otra = screen.getByRole('article', { name: /WEBINAR 3 DE OCTUBRE/ });
        await userEvent.click(within(otra).getByRole('tab', { name: 'Grabación' }));
        expect(within(otra).getByRole('switch')).toBeDisabled();
    });

    it('«Ver completo» abre el detalle en una hoja con el embudo y su desglose vivo', async () => {
        armar();
        const tarjeta = screen.getByRole('article', { name: /WEBINAR 12 DE OCTUBRE/ });
        await userEvent.click(within(tarjeta).getByRole('button', { name: /Embudo completo/ }));

        const hoja = screen.getByRole('dialog', { name: /WEBINAR 12 DE OCTUBRE/ });
        expect(within(hoja).getByRole('tab', { name: 'Embudo', selected: true })).toBeInTheDocument();
        expect(await within(hoja).findByText('Vivo vs. grabación')).toBeInTheDocument();
        expect(api.get).toHaveBeenCalledWith('workshop/prefill?date=2026-10-12');

        // Las flechas pasan al taller anterior sin cerrar.
        await userEvent.click(within(hoja).getByRole('button', { name: 'Taller anterior' }));
        expect(screen.getByRole('dialog', { name: /WEBINAR 3 DE OCTUBRE/ })).toBeInTheDocument();
    });

    it('en tabla filtra por facetas, recuerda el modo y la fila abre el detalle', async () => {
        const { unmount } = armar();
        await userEvent.click(screen.getByRole('button', { name: 'Ver como tabla' }));
        expect(screen.getByRole('columnheader', { name: /ROAS/ })).toBeInTheDocument();
        expect(screen.getByText('mostrando 3 de 3')).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));
        const panel = screen.getByRole('dialog', { name: 'Filtro completo' });
        await userEvent.click(within(panel).getByText('Sin ventas'));
        expect(screen.getByText('mostrando 1 de 3')).toBeInTheDocument();

        unmount();
        armar();
        expect(screen.getByRole('button', { name: 'Ver como tabla' })).toHaveAttribute('aria-pressed', 'true');
        await userEvent.click(screen.getByText('WEBINAR 20 DE SEPTIEMBRE'));
        expect(screen.getByRole('dialog', { name: /WEBINAR 20 DE SEPTIEMBRE/ })).toBeInTheDocument();
    });

    it('compara hasta cuatro: con dos elegidos se abre la comparación', async () => {
        armar();
        const [a, b] = screen.getAllByRole('article');
        await userEvent.click(within(a).getByRole('button', { name: 'Comparar' }));
        expect(within(a).getByRole('button', { name: 'Comparar' })).toHaveAttribute('aria-pressed', 'true');
        const barra = screen.getByRole('region', { name: 'Comparación' });
        expect(within(barra).getByRole('button', { name: 'Comparar' })).toBeDisabled();
        await userEvent.click(within(b).getByRole('button', { name: 'Comparar' }));
        await userEvent.click(within(barra).getByRole('button', { name: 'Comparar' }));

        const hoja = await screen.findByRole('dialog', { name: 'Comparar talleres' });
        await waitFor(() => expect(within(hoja).getAllByRole('columnheader')).toHaveLength(3));
    });
});
