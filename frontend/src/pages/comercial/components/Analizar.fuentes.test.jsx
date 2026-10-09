import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Analizar from './Analizar';

/**
 * Analizar › «Ingresos por fuente» (09/10/2026): el Cash collected abierto por la fuente que trajo
 * cada cobro, al lado de Payment types. Qué cobro va en qué fuente lo decide el backend (y que el
 * total sea el cash del mismo filtro lo prueba `tests/api/test_comercial_fuentes.py`): acá se
 * comprueba que se dibuje lo que llega, que el detalle se abra de a una fuente y los estados vacíos.
 */

const BLOQUE = {
    agendas: 0, realizadas: 0, asistieron: 0, show_up: null, cerradas: 0, close_rate: null,
    presentaciones: 0, presentacion_rate: null, close_presentacion: null, cierres: null, estados: [],
    cash: 5550, cash_neto: 5482.5, ventas: 4, ticket: 1187.5, comision: 548.25,
    cash_por_dia: [], mejor_dia: null, programas: [], funnel: [],
    payment_types: [
        { key: 'completo', label: 'Pago completo', tone: 'success', ventas: 3, cash: 3750 },
        { key: 'parcial', label: 'Split Pay', tone: 'info', ventas: 1, cash: 1000 },
        { key: 'cuota', label: 'Cuotas', tone: 'idle', ventas: 1, cash: 500 },
        { key: 'seña', label: 'Depósitos', tone: 'warning', ventas: 1, cash: 300 },
    ],
    senas: { total: 0, completo: 0, parcial: 0, espera: 0, caida: 0, conversion: null, cobrado: 0,
        ticket: null, desbloqueado: 0 },
};

const fuente = (key, label, tone, monto, cantidad, pct, detalle = [], comparado = {}) => ({
    key, label, tone, monto, cantidad, pct, detalle, previo: null, delta: null, ...comparado,
});
const sub = (key, label, monto, cantidad, pct) => ({ key, label, monto, cantidad, pct });

const FUENTES = {
    base: 'bruto', total: 5550, cantidad: 6, previo: 200, delta: { valor: 2675, modo: 'pct' },
    procedencias: [
        fuente('workshop', 'Workshop', 'cat-4', 1500, 2, 27, [sub('vivo', 'En vivo', 1500, 2, 27)],
            { previo: 200, delta: { valor: 650, modo: 'pct' } }),
        fuente('setting', 'Setting', 'cat-2', 2000, 2, 36.1,
            [sub('elias', 'Elias', 1200, 1, 21.6), sub('paula', 'Paula', 800, 1, 14.4)],
            { previo: 0, delta: null }),
        fuente('vsl', 'VSL', 'cat-1', 1500, 1, 27),
        fuente('fulfillment', 'Fulfillment', 'cat-3', 300, 1, 5.4, [sub('renovacion', 'Renovaciones', 300, 1, 5.4)]),
        fuente('sin_procedencia', 'Sin procedencia', 'idle', 250, 1, 4.5, [sub('sin_agenda', 'Sin agenda', 250, 1, 4.5)]),
    ],
};

const CERO = {
    ...FUENTES, total: 0, cantidad: 0, previo: null, delta: null,
    procedencias: FUENTES.procedencias.map(p => ({ ...p, monto: 0, cantidad: 0, pct: null, detalle: [], delta: null })),
};

const datos = (fuentes, extra = {}) => ({ rol: 'closers', actual: BLOQUE, deltas: {}, por_cobrar: null, fuentes, ...extra });

/** Las barras arrancan a crecer en el cuadro siguiente al montar: se espera ese cuadro dentro de `act`. */
const montar = async (payload) => {
    const r = render(<Analizar datos={payload} rol="closers" irA={vi.fn()} />);
    await act(() => new Promise((listo) => { requestAnimationFrame(() => listo()); }));
    return r;
};

const tarjeta = () => document.getElementById('p-fuentes');

/** El texto de una celda sin la «i» de su `Tip`. */
const texto = (el) => {
    const copia = el.cloneNode(true);
    copia.querySelectorAll('.tip').forEach(t => t.remove());
    return copia.textContent.trim();
};

/** Fuente, cobros, monto y % de una fila (las celdas de la primera línea de su grilla). */
const fila = (rotulo) => [...within(tarjeta()).getByText(rotulo).closest('.tdatos-fila').children]
    .slice(0, 4).map(texto);

const rotulos = () => [...tarjeta().querySelectorAll('.fuente, .fuente-sub')]
    .map(f => texto(f.firstElementChild));

