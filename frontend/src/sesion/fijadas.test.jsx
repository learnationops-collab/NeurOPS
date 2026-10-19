import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CalendarPlus, LogOut, Sparkles, Users } from 'lucide-react';
import DockSecciones from '../pages/comercial/components/DockSecciones';
import MenuSesion from '../pages/comercial/components/MenuSesion';
import { _olvidarFijadas, esFijable } from './fijadas';

const sesion = vi.hoisted(() => ({ auth: { user: null } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => sesion.auth }));
vi.mock('../services/api', () => ({ default: { put: vi.fn() } }));

/**
 * Fijar acciones del menú de sesión en el dock: se fija desde el menú, aparece a la izquierda del dock
 * con la acción de esa pantalla y queda guardado en el navegador por cuenta. Learnito viene fijado de
 * fábrica para los closers.
 */
const acciones = { agenda: vi.fn(), learnito: vi.fn(), salir: vi.fn() };
const grupos = [
    [
        { id: 'agenda', label: 'Nueva agenda', Icono: CalendarPlus, onClick: acciones.agenda },
        { id: 'learnito', label: 'Learnito', Icono: Sparkles, onClick: acciones.learnito },
    ],
    [{ id: 'salir', label: 'Cerrar sesión', Icono: LogOut, peligro: true, onClick: acciones.salir }],
];
const SECCIONES = [{ id: 'uno', label: 'Uno', Icono: Users }];

const renderDock = () => render(
    <DockSecciones secciones={SECCIONES} activa="uno" onElegir={() => {}} ariaLabel="Secciones"
        despues={<MenuSesion nombre="Ana" rol="Closer" grupos={grupos} />} />,
);
const fijadas = () => screen.queryByRole('group', { name: 'Accesos fijados' });

describe('acciones fijadas en el dock', () => {
    beforeEach(() => {
        window.localStorage.clear();
        _olvidarFijadas();
        Object.values(acciones).forEach((fn) => fn.mockClear());
    });

    it('un closer arranca con Learnito fijado y tocarlo corre la acción', () => {
        sesion.auth = { user: { id: 7, role: 'closer' } };
        renderDock();

        fireEvent.click(screen.getByRole('button', { name: 'Learnito' }));

        expect(fijadas()).not.toBeNull();
        expect(acciones.learnito).toHaveBeenCalledTimes(1);
    });

    it('otro rol arranca sin fijadas; fijar desde el menú la agrega y lo guarda', () => {
        sesion.auth = { user: { id: 8, role: 'admin' } };
        renderDock();
        expect(fijadas()).toBeNull();

        fireEvent.click(screen.getByRole('button', { name: /Tu sesión/ }));
        act(() => { fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Fijar Nueva agenda en el dock' })); });

        expect(screen.getByRole('menuitemcheckbox', { name: 'Quitar Nueva agenda del dock' }).getAttribute('aria-checked')).toBe('true');
        expect(fijadas()).not.toBeNull();
        expect(JSON.parse(window.localStorage.getItem('dock-fijadas:8'))).toEqual(['agenda']);
    });

    it('desfijar todo no vuelve a poner las de fábrica', () => {
        sesion.auth = { user: { id: 9, role: 'closer' } };
        renderDock();

        fireEvent.click(screen.getByRole('button', { name: /Tu sesión/ }));
        act(() => { fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Quitar Learnito del dock' })); });
        _olvidarFijadas();

        expect(JSON.parse(window.localStorage.getItem('dock-fijadas:9'))).toEqual([]);
        expect(fijadas()).toBeNull();
    });

    it('cerrar sesión no se puede fijar', () => {
        sesion.auth = { user: { id: 10, role: 'closer' } };
        renderDock();

        fireEvent.click(screen.getByRole('button', { name: /Tu sesión/ }));

        expect(screen.queryByRole('menuitemcheckbox', { name: /Cerrar sesión/ })).toBeNull();
        expect(esFijable({ id: 'salir', onClick: () => {} })).toBe(false);
        expect(esFijable({ id: 'simular', onClick: () => {}, panel: {} })).toBe(false);
    });
});
