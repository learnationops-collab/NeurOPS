import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Historial, { numerosDe, rangoDe } from './Historial';

/**
 * El Historial del setter: sus reportes por día (v2 por canal, v1 con lo que tienen), los totales
 * del período con la píldora de las generadas del sistema, abrir un día y llevarlo a editar.
 */

const red = vi.hoisted(() => ({ reportes: [], generadas: 4, gets: [] }));

vi.mock('../../../services/api', () => ({
    default: {
        get: vi.fn((url, { params } = {}) => {
            red.gets.push([url, params]);
            if (url === '/public/setter-reports') return Promise.resolve({ data: { reports: red.reportes } });
            if (url === '/public/setter-stats') return Promise.resolve({ data: { generadas: red.generadas } });
            return Promise.reject(new Error(url));
        }),
    },
}));

vi.mock('../../public/ConversationalStatsTab', () => ({ default: () => <div data-testid="conversacional" /> }));
vi.mock('../../public/IncomingLeadsTab', () => ({ default: () => <div data-testid="leads-entrantes" /> }));

const lecturaV2 = {
    version: 2, no_laborable: false,
    canales: {
        anuncios: { entrantes: 10, no_lead: 1, inabribles: 0, ap_entrantes: 3, ap_dolor: 5, agendas: 2, cualificados: 9, aperturas: 8 },
        inbound: { entrantes: 6, no_lead: 0, inabribles: 1, ap_entrantes: 1, ap_dolor: 3, agendas: 1, cualificados: 5, aperturas: 4 },
    },
    bienvenidas: { hechas: 12, respondidas: 5, aperturas: 4 },
    totales: { entrantes: 16, cualificados: 14, aperturas: 12, agendas: 3 },
    embudo: { cualificados: 14, dolor: 10, oferta: 7, link: 5, agendas: 3 },
    followups: { entrantes: 9, dolor: 5, oferta: 3, link: 3 },
    reflexion: { flujo_trabajo: '', win_del_dia: '' },
};

const V2 = { id: 2, date: '2026-10-09', version: 2, is_non_working_day: false, entrantes: 16, leads: 14, fun_agenda: 3, v2: lecturaV2 };
const V1 = { id: 1, date: '2026-10-08', version: 1, is_non_working_day: false, entrantes: 20, leads: 13, fun_agenda: 2,
    qualification_opening_submitted: 6, pain_opening_submitted: 4, v2: null };
const LIBRE = { id: 3, date: '2026-10-05', version: 1, is_non_working_day: true, entrantes: 0, leads: 0, fun_agenda: 0, v2: null };

const Url = () => <output data-testid="url">{useLocation().search}</output>;

const montar = async () => {
    render(
        <MemoryRouter initialEntries={['/setter/deck?step=reporte&tab=historial']}>
            <Historial setterId={7} />
            <Url />
        </MemoryRouter>,
    );
    await act(async () => {});
};

beforeEach(() => {
    red.reportes = [V2, V1, LIBRE];
    red.generadas = 4;
    red.gets = [];
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});

