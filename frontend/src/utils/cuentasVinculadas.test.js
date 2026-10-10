import { describe, it, expect } from 'vitest';
import { otrasCuentas, rotuloDeRol, rolDeFinanzas, rolesDeLaCuenta, RUTA_FINANZAS, TITULO_FINANZAS } from './cuentasVinculadas';

const marlon = {
    id: 1, role: 'director_comercial',
    cuentas_vinculadas: [
        { id: 1, username: 'marlon_garcia', role: 'director_comercial', activa: true },
        { id: 2, username: 'marlon_closer', role: 'closer', activa: false },
    ],
};

describe('cuentas vinculadas', () => {
    it('las otras cuentas son las de la persona menos la activa, y ninguna simulando', () => {
        expect(otrasCuentas(marlon).map((c) => c.id)).toEqual([2]);
        expect(otrasCuentas({ ...marlon, is_impersonating: true })).toEqual([]);
        expect(otrasCuentas(null)).toEqual([]);
    });

    it('los roles de la cuenta, con el principal primero; sin lista, el activo', () => {
        expect(rolesDeLaCuenta({ role: 'closer', roles: ['admin', 'closer'] })).toEqual(['admin', 'closer']);
        expect(rolesDeLaCuenta({ role: 'closer' })).toEqual(['closer']);
    });

    it('rotula los roles y deja pasar los desconocidos', () => {
        expect(rotuloDeRol('director_comercial')).toBe('Dirección comercial');
        expect(rotuloDeRol('nuevo')).toBe('nuevo');
    });

    it('Finances entra con admin o dirección comercial, y solo con «ver finanzas»', () => {
        expect(rolDeFinanzas(['operator', 'admin'], true)).toBe('admin');
        expect(rolDeFinanzas(['director_comercial'], true)).toBe('director_comercial');
        // Con los dos, va con la dirección: el admin ya no es una vista (10/10/2026).
        expect(rolDeFinanzas(['operator', 'admin', 'director_comercial'], true)).toBe('director_comercial');
        expect(rolDeFinanzas(['operator', 'admin'], false)).toBeNull();
        expect(rolDeFinanzas(['closer', 'setter'], true)).toBeNull();
        expect(rolDeFinanzas(undefined, true)).toBeNull();
        expect([TITULO_FINANZAS, RUTA_FINANZAS]).toEqual(['Finances', '/finanzas']);
    });
});
