import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Revisar from './Revisar';
import { operacionDe } from './operar/operacion';

/**
 * Revisar › Ventas para quien opera (10/10/2026): la tabla vieja de Ventas de Operaciones se retiró,
 * y lo que ella sabía llega a Revisar solo para admin y operador: las ventas no completadas, la
 * columna Estado (con «Sin agenda») y las facetas Estado y Agenda.
 *
 * Lo que no se negocia: el listado por defecto de quien opera y su tira de totales son los de la
 * dirección. Las no completadas se ven para corregirlas, pero nunca suman.
 *
 * Quién opera lo dice que Revisar reciba `operacion` (ver `operar/operacion.js`); qué acciones trae
 * no importa acá: se prueban con las de Ventas, en `operar/ventas/accionesVentas.test.jsx`.
 */

// Quien opera, con una acción de fila de muestra: la vista no depende de cuáles sean.
const QUIEN_OPERA = operacionDe('ventas', [{ ventas: { fila: () => [] } }]);

const chip = (key, label, tone = 'info') => ({ key, label, tone });
const COMPLETADA = chip('completada', 'Completada', 'success');
const PAGO_COMPLETO = chip('completo', 'Pago completo', 'success');

const venta = (id, cliente, extra = {}) => ({
    tipo: 'venta', id, client_id: id, cliente, ig: '', email: '', telefono: '', closer: 'Nerina', setter: '',
    programa: 'Residency Roadmap', fecha: `2026-09-0${id}T15:00:00`, metodo: 'zelle', monto: 1000,
    monto_neto: 1000, es_venta: true, academia: null, sena_estado: null, tipo_pago: PAGO_COMPLETO,
    tipo_pago_raw: 'RR - Completo', ...extra,
});

// Lo que recibe la dirección: solo las completadas, sin las marcas de quien opera.
const DIRECCION = [
    venta(1, 'Ana Gomez', { monto: 2000, monto_neto: 2000 }),
    venta(2, 'Beto Diaz', { monto: 800, monto_neto: 760, metodo: 'Stripe',
        tipo_pago: chip('parcial', 'Split Pay'), tipo_pago_raw: 'RR - Parcial' }),
];
// Lo que recibe quien opera: las mismas, con su estado y su agenda, más dos no completadas.
const OPERADOR = [
    { ...DIRECCION[0], estado: COMPLETADA, completada: true, tiene_agenda: true },
    { ...DIRECCION[1], estado: COMPLETADA, completada: true, tiene_agenda: false },
    venta(3, 'Caro Paz', { monto: 999, monto_neto: 999, estado: chip('reembolsada', 'Reembolsada', 'error'),
        completada: false, tiene_agenda: true }),
    venta(4, 'Dani Sol', { monto: 1500, monto_neto: 1500, estado: chip('pendiente', 'Pendiente', 'warning'),
        completada: false, tiene_agenda: false }),
];

const props = (extra = {}) => ({
    tabla: 'ventas', setTabla: () => {}, cargando: false, rol: 'closers', basis: 'meet', setBasis: () => {},
    alcance: 'Todo el equipo', onAbrirFila: vi.fn(), filtroInicial: null, onOlvidarFiltro: () => {},
    puedeElegirEquipo: true, ...extra,
});
const comoDireccion = (filas = DIRECCION) => render(<Revisar {...props({ datos: { filas } })} />);
const comoOperador = (filas = OPERADOR, extra = {}) => render(
    <Revisar {...props({ datos: { filas, dates: { start: '2026-09-01', end: '2026-09-30' } },
        operacion: QUIEN_OPERA, ...extra })} />);

const celda = (clave) => document.querySelector(`.tot-tira [data-total="${clave}"]`);
const valor = (clave) => celda(clave).querySelector('b').textContent;
const tira = () => ['cash', 'ventas', 'ticket', 'neto'].map(valor);
const registros = () => screen.queryAllByRole('button', { name: /^Abrir / }).map(b => b.getAttribute('aria-label'));
const mostrando = () => screen.getByText(/^mostrando \d+ de \d+$/).textContent;
// El filtro rápido por defecto es «Todas» para la dirección y «Completadas» para quien opera.
const abrirRapido = () => fireEvent.click(screen.getByRole('button', { name: /^(Todas|Completadas)/ }));
const abrirFiltro = () => fireEvent.click(screen.getByRole('button', { name: /Filtro completo/ }));