describe('Historial', () => {
    it('un día por fila: el v2 con sus canales, el v1 con lo que tiene', async () => {
        await montar();

        const filas = screen.getAllByRole('listitem').filter(li => li.classList.contains('rd-dia-rep'));
        expect(filas).toHaveLength(3);
        const [nuevo, viejo, libre] = filas;
        expect(within(nuevo).getByText('16')).toBeInTheDocument();
        expect(within(nuevo).getByText('87,5%')).toBeInTheDocument();
        expect(within(nuevo).getByText('41,7%')).toBeInTheDocument();
        expect(nuevo.querySelector('.rd-canales-mini')).toHaveTextContent('21');
        expect(within(viejo).getByText('Anterior')).toBeInTheDocument();
        expect(within(viejo).getByText('65%')).toBeInTheDocument();
        expect(within(viejo).getByText('—')).toBeInTheDocument();
        expect(within(libre).getByText('No laborable')).toBeInTheDocument();
    });

    it('los totales del período, con las generadas del sistema al lado de las reportadas', async () => {
        await montar();

        const kpis = document.querySelector('.rd-kpis');
        expect(within(kpis).getByText('3')).toBeInTheDocument();          // reportes
        expect(within(kpis).getByText('1 no laborable')).toBeInTheDocument();
        expect(within(kpis).getByText('36')).toBeInTheDocument();         // entrantes de los laborables
        expect(within(kpis).getByText('75%')).toBeInTheDocument();        // 27 cualificados de 36
        expect(within(kpis).getByText('5')).toBeInTheDocument();          // agendas reportadas
        expect(within(kpis).getByText('generadas')).toBeInTheDocument();
        expect(red.gets.find(([u]) => u === '/public/setter-stats')[1]).toMatchObject({ setter_id: 7 });
    });

    it('abrir un día muestra su Resumen; el de un v1, sin canales', async () => {
        await montar();

        fireEvent.click(screen.getByRole('button', { name: /9 oct: ver el resumen/ }));
        expect(screen.getByRole('region', { name: 'Tu día completo' })).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /8 oct: ver el resumen/ }));
        expect(screen.queryByRole('region', { name: 'Tu día completo' })).toBeNull();
        expect(screen.getByText(/formulario anterior: sin canales/)).toBeInTheDocument();
    });

    it('Editar lleva al formulario en esa fecha', async () => {
        await montar();

        fireEvent.click(screen.getByRole('button', { name: /Editar el reporte del .* 9 oct/ }));

        const url = new URLSearchParams(screen.getByTestId('url').textContent);
        expect(url.get('tab')).toBe('hoy');
        expect(url.get('fecha')).toBe('2026-10-09');
        expect(url.get('step')).toBe('reporte');
    });

    it('cambiar el período pide ese rango', async () => {
        await montar();

        await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Mes anterior' })); });

        const [, params] = red.gets.filter(([u]) => u === '/public/setter-reports').at(-1);
        expect([params.start_date, params.end_date]).toEqual(rangoDe('anterior'));
        expect(params.setter_id).toBe(7);
    });

    it('conserva lo que tenía «Mis reportes»: el rendimiento conversacional y los leads entrantes', async () => {
        await montar();

        fireEvent.click(screen.getByRole('tab', { name: 'Conversacional' }));
        expect(screen.getByTestId('conversacional')).toBeInTheDocument();
        expect(screen.queryByRole('tab', { name: '30 días' })).toBeNull();
        // Es una pantalla del panel viejo: va fuera de la isla del shell, que le borraría los botones.
        expect(screen.getByTestId('conversacional').closest('.dc-shell')).toBeNull();

        fireEvent.click(screen.getByRole('tab', { name: 'Leads' }));
        expect(screen.getByTestId('leads-entrantes')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('tab', { name: 'Reportes' }));
        expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0);
    });

    it('sin reportes lo dice', async () => {
        red.reportes = [];
        await montar();

        expect(screen.getByText('No mandaste reportes en este período.')).toBeInTheDocument();
    });
});

describe('Historial · cuentas', () => {
    it('el rango de cada período', () => {
        expect(rangoDe('mes', '2026-10-10')).toEqual(['2026-10-01', '2026-10-10']);
        expect(rangoDe('anterior', '2026-10-10')).toEqual(['2026-09-01', '2026-09-30']);
        expect(rangoDe('30', '2026-10-10')).toEqual(['2026-09-11', '2026-10-10']);
        expect(rangoDe('todo', '2026-10-10')).toEqual([null, null]);
    });

    it('los números de una fila v1 salen de sus totales', () => {
        expect(numerosDe(V1)).toMatchObject({ v2: false, entrantes: 20, cualificados: 13, agendas: 2, bienvenidas: null, apertura: 50 });
    });
});
