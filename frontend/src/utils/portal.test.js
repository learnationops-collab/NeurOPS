import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const post = vi.fn();
vi.mock('../services/api', () => ({ default: { post: (...a) => post(...a) } }));
const bus = vi.hoisted(() => ({ abrirPortal: vi.fn() }));
vi.mock('../sesion/portalBus', () => bus);

import {
    areasDelGrupo, cambiarDeCuenta, cambiarDeRolEnLaCuenta, destinoDeEntrada, entrarAlIniciar, entrarPorTarjeta, fijarTarjetaPorDefecto, gruposDelPortal, hayPortal,
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
    post.mockReset(); bus.abrirPortal.mockReset(); localStorage.clear(); sessionStorage.clear();
    original = window.location;
    delete window.location;
    window.location = { href: '' };
});
afterEach(() => { window.location = original; });

describe('roles y áreas en el Portal', () => {
    it('un rol es un grupo y sus áreas son las tarjetas', () => {
        expect(claves(dir)).toEqual(['director_comercial:ventas', 'director_comercial:agendamiento']);
        const [g] = gruposDelPortal(dir);
        expect(g).toMatchObject({ clave: 'director_comercial', titulo: 'Dirección comercial' });
        expect(g.tarjetas[0]).toMatchObject({ titulo: 'Ventas', rol: 'director_comercial', ruta: '/admin/comercial' });
    });

    it('un grupo por rol y por cuenta vinculada; Finances es un área del rol con el que se entra', () => {
        const mario = { id: 3, role: 'operator', roles: ['operator', 'admin', 'closer'], can_view_finance: true };
        expect(gruposDelPortal(mario).map((g) => [g.titulo, g.tarjetas.map((t) => t.titulo)])).toEqual([
            ['Operador', ['Operaciones']],
            ['Administrador', ['Administración', 'Ventas', 'Agendamiento', 'Finances']],
            ['Closer', ['Cierres']],
        ]);
        expect(tarjetasDelPortal(mario).find((t) => t.titulo === 'Finances')).toMatchObject({ clave: 'admin:finanzas', rol: 'admin', ruta: '/finanzas' });
        expect(gruposDelPortal(marlon).at(-1)).toMatchObject({ clave: 'cuenta-2', titulo: 'Closer', detalle: 'Cuenta vinculada · marlon_closer' });
        expect(gruposDelPortal(marlon).at(-1).tarjetas[0]).toMatchObject({ clave: 'cuenta-2:cierres', titulo: 'Cierres', cuenta: 2 });
    });

    it('simulando, el Portal muestra solo el rol simulado, y no cuenta para entrar', () => {
        const sim = { id: 9, role: 'closer', roles: [], is_impersonating: true };
        expect(gruposDelPortal(sim).map((g) => g.titulo)).toEqual(['Closer']);
        expect(tarjetasDelPortal(sim)).toEqual([]);
    });

    it('un solo área (o simulando) no tiene que elegir al entrar', () => {
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

    it('a la pantalla de su rol; con un área por defecto del mismo rol, directo ahí', () => {
        expect(destinoDeEntrada(dir)).toBe('/admin/comercial');
        fijarTarjetaPorDefecto(dir, 'director_comercial:agendamiento');
        expect(tarjetaPorDefecto(dir).titulo).toBe('Agendamiento');
        expect(destinoDeEntrada(dir)).toBe('/agendas-v2');
        fijarTarjetaPorDefecto(dir, null);
        expect(destinoDeEntrada(dir)).toBe('/admin/comercial');
    });

    it('al iniciar sesión: con área por defecto entra ahí; si no, a su pantalla con el Portal abierto si hay que elegir', async () => {
        const navegar = vi.fn();
        entrarAlIniciar(dir, navegar);
        expect(navegar).toHaveBeenCalledWith('/admin/comercial');
        expect(bus.abrirPortal).toHaveBeenCalledTimes(1);

        entrarAlIniciar({ id: 1, role: 'closer', roles: ['closer'] }, navegar);
        expect(navegar).toHaveBeenLastCalledWith('/closer/deck?step=confirmations');
        expect(bus.abrirPortal).toHaveBeenCalledTimes(1);

        fijarTarjetaPorDefecto(dir, 'director_comercial:agendamiento');
        entrarAlIniciar(dir, navegar);
        expect(navegar).toHaveBeenLastCalledWith('/agendas-v2');
        expect(bus.abrirPortal).toHaveBeenCalledTimes(1);

        // Un área por defecto de una cuenta vinculada pasa a esa cuenta.
        post.mockResolvedValue({ data: { token: 'tk', user: { id: 2, role: 'closer' } } });
        fijarTarjetaPorDefecto(marlon, 'cuenta-2:cierres');
        await entrarAlIniciar(marlon, navegar);
        expect(post).toHaveBeenCalledWith('/auth/switch-role', { user_id: 2, isolated: false });
    });

    it('Cortex es un área común: está en todos los roles y entra sin cambiar de rol', () => {
        const navegar = vi.fn();
        const [g] = gruposDelPortal(dir);
        const cortex = areasDelGrupo(g).at(-1);
        expect(cortex).toMatchObject({ titulo: 'Cortex', ruta: '/cortex', comun: true });
        entrarPorTarjeta({ ...dir, role: 'closer' }, cortex, navegar);
        expect(navegar).toHaveBeenCalledWith('/cortex');
        expect(post).not.toHaveBeenCalled();
    });

    it('lee el área por defecto de antes (Dirección ahora es Ventas)', () => {
        localStorage.setItem('area_por_defecto_7_director_comercial', 'agendamiento');
        expect(destinoDeEntrada(dir)).toBe('/agendas-v2');
        localStorage.setItem('area_por_defecto_7_director_comercial', 'direccion');
        expect(destinoDeEntrada(dir)).toBe('/admin/comercial');
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
        await entrarPorTarjeta(mario, tarjetasDelPortal(mario).find((t) => t.clave === 'admin:finanzas'), vi.fn());
        expect(post).toHaveBeenCalledWith('/auth/switch-role', { role: 'admin', isolated: false });
        expect(JSON.parse(localStorage.getItem('user')).role).toBe('admin');
        expect(window.location.href).toBe('/finanzas');
    });

    it('con un área de una cuenta vinculada pasa a esa cuenta y entra a esa área', async () => {
        post.mockResolvedValue({ data: { token: 'tk', user: { id: 2, role: 'closer', username: 'marlon_closer' } } });
        await entrarPorTarjeta(marlon, tarjetasDelPortal(marlon)[2], vi.fn());
        expect(post).toHaveBeenCalledWith('/auth/switch-role', { user_id: 2, isolated: false });
        expect(localStorage.getItem('auth_token')).toBe('tk');
        expect(window.location.href).toBe('/closer/deck?step=confirmations');
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

describe('«Portal» en el menú', () => {
    it('está siempre (ahí están Cortex y Simular), abre el Portal encima y lleva lo pendiente del Playbook', () => {
        const [op] = opcionPortal({ id: 1, role: 'closer' }, 3);
        expect(op).toMatchObject({ label: 'Portal', cuenta: 3 });
        expect(op.titulo).toMatch(/3 videos pendientes del Playbook/);
        op.onClick();
        expect(bus.abrirPortal).toHaveBeenCalledTimes(1);
        expect(opcionPortal(dir)[0].cuenta).toBeNull();
        expect(opcionPortal(null)).toEqual([]);
    });
});
