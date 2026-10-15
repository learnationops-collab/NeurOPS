import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
// Las herramientas de siempre no son lo que se prueba acá.
vi.mock('../../../components/operations/UTMGenerator', () => ({ default: () => <p>Generador UTM viejo</p> }));
vi.mock('../../../components/marketing/LandingTrafficTable', () => ({ default: () => <p>Tráfico viejo</p> }));
vi.mock('../../public/WebhookMonitorTab', () => ({ default: () => <p>Monitor de webhooks</p> }));

import api from '../../../services/api';
import AdminMarketingHubPage from './AdminMarketingHubPage';

const fila = (extra) => ({
    clave: 'APLICAR', nombre: 'APLICAR', ad_id: 1, archivado: false,
    meta: { anuncios: 7, activos: 1, nombres: ['DMV | H2 | BRD'] },
    entrantes: 227, calificados: 147, descalificados: 0, no_calificados: 80, pct_calificados: 64.8, pct_no_calificados: 35.2,
    gasto: 431, cpl: 1.9, cpl_calificado: 2.93, agendas: 21, costo_agenda: 20.52, ventas: 1, costo_venta: 431,
    cobrado: 1000, roas: 2.32, dias: { '2026-10-01': [10, 6, 14.37, 1] },
    ...extra,
});

const TABLERO = {
    desde: '2026-09-15', hasta: '2026-10-14', moneda: 'USD',
    filas: [
        fila(),
        fila({ clave: 'OBTENER GUIA', nombre: 'Obtener Guia', ad_id: null, meta: { anuncios: 0, activos: 0, nombres: [] },
            entrantes: 925, calificados: 693, no_calificados: 232, gasto: 0, cpl: null, cpl_calificado: null,
            costo_agenda: null, costo_venta: null, roas: null, cobrado: 0, ventas: 2, agendas: 20 }),
        fila({ clave: 'VIEJA', nombre: 'VIEJA', archivado: true, entrantes: 3 }),
    ],
    totales: {},
    sin_atribuir: { agendas: 220, ventas: 0, gasto_meta: 1572 },
    meta: { conectado: false, ultima_sincronizacion: null },
};

const abrir = (ruta = '/admin/marketing') => render(
    <MemoryRouter initialEntries={[ruta]}><AdminMarketingHubPage /></MemoryRouter>,
);

describe('Marketing › Anuncios', () => {
    beforeEach(() => {
        api.get.mockImplementation((url) => Promise.resolve({ data: url === '/marketing/anuncios' ? TABLERO : {
            anuncios: [], claves: ['APLICAR'], conectado: false, ultima_sincronizacion: null } }));
    });

    it('pide la tabla del período y muestra una fila por palabra clave, sin las archivadas', async () => {
        abrir();
        expect(await screen.findByText('Obtener Guia')).toBeInTheDocument();
        const [url, config] = api.get.mock.calls[0];
        expect(url).toBe('/marketing/anuncios');
        expect(config.params.desde < config.params.hasta).toBe(true);
        expect(screen.getByText('7 anuncios en Meta · 1 activo')).toBeInTheDocument();
        expect(screen.queryByText('VIEJA')).not.toBeInTheDocument();
        // Los totales son de las filas visibles: 227 + 925 (la archivada no suma).
        const total = screen.getByText(/Resultados de 2 palabras clave/).closest('tr');
        expect(within(total).getByText('1,152')).toBeInTheDocument();
    });

    it('sin anuncio en Meta el gasto es «—», no $0.00, y avisa que falta conectar Meta', async () => {
        abrir();
        const filaGuia = (await screen.findByText('Obtener Guia')).closest('tr');
        // Celdas: elegir, palabra clave, entrantes, calificados, no calificados, gasto…
        expect(within(filaGuia).getAllByRole('cell')[5].textContent).toBe('—');
        const filaAplicar = screen.getByText('APLICAR').closest('tr');
        expect(within(filaAplicar).getAllByRole('cell')[5].textContent).toBe('$431');
        expect(screen.getByText(/El gasto todavía no llega de Meta Ads/)).toBeInTheDocument();
        expect(screen.getByText(/\$1,572 gastados en anuncios de Meta sin palabra clave/)).toBeInTheDocument();
    });

    it('ordena por una columna al tocar su encabezado', async () => {
        const user = userEvent.setup();
        abrir();
        await screen.findByText('Obtener Guia');
        const nombres = () => screen.getAllByRole('row').slice(1, 3).map((r) => within(r).getAllByRole('cell')[1].textContent);
        expect(nombres()[0]).toMatch(/Obtener Guia/); // por entrantes, de mayor a menor
        await user.click(screen.getByRole('button', { name: /Costo por lead/ }));
        expect(nombres()[0]).toMatch(/APLICAR/); // el costo menor primero; el vacío al final
    });

    it('archivar avisa al backend y saca la fila', async () => {
        const user = userEvent.setup();
        api.post.mockResolvedValue({ data: { clave: 'APLICAR', archivado: true } });
        abrir();
        await user.click(await screen.findByRole('button', { name: 'Archivar APLICAR' }));
        expect(api.post).toHaveBeenCalledWith('/marketing/anuncios/archivar', { clave: 'APLICAR', archivado: true });
        await waitFor(() => expect(screen.queryByText('7 anuncios en Meta · 1 activo')).not.toBeInTheDocument());
        expect(screen.getByRole('button', { name: /Ver archivadas \(2\)/ })).toBeInTheDocument();
    });

    it('la pestaña Meta Ads explica cómo conectarlo cuando falta el token', async () => {
        abrir('/admin/marketing?tab=meta');
        expect(await screen.findByText('Sin conectar')).toBeInTheDocument();
        expect(screen.getByText(/META_ADS_TOKEN/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Sincronizar/ })).toBeDisabled();
    });

    it('las herramientas de siempre siguen en sus pestañas', async () => {
        abrir('/admin/marketing?tab=webhooks');
        expect(await screen.findByText('Monitor de webhooks')).toBeInTheDocument();
    });
});
