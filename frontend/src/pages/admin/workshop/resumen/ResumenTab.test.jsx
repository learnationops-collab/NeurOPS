import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ResumenTab from '../tabs/ResumenTab';

const taller = (id, date, x) => ({
    id, date, name: `Taller ${id}`, inversion: 100 * x, leads: 100 * x, whatsapp_leads: 80 * x, show_up: 40 * x,
    pitch_leads: 30 * x, pitch_final_leads: 20 * x, aplicaciones_form: 10 * x, agendas_exitosas: 8 * x,
    show_up_sales_call: 6 * x, sales: 2 * x, cash_collected: 300 * x, cash_ventas: 300 * x, ventas_cobradas: 2 * x,
});
// Los dos últimos con el doble de todo: por taller suben 100%.
const TALLERES = [taller(1, '2026-09-05', 1), taller(2, '2026-09-12', 1), taller(3, '2026-09-19', 2), taller(4, '2026-09-26', 2)];
const GOALS = {
    meta_whatsapp: 80, meta_asistencia: 50, meta_retencion_clase: 75, meta_retencion_pitch: 70,
    meta_conversion_form: 60, meta_agendamiento: 80, meta_show_up_citas: 70, meta_close_rate: 40, banda_limite: 5,
};

let ubicacion;
const Url = () => { ubicacion = useLocation(); return null; };
const montar = (url = '/admin/workshops', props = {}) => render(
    <MemoryRouter initialEntries={[url]}>
        <ResumenTab realizados={TALLERES} goals={GOALS} actions={[]} onEditGoals={() => {}} onGoToSimulador={() => {}} {...props} />
        <Url />
    </MemoryRouter>
);

describe('Workshop › Resumen', () => {
    it('sin filtro suma todos los talleres y no compara', () => {
        montar();
        const kpis = screen.getByRole('region', { name: 'Indicadores principales' });
        expect(within(kpis).getByText('$600')).toBeInTheDocument();
        expect(within(kpis).queryByText(/▲/)).toBeNull();
        expect(screen.queryByRole('columnheader', { name: 'VS' })).toBeNull();
    });

    it('el filtro y la comparación salen de la URL y se reflejan en KPIs y embudo', () => {
        montar('/admin/workshops?rf=ultimos&rn=2');
        const kpis = screen.getByRole('region', { name: 'Indicadores principales' });
        // 400 de inversión en los dos últimos; por taller 200 contra 100.
        expect(within(kpis).getByText('$400')).toBeInTheDocument();
        expect(within(kpis).getAllByText('▲ 100.0%').length).toBeGreaterThan(0);
        // El embudo muestra la columna de la comparación (las tasas son iguales: 0 pts).
        expect(screen.getByRole('columnheader', { name: 'VS' })).toBeInTheDocument();
        expect(screen.getAllByText('▲ 0 pts')).toHaveLength(8);
    });

    it('cambiar la comparación escribe sus claves sin tocar las demás', async () => {
        montar('/admin/workshops?tab=resumen&rf=ultimos&rn=2');
        await userEvent.click(screen.getByRole('button', { name: /Los 2 anteriores/ }));
        await userEvent.click(screen.getByRole('menuitemradio', { name: 'Sin comparar' }));
        const p = new URLSearchParams(ubicacion.search);
        expect(p.get('tab')).toBe('resumen');
        expect(p.get('rn')).toBe('2');
        expect(p.get('vs')).toBe('none');
        expect(screen.queryByRole('columnheader', { name: 'VS' })).toBeNull();
    });

    it('«Simular mejora» lleva al simulador con la etapa más lejos de su meta', async () => {
        const onGoToSimulador = vi.fn();
        montar('/admin/workshops', { onGoToSimulador });
        await userEvent.click(screen.getByRole('button', { name: /Simular mejora/ }));
        // Conversión del form: 50% contra 60% es la mayor distancia.
        expect(onGoToSimulador).toHaveBeenCalledWith('conversion_form');
    });

    it('una selección vacía lo dice en vez de mostrar ceros', () => {
        montar('/admin/workshops?rf=elegidos');
        expect(screen.getByRole('status')).toHaveTextContent('Ningún taller en esta selección');
    });
});
