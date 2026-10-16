import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../../services/api', () => ({ default: { get: vi.fn() } }));

import api from '../../../../services/api';
import { olvidarDatosTaller } from '../talleres/datosTaller';
import WorkshopAnunciosView from './WorkshopAnunciosView';

const dinero = (v) => `$${Number(v).toFixed(2)}`;

const anuncio = (nombre, gasto) => ({ meta_ad_id: nombre, nombre, estado: 'ACTIVE', gasto, impresiones: 1000, clics: 50, clics_enlace: 20, cpm: 5, cpc: 1.5, ctr: 5 });

const DESGLOSE = {
    desde: '2026-10-04', hasta: '2026-10-12', anuncios_workshop: 4,
    totales: { gasto: 205.27, impresiones: 9000, clics: 300, clics_enlace: 120, cpm: 22.8, cpc: 1.71, ctr: 3.33, visitas: 410, clics_whatsapp: 61, costo_whatsapp: 3.37 },
    campanas: [
        { campana_id: '120247656795310532', nombre: 'WORKSHOP FUNNEL | TESTING ADS', gasto: 150, impresiones: 6000, clics: 200, clics_enlace: 90, cpm: 25, cpc: 1.67, ctr: 3.33, visitas: 300, clics_whatsapp: 45, costo_whatsapp: 3.33,
            conjuntos: [{ nombre: '👑 Broad | Single | Ad 8 - Aprobación', gasto: 150, impresiones: 6000, clics: 200, clics_enlace: 90, cpm: 25, cpc: 1.67, ctr: 3.33, anuncios: [anuncio('Ad 8 - Aprobación', 150)] }] },
        { campana_id: '120248595687160532', nombre: 'SPI-TRIPODE-LAUNCH', gasto: 55.27, impresiones: 3000, clics: 100, clics_enlace: 30, cpm: 18.4, cpc: 1.84, ctr: 3.33, visitas: 110, clics_whatsapp: 16, costo_whatsapp: 3.45,
            conjuntos: [{ nombre: 'Launch - Chile', gasto: 55.27, impresiones: 3000, clics: 100, clics_enlace: 30, cpm: 18.4, cpc: 1.84, ctr: 3.33, anuncios: [anuncio('Launch CL', 55.27)] }] },
    ],
};

const armar = () => render(<div className="dc-shell"><WorkshopAnunciosView evento={{ id: 15 }} formatCurrency={dinero} /></div>);

describe('Workshop › Talleres › Anuncios del taller', () => {
    beforeEach(() => { api.get.mockReset(); olvidarDatosTaller(); });

    it('pide los anuncios del taller y abre la campaña que más gastó', async () => {
        api.get.mockResolvedValue({ data: DESGLOSE });
        armar();

        expect(await screen.findByText('Ad 8 - Aprobación')).toBeInTheDocument();
        expect(api.get.mock.calls[0][0]).toBe('workshop/events/15/anuncios');
        expect(screen.getByText(/del 04\/10 al 12\/10/)).toBeInTheDocument();
        // La segunda campaña está cerrada hasta que se la abre.
        expect(screen.queryByText('Launch CL')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /SPI-TRIPODE-LAUNCH/ }));
        expect(screen.getByText('Launch CL')).toBeInTheDocument();
        const total = screen.getByText('Total del taller').closest('tr');
        expect(within(total).getByText('$205.27')).toBeInTheDocument();
        expect(within(total).getByText('61')).toBeInTheDocument();
    });

    it('cada columna explica qué es con su «i» y la tabla tiene sus encabezados', async () => {
        api.get.mockResolvedValue({ data: DESGLOSE });
        armar();

        await screen.findByText('Ad 8 - Aprobación');
        const columnas = ['Campaña › conjunto › anuncio', 'Gasto', 'Impresiones', 'Clics (todos)', 'CTR', 'CPC (enlace)',
            'CPM', 'Visitas a la landing', 'Clics al grupo', 'Costo por clic al grupo'];
        const tabla = screen.getByRole('table');
        const cabeceras = within(tabla).getAllByRole('columnheader');
        // El texto de cada título, sin la «i» del Tip.
        expect(cabeceras.map((th) => th.querySelector('.wt-anuncios-titulo > span').textContent)).toEqual(columnas);
        cabeceras.forEach((th, i) => {
            expect(within(th).getByRole('note').getAttribute('aria-label').startsWith(`${columnas[i]}:`)).toBe(true);
        });
    });

    it('arriba resume el taller y «Abrir todas» despliega cada campaña', async () => {
        api.get.mockResolvedValue({ data: DESGLOSE });
        const { container } = armar();

        await screen.findByText('Ad 8 - Aprobación');
        const resumen = container.querySelector('.wt-resumen-anuncios');
        expect(within(resumen).getByText('$205.27')).toBeInTheDocument();
        expect(within(resumen).getByText('$3.37')).toBeInTheDocument();
        expect(screen.getByText(/2 campañas · 2 anuncios con gasto/)).toBeInTheDocument();

        await userEvent.click(screen.getByRole('button', { name: 'Abrir todas' }));
        expect(screen.getByText('Launch CL')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Cerrar todas' }));
        expect(screen.queryByText('Ad 8 - Aprobación')).not.toBeInTheDocument();
    });

    it('sin anuncios de Workshop dice dónde se clasifican', async () => {
        api.get.mockResolvedValue({ data: { ...DESGLOSE, anuncios_workshop: 0, campanas: [] } });
        armar();

        expect(await screen.findByText(/se\s+corrigen en Marketing › Meta Ads/)).toBeInTheDocument();
    });
});
