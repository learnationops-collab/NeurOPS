import { describe, expect, it } from 'vitest';
import { aggregateTotals, ticketPromedio } from './funnelMath';

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
