import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ListaAgrupable from './ListaAgrupable';
import { TAMANO_PAGINA } from './usePaginaProgresiva';

/**
 * Lo que estos tests fijan es el pedido del 29/sep/2026 —al agrupar, los grupos aparecen cerrados
 * y se abre el que se quiere revisar— sin romper lo que la lista agrupada ya prometía: que los
 * encabezados sumen el total de la lista aunque no se dibuje ninguna fila, y que un grupo grande no
 * se dibuje entero de golpe.
 *
 * jsdom no trae `IntersectionObserver`, y sin él `usePaginaProgresiva` dibuja todo (lo decide al
 * cargar el módulo). Por eso se instala uno falso ANTES de los imports, con `vi.hoisted`: así el
 * paginado de cada grupo es el de producción, y el test decide cuándo el pie "se ve".
 */
const observadores = vi.hoisted(() => {
    const lista = [];
    globalThis.IntersectionObserver = class {
        constructor(avisar) {
            this.avisar = avisar;
            this.nodos = [];
            this.activo = true;
            lista.push(this);
        }

        observe(nodo) { this.nodos.push(nodo); }

        unobserve() {}

        disconnect() { this.activo = false; }
    };
    return lista;
});

const porCloser = { key: 'closer', label: 'Closer', de: (f) => f.closer };
const porFuente = { key: 'fuente', label: 'Fuente', de: (f) => f.fuente };

const VENTAS = [
    { id: 1, cliente: 'Ana', closer: 'Nerina', fuente: 'Setting', monto: 500 },
    { id: 2, cliente: 'Beto', closer: 'Marlon', fuente: 'Workshop', monto: 300.5 },
    { id: 3, cliente: 'Cora', closer: 'Nerina', fuente: 'Setting', monto: 199.5 },
    { id: 4, cliente: 'Dani', closer: 'Marlon', fuente: 'Setting', monto: 1000 },
    { id: 5, cliente: 'Eva', closer: 'Sofía', fuente: 'Workshop', monto: 250 },
];

const dinero = (n) => `$${n}`;

/** Cada fila es un `<li>` con el nombre del cliente: alcanza para saber qué se dibujó y qué no. */
const renderFilas = (filas) => (
    <ul>{filas.map(f => <li key={f.id}>{f.cliente}</li>)}</ul>
);

const montar = (props = {}) => render(
    <ListaAgrupable filas={VENTAS} dimension={porCloser} renderFilas={renderFilas}
        formatoMonto={dinero} {...props} />);

const encabezado = (nombre) => screen.getByRole('button', { name: new RegExp(nombre) });
const filasDibujadas = () => screen.queryAllByRole('listitem').map(li => li.textContent);

