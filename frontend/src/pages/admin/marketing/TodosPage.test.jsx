import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import api from '../../../services/api';
import TodosPage from './TodosPage';

const BASE = { anuncios: 3, cuotas: 4, cuotas_monto: 800, upsells: 2, upsells_monto: 350, pct_upsell: 25, agendas_dias: {} };
const SETTING = {
    key: 'setting', label: 'Setting', ...BASE, leads: 1000, agendas: 50, show_up: 30, ventas: 3, gasto: 1000, new_cash: 900,
    cash_total: 2500, cpl: 1, costo_agenda: 20, costo_venta: 333.33, roas_new_cash: 0.9, roas_total: 2.5,
};
const WORKSHOP = {
    key: 'workshop', label: 'Workshop', ...BASE, leads: 400, agendas: 60, show_up: 30, ventas: 2, gasto: 500, new_cash: 550,
    cash_total: 600, cpl: 1.25, costo_agenda: 8.33, costo_venta: 250, roas_new_cash: 1.1, roas_total: 1.2,
};
const TABLERO = {
    desde: '2026-09-15', hasta: '2026-10-14', moneda: 'USD', filas: [], totales: {},
    meta: { conectado: false, ultima_sincronizacion: null },
    embudos: [
        { embudo: 'setting', gasto: 300, anuncios: 12, dias: { '2026-10-01': 300 } },
        { embudo: 'workshop', gasto: 100, anuncios: 4, dias: { '2026-10-01': 100 } },
        { embudo: 'contratacion', gasto: 0, anuncios: 0, dias: {} },
        { embudo: 'otro', gasto: 0, anuncios: 0, dias: {} },
    ],
    fuentes: { fuentes: [SETTING, WORKSHOP], otras: { cash_total: 0, cobros: 0 } },
};

const Destino = ({ nombre }) => {
    const { pathname, search } = useLocation();
    return <p>{nombre} {pathname}{search}</p>;
};

const abrir = (ruta = '/admin/todos?periodo=ultimos_30') => render(
    <MemoryRouter initialEntries={[ruta]}>
        <Routes>
            <Route path="/admin/todos" element={<TodosPage />} />
            <Route path="/admin/workshops" element={<Destino nombre="Workshop" />} />
            <Route path="/admin/marketing" element={<Destino nombre="Setting" />} />
        </Routes>
    </MemoryRouter>,
);

describe('Todos › Setting vs Workshop', () => {
    beforeEach(() => {
        cleanup();
        api.get.mockReset();
        api.get.mockResolvedValue({ data: TABLERO });
    });

    it('el resumen dice quién gana en las cuatro cifras que más separan a las dos fuentes', async () => {
        abrir();
        const tarjetas = within(await screen.findByLabelText('Lo que más separa a Setting de Workshop'));
        // Lead → agenda: 5% contra 15%. ROAS total: 2.5x contra 1.2x. Costo por venta: $333 contra $250.
        expect(tarjetas.getByText('×3.0')).toBeInTheDocument();
        expect(tarjetas.getByText('×2.1')).toBeInTheDocument();
        expect(tarjetas.getByText('−25%')).toBeInTheDocument();
        // Show → venta: 10% contra 6.7%.
        expect(tarjetas.getByText('+3.3 pp')).toBeInTheDocument();
    });

    it('el embudo normalizado cuenta cuántos de cada 1.000 leads llegan a cada paso', async () => {
        abrir();
        const embudo = (await screen.findByText('De cada 1.000 leads, cuántos llegan a cada paso')).closest('section');
        // Agendas: 50 de 1.000 en Setting y 150 de 1.000 en Workshop.
        expect(within(embudo).getByText('50')).toBeInTheDocument();
        expect(within(embudo).getByText('150')).toBeInTheDocument();
    });

    it('«Métrica por métrica» corona las tasas y los costos, y deja sin ganador los volúmenes', async () => {
        abrir();
        await userEvent.click(await screen.findByRole('tab', { name: 'Métrica por métrica' }));
        const roas = (await screen.findByText('ROAS Total')).closest('.td-fila');
        expect(within(roas).getByText('2.50x')).toBeInTheDocument();
        expect(within(roas).getByText('1.20x')).toBeInTheDocument();
        expect(within(roas).getByTitle('Gana Setting')).toBeInTheDocument();
        const leads = screen.getByText('Leads entrantes').closest('.td-fila');
        expect(within(leads).getByText('Volumen')).toBeInTheDocument();
        // Un filtro deja solo un grupo.
        await userEvent.click(screen.getByRole('tab', { name: 'Costos' }));
        expect(screen.queryByText('ROAS Total')).not.toBeInTheDocument();
        expect(screen.getByText('Costo por venta')).toBeInTheDocument();
    });

    it('«Gasto en Meta» muestra el gasto por embudo y cada tarjeta lleva a su espacio con el mismo período', async () => {
        abrir('/admin/todos?periodo=ultimos_30&vista=meta');
        expect(await screen.findByText('75% del gasto · 12 anuncios')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Ver Workshop: $100' }));
        expect(await screen.findByText(/^Workshop \/admin\/workshops\?tab=rendimiento&periodo=ultimos_30/)).toBeInTheDocument();
    });
});
