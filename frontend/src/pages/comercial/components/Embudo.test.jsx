import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Embudo from './Embudo';
import { PASOS_CLOSER } from './destinos';

/**
 * El embudo de closers, sin «Confirmadas» (pedido del usuario, 09/10/2026: «Quita las
 * confirmadas del embudo del dashboard»).
 *
 * Los pasos los arma el backend (`bloque_closers`) y el porcentaje de cada fila es contra la fila
 * de arriba: sacar un escalón tiene que dejar Asistieron medido contra Agendas, no contra un paso
 * que ya no se ve.
 */

// Septiembre de 2026 en la base local, con los números que da `bloque_closers`.
const PASOS = [
    { paso: 'Agendas', n: 230 }, { paso: 'Asistieron', n: 97 },
    { paso: 'Presentaciones', n: 88 }, { paso: 'Ventas', n: 16 },
];

const filas = (container) => [...container.querySelectorAll('.dc-funnel-label')]
    .map(l => [l.textContent, l.closest('.dc-funnel-row').querySelector('.dc-funnel-pct').textContent]);

describe('Embudo de closers', () => {
    it('el vocabulario de pasos ya no tiene Confirmadas', () => {
        expect(Object.keys(PASOS_CLOSER)).toEqual(['Agendas', 'Asistieron', 'Presentaciones', 'Ventas']);
    });

    it('cada tasa es contra el paso de arriba: Asistieron contra Agendas', () => {
        const { container } = render(<Embudo pasos={PASOS} />);

        expect(filas(container)).toEqual([
            ['Agendas', ''], ['Asistieron', '42.2%'], ['Presentaciones', '90.7%'], ['Ventas', '18.2%'],
        ]);
        expect(container).toHaveTextContent('de 230 agendas a 16 ventas');
        expect(container).toHaveTextContent('7.0% final');
    });

    it('el primer salto no compite por el cuello de botella', () => {
        // De agendas a asistieron es casi siempre el más flojo (cuenta las llamadas que todavía no
        // pasaron): si compitiera se llevaría la etiqueta siempre. Acá el cuello es Ventas.
        const { container, rerender } = render(<Embudo pasos={PASOS} />);
        expect(container.querySelector('.dc-bottleneck')).toHaveTextContent('Cuello de botella · Ventas');

        rerender(<Embudo pasos={[{ paso: 'Agendas', n: 92 }, { paso: 'Asistieron', n: 21 },
            { paso: 'Presentaciones', n: 19 }, { paso: 'Ventas', n: 7 }]} />);
        expect(container.querySelector('.dc-bottleneck')).toHaveTextContent('Cuello de botella · Ventas');
    });
});
