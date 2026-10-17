import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../services/api', () => ({ default: { post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('react-hot-toast', () => {
    const toast = vi.fn();
    toast.success = vi.fn();
    toast.error = vi.fn();
    return { default: toast };
});

import api from '../../../../services/api';
import PlanificarTab from './PlanificarTab';

const REALIZADO = {
    id: 1, date: '2026-10-05', name: 'WEBINAR 5', inicio_at: '2026-10-05T20:00:00Z', inversion: 500, leads: 200,
    whatsapp_leads: 140, show_up: 40, pitch_leads: 30, pitch_final_leads: 20, aplicaciones_form: 10,
    agendas_exitosas: 8, show_up_sales_call: 5, sales: 1, cash_collected: 1000, cash_ventas: 1000, ventas_cobradas: 1,
};
const PROXIMO = { id: 2, date: '2026-10-19', name: 'WEBINAR 19', inicio_at: '2026-10-19T20:00:00Z' };
const GOALS = {
    meta_whatsapp: 70, meta_asistencia: 30, meta_retencion_clase: 70, meta_retencion_pitch: 50,
    meta_conversion_form: 60, meta_agendamiento: 85, meta_show_up_citas: 60, meta_close_rate: 20, banda_limite: 5,
};

const montar = (props = {}) => render(
    <PlanificarTab events={[REALIZADO, PROXIMO]} realizados={[REALIZADO]} goals={GOALS} onGoalsUpdated={vi.fn()}
        actions={[]} onActionsChanged={vi.fn()} enfoque={null} onEdit={vi.fn()} onDelete={vi.fn()}
        onProgramado={vi.fn()} formatCurrency={(v) => `$${Math.round(v)}`} {...props} />,
);

describe('Workshop › Planificar', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-15T15:00:00Z'));
        Object.values(api).forEach((f) => f.mockReset());
        Element.prototype.scrollIntoView = vi.fn();
    });
    afterEach(() => vi.useRealTimers());

    it('una palanca subida se vuelve una acción del siguiente taller', async () => {
        api.post.mockResolvedValue({ data: {} });
        const onActionsChanged = vi.fn();
        montar({ onActionsChanged });

        const crear = screen.getByRole('button', { name: 'Crear acción: Asistencia al workshop' });
        expect(crear).toBeDisabled();
        // Asistencia real: 40 de 140 = 28.6%. Se sube a 35%.
        fireEvent.change(screen.getByRole('slider', { name: /^Asistencia al workshop/ }), { target: { value: '35' } });
        await userEvent.click(crear);

        const dialogo = screen.getByRole('dialog', { name: 'Nueva acción' });
        expect(within(dialogo).getByText('Del simulador · 28.6% → 35%')).toBeInTheDocument();
        expect(within(dialogo).getByRole('textbox', { name: 'Qué hay que hacer' }))
            .toHaveValue('Subir asistencia al workshop de 28.6% a 35%');
        expect(within(dialogo).getByRole('combobox', { name: 'Taller' })).toHaveValue('2');

        await userEvent.click(within(dialogo).getByRole('button', { name: /Crear acción/ }));

        expect(api.post).toHaveBeenCalledWith('workshop/actions', expect.objectContaining({
            stage_key: 'asistencia', target_delta_pp: 6.4, event_id: 2,
            title: 'Subir asistencia al workshop de 28.6% a 35%',
        }));
        await waitFor(() => expect(onActionsChanged).toHaveBeenCalled());
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('las acciones sin taller siguen a la vista y se asignan a un próximo', async () => {
        api.put.mockResolvedValue({ data: {} });
        const vieja = { id: 7, title: 'Mejorar el botón de WhatsApp', status: 'pending', stage_key: 'whatsapp', event_id: null, score: 3 };
        const delTaller = { id: 8, title: 'Recordatorio 1 h antes', status: 'pending', stage_key: null, event_id: 2, score: 3 };
        montar({ actions: [vieja, delTaller] });

        const sueltas = within(screen.getByRole('list', { name: 'Acciones sin un próximo taller' }));
        expect(sueltas.getByText('Mejorar el botón de WhatsApp')).toBeInTheDocument();
        expect(within(screen.getByRole('list', { name: 'Acciones de WEBINAR 19' })).getByText('Recordatorio 1 h antes')).toBeInTheDocument();

        await userEvent.selectOptions(sueltas.getByRole('combobox', { name: 'Taller de Mejorar el botón de WhatsApp' }), '2');
        expect(api.put).toHaveBeenCalledWith('workshop/actions/7', { event_id: 2 });
    });

    it('tildar se ve al instante y manda el estado', async () => {
        let resolver;
        api.put.mockReturnValue(new Promise((r) => { resolver = r; }));
        montar({ actions: [{ id: 8, title: 'Recordatorio', status: 'pending', event_id: 2, score: 3 }] });

        const check = screen.getByRole('checkbox', { name: 'Marcar hecha: Recordatorio' });
        await userEvent.click(check);
        expect(screen.getByRole('checkbox', { name: 'Marcar pendiente: Recordatorio' })).toBeChecked();
        expect(api.put).toHaveBeenCalledWith('workshop/actions/8', { status: 'done' });
        resolver({ data: {} });
    });

    it('«Simular mejora» del Resumen lleva al simulador y resalta la etapa', () => {
        montar({ enfoque: { vista: 'simulador', etapa: 'close_rate' } });
        const palanca = screen.getByRole('slider', { name: /^Close rate/ }).closest('.wp-palanca');
        expect(palanca).toHaveAttribute('data-enfocada', '1');
        expect(document.getElementById('wp-simulador').scrollIntoView).toHaveBeenCalled();
    });

    it('cada panel espera solo su dato: sin metas, el simulador y el plan son esqueletos', () => {
        montar({ goals: null });
        expect(screen.getByRole('region', { name: 'Próximos talleres' })).toBeInTheDocument();
        expect(screen.getByRole('status', { name: 'Cargando el plan de acciones…' })).toHaveTextContent('Plan de acciones');
        expect(screen.getByRole('status', { name: 'Cargando el simulador…' })).toBeInTheDocument();
        expect(screen.queryByRole('slider')).toBeNull();
    });

    it('sin talleres todavía, los tres paneles muestran su esqueleto', () => {
        montar({ events: null, realizados: null, goals: null, actions: null });
        expect(screen.getAllByRole('status').map((s) => s.getAttribute('aria-label'))).toEqual([
            'Cargando los próximos talleres…', 'Cargando el plan de acciones…', 'Cargando el simulador…',
        ]);
    });
});
