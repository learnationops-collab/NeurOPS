// «Mis eventos»: un evento asociado a un funnel Momentum muestra su horario y no tiene link público.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../../services/api';
import MisEventos from './MisEventos';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

const envolver = (el) => <div className="thalamus">{el}</div>;
const vacio = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
const evento = (extra = {}) => ({
    id: 'e1', nombre: 'Momentum', activo: true, duracion: 30, margen: 15, formulario: '', funnel: '', horario: null,
    link: '/agenda/allan-momentum', ...extra,
});

describe('MisEventos', () => {
    beforeEach(() => { api.get.mockReset(); api.put.mockReset(); });

    it('sin funnels Momentum no ofrece funnel y el evento tiene su link', async () => {
        api.get.mockResolvedValue({ data: { eventos: [evento()], formularios: [], funnels_momentum: [], horario_persona: vacio } });
        render(envolver(<MisEventos />));
        expect(await screen.findByRole('button', { name: /Copiar link/ })).toBeTruthy();
        expect(screen.queryByText(/la agenda la Academia/)).toBeNull();
    });

    it('un evento Momentum muestra el horario y guarda el horario propio', async () => {
        const fm = [{ id: 'fu-m', nombre: 'Momentum', activo: true }];
        const persona = { ...vacio, 1: [['10:00', '12:00']] };
        api.get.mockResolvedValue({ data: { eventos: [evento({ funnel: 'fu-m' })], formularios: [], funnels_momentum: fm, horario_persona: persona } });
        api.put.mockImplementation((url, cuerpo) => Promise.resolve({ data: { evento: evento({ funnel: 'fu-m', horario: cuerpo.horario }) } }));
        render(envolver(<MisEventos />));
        expect(await screen.findByText(/la agenda la Academia/)).toBeTruthy();
        expect(screen.queryByRole('button', { name: /Copiar link/ })).toBeNull();
        expect(screen.getByText(/usan tu disponibilidad/)).toBeTruthy();
        const guardar = screen.getByRole('button', { name: 'Guardar horario' });
        expect(guardar).toBeDisabled();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: /L a V 9–18/ })); });
        await act(async () => { fireEvent.click(guardar); });
        const [url, cuerpo] = api.put.mock.calls[0];
        expect(url).toBe('/auth/me/eventos/e1');
        expect(cuerpo.horario[1]).toEqual([['09:00', '18:00']]);
        expect(await screen.findByText(/este horario propio/)).toBeTruthy();
    });
});
