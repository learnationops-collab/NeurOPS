import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import Revisar from './Revisar';

/**
 * El grupo que el usuario abrió en Revisar sigue abierto aunque la lista se desmonte.
 *
 * Desde el pedido del 29/sep/2026 los grupos arrancan cerrados y el closer abre el que quiere
 * revisar. Revisar desmonta la lista mientras recarga (el esqueleto la reemplaza), cuando un filtro
 * la deja vacía y al alternar lista/tarjetas; con la memoria de lo abierto adentro de la lista, el
 * grupo volvía cerrado después de cada cosa que el closer registraba en la ficha y al cambiar el
 * período. Estos tests montan el Revisar real y recorren esos caminos.
 *
 * Sin `IntersectionObserver` (jsdom) la lista se dibuja entera: acá no se prueba el paginado.
 */

const venta = (id, closer) => ({
    tipo: 'venta', id, cliente: `Cliente ${id}`, closer, programa: 'ACE',
    fecha: '2026-09-10T10:00:00',
    tipo_pago: { key: 'completo', label: 'Pago completo', tone: 'success' }, metodo: 'Stripe',
    monto: 100, monto_neto: 95, es_venta: true,
});
// Cinco ventas de Nerina y tres de Marlon.
const FILAS = [...[1, 2, 3, 4, 5].map(i => venta(i, 'Nerina')), ...[6, 7, 8].map(i => venta(i, 'Marlon'))];

const props = (extra = {}) => ({
    tabla: 'ventas', setTabla: () => {}, datos: { filas: FILAS }, cargando: false, rol: 'closers',
    basis: 'meet', setBasis: () => {}, alcance: 'Todo el equipo', onAbrirFila: () => {},
    filtroInicial: null, onOlvidarFiltro: () => {}, puedeElegirEquipo: true, ...extra,
});

const agrupar = (dimension) => {
    fireEvent.click(screen.getByRole('button', { name: /^(Sin agrupar|Por )/ }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: new RegExp(`^${dimension}`) }));
};
const grupo = (nombre) => screen.getByRole('button', { name: new RegExp(`^${nombre}`) });
const registros = () => screen.queryAllByRole('button', { name: /^Abrir / });

/** Agrupa las ventas por closer y abre el grupo de Nerina: el punto de partida de cada test. */
const abrirNerina = (extra) => {
    const vista = render(<Revisar {...props(extra)} />);
    agrupar('Closer');
    fireEvent.click(grupo('Nerina'));
    expect(grupo('Nerina')).toHaveAttribute('aria-expanded', 'true');
    return vista;
};

describe('Revisar · los grupos abiertos', () => {
    // `useModoVista` recuerda lista/tarjetas en `localStorage`: sin limpiarlo, un test que pasa a
    // tarjetas dejaría a los siguientes arrancando en tarjetas.
    beforeEach(() => { window.localStorage.clear(); });

    it('siguen abiertos después de recargar la tabla', () => {
        // Es lo que pasa al registrar algo en la ficha, al cambiar el período y al cambiar la base
        // de fecha: `cargando` pasa a true, llegan filas nuevas y `cargando` vuelve a false.
        const { rerender } = abrirNerina();

        rerender(<Revisar {...props({ cargando: true, basis: 'creacion' })} />);
        expect(screen.queryByRole('button', { name: /^Nerina/ })).toBeNull();
        rerender(<Revisar {...props({ datos: { filas: FILAS.slice() }, basis: 'creacion' })} />);

        expect(screen.getByRole('button', { name: 'Por closer' })).toBeInTheDocument();
        expect(grupo('Nerina')).toHaveAttribute('aria-expanded', 'true');
        expect(grupo('Marlon')).toHaveAttribute('aria-expanded', 'false');
        expect(registros()).toHaveLength(5);
    });

    it('siguen abiertos al pasar a tarjetas y volver a la lista', () => {
        abrirNerina();

        fireEvent.click(screen.getByRole('button', { name: 'Ver como tarjetas' }));
        expect(grupo('Nerina')).toHaveAttribute('aria-expanded', 'true');
        expect(registros()).toHaveLength(5);

        fireEvent.click(screen.getByRole('button', { name: 'Ver como lista' }));
        expect(grupo('Nerina')).toHaveAttribute('aria-expanded', 'true');
    });

    it('siguen abiertos aunque la búsqueda deje la lista vacía por un momento', () => {
        abrirNerina();
        const buscar = screen.getByRole('searchbox', { name: 'Buscar' });

        // Un error de tipeo que no encuentra nada, y enseguida la corrección.
        fireEvent.change(buscar, { target: { value: 'Clientex' } });
        expect(screen.getByText('Ningún registro entra por este filtro')).toBeInTheDocument();
        fireEvent.change(buscar, { target: { value: 'Cliente' } });

        expect(grupo('Nerina')).toHaveAttribute('aria-expanded', 'true');
        expect(registros()).toHaveLength(5);
    });

    it('cambiar la agrupación y volver empieza con todo cerrado', () => {
        abrirNerina();

        agrupar('Programa');
        agrupar('Closer');

        expect(grupo('Nerina')).toHaveAttribute('aria-expanded', 'false');
        expect(registros()).toHaveLength(0);
    });

    it('cambiar de tabla y volver empieza con todo cerrado', () => {
        const { rerender } = abrirNerina();

        // Mientras llegan las filas de la otra tabla, `datos` viene en null y Revisar carga.
        rerender(<Revisar {...props({ tabla: 'clientes', datos: null, cargando: true })} />);
        rerender(<Revisar {...props()} />);
        expect(screen.getByRole('button', { name: 'Sin agrupar' })).toBeInTheDocument();
        agrupar('Closer');

        expect(grupo('Nerina')).toHaveAttribute('aria-expanded', 'false');
        expect(registros()).toHaveLength(0);
    });
});
