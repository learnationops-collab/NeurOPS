import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import Revisar from './Revisar';

/**
 * Ordenar Revisar por una columna: desde el encabezado y desde "Ordenar", sin tocar lo filtrado.
 *
 * El orden se aplica DESPUÉS del filtro, así que ni el "mostrando X de Y" ni la tira de totales
 * cambian al ordenar: son las mismas filas en otro orden.
 */

const cliente = (id, deuda, pagado) => ({
    tipo: 'cliente', id, client_id: id, cliente: `Cliente ${id}`, closer: 'Nerina', programa: 'ACE',
    fecha: '2026-09-10', pagado, deuda, cobros: 1, cuota_monto: null, cuota_fecha: null,
    cuota_vencida: false, estado: { key: 'al_dia', label: 'Al día', tone: 'success' },
});
// El backend manda la cartera por deuda descendente; acá llegan desordenadas a propósito.
const FILAS = [cliente(1, 300, 10), cliente(2, 0, 900), cliente(3, 1200, 50)];

const props = (extra = {}) => ({
    tabla: 'clientes', setTabla: () => {}, datos: { filas: FILAS }, cargando: false, rol: 'closers',
    basis: 'meet', setBasis: () => {}, alcance: 'Todo el equipo', onAbrirFila: () => {},
    filtroInicial: null, onOlvidarFiltro: () => {}, puedeElegirEquipo: true, ...extra,
});

const orden = () => screen.getAllByRole('button', { name: /^Abrir / })
    .map(b => b.getAttribute('aria-label').replace('Abrir ', ''));
const encabezado = (nombre) => screen.getByRole('button', { name: new RegExp(`^Ordenar por ${nombre}`) });

describe('Revisar · ordenar por columna', () => {
    beforeEach(() => { window.localStorage.clear(); });

    it('el encabezado ordena de mayor a menor, después de menor a mayor y al tercer toque vuelve', () => {
        render(<Revisar {...props()} />);
        expect(orden()).toEqual(['Cliente 1', 'Cliente 2', 'Cliente 3']);

        fireEvent.click(encabezado('Deuda'));
        expect(orden()).toEqual(['Cliente 3', 'Cliente 1', 'Cliente 2']);
        expect(encabezado('Deuda')).toHaveAccessibleName(/de mayor a menor/);

        fireEvent.click(encabezado('Deuda'));
        expect(orden()).toEqual(['Cliente 2', 'Cliente 1', 'Cliente 3']);

        fireEvent.click(encabezado('Deuda'));
        expect(orden()).toEqual(['Cliente 1', 'Cliente 2', 'Cliente 3']);
    });

    it('la flecha solo ocupa lugar en la columna que ordena, y el rótulo se puede cortar', () => {
        // Invisible en las demás igual ocupaba 15px, y en las columnas angostas eso dejaba «H…».
        const { container } = render(<Revisar {...props()} />);
        expect(container.querySelectorAll('.tabla-cab .cab-flecha')).toHaveLength(0);

        fireEvent.click(encabezado('Deuda'));
        expect(container.querySelectorAll('.tabla-cab .cab-flecha')).toHaveLength(1);
        expect(within(encabezado('Deuda')).getByText('Debe')).toHaveClass('trunc');
    });

    it('un texto que no entra se corta con «…» y deja el entero en el title', () => {
        // Antes un nombre largo se montaba sobre la columna de al lado (`.celda` es un span y en
        // línea no recorta). El chip lleva su texto en su propio span, que es lo que se corta.
        const largo = { ...cliente(9, 0, 100), cliente: 'Andrea Alejandra Pérez Hernández de la Torre' };
        render(<Revisar {...props({ datos: { filas: [largo] } })} />);

        const fila = screen.getByRole('button', { name: /^Abrir Andrea/ });
        expect(within(fila).getByText(largo.cliente)).toHaveAttribute('title', largo.cliente);
        const chip = within(fila).getByText('Al día');
        expect(chip).toHaveClass('trunc');
        expect(chip.closest('.chip')).toHaveAttribute('title', 'Al día');
    });

    it('"Ordenar" hace lo mismo, también en tarjetas donde no hay encabezado', () => {
        render(<Revisar {...props()} />);
        fireEvent.click(screen.getByRole('button', { name: 'Ver como tarjetas' }));

        fireEvent.click(screen.getByRole('button', { name: /^Ordenar/ }));
        fireEvent.click(screen.getByRole('menuitemradio', { name: /^Pagado/ }));

        expect(orden()).toEqual(['Cliente 2', 'Cliente 3', 'Cliente 1']);
        expect(screen.getByRole('button', { name: /^Pagado ↓/ })).toBeInTheDocument();
    });

    it('ordenar no cambia lo que se cuenta: mismas filas, mismos totales', () => {
        const { container } = render(<Revisar {...props()} />);
        const tira = () => container.querySelector('.tot-tira').textContent;
        const antes = tira();

        fireEvent.click(encabezado('Pagado'));

        expect(tira()).toBe(antes);
        expect(screen.getByText('mostrando 3 de 3')).toBeInTheDocument();
    });

    it('cambiar de tabla deja el orden de la tabla nueva', () => {
        const { rerender } = render(<Revisar {...props()} />);
        fireEvent.click(encabezado('Deuda'));

        rerender(<Revisar {...props({ tabla: 'ventas', datos: null, cargando: true })} />);
        rerender(<Revisar {...props()} />);

        expect(orden()).toEqual(['Cliente 1', 'Cliente 2', 'Cliente 3']);
        expect(within(screen.getByRole('button', { name: /^Ordenar$/ })).queryByText(/↓|↑/)).toBeNull();
    });
});
