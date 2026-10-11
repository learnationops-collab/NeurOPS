import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CanalesSetter from './CanalesSetter';

/**
 * Lo nuevo del v2 en la Vista General de /admin/ventas › Setters: por canal y bienvenidas, sumado a
 * lo que ya mostraba. Lo del formulario anterior queda aparte, sin repartir entre canales.
 */

const porCanal = (extra = {}) => ({
    reportes: 3, reportes_v2: 2, no_laborables: 0,
    canales: {
        anuncios: { entrantes: 20, no_lead: 2, inabribles: 0, ap_entrantes: 6, ap_dolor: 10, agendas: 4, cualificados: 18, aperturas: 16 },
        inbound: { entrantes: 12, no_lead: 0, inabribles: 2, ap_entrantes: 2, ap_dolor: 6, agendas: 2, cualificados: 10, aperturas: 8 },
    },
    sin_canal: { entrantes: 30, agendas: 3, cualificados: 20 },
    bienvenidas: { hechas: 24, respondidas: 10, aperturas: 8 },
    ...extra,
});

const columna = (nombre) => screen.getByText(nombre, { selector: '.rd-chip--canal' }).closest('.rd-canal-col');

describe('CanalesSetter', () => {
    it('cada canal con sus entrantes, cualificación, apertura y agendas; y las bienvenidas', () => {
        render(<CanalesSetter stats={{ por_canal: porCanal(), reportes_por_version: { v1: 1, v2: 2 } }} />);

        const ads = within(columna('Anuncios'));
        expect(ads.getByText('20')).toBeInTheDocument();
        expect(ads.getByText('90%')).toBeInTheDocument();
        expect(ads.getByText('80%')).toBeInTheDocument();
        expect(ads.getByText('4')).toBeInTheDocument();
        const inb = within(columna('Inbound'));
        expect(inb.getByText('83,3%')).toBeInTheDocument();
        const bnv = within(columna('Bienvenidas'));
        expect(bnv.getByText('24')).toBeInTheDocument();
        expect(bnv.getByText('41,7%')).toBeInTheDocument();
        expect(screen.getByText('2 reportes por canal')).toBeInTheDocument();
    });

    it('lo del formulario anterior va aparte, y avisa de dónde salen las tasas de respuesta', () => {
        render(<CanalesSetter stats={{ por_canal: porCanal(), reportes_por_version: { v1: 1, v2: 2 } }} />);

        expect(screen.getByText(/30 entrantes y 3 agendas de 1 reporte del formulario anterior, sin canal/)).toBeInTheDocument();
        expect(screen.getByText(/se mide solo con el formulario anterior/)).toBeInTheDocument();
    });

    it('con promedio, los conteos son por reporte (las tasas no cambian)', () => {
        render(<CanalesSetter promedio stats={{ por_canal: porCanal(), reportes_por_version: { v1: 0, v2: 2 } }} />);

        const ads = within(columna('Anuncios'));
        expect(ads.getByText('10')).toBeInTheDocument();
        expect(ads.getByText('90%')).toBeInTheDocument();
        expect(ads.getByText('2')).toBeInTheDocument();
    });

    it('con la comparación, al lado va el período anterior', () => {
        const anterior = porCanal();
        anterior.canales = { ...anterior.canales, anuncios: { ...anterior.canales.anuncios, entrantes: 15, agendas: 1 } };
        render(<CanalesSetter comparar stats={{ por_canal: porCanal(), reportes_por_version: { v1: 0, v2: 2 },
            comparison: { por_canal: anterior } }} />);

        const ads = within(columna('Anuncios'));
        expect(ads.getByText('Ant: 15')).toBeInTheDocument();
        expect(ads.getByText('Ant: 1')).toBeInTheDocument();
    });

    it('sin reportes por canal en el período lo dice, y sin el bloque del backend no dibuja nada', () => {
        const { rerender } = render(<CanalesSetter stats={{ por_canal: porCanal({ reportes_v2: 0 }),
            reportes_por_version: { v1: 3, v2: 0 } }} />);
        expect(screen.getByText('Ningún reporte del período se cargó por canal todavía.')).toBeInTheDocument();

        rerender(<CanalesSetter stats={{ totals: {} }} />);
        expect(screen.queryByLabelText('Por canal')).toBeNull();
    });
});
