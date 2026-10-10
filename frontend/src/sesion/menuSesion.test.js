import { describe, expect, it, vi } from 'vitest';
import { armarMenuSesion, rotuloDeSesion } from './menuSesion';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const ids = (grupos) => grupos.map(g => g.map(o => o.id));
const base = (user, extra = {}) => armarMenuSesion({ user, navigate: vi.fn(), logout: vi.fn(), configuracion: { onClick: vi.fn() }, ...extra });

describe('menú de sesión', () => {
    it('siempre los mismos grupos y en el mismo orden: acciones, cuenta, ir a, equipo, salida', () => {
        const grupos = base({ role: 'setter' }, {
            acciones: [{ id: 'links' }],
            playbook: { onClick: vi.fn(), pendientes: 0 },
        });
        expect(ids(grupos)).toEqual([['links'], ['configuracion', 'playbook'], [], [], ['salir']]);
    });

    it('Configuración está en todas las pantallas, con «!» y el detalle si falta algo', () => {
        const [, cuenta] = base({ role: 'closer' }, { configuracion: { onClick: vi.fn(), avisos: ['Google Calendar sin conectar', false] } });
        expect(cuenta[0]).toMatchObject({ id: 'configuracion', label: 'Configuración', cuenta: '!', titulo: 'Google Calendar sin conectar' });
    });

    it('simular a un closer o setter solo para quien puede, mirando el rol real', () => {
        expect(ids(base({ role: 'closer' }))[3]).toEqual([]);
        expect(ids(base({ role: 'director_comercial' }))[3]).toEqual(['simular', 'simular-setter']);
        // simulando a un closer, la dirección sigue pudiendo pasar a otro
        expect(ids(base({ role: 'closer', is_impersonating: true, original_user_role: 'director_comercial' }))[3])
            .toEqual(['simular', 'simular-setter']);
    });

    it('simulando: «Volver a mi sesión» antes de cerrar sesión, y el rótulo lo dice', () => {
        const user = { role: 'closer', is_impersonating: true, original_user_role: 'admin' };
        expect(ids(base(user))[4]).toEqual(['volver', 'salir']);
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
