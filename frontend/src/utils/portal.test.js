import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const post = vi.fn();
vi.mock('../services/api', () => ({ default: { post: (...a) => post(...a) } }));

import {
    cambiarDeCuenta, cambiarDeRolEnLaCuenta, destinoDeEntrada, entrarPorTarjeta, fijarTarjetaPorDefecto, hayPortal,
    opcionPortal, tarjetaPorDefecto, tarjetasDelPortal,
} from './portal';

const claves = (u) => tarjetasDelPortal(u).map((t) => t.clave);
const dir = { id: 7, role: 'director_comercial', roles: ['director_comercial'] };
const marlon = {
    id: 1, role: 'director_comercial', roles: ['director_comercial'],
    cuentas_vinculadas: [
        { id: 1, username: 'marlon_garcia', role: 'director_comercial', activa: true },
        { id: 2, username: 'marlon_closer', role: 'closer', activa: false },
    ],
};

let original;
beforeEach(() => {
    post.mockReset(); localStorage.clear(); sessionStorage.clear();
    original = window.location;
    delete window.location;
    window.location = { href: '' };
});
afterEach(() => { window.location = original; });

describe('las tarjetas del Portal', () => {
    it('un rol con varias áreas: una tarjeta por área', () => {
        expect(claves(dir)).toEqual(['director_comercial:direccion', 'director_comercial:agendamiento']);
        expect(tarjetasDelPortal(dir)[0]).toMatchObject({ titulo: 'Dirección', sobre: null, ruta: '/admin/comercial' });
    });

    it('roles, áreas, cuentas vinculadas y Finances en una sola elección', () => {
        const mario = { id: 3, role: 'operator', roles: ['operator', 'admin', 'closer'], can_view_finance: true };
        expect(claves(mario)).toEqual(['operator', 'admin:administracion', 'admin:direccion', 'admin:agendamiento', 'closer', 'finanzas']);
        // Con varios roles, cada área dice de qué rol es.
        expect(tarjetasDelPortal(mario)[1].sobre).toBe('Administrador');
        expect(tarjetasDelPortal(mario).at(-1)).toMatchObject({ titulo: 'Finances', rol: 'admin', ruta: '/finanzas' });
        expect(claves(marlon)).toEqual(['director_comercial:direccion', 'director_comercial:agendamiento', 'cuenta-2']);
        expect(tarjetasDelPortal(marlon)[2]).toMatchObject({ titulo: 'Closer', sobre: 'Cuenta vinculada', detalle: 'marlon_closer', cuenta: 2 });
    });

    it('un solo destino (o simulando) no tiene Portal', () => {
        expect(hayPortal({ id: 1, role: 'closer', roles: ['closer'] })).toBe(false);
        expect(hayPortal({ id: 1, role: 'closer', roles: ['closer'], can_view_finance: true })).toBe(false);
        expect(hayPortal({ ...dir, is_impersonating: true })).toBe(false);
        expect(hayPortal(null)).toBe(false);
        expect(hayPortal(dir)).toBe(true);
    });
});

