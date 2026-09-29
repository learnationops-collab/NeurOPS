import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RevisarLista from './RevisarLista';
import { TAMANO_PAGINA } from '../../../components/listas/usePaginaProgresiva';

/**
 * Quién pagina en Revisar: la lista entera cuando está suelta, cada grupo abierto cuando está
 * agrupada, y nunca las dos cosas.
 *
 * El bug que esto blinda nace del pedido del 29/sep/2026 (los grupos arrancan cerrados): con el pie
 * de la lista entera, cerrado todo quedaba a la vista debajo de los encabezados y cargaba todas las
 * páginas sin dibujar nada, y al abrir un grupo aparecían todas sus filas de golpe.
 *
 * Como en el test de `ListaAgrupable`, el `IntersectionObserver` falso se instala antes de los
 * imports: sin él `usePaginaProgresiva` no pagina y no habría nada que fijar.
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

const DEF = {
    cols: [
        { key: 'cliente', header: 'Cliente', width: '2fr' },
        { key: 'monto', header: 'Monto', width: '1fr' },
    ],
};
const porCloser = { key: 'closer', label: 'Closer', de: (f) => f.closer };

// 45 ventas de Nerina y 5 de Marlon: la lista entera y el grupo grande pasan de una página.
const VISIBLES = [
    ...Array.from({ length: 45 }, (_, i) => (
        { tipo: 'venta', id: i, cliente: `Nerina ${i}`, closer: 'Nerina', monto: 100 })),
    ...Array.from({ length: 5 }, (_, i) => (
        { tipo: 'venta', id: 100 + i, cliente: `Marlon ${i}`, closer: 'Marlon', monto: 100 })),
];

const montar = (props = {}) => render(
    <RevisarLista def={DEF} visibles={VISIBLES} plantilla="2fr 1fr" onAbrirFila={() => {}}
        dimension={null} modo="lista" {...props} />);

/** Las filas y las tarjetas son botones "Abrir <cliente>"; los encabezados de grupo no. */
const registros = () => screen.queryAllByRole('button', { name: /^Abrir / });
const huesos = (container) => container.querySelectorAll('.hueso');
const piesActivos = () => observadores.filter(o => o.activo && o.nodos.length);

describe('RevisarLista · quién pagina', () => {
    beforeEach(() => { observadores.length = 0; });

    it('suelta, pagina la lista entera con su pie', () => {
        const { container } = montar();

        expect(registros()).toHaveLength(TAMANO_PAGINA);
        expect(huesos(container).length).toBeGreaterThan(0);
        expect(piesActivos()).toHaveLength(1);
    });

    it('agrupada y con todo cerrado, no hay ningún pie cargando páginas', () => {
        const { container } = montar({ dimension: porCloser });

        expect(screen.getByRole('button', { name: /^Nerina/ })).toHaveAttribute('aria-expanded', 'false');
        expect(registros()).toHaveLength(0);
        expect(huesos(container)).toHaveLength(0);
        expect(piesActivos()).toHaveLength(0);
    });

    it.each(['lista', 'tarjetas'])('agrupada en %s, el grupo abierto pagina sus filas', (modo) => {
        const { container } = montar({ dimension: porCloser, modo });

        fireEvent.click(screen.getByRole('button', { name: /^Nerina/ }));

        // La primera tanda del GRUPO, no el recorte de una página de la lista entera.
        expect(registros()).toHaveLength(TAMANO_PAGINA);
        expect(registros().every(b => b.getAttribute('aria-label').startsWith('Abrir Nerina'))).toBe(true);
        expect(huesos(container).length).toBeGreaterThan(0);
        expect(piesActivos()).toHaveLength(1);

        act(() => piesActivos()[0].avisar([{ isIntersecting: true }]));

        expect(registros()).toHaveLength(45);
        expect(huesos(container)).toHaveLength(0);
    });

    it('agrupada, un grupo chico se dibuja entero y sin pie', () => {
        const { container } = montar({ dimension: porCloser });

        fireEvent.click(screen.getByRole('button', { name: /^Marlon/ }));

        expect(registros()).toHaveLength(5);
        expect(huesos(container)).toHaveLength(0);
    });
});
