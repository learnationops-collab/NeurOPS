import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CalendarPlus, Compass, LogOut } from 'lucide-react';
import MenuSesion from './MenuSesion';
import { BUG_REPORT_VISTA_EVENT, publicarEstadoDeReportes } from '../../../utils/bugReportBus';

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
    beforeEach(() => publicarEstadoDeReportes({ sinLeer: 0, enProgreso: false }));

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
        expect(screen.getAllByRole('group')).toHaveLength(4);
        // «Reportar un problema» y «Mis reportes» se agregan solos, antes del último grupo (cerrar sesión).
        expect(screen.getAllByRole('menuitem').map(i => i.getAttribute('aria-label') || i.textContent))
            .toEqual(['Nueva agenda', 'Playbook, 5 pendientes', 'Reportar un problema', 'Mis reportes', 'Cerrar sesión']);
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Nueva agenda' }));
    });

    it('las flechas recorren las opciones, en círculo', async () => {
        renderMenu();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tu sesión: Marlon Closer' })); });
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        expect(document.activeElement.getAttribute('aria-label')).toBe('Playbook, 5 pendientes');
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        fireEvent.keyDown(document, { key: 'ArrowDown' });
        expect(document.activeElement.textContent).toBe('Nueva agenda');
        fireEvent.keyDown(document, { key: 'ArrowUp' });
        expect(document.activeElement.textContent).toBe('Cerrar sesión');
    });

    it('«Reportar un problema» y «Mis reportes» le piden al widget que abra su vista', async () => {
        const pedidos = [];
        const alPedir = (e) => pedidos.push(e.detail.vista);
        window.addEventListener(BUG_REPORT_VISTA_EVENT, alPedir);
        renderMenu();

        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tu sesión: Marlon Closer' })); });
        fireEvent.click(screen.getByRole('menuitem', { name: 'Reportar un problema' }));
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tu sesión: Marlon Closer' })); });
        fireEvent.click(screen.getByRole('menuitem', { name: 'Mis reportes' }));

        window.removeEventListener(BUG_REPORT_VISTA_EVENT, alPedir);
        expect(pedidos).toEqual(['chat', 'historial']);
    });

    it('las respuestas sin leer a tus reportes se suman a la cuenta del avatar y se ven en el menú', async () => {
        publicarEstadoDeReportes({ sinLeer: 2, enProgreso: false });
        renderMenu(undefined, { texto: 5, titulo: '5 videos pendientes del Playbook' });
        const boton = screen.getByRole('button', {
            name: 'Tu sesión: Marlon Closer, 5 videos pendientes del Playbook, 2 respuestas sin leer a tus reportes',
        });
        expect(boton.querySelector('.dock-sesion-aviso').textContent).toBe('7');

        await act(async () => { fireEvent.click(boton); });
        expect(screen.getByRole('menuitem', { name: 'Mis reportes, 2 respuestas sin leer' }).textContent).toContain('2');

        publicarEstadoDeReportes({ sinLeer: 0, enProgreso: true });
    });

    it('con un reporte a medias el menú ofrece retomarlo', async () => {
        publicarEstadoDeReportes({ sinLeer: 0, enProgreso: true });
        renderMenu();
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tu sesión: Marlon Closer' })); });
        expect(screen.getByRole('menuitem', { name: 'Continuar reporte en progreso' })).toBeTruthy();
        expect(screen.queryByRole('menuitem', { name: 'Reportar un problema' })).toBeNull();
        publicarEstadoDeReportes({ sinLeer: 0, enProgreso: false });
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

    it('una opción con panel abre su lista en el mismo menú, y elegir de la lista corre esa acción', async () => {
        const simularA = vi.fn();
        let resolver;
        const cargar = vi.fn(() => new Promise((r) => { resolver = r; }));
        render(<MenuSesion nombre="Dirección" grupos={[[{
            id: 'simular', label: 'Simular a un closer', Icono: CalendarPlus,
            panel: { titulo: 'Simular a un closer', vacio: 'No hay closers activos.', cargar },
        }]]} />);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tu sesión: Dirección' })); });

        const opcion = screen.getByRole('menuitem', { name: 'Simular a un closer' });
        expect(opcion.getAttribute('aria-haspopup')).toBe('menu');
        await act(async () => { fireEvent.click(opcion); });
        // El menú sigue abierto, con la vuelta arriba y la lista cargando.
        expect(screen.getByRole('menu')).toBeTruthy();
        expect(cargar).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('group', { name: 'Simular a un closer' }).getAttribute('aria-busy')).toBe('true');
        expect(screen.getByText('Cargando…')).toBeTruthy();
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Volver al menú. Simular a un closer' }));

        await act(async () => { resolver([{ id: 7, label: 'Marlon Closer', onClick: () => simularA(7) }]); });
        const marlon = screen.getByRole('menuitem', { name: 'Marlon Closer' });
        expect(document.activeElement).toBe(marlon);
        fireEvent.click(marlon);
        expect(simularA).toHaveBeenCalledWith(7);
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('en el panel, Escape vuelve al menú (a la opción que lo abrió); la lista vacía y el error se dicen', async () => {
        const cargar = vi.fn()
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error('caído'))
            .mockResolvedValueOnce([{ id: 1, label: 'Ana', onClick: () => {} }]);
        render(<MenuSesion nombre="Dirección" grupos={[[
            { id: 'otra', label: 'Otra cosa', Icono: Compass, onClick: () => {} },
            { id: 'simular', label: 'Simular a un closer', Icono: CalendarPlus,
                panel: { titulo: 'Simular a un closer', vacio: 'No hay closers activos.', cargar } },
        ]]} />);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tu sesión: Dirección' })); });

        await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Simular a un closer' })); });
        expect(screen.getByText('No hay closers activos.')).toBeTruthy();

        await act(async () => { fireEvent.keyDown(document, { key: 'Escape' }); });
        expect(screen.getByRole('menu')).toBeTruthy(); // no se cerró: volvió
        expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Simular a un closer' }));

        await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Simular a un closer' })); });
        expect(screen.getByText('No se pudo cargar la lista.')).toBeTruthy();
        await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Reintentar' })); });
        expect(screen.getByRole('menuitem', { name: 'Ana' })).toBeTruthy();
        expect(cargar).toHaveBeenCalledTimes(3);
    });

    it('una lista que llega tarde, después de volver al menú, no se muestra', async () => {
        let resolver;
        const cargar = () => new Promise((r) => { resolver = r; });
        render(<MenuSesion nombre="Dirección" grupos={[[{
            id: 'simular', label: 'Simular a un closer', Icono: CalendarPlus,
            panel: { titulo: 'Simular a un closer', vacio: 'Nadie.', cargar },
        }]]} />);
        await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Tu sesión: Dirección' })); });
        await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Simular a un closer' })); });
        await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Volver al menú. Simular a un closer' })); });

        await act(async () => { resolver([{ id: 1, label: 'Ana', onClick: () => {} }]); });

        expect(screen.queryByRole('menuitem', { name: 'Ana' })).toBeNull();
        expect(screen.getByRole('menuitem', { name: 'Simular a un closer' })).toBeTruthy();
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