describe('a dónde entra', () => {
    it('sin nada que elegir, a la pantalla de su rol; simulando, también', () => {
        expect(destinoDeEntrada({ id: 1, role: 'closer' })).toContain('/closer/deck');
        expect(destinoDeEntrada({ ...dir, is_impersonating: true })).toBe('/admin/comercial');
        expect(destinoDeEntrada(null)).toBe('/login');
    });

    it('con algo que elegir, al Portal; con una por defecto del mismo rol, directo ahí', () => {
        expect(destinoDeEntrada(dir)).toBe('/portal');
        fijarTarjetaPorDefecto(dir, 'director_comercial:agendamiento');
        expect(tarjetaPorDefecto(dir).titulo).toBe('Agendamiento');
        expect(destinoDeEntrada(dir)).toBe('/agendas-v2');
        fijarTarjetaPorDefecto(dir, null);
        expect(destinoDeEntrada(dir)).toBe('/portal');
    });

    it('si la por defecto es de otro rol o cuenta, va al Portal (que entra solo)', () => {
        fijarTarjetaPorDefecto(marlon, 'cuenta-2');
        expect(destinoDeEntrada(marlon)).toBe('/portal');
    });

    it('lee el área por defecto de antes', () => {
        localStorage.setItem('area_por_defecto_7_director_comercial', 'agendamiento');
        expect(destinoDeEntrada(dir)).toBe('/agendas-v2');
        fijarTarjetaPorDefecto(dir, 'director_comercial:direccion');
        expect(localStorage.getItem('area_por_defecto_7_director_comercial')).toBeNull();
    });

    it('una por defecto que ya no tiene no cuenta', () => {
        fijarTarjetaPorDefecto(dir, 'admin:direccion');
        expect(tarjetaPorDefecto(dir)).toBeNull();
    });
});

describe('entrar por una tarjeta', () => {
    it('con el rol que ya tiene solo navega', () => {
        const navegar = vi.fn();
        entrarPorTarjeta(dir, tarjetasDelPortal(dir)[1], navegar);
        expect(navegar).toHaveBeenCalledWith('/agendas-v2');
        expect(post).not.toHaveBeenCalled();
    });

    it('con otro rol de la cuenta lo activa y va a esa ruta', async () => {
        post.mockResolvedValue({ data: { token: 'tk', user: { id: 3, role: 'admin', roles: ['operator', 'admin'] } } });
        const mario = { id: 3, role: 'operator', roles: ['operator', 'admin'], can_view_finance: true };
        await entrarPorTarjeta(mario, tarjetasDelPortal(mario).find((t) => t.clave === 'finanzas'), vi.fn());
        expect(post).toHaveBeenCalledWith('/auth/switch-role', { role: 'admin', isolated: false });
        expect(JSON.parse(localStorage.getItem('user')).role).toBe('admin');
        expect(window.location.href).toBe('/finanzas');
    });

    it('con una cuenta vinculada pasa a esa cuenta y entra a donde entra ella', async () => {
        post.mockResolvedValue({ data: { token: 'tk', user: { id: 2, role: 'closer', username: 'marlon_closer' } } });
        await entrarPorTarjeta(marlon, tarjetasDelPortal(marlon)[2], vi.fn());
        expect(post).toHaveBeenCalledWith('/auth/switch-role', { user_id: 2, isolated: false });
        expect(localStorage.getItem('auth_token')).toBe('tk');
        expect(window.location.href).toContain('/closer/deck');
    });

    it('en una pestaña aislada pide el cambio aislado', async () => {
        sessionStorage.setItem('auth_token', 'viejo');
        post.mockResolvedValue({ data: { token: 'tk', user: { id: 2, role: 'closer' } } });
        await cambiarDeCuenta(2);
        expect(post).toHaveBeenCalledWith('/auth/switch-role', { user_id: 2, isolated: true });
        expect(sessionStorage.getItem('auth_token')).toBe('tk');
        post.mockResolvedValue({ data: { token: 'tk2', user: { id: 1, role: 'closer' } } });
        await cambiarDeRolEnLaCuenta('closer');
        expect(post).toHaveBeenLastCalledWith('/auth/switch-role', { role: 'closer', isolated: true });
    });
});

describe('«Cambiar de vista» del menú', () => {
    it('vuelve al Portal aunque haya una por defecto, solo si hay algo que elegir', () => {
        const navegar = vi.fn();
        const [op] = opcionPortal(dir, navegar);
        expect(op.label).toBe('Cambiar de vista');
        op.onClick();
        expect(navegar).toHaveBeenCalledWith('/portal?elegir=1');
        expect(opcionPortal({ id: 1, role: 'closer' }, navegar)).toEqual([]);
        expect(opcionPortal({ ...dir, is_impersonating: true }, navegar)).toEqual([]);
    });
});
