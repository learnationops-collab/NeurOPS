import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import api from '../../../services/api';
import TodosPage from './TodosPage';

const FUENTE = {
    anuncios: 3, leads: 1000, gasto: 1000, agendas: 50, show_up: 30, pct_show_up: 60, ventas: 3, cuotas: 4, cuotas_monto: 800,
    new_cash: 900, cash_total: 2500, cpl: 1, costo_agenda: 20, costo_venta: 333.33, roas_new_cash: 0.9, roas_total: 2.5,
    agendas_dias: {}, upsells: 2, upsells_monto: 350, pct_upsell: 25,
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
    fuentes: {
        fuentes: [{ key: 'setting', label: 'Setting', ...FUENTE },
            { key: 'workshop', label: 'Workshop', ...FUENTE, roas_new_cash: 1.1, roas_total: 1.2, costo_agenda: 35, pct_show_up: 40 }],
        otras: { cash_total: 0, cobros: 0 },
    },
};

const Destino = ({ nombre }) => {
    const { pathname, search } = useLocation();
    return <p>{nombre} {pathname}{search}</p>;
};

const abrir = () => render(
    <MemoryRouter initialEntries={['/admin/todos?periodo=ultimos_30']}>
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

    it('compara Setting y Workshop con el ROAS New Cash y el Total, y marca el que rinde más', async () => {
        abrir();
        const tabla = (await screen.findByText('Setting vs Workshop', { selector: 'h2' })).closest('section');
        const roasNew = within(tabla).getByText('ROAS New Cash').closest('tr');
        expect(within(roasNew).getByText('0.90x')).toBeInTheDocument();
        expect(within(roasNew).getByText('1.10x').closest('td')).toHaveClass('mk-gana');
        const roasTotal = within(tabla).getByText('ROAS Total').closest('tr');
        expect(within(roasTotal).getByText('2.50x').closest('td')).toHaveClass('mk-gana');
    });

    it('muestra el gasto por embudo y cada tarjeta lleva a su espacio con el mismo período', async () => {
        abrir();
        expect(await screen.findByText('75% del gasto · 12 anuncios')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Ver Workshop: $100' }));
        expect(await screen.findByText(/^Workshop \/admin\/workshops\?tab=rendimiento&periodo=ultimos_30/)).toBeInTheDocument();
    });
});
