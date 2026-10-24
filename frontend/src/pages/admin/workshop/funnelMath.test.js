import { describe, expect, it } from 'vitest';
import { aggregateTotals, stageRates, ticketPromedio } from './funnelMath';

// Ticket del taller (02/10/2026): lo cobrado en ventas nuevas / cuántas son. Antes era
// cash_collected / sales, con la seña adentro y dividiendo por personas.
describe('ticketPromedio', () => {
    it('divide lo cobrado en ventas nuevas por esas ventas, no el cash por las personas', () => {
        const totals = aggregateTotals([
            { sales: 2, cash_collected: 350, cash_ventas: 250, ventas_cobradas: 1 },
            { sales: 1, cash_collected: 1000, cash_ventas: 1000, ventas_cobradas: 1 },
        ]);

        expect(totals.cash_ventas).toBe(1250);
        expect(totals.ventas_cobradas).toBe(2);
        expect(ticketPromedio(totals)).toBe(625);
    });

    it('un taller que todavía no tiene la base calculada (null) no rompe la suma', () => {
        const totals = aggregateTotals([
            { sales: 1, cash_collected: 500, cash_ventas: null, ventas_cobradas: null },
            { sales: 1, cash_collected: 300, cash_ventas: 300, ventas_cobradas: 1 },
        ]);

        expect(ticketPromedio(totals)).toBe(300);
    });

    it('sin ventas nuevas el ticket es cero', () => {
        expect(ticketPromedio(aggregateTotals([{ sales: 1, cash_collected: 100, cash_ventas: 0, ventas_cobradas: 0 }]))).toBe(0);
        expect(ticketPromedio(aggregateTotals([]))).toBe(0);
    });
});

// Show up de citas (24/10/2026): asistieron / citas con resultado, no / todas las agendadas.
describe('show up de citas', () => {
    it('se divide por las citas con resultado, no por las agendas', () => {
        const totals = aggregateTotals([
            { agendas_exitosas: 29, citas_reportadas: 14, show_up_sales_call: 9, citas_sin_reportar: 9 },
        ]);

        expect(stageRates(totals).show_up_citas).toBeCloseTo(9 / 14);
        expect(totals.citas_sin_reportar).toBe(9);
    });

    it('un taller sin la base calculada (null) cae a sus agendas', () => {
        const totals = aggregateTotals([
            { agendas_exitosas: 10, citas_reportadas: null, show_up_sales_call: 3 },
            { agendas_exitosas: 20, citas_reportadas: 10, show_up_sales_call: 6 },
        ]);

        expect(totals.citas_reportadas).toBe(20);
        expect(stageRates(totals).show_up_citas).toBeCloseTo(9 / 20);
    });
});
