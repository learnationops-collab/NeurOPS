import { describe, it, expect, vi, beforeEach } from 'vitest';

const post = vi.fn();
vi.mock('../services/api', () => ({ default: { post: (...a) => post(...a) } }));

import {
    otrasCuentas, otrosRoles, opcionesDeRol, cambiarDeRol, cambiarDeRolEnLaCuenta, rotuloDeRol, rolDeFinanzas,
    opcionesDeFinanzas, RUTA_FINANZAS, TITULO_FINANZAS, hayQueElegir,
} from './cuentasVinculadas';

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
        expect(opcionesDeRol(marlon).map((o) => o.label)).toEqual(['Cambiar de vista', 'Pasar a Closer']);
    });

    it('«Cambiar de vista» lleva al hub, /vistas, a quien tiene más de una tarjeta', () => {
        const navegar = vi.fn();
        const [hub] = opcionesDeRol(marlon, () => {}, navegar);
        expect(hub.label).toBe('Cambiar de vista');
        hub.onClick();
        expect(navegar).toHaveBeenCalledWith('/vistas');

        // Un rol que además ve Finances también tiene dos tarjetas.
        const direccion = { id: 4, role: 'director_comercial', roles: ['director_comercial'], can_view_finance: true };
        expect(opcionesDeRol(direccion).map((o) => o.label)).toEqual(['Cambiar de vista']);
        expect(opcionesDeRol({ ...direccion, can_view_finance: false })).toEqual([]);
        expect(opcionesDeRol({ ...direccion, is_impersonating: true })).toEqual([]);
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

    describe('varios roles en una sola cuenta', () => {
        const unico = { id: 1, role: 'director_comercial', roles: ['director_comercial', 'closer'] };

        it('ofrece los otros roles de la misma cuenta', () => {
            expect(otrosRoles(unico)).toEqual(['closer']);
            expect(opcionesDeRol(unico).map((o) => o.label)).toEqual(['Cambiar de vista', 'Pasar a Closer']);
        });

        it('con un solo rol, o simulando a otro, no ofrece nada', () => {
            expect(otrosRoles({ id: 2, role: 'closer', roles: ['closer'] })).toEqual([]);
            expect(otrosRoles({ ...unico, is_impersonating: true })).toEqual([]);
            expect(opcionesDeRol({ id: 2, role: 'closer' })).toEqual([]);
        });

        it('al cambiar pide el rol, guarda la sesión y entra a la pantalla de ese rol', async () => {
            post.mockResolvedValue({ data: { token: 'tk', user: { id: 1, role: 'closer', roles: unico.roles } } });
            const original = window.location;
            delete window.location;
            window.location = { href: '' };

            await cambiarDeRolEnLaCuenta('closer');

            expect(post).toHaveBeenCalledWith('/auth/switch-role', { role: 'closer', isolated: false });
            expect(JSON.parse(localStorage.getItem('user')).role).toBe('closer');
            expect(window.location.href).toContain('/closer/deck');
            window.location = original;
        });

        it('con `destino` entra ahí en vez de a la pantalla del rol (la tarjeta «Finances»)', async () => {
            post.mockResolvedValue({ data: { token: 'tk', user: { id: 1, role: 'admin', roles: ['operator', 'admin'] } } });
            const original = window.location;
            delete window.location;
            window.location = { href: '' };

            await cambiarDeRolEnLaCuenta('admin', '/finanzas');

            expect(post).toHaveBeenCalledWith('/auth/switch-role', { role: 'admin', isolated: false });
            expect(window.location.href).toBe('/finanzas');
            window.location = original;
        });
    });

    describe('Finances', () => {
        it('entra con admin o dirección comercial, y solo con «ver finanzas»', () => {
            expect(rolDeFinanzas(['operator', 'admin'], true)).toBe('admin');
            expect(rolDeFinanzas(['director_comercial'], true)).toBe('director_comercial');
            expect(rolDeFinanzas(['operator', 'admin'], false)).toBeNull();
            expect(rolDeFinanzas(['closer', 'setter'], true)).toBeNull();
            expect(rolDeFinanzas(undefined, true)).toBeNull();
        });

        it('hay que elegir con varios roles, con cuentas vinculadas o con un rol que ve Finances', () => {
            expect(hayQueElegir({ id: 1, role: 'director_comercial', roles: ['director_comercial', 'closer'] })).toBe(true);
            expect(hayQueElegir(marlon)).toBe(true);
            expect(hayQueElegir({ id: 1, role: 'director_comercial', roles: ['director_comercial'], can_view_finance: true })).toBe(true);
            expect(hayQueElegir({ id: 1, role: 'director_comercial', roles: ['director_comercial'], can_view_finance: false })).toBe(false);
            expect(hayQueElegir({ id: 1, role: 'closer', can_view_finance: true })).toBe(false);
            expect(hayQueElegir(null)).toBe(false);
        });

        it('la tarjeta se llama «Finances» y va a /finanzas', () => {
            expect(TITULO_FINANZAS).toBe('Finances');
            expect(RUTA_FINANZAS).toBe('/finanzas');
        });

        it('el menú de sesión ofrece «Pasar a Finances» solo a quien la ve con el rol con el que está', () => {
            const navegar = vi.fn();
            const [ir] = opcionesDeFinanzas({ id: 1, role: 'director_comercial', can_view_finance: true }, navegar);
            expect(ir.label).toBe('Pasar a Finances');
            ir.onClick();
            expect(navegar).toHaveBeenCalledWith('/finanzas');

            expect(opcionesDeFinanzas({ id: 1, role: 'director_comercial', can_view_finance: false }, navegar)).toEqual([]);
            expect(opcionesDeFinanzas({ id: 1, role: 'operator', roles: ['operator', 'admin'], can_view_finance: true }, navegar)).toEqual([]);
            expect(opcionesDeFinanzas(null, navegar)).toEqual([]);
            // Lo que diga el backend manda sobre la sesión guardada.
            expect(opcionesDeFinanzas({ id: 1, role: 'admin' }, navegar, { puede: true })).toHaveLength(1);
        });

        it('en /finanzas ofrece la vuelta a la pantalla del rol', () => {
            const navegar = vi.fn();
            const [volver] = opcionesDeFinanzas({ id: 1, role: 'director_comercial' }, navegar, { enFinanzas: true });
            expect(volver.label).toBe('Pasar a Dirección comercial');
            volver.onClick();
            expect(navegar).toHaveBeenCalledWith('/admin/comercial');
        });
    });
});
