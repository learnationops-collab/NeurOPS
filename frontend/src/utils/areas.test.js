import { describe, it, expect, beforeEach, vi } from 'vitest';
import { areaPorDefecto, destinoDeEntrada, fijarAreaPorDefecto, opcionCambiarDeArea } from './areas';

const dir = { id: 7, role: 'director_comercial' };

describe('áreas al entrar', () => {
    beforeEach(() => localStorage.clear());

    it('un rol con varias áreas va a elegirla; con área por defecto, directo a ella', () => {
        expect(destinoDeEntrada(dir)).toBe('/inicio');
        fijarAreaPorDefecto(dir, 'agendamiento');
        expect(areaPorDefecto(dir)).toBe('agendamiento');
        expect(destinoDeEntrada(dir)).toBe('/agendas-v2');
        fijarAreaPorDefecto(dir, null);
        expect(destinoDeEntrada(dir)).toBe('/inicio');
    });

    it('el área por defecto es de cada rol: el mismo usuario como admin elige de nuevo', () => {
        fijarAreaPorDefecto(dir, 'direccion');
        expect(destinoDeEntrada({ ...dir, role: 'admin' })).toBe('/inicio');
    });

    it('un rol con una sola área (o simulando) entra a su pantalla de siempre', () => {
        expect(destinoDeEntrada({ id: 1, role: 'closer' })).toContain('/closer/deck');
        expect(destinoDeEntrada({ ...dir, is_impersonating: true })).toBe('/admin/comercial');
    });

    it('«Cambiar de área» lleva a elegir aunque haya un área por defecto', () => {
        const navigate = vi.fn();
        const [op] = opcionCambiarDeArea(dir, 'direccion', navigate);
        op.onClick();
        expect(navigate).toHaveBeenCalledWith('/inicio?elegir=1');
        expect(opcionCambiarDeArea({ id: 1, role: 'closer' }, 'x', navigate)).toEqual([]);
    });
});
