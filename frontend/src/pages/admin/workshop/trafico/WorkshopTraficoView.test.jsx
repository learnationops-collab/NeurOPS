import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn(), delete: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import api from '../../../../services/api';
import WorkshopTraficoView from '../components/WorkshopTraficoView';
import { rangoDePeriodo } from './trafico';

const TRAFICO = {
    rango: { desde: '2026-10-01', hasta: '2026-10-03' },
    totales: { visitas: 30, landings: 2, visitas_landings_whatsapp: 20, clics_whatsapp: 5, tasa_whatsapp: 25 },
    por_landing: [
        { path: '/live-class-t5/', visitas: 20, clics_whatsapp: 5, tasa_whatsapp: 25, lleva_whatsapp: true,
            fuente_principal: 'Instagram', ultima_visita: '2026-10-03T15:00:00Z', origen_datos: 'track-visit' },
        { path: '/bienvenido/', visitas: 10, clics_whatsapp: 0, tasa_whatsapp: null, lleva_whatsapp: false,
            fuente_principal: 'Facebook', ultima_visita: '2026-10-02T15:00:00Z', origen_datos: 'track-visit' },
    ],
    por_fuente: [{ fuente: 'Instagram', visitas: 22, clics_whatsapp: 5, tasa_whatsapp: 25 }],
    por_campana: [
        { campana: '120211', nombre: 'WORKSHOP FUNNEL | TESTING ADS', visitas: 12, clics_whatsapp: 2, tasa_whatsapp: 20 },
        { campana: '120999', nombre: null, visitas: 3, clics_whatsapp: 0, tasa_whatsapp: 0 },
    ],
    por_anuncio: [
        { anuncio: '900', nombre: 'B | PP | A3', campana_id: '120211', campana_nombre: 'WORKSHOP FUNNEL | TESTING ADS',
            visitas: 12, clics_whatsapp: 2, tasa_whatsapp: 20 },
    ],
    por_dia: [
        { dia: '2026-10-01', visitas: 10, clics_whatsapp: 1 },
        { dia: '2026-10-02', visitas: 0, clics_whatsapp: 0 },
        { dia: '2026-10-03', visitas: 20, clics_whatsapp: 4 },
    ],
    whatsapp_medido_desde: '2026-10-01T12:00:00Z',
};

const visita = (id, extra) => ({
    id, landing: '/live-class-t5/', page_path: '/live-class-t5/?utm_source=ig', evento: 'visita',
    fuente: 'Instagram', utm_source: 'ig', utm_medium: 'paid', utm_campaign: '120211', utm_content: null,
    referrer: 'https://institute.thelearnation.com/live-class-t5/', created_at: '2026-10-03T15:00:00Z', ...extra,
});

const detalle = (extra) => ({
    rango: TRAFICO.rango, limite: 5000, recortado: false, puede_borrar: false,
    visitas: [visita(1), visita(2, { landing: '/bienvenido/', fuente: 'Facebook', utm_source: 'fb', utm_campaign: null })],
    ...extra,
});

const responder = (det = detalle()) => api.get.mockImplementation((url) => Promise.resolve({
    data: url === '/workshop/landing/trafico' ? TRAFICO : det,
}));

const abrir = (ruta = '/admin/workshops?tab=trafico') => render(
    <MemoryRouter initialEntries={[ruta]}><WorkshopTraficoView /></MemoryRouter>,
);

const listaDeVisitas = () => within(screen.getByRole('region', { name: 'Detalle de visitas' }));

