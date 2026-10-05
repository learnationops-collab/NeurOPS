import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
vi.mock('../services/api', () => ({ default: { post: (...a) => post(...a) } }));

import { otrasCuentas, opcionesDeRol, cambiarDeRol, rotuloDeRol } from './cuentasVinculadas';

const marlon = {
    id: 1, role: 'director_comercial',
    cuentas_vinculadas: [
        { id: 1, username: 'marlon_garcia', role: 'director_comercial', activa: true },
        { id: 2, username: 'marlon_closer', role: 'closer', activa: false },
    ],
};

describe('cuentas vinculadas', () => {
    beforeEach(() => { post.mockReset(); sessionStorage.clear(); localStorage.clear(); });

    it('ofrece solo las otras cuentas de la persona', () => {
        expect(otrasCuentas(marlon).map((c) => c.id)).toEqual([2]);
        expect(opcionesDeRol(marlon).map((o) => o.label)).toEqual(['Pasar a Closer']);
    });

    it('no ofrece nada sin vínculos ni mientras se simula a otro usuario', () => {
        expect(opcionesDeRol({ id: 5, role: 'closer' })).toEqual([]);
        expect(opcionesDeRol(null)).toEqual([]);
        expect(opcionesDeRol({ ...marlon, is_impersonating: true })).toEqual([]);
    });

    it('rotula los roles y deja pasar los desconocidos', () => {
        expect(rotuloDeRol('director_comercial')).toBe('Dirección comercial');
        expect(rotuloDeRol('nuevo')).toBe('nuevo');
    });

    it('al cambiar guarda la sesión de la otra cuenta, sin tocar la cookie en una pestaña normal', async () => {
        post.mockResolvedValue({ data: { token: 'tk', user: { id: 2, role: 'closer', username: 'marlon_closer' } } });
        const original = window.location;
        delete window.location;
        window.location = { href: '' };

        await cambiarDeRol(2);

        expect(post).toHaveBeenCalledWith('/auth/switch-role', { user_id: 2, isolated: false });
        expect(JSON.parse(localStorage.getItem('user')).role).toBe('closer');
        expect(localStorage.getItem('auth_token')).toBe('tk');
        expect(window.location.href).toContain('/closer/deck');
        window.location = original;
    });

    it('en una pestaña aislada pide el cambio aislado', async () => {
        sessionStorage.setItem('auth_token', 'viejo');
        post.mockResolvedValue({ data: { token: 'tk', user: { id: 2, role: 'closer' } } });
        const original = window.location;
        delete window.location;
        window.location = { href: '' };

        await cambiarDeRol(2);

        expect(post).toHaveBeenCalledWith('/auth/switch-role', { user_id: 2, isolated: true });
        expect(sessionStorage.getItem('auth_token')).toBe('tk');
        window.location = original;
    });
});