beforeEach(() => { window.localStorage.clear(); });

describe('Revisar › Ventas · los números de quien opera son los de la dirección', () => {
    it('el listado por defecto y la tira de totales son los mismos', () => {
        const { unmount } = comoDireccion();
        const deLaDireccion = { tira: tira(), registros: registros(), cobros: celda('cash').textContent };
        unmount();

        comoOperador();

        expect(tira()).toEqual(deLaDireccion.tira);
        expect(tira()).toEqual(['$2,800', '2', '$1,400', '$2,760']);
        expect(registros()).toEqual(deLaDireccion.registros);
        expect(celda('cash').textContent).toBe(deLaDireccion.cobros);
        // Las no completadas están en el período, pero no en la lista por defecto, que lo dice.
        expect(mostrando()).toBe('mostrando 2 de 4');
        expect(screen.getByRole('button', { name: /^Completadas/ })).toBeInTheDocument();
    });

    it('«No completadas» muestra las que no suman, y la tira sigue contando solo las completadas', () => {
        comoOperador();
        abrirRapido();
        fireEvent.click(screen.getByRole('menuitemradio', { name: /^No completadas/ }));

        expect(registros()).toEqual(['Abrir Caro Paz', 'Abrir Dani Sol']);
        expect(tira()).toEqual(['$0', '0', '—', '$0']);
        expect(celda('cash').textContent).toMatch(/0 cobros · 2 no suman/);
        // El monto de una no completada va tachado: es lo que explica por qué no está en la tira.
        expect(screen.getByTitle('No suma: la venta está reembolsada')).toHaveStyle({ textDecoration: 'line-through' });
    });

    it('«No completadas» solo se ofrece si el período tiene alguna, y nunca a la dirección', () => {
        const { unmount } = comoOperador(OPERADOR.filter(f => f.completada));
        abrirRapido();
        expect(screen.getByRole('menuitemradio', { name: /^Pago completo/ })).toBeInTheDocument();
        expect(screen.queryByRole('menuitemradio', { name: /^No completadas/ })).toBeNull();
        unmount();

        comoDireccion();
        abrirRapido();
        expect(screen.queryByRole('menuitemradio', { name: /^No completadas/ })).toBeNull();
    });

    it('los atajos de siempre tampoco cuentan las no completadas', () => {
        comoOperador();
        abrirRapido();
        // Ana y Dani son pago completo; Dani está pendiente.
        expect(screen.getByRole('menuitemradio', { name: /^Pago completo/ })).toHaveTextContent('1');
    });
});

describe('Revisar › Ventas · las facetas Estado y Agenda', () => {
    it('pedir un estado no completado lo muestra aunque el filtro rápido sea el de por defecto', () => {
        comoOperador();
        abrirFiltro();
        const panel = screen.getByRole('dialog', { name: 'Filtro completo' });
        expect(within(panel).getByText('Estado')).toBeInTheDocument();
        fireEvent.click(within(panel).getByRole('checkbox', { name: /^Reembolsada/ }));

        expect(registros()).toEqual(['Abrir Caro Paz']);
        expect(valor('cash')).toBe('$0');
    });

    it('«Agenda: Sin agenda» deja las ventas sin agenda del listado', () => {
        comoOperador();
        abrirFiltro();
        const panel = screen.getByRole('dialog', { name: 'Filtro completo' });
        expect(within(panel).getByRole('checkbox', { name: /^Con agenda/ })).toHaveTextContent('2');
        fireEvent.click(within(panel).getByRole('checkbox', { name: /^Sin agenda/ }));

        // Dani tampoco tiene agenda, pero está pendiente: el listado por defecto no la muestra.
        expect(registros()).toEqual(['Abrir Beto Diaz']);
        // La columna Estado lo dice en la fila, debajo del chip.
        const fila = screen.getByRole('button', { name: 'Abrir Beto Diaz' });
        expect(within(fila).getByText('Completada')).toBeInTheDocument();
        expect(within(fila).getByText('Sin agenda')).toBeInTheDocument();
    });

    it('la dirección no tiene esas facetas ni la columna Estado', () => {
        comoDireccion();
        abrirFiltro();
        const panel = screen.getByRole('dialog', { name: 'Filtro completo' });
        expect(within(panel).queryByText('Estado')).toBeNull();
        expect(within(panel).queryByText('Agenda')).toBeNull();
        expect(screen.queryByText('Completada')).toBeNull();
    });
});