describe('Workshop › Tráfico landings', () => {
    beforeEach(() => { window.localStorage.clear(); api.get.mockReset(); api.delete.mockReset(); });
    afterEach(() => { cleanup(); vi.useRealTimers(); });

    it('pide el tráfico y el detalle de los últimos 30 días, con el tope del detalle', async () => {
        responder();
        abrir();
        expect(await screen.findByText('Landings')).toBeInTheDocument();
        const esperado = rangoDePeriodo('ultimos_30');
        await waitFor(() => expect(api.get).toHaveBeenCalledWith('/workshop/landing/trafico/visitas', expect.anything()));
        const pedidos = Object.fromEntries(api.get.mock.calls.map(([url, config]) => [url, config.params]));
        expect(pedidos['/workshop/landing/trafico']).toEqual(esperado);
        expect(pedidos['/workshop/landing/trafico/visitas']).toEqual({ ...esperado, limite: 5000 });
    });

    it('un período personalizado de la URL es el que se pide', async () => {
        responder();
        abrir('/admin/workshops?tab=trafico&periodo=personalizado&desde=2026-10-01&hasta=2026-10-03');
        await screen.findByText('Landings');
        expect(api.get.mock.calls[0][1].params).toEqual({ desde: '2026-10-01', hasta: '2026-10-03' });
    });

    it('el ranking cambia de landing a campaña y anuncio, con los nombres de Meta', async () => {
        responder();
        abrir();
        const ranking = within(await screen.findByRole('region', { name: 'Qué trae el tráfico' }));
        expect(ranking.getByText('/bienvenido/')).toBeInTheDocument();
        fireEvent.click(ranking.getByRole('tab', { name: 'Por campaña' }));
        // El ID de Meta se muestra con su nombre; el que no está sincronizado, tal cual.
        expect(ranking.getByText('WORKSHOP FUNNEL | TESTING ADS')).toBeInTheDocument();
        expect(ranking.getByText('120211')).toBeInTheDocument();
        expect(ranking.getByText('120999')).toBeInTheDocument();
        expect(ranking.queryByText('/bienvenido/')).not.toBeInTheDocument();
        fireEvent.change(ranking.getByLabelText('Buscar'), { target: { value: 'testing ads' } });
        expect(ranking.getByText('mostrando 1 de 2')).toBeInTheDocument();
        fireEvent.change(ranking.getByLabelText('Buscar'), { target: { value: '' } });
        fireEvent.click(ranking.getByRole('tab', { name: 'Por anuncio' }));
        expect(ranking.getByText('B | PP | A3')).toBeInTheDocument();
        expect(ranking.getByText('WORKSHOP FUNNEL | TESTING ADS')).toBeInTheDocument();
    });

    it('el detalle filtra por búsqueda y abre la visita con sus UTM, sin borrar si no puede', async () => {
        responder();
        abrir();
        await waitFor(() => expect(listaDeVisitas().getByText('mostrando 2 de 2')).toBeInTheDocument());
        fireEvent.change(listaDeVisitas().getByLabelText('Buscar'), { target: { value: 'fb' } });
        expect(listaDeVisitas().getByText('mostrando 1 de 2')).toBeInTheDocument();

        fireEvent.click(listaDeVisitas().getAllByRole('row')[1]);
        const ficha = within(listaDeVisitas().getByLabelText('Visita elegida'));
        expect(ficha.getByText('https://institute.thelearnation.com/live-class-t5/')).toBeInTheDocument();
        expect(ficha.queryByRole('button', { name: /Borra esta visita/ })).not.toBeInTheDocument();
    });

    it('quien puede borrar, borra la visita al agotarse el deshacer', async () => {
        responder(detalle({ puede_borrar: true }));
        api.delete.mockResolvedValue({ data: {} });
        abrir();
        await waitFor(() => expect(listaDeVisitas().getByText('mostrando 2 de 2')).toBeInTheDocument());
        fireEvent.click(listaDeVisitas().getAllByRole('row')[1]);

        vi.useFakeTimers();
        fireEvent.click(listaDeVisitas().getByRole('button', { name: /Borra esta visita/ }));
        fireEvent.click(listaDeVisitas().getByRole('button', { name: /Sí, borrar/ }));
        expect(api.delete).not.toHaveBeenCalled();
        await act(async () => { vi.advanceTimersByTime(5100); });
        expect(api.delete).toHaveBeenCalledWith('/v1/metrics/track-visit/1');
    });

    it('avisa cuando el detalle quedó recortado por el tope', async () => {
        responder(detalle({ recortado: true }));
        abrir();
        expect(await screen.findByText(/las 5,000 más recientes/)).toBeInTheDocument();
    });
});