describe('Analizar · Ingresos por fuente', () => {
    it('va al lado de Payment types y muestra cada fuente con sus cobros, su monto y su %', async () => {
        await montar(datos(FUENTES));

        // Las dos maneras de abrir el mismo cash, en la misma fila.
        const par = tarjeta().parentElement;
        expect(par.classList.contains('grid-2')).toBe(true);
        expect([...par.children].map(p => texto(p.querySelector('.panel-cab h2'))))
            .toEqual(['Payment types', 'Ingresos por fuente']);

        expect(rotulos()).toEqual(['Workshop', 'Setting', 'VSL', 'Fulfillment', 'Sin procedencia']);
        expect(fila('Workshop')).toEqual(['Workshop', '2', '$1,500', '27%']);
        expect(fila('Setting')).toEqual(['Setting', '2', '$2,000', '36.1%']);
        expect(fila('Sin procedencia')).toEqual(['Sin procedencia', '1', '$250', '4.5%']);
        // El total es el Cash collected del bloque (el backend los hace cerrar; acá viajan iguales).
        expect(fila('Total')).toEqual(['Total', '6', '$5,550', '100%']);
    });

    it('las barras miden contra el total y el delta va debajo del monto', async () => {
        await montar(datos(FUENTES));

        await vi.waitFor(() => expect([...tarjeta().querySelectorAll('.fuente-riel .riel > i')]
            .map(i => Number.parseFloat(i.style.width).toFixed(1)))
            .toEqual(['27.0', '36.0', '27.0', '5.4', '4.5']));
        // Workshop subió contra agosto; Setting no tenía nada antes: sin delta, no un infinito.
        const deltas = [...tarjeta().querySelectorAll('.fuente-delta')];
        expect(deltas.map(d => d.textContent)).toEqual(['▲ 650%', '▲ 2675%']);
        expect(deltas[0].closest('.fuente')).toBe(within(tarjeta()).getByText('Workshop').closest('.fuente'));
        expect(deltas[0].title).toBe('$200 en el período comparado');
        // El del total, en su fila y no en la cabecera, que queda con las pestañas solas.
        expect(deltas[1].closest('.tdatos-total')).not.toBeNull();
        expect(tarjeta().querySelector('.panel-cab .delta')).toBeNull();
    });

    it('el detalle se abre de a una fuente: el de Setting es por setter', async () => {
        await montar(datos(FUENTES));
        const setting = within(tarjeta()).getByRole('button', { name: /^Setting: \$2,000\. Ver el detalle/ });
        expect(setting.getAttribute('aria-expanded')).toBe('false');

        fireEvent.click(setting);
        expect(setting.getAttribute('aria-expanded')).toBe('true');
        expect(rotulos()).toEqual(['Workshop', 'Setting', 'Elias', 'Paula', 'VSL', 'Fulfillment', 'Sin procedencia']);
        expect(fila('Elias')).toEqual(['Elias', '1', '$1,200', '21.6%']);

        // Abrir otra cierra la anterior.
        fireEvent.click(within(tarjeta()).getByRole('button', { name: /^Workshop: / }));
        expect(rotulos()).toEqual(['Workshop', 'En vivo', 'Setting', 'VSL', 'Fulfillment', 'Sin procedencia']);

        // Y volver a tocarla la cierra.
        fireEvent.click(within(tarjeta()).getByRole('button', { name: /^Workshop: / }));
        expect(rotulos()).toEqual(['Workshop', 'Setting', 'VSL', 'Fulfillment', 'Sin procedencia']);
    });

    it('una fuente sin detalle no se abre, y una en cero queda apagada sin esconderse', async () => {
        await montar(datos({
            ...FUENTES,
            procedencias: FUENTES.procedencias.map(p => (p.key === 'fulfillment'
                ? { ...p, monto: 0, cantidad: 0, pct: 0, detalle: [] } : p)),
        }));

        const vsl = within(tarjeta()).getByText('VSL').closest('.fuente');
        expect(vsl.querySelector('.fuente-abrir')).toBeNull();
        const apagada = within(tarjeta()).getByText('Fulfillment').closest('.fuente');
        expect(apagada.querySelector('.fuente-abrir')).toBeNull();
        expect(apagada.dataset.vacio).toBe('1');
        // Su monto lleva igual a la lista, apagado: un cero también se puede mirar.
        expect(apagada.querySelector('.metrica-clic').dataset.vacio).toBe('1');
    });

    it('«Sin procedencia» en cero no se muestra; un embudo en cero, sí', async () => {
        // Pedido del usuario (09/10/2026): «si "Sin procedencia" es cero no lo muestres».
        await montar(datos({
            ...FUENTES, total: 5300, cantidad: 5,
            procedencias: FUENTES.procedencias.map(p => (p.key === 'sin_procedencia' || p.key === 'vsl'
                ? { ...p, monto: 0, cantidad: 0, pct: 0, detalle: [],
                    previo: 250, delta: { valor: -100, modo: 'pct' } }
                : p)),
        }));

        expect(rotulos()).toEqual(['Workshop', 'Setting', 'VSL', 'Fulfillment']);
        expect(within(tarjeta()).getByText('VSL').closest('.fuente').dataset.vacio).toBe('1');
        expect(fila('Total')).toEqual(['Total', '5', '$5,300', '100%']);
    });

    it('el monto de una fuente abre Revisar › Ventas con esa fuente, sin abrir el detalle', async () => {
        const irA = vi.fn();
        render(<Analizar datos={datos(FUENTES)} rol="closers" irA={irA} />);

        const workshop = within(tarjeta()).getByRole('button', { name: 'Ver en la lista: 2 cobros de Workshop, $1,500' });
        fireEvent.click(workshop);

        expect(irA).toHaveBeenCalledWith('ventas',
            { fuente: 'Workshop', __de: 'Ingresos por fuente: Workshop', __aviso: null });
        expect(within(tarjeta()).getByRole('button', { name: /^Workshop: .*Ver el detalle/ }))
            .toHaveAttribute('aria-expanded', 'false');

        // La VSL no tiene detalle, pero su monto también lleva.
        fireEvent.click(within(tarjeta()).getByRole('button', { name: 'Ver en la lista: 1 cobro de VSL, $1,500' }));
        expect(irA).toHaveBeenLastCalledWith('ventas',
            { fuente: 'VSL', __de: 'Ingresos por fuente: VSL', __aviso: null });

        // El total es el Cash collected: la lista entera, sin etiquetas.
        fireEvent.click(within(tarjeta()).getByRole('button', { name: 'Ver en la lista: 6 cobros del período, $5,550' }));
        expect(irA).toHaveBeenLastCalledWith('ventas', { __de: 'Ingresos por fuente', __aviso: null });
    });

    it('un renglón del detalle abre la lista de ese renglón, con su fuente adelante', async () => {
        const irA = vi.fn();
        render(<Analizar datos={datos(FUENTES)} rol="closers" irA={irA} />);
        fireEvent.click(within(tarjeta()).getByRole('button', { name: /^Setting: .*Ver el detalle/ }));

        fireEvent.click(within(tarjeta()).getByRole('button', { name: 'Ver en la lista: 1 cobro de Setting · Elias, $1,200' }));

        expect(irA).toHaveBeenCalledWith('ventas', {
            fuente_detalle: 'Setting · Elias', __de: 'Ingresos por fuente: Setting · Elias', __aviso: null });
    });

    it('sin a dónde llevar (Analizar embebido sin lista), los montos son texto', async () => {
        render(<Analizar datos={datos(FUENTES)} rol="closers" irA={null} />);

        expect(tarjeta().querySelectorAll('.metrica-clic')).toHaveLength(0);
        expect(fila('Workshop')).toEqual(['Workshop', '2', '$1,500', '27%']);
        // El detalle se sigue abriendo.
        expect(tarjeta().querySelectorAll('.fuente-abrir')).toHaveLength(4);
    });

    it('en gráfico, la dona reparte solo las fuentes que tuvieron cobros', async () => {
        await montar(datos({
            ...FUENTES,
            procedencias: FUENTES.procedencias.map(p => (p.key === 'vsl' ? { ...p, monto: 0, cantidad: 0 } : p)),
        }));
        fireEvent.click(within(tarjeta()).getByRole('tab', { name: 'Gráfico' }));

        expect([...tarjeta().querySelectorAll('.tl-nom')].map(n => n.textContent))
            .toEqual(['Workshop', 'Setting', 'Fulfillment', 'Sin procedencia']);
        // El % de la leyenda es el del backend, el mismo que dice la tabla: no uno recalculado.
        expect([...tarjeta().querySelectorAll('.tl-p')].map(n => n.textContent.trim()))
            .toEqual(['27%', '36.1%', '5.4%', '4.5%']);
        expect(within(tarjeta()).getByText('cobrado')).toBeTruthy();
    });

    it('un período sin cobros lo dice, sin filas en cero', async () => {
        await montar(datos(CERO));

        expect(within(tarjeta()).getByText('Sin cobros en el período.')).toBeTruthy();
        expect(tarjeta().querySelectorAll('.fuente')).toHaveLength(0);
    });

    it('sin `fuentes` en el payload, Payment types ocupa la fila entera como antes', async () => {
        await montar(datos(undefined));

        expect(tarjeta()).toBeNull();
        expect(screen.getByText('Payment types').closest('.panel').parentElement.classList.contains('grid-2'))
            .toBe(false);
    });
});
