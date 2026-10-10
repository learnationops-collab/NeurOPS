import { describe, expect, it, vi } from 'vitest';
import { armarMenuSesion, rotuloDeSesion } from './menuSesion';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const bus = vi.hoisted(() => ({ abrirPortal: vi.fn() }));
vi.mock('./portalBus', () => bus);

const ids = (grupos) => grupos.map(g => g.map(o => o.id));
const base = (user, extra = {}) => armarMenuSesion({ user, navigate: vi.fn(), logout: vi.fn(), configuracion: { onClick: vi.fn() }, ...extra });

describe('menú de sesión', () => {
    it('siempre los mismos grupos y en el mismo orden: acciones, cuenta (Configuración y Portal), salida', () => {
        const grupos = base({ role: 'setter' }, { acciones: [{ id: 'links' }], playbook: { pendientes: 0 } });
        expect(ids(grupos)).toEqual([['links'], ['configuracion', 'portal'], ['salir']]);
    });

    it('nada de cambiar de rol, de área, simular ni Playbook sueltos: todo eso está en el Portal', () => {
        for (const role of ['admin', 'director_comercial', 'operator', 'closer']) {
            expect(ids(base({ role, roles: [role, 'closer'] })).flat()).toEqual(['configuracion', 'portal', 'salir']);
        }
    });

    it('lo pendiente del Playbook (ahora en Cortex) se ve en «Portal»', () => {
        const [, cuenta] = base({ role: 'closer' }, { playbook: { pendientes: 4 } });
        expect(cuenta[1]).toMatchObject({ label: 'Portal', cuenta: 4 });
        const navigate = vi.fn();
        armarMenuSesion({ user: { role: 'closer' }, navigate, logout: vi.fn(), configuracion: {} })[1][1].onClick();
        // El Portal se abre encima de la pantalla: no navega.
        expect(bus.abrirPortal).toHaveBeenCalledTimes(1);
        expect(navigate).not.toHaveBeenCalled();
    });

    it('Configuración está en todas las pantallas, con «!» y el detalle si falta algo', () => {
        const [, cuenta] = base({ role: 'closer' }, { configuracion: { onClick: vi.fn(), avisos: ['Google Calendar sin conectar', false] } });
        expect(cuenta[0]).toMatchObject({ id: 'configuracion', label: 'Configuración', cuenta: '!', titulo: 'Google Calendar sin conectar' });
    });

    it('una pantalla puede sumar a dónde ir, después de «Portal»', () => {
        const [, cuenta] = base({ role: 'admin' }, { ir: [{ id: 'admin' }] });
        expect(cuenta.map(o => o.id)).toEqual(['configuracion', 'portal', 'admin']);
    });

    it('simulando: «Volver a mi sesión» antes de cerrar sesión, y el rótulo lo dice', () => {
        const user = { role: 'closer', is_impersonating: true, original_user_role: 'admin' };
        expect(ids(base(user)).at(-1)).toEqual(['volver', 'salir']);
        expect(rotuloDeSesion(user)).toBe('Closer · simulación');
        expect(rotuloDeSesion({ role: 'admin' }, 'Hiring')).toBe('Hiring');
    });

    it('cerrar sesión siempre pide confirmación', () => {
        const logout = vi.fn();
        const salir = armarMenuSesion({ user: { role: 'setter' }, navigate: vi.fn(), logout, configuracion: {} }).at(-1).at(-1);
        vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
        salir.onClick();
        expect(logout).not.toHaveBeenCalled();
        salir.onClick();
        expect(logout).toHaveBeenCalledTimes(1);
    });
});