describe('ListaAgrupable', () => {
    beforeEach(() => { observadores.length = 0; });

    it('al agrupar, todos los grupos arrancan cerrados', () => {
        montar();

        const cabs = screen.getAllByRole('button');
        expect(cabs).toHaveLength(3);
        cabs.forEach(cab => expect(cab).toHaveAttribute('aria-expanded', 'false'));
        // Cerrados de verdad: ninguna fila dibujada, no sólo la flecha girada.
        expect(filasDibujadas()).toEqual([]);
    });

    it('con un solo grupo arranca abierto: no hay nada que elegir', () => {
        montar({ filas: VENTAS.filter(f => f.closer === 'Nerina') });

        expect(encabezado('Nerina')).toHaveAttribute('aria-expanded', 'true');
        expect(filasDibujadas()).toEqual(['Ana', 'Cora']);
    });

    it('el grupo único también se puede cerrar', () => {
        montar({ filas: VENTAS.filter(f => f.closer === 'Nerina') });

        fireEvent.click(encabezado('Nerina'));

        expect(encabezado('Nerina')).toHaveAttribute('aria-expanded', 'false');
        expect(filasDibujadas()).toEqual([]);
    });

    it('con todo cerrado, los subtotales son los del grupo entero', () => {
        // Es la invariante del módulo: los encabezados suman el total de la tira de arriba. Que no
        // se dibuje ninguna fila no puede dejarlos en cero.
        montar();

        expect(encabezado('Nerina')).toHaveTextContent('2 registros');
        expect(encabezado('Nerina')).toHaveTextContent('$699.5');
        expect(encabezado('Marlon')).toHaveTextContent('2 registros');
        expect(encabezado('Marlon')).toHaveTextContent('$1300.5');
        expect(encabezado('Sofía')).toHaveTextContent('1 registro');
        expect(encabezado('Sofía')).toHaveTextContent('$250');
    });

    it('abrir un grupo muestra sus filas y sólo las suyas', () => {
        montar();

        fireEvent.click(encabezado('Marlon'));

        const cab = encabezado('Marlon');
        expect(cab).toHaveAttribute('aria-expanded', 'true');
        // El encabezado sigue diciendo qué cuerpo controla, y ese cuerpo es el que tiene las filas.
        const cuerpo = document.getElementById(cab.getAttribute('aria-controls'));
        expect(cuerpo).not.toBeNull();
        expect(within(cuerpo).getAllByRole('listitem').map(li => li.textContent))
            .toEqual(['Beto', 'Dani']);
        expect(filasDibujadas()).toEqual(['Beto', 'Dani']);
        expect(encabezado('Nerina')).toHaveAttribute('aria-expanded', 'false');
    });

    it('volver a clickear el encabezado lo cierra', () => {
        montar();

        fireEvent.click(encabezado('Marlon'));
        fireEvent.click(encabezado('Marlon'));

        expect(encabezado('Marlon')).toHaveAttribute('aria-expanded', 'false');
        expect(filasDibujadas()).toEqual([]);
    });

    it('cambiar de dimensión vuelve a cerrar todo', () => {
        const { rerender } = montar();
        fireEvent.click(encabezado('Nerina'));

        rerender(<ListaAgrupable filas={VENTAS} dimension={porFuente} renderFilas={renderFilas}
            formatoMonto={dinero} />);

        screen.getAllByRole('button').forEach(cab => expect(cab).toHaveAttribute('aria-expanded', 'false'));
        expect(filasDibujadas()).toEqual([]);
    });

    it('volver a la dimensión anterior no resucita lo que estaba abierto', () => {
        const { rerender } = montar();
        fireEvent.click(encabezado('Nerina'));

        const con = (dimension) => (
            <ListaAgrupable filas={VENTAS} dimension={dimension} renderFilas={renderFilas}
                formatoMonto={dinero} />);
        rerender(con(porFuente));
        rerender(con(porCloser));

        expect(encabezado('Nerina')).toHaveAttribute('aria-expanded', 'false');
    });

    it('cambiar un filtro con la misma dimensión deja abierto lo que el usuario abrió', () => {
        const { rerender } = montar();
        fireEvent.click(encabezado('Nerina'));

        // Un filtro nuevo es un arreglo nuevo (el `useMemo` de Revisar) con menos filas.
        const filtradas = VENTAS.filter(f => f.id !== 3);
        rerender(<ListaAgrupable filas={filtradas} dimension={porCloser} renderFilas={renderFilas}
            formatoMonto={dinero} />);

        expect(encabezado('Nerina')).toHaveAttribute('aria-expanded', 'true');
        expect(encabezado('Nerina')).toHaveTextContent('1 registro');
        expect(encabezado('Marlon')).toHaveAttribute('aria-expanded', 'false');
        expect(filasDibujadas()).toEqual(['Ana']);
    });

    describe('paginado dentro de cada grupo', () => {
        // 45 filas de Nerina: una página y un pedazo. Marlon tiene 2.
        const MUCHAS = [
            ...Array.from({ length: 45 }, (_, i) => (
                { id: 100 + i, cliente: `N${i}`, closer: 'Nerina', monto: 10 })),
            { id: 1, cliente: 'Beto', closer: 'Marlon', monto: 1 },
            { id: 2, cliente: 'Dani', closer: 'Marlon', monto: 1 },
        ];
        const pie = () => <span data-testid="pie">cargando</span>;
        const pieActivo = () => observadores.filter(o => o.activo && o.nodos.length);

        it('con todo cerrado no hay ningún pie esperando', () => {
            // Un pie a la vista sin filas arriba cargaría tandas que nadie ve (ver el test de
            // `RevisarLista`, que fija lo mismo para el pie de la lista entera).
            montar({ filas: MUCHAS, renderPie: pie });

            expect(screen.queryByTestId('pie')).toBeNull();
            expect(pieActivo()).toHaveLength(0);
        });

        it('abrir un grupo grande dibuja la primera tanda y el resto al bajar', () => {
            const llamadas = [];
            const registrar = (filas, desde) => {
                llamadas.push({ cantidad: filas.length, desde });
                return renderFilas(filas);
            };
            montar({ filas: MUCHAS, renderPie: pie, renderFilas: registrar });

            fireEvent.click(encabezado('Nerina'));

            expect(filasDibujadas()).toHaveLength(TAMANO_PAGINA);
            expect(screen.getByTestId('pie')).toBeInTheDocument();
            expect(llamadas.at(-1)).toEqual({ cantidad: TAMANO_PAGINA, desde: 0 });
            // El encabezado sigue contando el grupo entero, no la tanda dibujada.
            expect(encabezado('Nerina')).toHaveTextContent('45 registros');
            expect(encabezado('Nerina')).toHaveTextContent('$450');

            // El pie del grupo "se ve": llega la tanda siguiente, y el escalonado se cuenta
            // desde las que ya estaban.
            const [observador] = pieActivo();
            act(() => observador.avisar([{ isIntersecting: true }]));

            expect(filasDibujadas()).toHaveLength(45);
            expect(screen.queryByTestId('pie')).toBeNull();
            expect(llamadas.at(-1)).toEqual({ cantidad: 45, desde: TAMANO_PAGINA });
        });

        it('abrir o cerrar otro grupo no devuelve al primero a su primera tanda', () => {
            montar({ filas: MUCHAS, renderPie: pie });
            fireEvent.click(encabezado('Nerina'));
            act(() => pieActivo()[0].avisar([{ isIntersecting: true }]));

            fireEvent.click(encabezado('Marlon'));

            expect(filasDibujadas()).toHaveLength(47);
        });

        it('sin renderPie el grupo se dibuja entero', () => {
            montar({ filas: MUCHAS });

            fireEvent.click(encabezado('Nerina'));

            expect(filasDibujadas()).toHaveLength(45);
        });
    });
});
