import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subirACapa } from './capa';
import { Select } from './index';
import { PillMenu } from '../../pages/comercial/components/Shared';

/**
 * jsdom no tiene la Popover API: se simula lo justo (showPopover y `:popover-open`) para ver que
 * los menús PIDEN la capa superior. Que el navegador los pinte encima de todo es cosa suya.
 */
const abiertos = new WeakSet();
const matchesOriginal = Element.prototype.matches;

beforeEach(() => {
    HTMLElement.prototype.showPopover = vi.fn(function showPopover() { abiertos.add(this); });
    Element.prototype.matches = function matches(sel) {
        return sel === ':popover-open' ? abiertos.has(this) : matchesOriginal.call(this, sel);
    };
});

afterEach(() => {
    delete HTMLElement.prototype.showPopover;
    Element.prototype.matches = matchesOriginal;
    vi.restoreAllMocks();
});

describe('subirACapa', () => {
    it('lo vuelve un popover manual, lo marca para el reset y lo muestra una sola vez', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);
        expect(subirACapa(el)).toBe(true);
        expect(subirACapa(el)).toBe(true);
        expect(el.getAttribute('popover')).toBe('manual');
        expect(el.hasAttribute('data-ui-capa')).toBe(true);
        expect(HTMLElement.prototype.showPopover).toHaveBeenCalledTimes(1);
        el.remove();
    });

    it('sin la API (navegador viejo) o fuera del documento no hace nada', () => {
        const suelto = document.createElement('div');
        expect(subirACapa(suelto)).toBe(false);
        delete HTMLElement.prototype.showPopover;
        const el = document.createElement('div');
        document.body.appendChild(el);
        expect(subirACapa(el)).toBe(false);
        expect(el.hasAttribute('popover')).toBe(false);
        el.remove();
    });
});

describe('los menús piden la capa superior', () => {
    it('la lista de un Select', () => {
        render(<Select label="Closer" value="a" onChange={() => {}} options={[{ value: 'a', label: 'Ana' }, { value: 'b', label: 'Beto' }]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Closer' }));
        // `hidden`: jsdom aplica el `display:none` de fábrica de un popover (no sabe de `:popover-open`).
        expect(screen.getByRole('listbox', { hidden: true })).toHaveAttribute('popover', 'manual');
    });

    it('el menú de una pastilla (Workshop › Resumen), anclado bajo su borde derecho', () => {
        // jsdom no tiene layout: el menú es `absolute` y su ancla es la caja de la pastilla.
        const estilo = window.getComputedStyle;
        vi.spyOn(window, 'getComputedStyle').mockImplementation((el, pseudo) => {
            const s = estilo(el, pseudo);
            if (el.getAttribute('role') !== 'menu') return s;
            return new Proxy(s, {
                get: (t, k) => (k === 'position' ? 'absolute' : k === 'maxHeight' ? 'none' : typeof t[k] === 'function' ? t[k].bind(t) : t[k]),
            });
        });
        vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockImplementation(function ancla() { return this.parentElement; });
        vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(46);
        vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockReturnValue(19);
        vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(240);
        vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(259);
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 24, top: 184, right: 283, bottom: 222, width: 259, height: 38 });
        Object.defineProperty(document.documentElement, 'clientWidth', { value: 1440, configurable: true });
        Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });

        render(<PillMenu texto="Todos los talleres" rotulo="talleres" valor="todos" onChange={() => {}}
            opciones={[{ key: 'todos', label: 'Todos los talleres' }, { key: 'ultimos3', label: 'Últimos 3' }]} />);
        fireEvent.click(screen.getByRole('button', { name: /Todos los talleres/ }));
        const menu = screen.getByRole('menu', { hidden: true });
        expect(menu).toHaveAttribute('popover', 'manual');
        expect(menu.style.position).toBe('fixed');
        expect(menu.style.top).toBe('230px');
        expect(menu.style.left).toBe('43px');
    });
});
