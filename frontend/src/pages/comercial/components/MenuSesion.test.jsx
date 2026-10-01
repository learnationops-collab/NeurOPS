import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CalendarPlus, Compass, LogOut } from 'lucide-react';
import MenuSesion from './MenuSesion';

/**
 * La sesión al final del dock: lo que antes eran botones del header del mazo. Lo que importa es
 * que se pueda abrir y usar con el teclado, que elegir cierre el menú antes de correr la acción
 * (un modal que abre la opción no puede quedar debajo) y que lo pendiente no se esconda adentro.
 */
const grupos = (acciones) => [
    [{ id: 'agenda', label: 'Nueva agenda', Icono: CalendarPlus, onClick: acciones.agenda }],
    [{ id: 'playbook', label: 'Playbook', Icono: Compass, cuenta: 5, titulo: '5 pendientes', onClick: acciones.playbook }],
    [{ id: 'salir', label: 'Cerrar sesión', Icono: LogOut, peligro: true, onClick: acciones.salir }],
];

const renderMenu = (acciones = { agenda: vi.fn(), playbook: vi.fn(), salir: vi.fn() }, aviso = null) => {
    render(<MenuSesion nombre="Marlon Closer" rol="Closer" aviso={aviso} grupos={grupos(acciones)} />);
    return acciones;
};

describe('MenuSesion', () => {
    it('el botón es el avatar, dice de quién es la sesión y lleva la cuenta de lo pendiente', () => {
        renderMenu(undefined, { texto: 5, titulo: '5 videos pendientes del Playbook' });
        const boton = screen.getByRole('button', { name: 'Tu sesión: Marlon Closer, 5 videos pendientes del Playbook' });
        expect(boton.querySelector('.avatar').textContent).toBe('MC');
        expect(boton.querySelector('.dock-sesion-aviso').textContent).toBe('5');
        expect(boton.getAttribute('aria-expanded')).toBe('false');
    });

    it('abre con las opciones en grupos, y el foco entra a la primera', async () => {
        renderMenu();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tu sesión: Marlon Closer' })); });
        const menu = screen.getByRole('menu', { name: 'Tu sesión' });
        expect(menu.textContent).toContain('Marlon Closer');
        expect(screen.getAllByRole('group')).toHaveLength(3);
        expect(screen.getAllByRole('menuitem').map(i => i.getAttribute('aria-label') || i.textContent))
            .toEqual(['Nueva agenda', 'Playbook, 5 pendientes', 'Cerrar sesión']);
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Nueva agenda' }));
    });

    it('las flechas recorren las opciones, en círculo', async () => {
        renderMenu();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tu sesión: Marlon Closer' })); });
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        expect(document.activeElement.getAttribute('aria-label')).toBe('Playbook, 5 pendientes');
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        expect(document.activeElement.textContent).toBe('Nueva agenda');
        fireEvent.keyDown(document, { key: 'ArrowUp' });
        expect(document.activeElement.textContent).toBe('Cerrar sesión');
    });

    it('elegir cierra el menú y después corre la acción', async () => {
        const acciones = renderMenu();
        acciones.agenda.mockImplementation(() => {
            expect(screen.queryByRole('menu')).toBeNull();
        });
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tu sesión: Marlon Closer' })); });
        fireEvent.click(screen.getByRole('menuitem', { name: 'Nueva agenda' }));
        expect(acciones.agenda).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('Escape cierra y devuelve el foco al avatar; tocar afuera también cierra', async () => {
        renderMenu();
        const boton = screen.getByRole('button', { name: 'Tu sesión: Marlon Closer' });
        await act(async () => { fireEvent.click(boton); });
        fireEvent.keyDown(document, { key: 'Escape' });
        expect(screen.queryByRole('menu')).toBeNull();
        expect(document.activeElement).toBe(boton);

        await act(async () => { fireEvent.click(boton); });
        fireEvent.pointerDown(document.body);
        expect(screen.queryByRole('menu')).toBeNull();
    });
});
